# MotionGen Animation Quality Improvement Plan

## 1. Current System Overview

- **High-level flow**
  - User sends a natural-language prompt (optionally with assets) to `/orchestrate` (`orchestratorServer.ts`).
  - `studioGraph` (`orchestrator.ts`) runs a LangGraph state machine with nodes:
    - **Director** → storyboard planning via `DirectorAgent` (`directorAgent.ts`).
    - **Animator** → MotionScript TypeScript generation via `AnimatorAgent` (`animatorAgent.ts`).
    - **Sandbox** → compile/execute MotionScript to Lottie JSON via `sandboxRunner.ts` + `sandbox-worker.ts`.
    - **Renderer** → sample frames via headless browser + `lottie-web` (`browserRenderer.ts`, `renderer.ts`).
    - **Critic** → visual QA via `CriticAgent` (`criticAgent.ts`) calling a vision model.

- **Director stage (storyboard)**
  - System prompt (`DIRECTOR_SYSTEM_PROMPT`) produces:
    - `vibe: string`
    - `colorPalette: string[]`
    - `timeline: string[]` where each entry is a **mini-DSL**:
      - `"t:start–end | layer:... | role:... | type:... | content:... | layout:... | motion:... | physics:... | notes:..."`
  - Complexity rules: ≥ 6–10 timeline entries, required background/midground/foreground layers, staggered groups, spring/easing usage, etc.

- **Animator stage (MotionScript codegen)**
  - `AnimatorAgent` builds a long system prompt (`ANIMATOR_SYSTEM_PROMPT_BASE + SDK interface + examples`), plus a user prompt containing:
    - Original user prompt (plus previous critique/errors if present).
    - Serialized storyboard JSON.
  - LLM outputs TypeScript using the **MotionScript SDK** abstraction:
    - `Stage.create(...)`, `stage.addText`, `stage.addShape`, `element.animate`, `stage.createGroup().stagger`, `Motion.spring`.
  - Runtime implementation lives in `motionscript.ts`, `Animation.ts`, `Layer.ts`, `shapes.ts`, `physics.ts`.

- **Sandbox, rendering, critic loop**
  - `runSandbox` executes LLM-generated TS in an isolated child process and returns Lottie JSON or compile/runtime errors.
  - `renderer` samples 3–7 frames across the animation duration using Puppeteer + `lottie-web`.
  - `CriticAgent` evaluates the sampled frames against the original prompt using a vision model and returns `CriticResult`:
    - `status: PASS|FAIL`, `score`, `issues[]`, `suggestion` (JSON).
  - `orchestrator.critic` collapses the result into a **single string** `critique: "ACCEPT/REJECT: <summary>"`.
  - `orchestrator.animator` feeds this `critique` plus any `errorLogs` back into the next call to `AnimatorAgent` as extra text appended to the prompt.
  - Graph loops back to `animator` on:
    - Sandbox errors (up to 5 attempts).
    - Critic `REJECT` (status ≠ PASS, up to 5 attempts).

- **MotionScript runtime constraints**
  - `Stage` currently supports:
    - `addText` (centered by default) and `addShape(type: 'circle' | 'rectangle', style)`.
    - A `MotionElement.animate({ props, spring?, delay? })` API.
  - `animate` implementation:
    - Uses **global animation duration** as the end time for most properties.
    - Uses `delay` only as a **start offset**, not as a per-phase duration window.
    - Ignores the `easing` field in the SDK interface (only `spring` is honored; non-spring is effectively linear/time-to-end).
  - SDK interface string (`sdk.ts` / `SDK_INTERFACE_DEFINITION`) is **richer** than the runtime:
    - Allows more shapes (`roundedRectangle`, `ellipse`, `polygon`, `star`) and more style & motion properties (`fillColor`/`color` animation, easing), which are not fully implemented in `motionscript.ts`.

---

## 2. Current Issues

### 2.1 Behavioral issues from logs and usage

Using the sample prompt **“ping pong game demonstration”**, the critic repeatedly reports:

- **Lack of semantic alignment** with the prompt:
  - Animations show “score display and paddles but no ball”, or only “ball and paddles but not effective gameplay”, or “static background color change” with no ping-pong context.
- **Overly simplistic compositions**:
  - Minimal shapes; flat scenes; almost no sense of environment (table, net, court) or clear gameplay.
  - Little to no midground/foreground depth beyond 1–2 key elements.
- **Motion that is either trivial or incoherent**:
  - Subtle or nearly static changes between sampled frames → critic flags lack of meaningful motion.
  - Motion that doesn’t obviously represent gameplay arcs (no clear ball trajectory, no timed paddle hits).

The retry loop simply regenerates a new MotionScript file from scratch, with the same storyboard and only free-form natural-language critique. The critic’s comments are descriptive but not structurally connected to specific objects or timeline segments, so the Animator LLM often repeats similar mistakes.

### 2.2 Representation gaps between prompt → storyboard → code

- **Storyboard timeline is a free-text mini-DSL**:
  - Implemented as plain `string[]` with no structured parsing or enforcement beyond the LLM’s own consistency.
  - Animator must re-parse each string, map it to coordinates, timings, and motion, and keep all that consistent with Stage duration and motion primitives.
  - There is no programmatic validation that:
    - All required roles (ball, paddles, table, etc.) actually get mapped to elements.
    - Timeline `t:start–end` intervals match what the MotionScript code actually animates.

- **No object-level or scene-graph representation**:
  - There is no explicit **scene graph** (objects, roles, relationships, motion tracks).
  - E.g. for ping pong, we would want something like:
    - `objects: [paddle_left, paddle_right, ball, table, net, score_text]` with positions and behaviors.
  - Currently, this semantics is only implicit in English inside `content`, `layout`, `motion`, `physics` fields.

- **No persistent semantics across retries**:
  - Each animator iteration regenerates the entire MotionScript file.
  - The system does not maintain a stable object identity or layout plan between attempts.
  - Critic feedback is not attached to specific objects or timeline segments; it’s just appended text.

### 2.3 MotionScript/SDK mismatch and limitations

- **SDK interface vs runtime implementation**:
  - SDK suggests support for rich shapes & color animations; runtime `Stage` only offers:
    - `ShapeType = 'circle' | 'rectangle'`.
    - Motion of `position`, `scale`, `opacity`, `rotation` (no actual color or easing handling).
  - LLM is encouraged to use rounded rectangles, ellipses, stars, color animation, easing curves, etc., but these either silently degrade or cause subtle runtime limitations.

- **Timeline semantics not expressible in MotionScript**:
  - Storyboard DSL uses `t:start–end` per entry, but `MotionElement.animate` only uses:
    - `delay` as a start offset.
    - End time = entire animation duration.
  - Multiple phases per element (intro, idle, outro) are hard to encode faithfully.
  - This makes it difficult for the Animator LLM to create clear beats like “ball enters, rally, score freeze frame” with distinct time windows.

- **Missing easing support in implementation**:
  - `MotionConfig` (SDK) has `easing?: Easing` but `motionscript.ts` ignores it.
  - All non-spring animations become effectively linear between start and end.
  - This limits the visual richness and physics nuance that the prompts encourage.

- **Limited layout primitives**:
  - `addText` and `addShape` always center by default; the LLM must manually manage all positions as absolute coordinates.
  - There are no helpers for common layouts (grids, columns, safe margins, anchoring, banners vs stories), increasing cognitive load and making complex compositions error-prone.

### 2.4 Critic & refinement loop limitations

- **Critic feedback is collapsed**:
  - Full `CriticResult` includes structured `issues[]` plus a `suggestion`.
  - `orchestrator.critic` reduces this to a single string `critique: "ACCEPT/REJECT: ..."`.
  - Animator sees this as paragraph text, not structured data.

- **No explicit mapping from feedback → changes**:
  - Critic instructions like “add more midground accents” or “ball is missing” are not tied to object IDs, layers, or timeline entries.
  - Animator must infer what to modify and usually re-creates everything from scratch.

- **Limited visual sampling**:
  - 3–7 frames sampled over the duration may miss critical parts of the motion (e.g. a single fast bounce).
  - Critic may see an unrepresentative snapshot and either over-reject or miss nuanced issues.

### 2.5 Generalization to varied prompt types

- The current prompts and DSL are mostly optimized for **generic motion graphics scenes** (text + abstract shapes).
- For prompts like:
  - Human-centric animations (characters, gestures).
  - UI or product demos.
  - Longer narrative sequences.
- There is no specialized modeling of:
  - Characters / rigs.
  - Camera movement.
  - Scene/shot breakdown (multi-shot stories).

---

## 3. Target Architecture for Higher-Quality, Goal-Aligned Animations

### 3.1 High-level goals

- **Stronger goal understanding**:
  - Explicitly represent what the animation is trying to show (e.g. gameplay loop, product usage, banner message) as structured data, not just prose.

- **Richer, more controllable motion**:
  - Support multiple timed motion phases per element with easing/springs.
  - Enable LLMs to express arcs, bounces, parallax, and secondary motion in an API-aligned way.

- **Robust refinement**:
  - Make critic feedback structured and directly actionable by the Animator.
  - Preserve scene structure between attempts and apply targeted edits instead of full regeneration.

- **Generalizable across prompt types**:
  - Introduce an **Animation Mode / Archetype layer** (banner, game demo, explainer, logo sting, etc.) so the system can pick different planning templates and expectations.

### 3.2 New intermediate representations

1. **Storyboard v2 (structured)**
   - Replace (or augment) the current string DSL with a structured schema:
     - `vibe: string`
     - `colorPalette: string[]`
     - `timeline: StoryboardBeat[]`
   - Example shape of `StoryboardBeat`:
     - `id: string`
     - `start: number`, `end: number`
     - `layer: 'background' | 'midground' | 'foreground'`
     - `role: 'main-text' | 'supporting-text' | 'paddle-left' | 'paddle-right' | 'ball' | ...`
     - `type: 'shape(rectangle)' | 'shape(circle)' | 'text(single-line)' | 'group(staggered-text)' | ...`
     - `content: string`
     - `layout: string` (still natural language but narrower)
     - `motion: string` (high-level description: “ball bounces between paddles along an arc”)
     - `physics: string` (weight, spring/easing hints)

2. **Scene Plan / Scene Graph**
   - Derived from Storyboard v2 (either by deterministic parser or an additional “ScenePlannerAgent”) into a more programmatic structure:
     - `ScenePlan` example:
       - `durationSeconds: number`
       - `mode: 'banner' | 'game-demo' | 'explainer' | 'logo-sting' | ...`
       - `objects: SceneObject[]` where each object has:
         - `id`, `role`, `kind: 'text' | 'shape' | 'character' | 'ui-element' | ...`
         - `shapeType` (rectangle/circle/etc), `style` (colors, sizes).
         - `keyframes: { t: number; position?: [x,y]; scale?: [sx,sy]; rotation?: number; opacity?: number; }[]`
         - Optional relationships (e.g. `parentId`, `followTargetId`, `pathId`).
       - `paths: Path[]` for arcs/orbits.
   - `ScenePlan` is **LLM-readable and machine-enforceable**.

3. **Animation Mode / Archetype**
   - Before or during storyboard planning, classify the prompt into an **animation mode**:
     - `mode: 'banner' | 'game-demo' | 'product-demo' | 'data-viz' | 'explainer' | 'loader/loop' | 'logo-sting' | 'character-moment' | ...`.
   - Each mode defines:
     - Typical layout patterns.
     - Required objects/roles.
     - Typical motion patterns.
     - Mode-specific validation rules and critic expectations.

### 3.3 Enhanced MotionScript layer

- **Align runtime with SDK interface**:
  - Implement missing shapes (roundedRectangle, ellipse, polygon, star) in `motionscript.ts` using `ShapeBuilder`.
  - Add color animation support in `MotionElement.animate` for `fillColor` and `color`.
  - Implement `easing?: Easing` mappings to underlying `Property`/keyframe interp.

- **Support explicit in/out times and local durations**:
  - Extend `MotionConfig` to accept `duration?: number` or `{ start: number; end: number; }`.
  - Update `MotionElement.animate` to:
    - Compute `startFrame` from `delay` or `start`.
    - Compute `endFrame` from `duration`/`end` instead of always using total animation duration.
    - Allow multiple non-overlapping phases per element.

- **Add layout helpers** (still simple but reduce LLM burden):
  - E.g. helper functions or methods accessible to LLM:
    - `placeInGrid(index, total, { margin })` → returns `[x, y]`.
    - `placeBanner(region: 'top' | 'bottom' | 'center')`.
    - `computeSafeTextPosition(rowIndex, totalRows)`.
  - Or encode canonical layout recipes directly into the Animator system prompt as “preferred patterns”.

- **Path-level helpers for arcs and orbits (optional later phase)**:
  - Introduce a primitive like `animateAlongArc(from, to, arcHeight, config)` built on top of existing `Property` APIs.
  - This matches storyboard commands like “ball moves along an arc between paddles”.

### 3.4 LLM prompt and agent improvements

- **Prompt classifier / mode selector**:
  - Add a lightweight `PromptClassifierAgent` (or reuse Director with a new method) that:
    - Takes user prompt + optional assets metadata.
    - Outputs `mode`, `targetDuration`, and some high-level constraints.

- **Storyboard v2 generation**:
  - Update Director prompt to:
    - Output **structured JSON** for `timeline` (StoryBoardBeat[]), rather than strings.
    - Keep the same conceptual fields but as JSON properties.

- **ScenePlan generation**:
  - Add a `ScenePlannerAgent` that:
    - Consumes Storyboard v2 + mode.
    - Outputs a `ScenePlan` object with explicit objects, styles, and keyframes.

- **Animator prompt simplification**:
  - Instead of asking Animator to parse a DSL string and re-interpret everything, provide:
    - `mode`.
    - `ScenePlan` JSON.
    - Reduced, more mechanical instructions like:
      - “For each SceneObject, create the corresponding MotionScript elements and animate them to match the keyframes and styles.”

- **Structured feedback from Critic to Animator**:
  - Extend `CriticResult` to support optional structured `fixes` (e.g. by referencing `objectId` or `role`):
    - Examples:
      - `{ target: { role: 'ball' }, action: 'add-or-strengthen', reason: 'ball missing or unclear' }`.
      - `{ target: { layer: 'background' }, action: 'increase-complexity', reason: 'background too flat' }`.
  - Pass the **raw JSON** `CriticResult` (not just human-readable string) into Animator’s user prompt.
  - Animator uses `ScenePlan + CriticResult` to apply targeted changes.

### 3.5 Refinement workflow

- **Shift from regenerate-everything to patch-based refinement**:
  - Introduce a `SceneRefinementAgent` or an Animator mode that:
    - Takes previous `ScenePlan` and `CriticResult`.
    - Outputs a **patch** (add/modify/remove objects, tweak keyframes).
  - Only after patching `ScenePlan` do we go from ScenePlan → MotionScript again.

- **Richer evaluation**:
  - Sample more frames for complex or long animations (e.g. 9–12 frames) while keeping compute bounded.
  - Optionally add a **non-LLM heuristic evaluator** for:
    - Minimum number of layers.
    - Minimum motion diversity (number of properties animated, keyframe counts).
    - Presence of required roles for each `mode` (e.g. ball + paddles for a game demo).

---

## 4. Transition Strategy (Incremental Path)

Given the existing codebase, a pragmatic migration is:

1. **Phase 0 – Observability & debugging**
   - Improve logging and tooling to inspect:
     - Actual storyboard JSON per run.
     - Generated MotionScript code.
     - Structural properties of resulting Lottie JSON (layers, shapes, motion keyframes).
   - This gives quick feedback while later phases roll out.

2. **Phase 1 – MotionScript & SDK alignment**
   - Align runtime capabilities (`motionscript.ts`) with the documented SDK interface (`sdk.ts`/`SDK_INTERFACE_DEFINITION`).
   - Add explicit support for timings, easing, more shapes, and color animation.
   - This immediately increases the expressiveness for existing prompts and LLM instructions.

3. **Phase 2 – Storyboard v2 and ScenePlan**
   - Introduce structured storyboard beats and a ScenePlan layer.
   - Keep backward compatibility by parsing old string DSL into the new structure.

4. **Phase 3 – Prompt modes and specialized planning**
   - Add prompt classification and per-mode planning templates.
   - Provide few-shot examples for common modes (banners, game demos, product demos, etc.).

5. **Phase 4 – Critic/Animator integration and refinement**
   - Change the critic output to stay structured.
   - Teach Animator/SceneRefinement to use structured feedback to apply targeted patches.

6. **Phase 5 – Generalization and domain extensions**
   - Add domain-specific conventions (e.g. character/human layouts, UI demos) on top of the same underlying representations.

---

## 5. Detailed Task List

### Phase 0 – Observability & Debugging

1. **Add storyboard logging and capture utilities**
   - **Files**: `backend/src/orchestrator.ts`, `backend/src/directorAgent.ts`.
   - **Work**:
     - Extend debug logging in `orchestrator.director` to include at least the first N timeline entries (or their count and a hash) in logs.
     - Optionally add a development-only flag to persist the latest storyboard JSON to disk (e.g. `./backend/screenshots/latest-storyboard.json`).
   - **Outcome**: You can see exactly how the Director interpreted the prompt.

2. **Add MotionScript capture**
   - **Files**: `backend/src/orchestrator.ts`, `backend/src/sharedApiTypes.ts`.
   - **Work**:
     - Ensure `StudioSummary.code` is populated and surfaced to the frontend for inspection.
     - Add a development endpoint or CLI to dump the MotionScript TS file for a given prompt to disk (e.g. `output/motionscript-latest.ts`).
   - **Outcome**: You can inspect actual LLM-generated code for failure examples.

3. **Add simple Lottie structural metrics**
   - **Files**: `backend/src/orchestrator.ts`, `backend/src/types.ts`, possibly a new `metrics.ts`.
   - **Work**:
     - After sandbox success, compute metrics:
       - Number of layers, distribution by type (shape/text/solid).
       - Number of keyframes per property (rough motion richness proxy).
     - Log these metrics and optionally expose them in `StudioSummary`.
   - **Outcome**: Quick signal for “too simplistic” before even calling the critic.

---

### Phase 1 – MotionScript & SDK Alignment

4. **Implement additional shapes in MotionScript**
   - **Files**: `backend/src/motionscript.ts`, `backend/src/shapes.ts`.
   - **Work**:
     - Extend `ShapeType` in `motionscript.ts` to match the SDK (`rectangle | roundedRectangle | circle | ellipse | polygon | star`).
     - Implement shape construction using `ShapeBuilder` variants for each type.
     - Ensure style fields (`cornerRadius`, `radiusX`, `radiusY`, `points`, `innerRadius`, `outerRadius`) are honored where applicable.
   - **Outcome**: LLM can use the richer shape vocabulary it is already instructed to use.

5. **Add color and easing animation support**
   - **Files**: `backend/src/motionscript.ts`, `backend/src/Property.ts`, `backend/src/physics.ts` (if needed).
   - **Work**:
     - Extend `MotionProps` in `motionscript.ts` to include `fillColor` and `color` aligned with SDK.
     - Implement keyframe generation for color properties:
       - Animate shape fill color and text color via corresponding `Property` APIs.
     - Implement handling of `easing?: Easing` (string or Bezier tuple) to map into internal keyframe easing curves.
   - **Outcome**: LLM instructions about easing and color animation become real, not no-ops.

6. **Support explicit durations in MotionScript animations**
   - **Files**: `backend/src/motionscript.ts`, possibly new types.
   - **Work**:
     - Extend `MotionConfig` to optionally accept:
       - `duration?: number` (seconds) or `{ start?: number; end?: number; }`.
     - Update `MotionElement.animate` to:
       - Compute `startFrame` from `delay` or provided `start`.
       - Compute `endFrame` from `startFrame + duration * fps` or from explicit `end`.
       - Use these for position/scale/opacity/rotation keyframes instead of always `getDurationSeconds()`.
   - **Outcome**: Animator can respect storyboard `t:start–end` windows more faithfully.

7. **Add simple layout helpers (optional but recommended)**
   - **Files**: `backend/src/motionscript.ts` or a small new helper module.
   - **Work**:
     - Design a few declarative helpers that do not require changes in the TypeScript signature seen by the LLM, e.g.:
       - Helper functions (not exported via SDK) that Animator examples can call internally to compute coordinates for:
         - Centered upper third / lower third.
         - Left/right columns.
         - Grids.
     - Update Animator few-shot examples to use these helpers so LLM learns patterns.
   - **Outcome**: Complex layouts become more reliable and less numerically brittle.

---

### Phase 2 – Storyboard v2 and ScenePlan

8. **Introduce typed storyboard beats**
   - **Files**: `backend/src/directorAgent.ts`, `backend/src/sharedApiTypes.ts`, new `backend/src/storyboardTypes.ts`.
   - **Work**:
     - Define TypeScript interfaces for `StoryboardBeat` and `StoryboardV2`.
     - Keep the current `Storyboard` interface but add a new field or a sibling type that holds structured beats.
     - Update `DIRECTOR_SYSTEM_PROMPT` to output fully structured JSON for beats, not plain strings.
     - Implement a migration parser that can:
       - Parse existing string DSL timeline entries into `StoryboardBeat`.
       - This allows gradual rollout without breaking existing runs.
   - **Outcome**: Storyboard information becomes machine-readable and testable.

9. **Create a ScenePlan model**
   - **Files**: new `backend/src/scenePlan.ts`.
   - **Work**:
     - Define `ScenePlan`, `SceneObject`, and related types described above.
     - Include metadata for mode, duration, objects, keyframes, and optional paths.
   - **Outcome**: Central place to represent the animation that is independent of any given LLM.

10. **Add a ScenePlannerAgent**
    - **Files**: new `backend/src/scenePlannerAgent.ts`, updates in `backend/src/orchestrator.ts`.
    - **Work**:
      - Implement `ScenePlannerAgent` that:
        - Takes `StoryboardV2` + user prompt + mode.
        - Outputs a `ScenePlan` JSON.
      - Write a focused system prompt:
        - Emphasize mapping roles to concrete objects.
        - Require keyframes and object IDs.
      - Integrate into the graph:
        - Either as a new node between Director and Animator.
        - Or as a method on Director that returns both storyboard and scene plan.
    - **Outcome**: Animated scenes become object-based and inspectable before codegen.

11. **Update AnimatorAgent to consume ScenePlan**
    - **Files**: `backend/src/animatorAgent.ts`.
    - **Work**:
      - Modify `buildAnimatorUserPrompt` to:
        - Include `ScenePlan` JSON (and optionally still include storyboard).
        - Clarify that the LLM should mostly **translate** ScenePlan→MotionScript, not invent new structure.
      - Adjust instructions to rely less on parsing free-text timeline strings.
    - **Outcome**: Animator’s job becomes more mechanical and reliable.

12. **Add validation for ScenePlan → MotionScript consistency**
    - **Files**: new `backend/src/sceneValidation.ts`, `backend/src/orchestrator.ts`.
    - **Work**:
      - Implement simple checks:
        - Every `SceneObject` results in at least one Lottie layer.
        - Keyframe counts and time ranges roughly match those in the ScenePlan.
      - Optionally run this validation after sandbox and log discrepancies.
    - **Outcome**: Early detection of LLM ignoring parts of the plan.

---

### Phase 3 – Prompt Modes and Specialized Planning

13. **Implement PromptClassifierAgent / mode detection**
    - **Files**: new `backend/src/promptClassifierAgent.ts`, `backend/src/orchestrator.ts`.
    - **Work**:
      - Define a small LLM agent that:
        - Reads user prompt + brief guidance.
        - Outputs `mode`, `targetDuration`, and flags (e.g. `requiresCharacters`, `uiDemo`, `gameplay`, `banner`).
      - Integrate it as the first node in the graph, storing results in state.
    - **Outcome**: Global decisions can adapt to the type of request.

14. **Mode-aware Director and ScenePlanner behavior**
    - **Files**: `backend/src/directorAgent.ts`, `backend/src/scenePlannerAgent.ts`.
    - **Work**:
      - Update prompts to branch on `mode`:
        - For `game-demo`: insist on clear objects for players, ball, playfield, score.
        - For `banner`: emphasize text hierarchy and brand-like layout.
        - For `product-demo`: emphasize UI panels, device frames, interactions.
      - Add mode-specific complexity rules and required roles to prompts.
    - **Outcome**: Storyboards and scene plans become more semantically appropriate.

15. **Add few-shot examples per mode**
    - **Files**: `backend/src/animatorAgent.ts`, new prompt resource files under `backend/src/prompts/`.
    - **Work**:
      - Create compact examples of ScenePlan → MotionScript for:
        - A banner.
        - A simple game demo (e.g. ping pong).
        - A product or UI demo.
      - Inject these into Animator’s system prompt under a `# EXAMPLES` section.
    - **Outcome**: LLM has concrete templates for complex domain-specific scenes.

---

### Phase 4 – Critic/Animator Integration and Structured Refinement

16. **Expose full CriticResult to orchestrator state**
    - **Files**: `backend/src/criticAgent.ts`, `backend/src/orchestrator.ts`, `backend/src/sharedApiTypes.ts`.
    - **Work**:
      - Add optional `criticResult?: CriticResult` to `StudioStateValue` / `StudioSummary`.
      - In `orchestrator.critic`, store the **entire** `CriticResult` object rather than just a string.
      - Keep `critique` string for backwards compatibility/UX, but don’t lose structured data.
    - **Outcome**: Animator/SceneRefinement can consume structured feedback.

17. **Extend Critic prompt to optionally emit structured fixes**
    - **Files**: `backend/src/criticAgent.ts`.
    - **Work**:
      - Update `CRITIC_SYSTEM_PROMPT` to describe an optional `fixes` array:
        - Each fix references `role`, `layer`, or `objectId` when available.
        - Explicitly request targeted suggestions (“add ball object with clear motion arc between paddles”, etc.).
      - Update `CriticResult` type to include `fixes?: CriticFix[]`.
    - **Outcome**: Feedback becomes more precise and machine-usable.

18. **Add SceneRefinementAgent (patching ScenePlan)**
    - **Files**: new `backend/src/sceneRefinementAgent.ts`, updates to `backend/src/orchestrator.ts`.
    - **Work**:
      - Define an agent that:
        - Takes previous `ScenePlan` + `CriticResult`.
        - Emits a **patch object** (add/modify/remove objects, adjust keyframes).
      - Apply this patch to the existing ScenePlan before regenerating MotionScript.
      - Limit retries to a few iterations, similar to current loop.
    - **Outcome**: Refinement becomes localized instead of full regeneration.

19. **Update Animator to use CriticResult and patches**
    - **Files**: `backend/src/animatorAgent.ts`.
    - **Work**:
      - When re-running after a critic fail, provide:
        - Updated ScenePlan.
        - Raw `CriticResult` JSON in the prompt.
      - Clarify instructions to follow ScenePlan and apply described fixes.
    - **Outcome**: Animator corrections become tightly guided by critic feedback.

20. **Improve frame sampling strategy for critic**
    - **Files**: `backend/src/orchestrator.ts`, `backend/src/browserRenderer.ts`.
    - **Work**:
      - For longer scenes or high-motion modes, sample more timestamps (e.g. 7–9) with slight concentration around anticipated action windows (mid-timeline).
      - Optionally allow mode-specific sampling strategies (e.g. more frames during gameplay section).
    - **Outcome**: Critic sees a more representative set of frames.

---

### Phase 5 – Generalization & Domain Extensions

21. **Define domain-specific conventions and modes**
    - **Files**: `backend/src/promptClassifierAgent.ts`, `backend/src/scenePlannerAgent.ts`, prompt resources.
    - **Work**:
      - For each new domain (characters, UI demos, data viz, etc.), define:
        - Canonical roles (e.g. `character-main`, `ui-panel`, `chart-line`).
        - Typical motion patterns (walk cycles, hover states, metric changes).
      - Encode these in prompts and ScenePlan schemas.
    - **Outcome**: System can intelligently adapt layouts and motions per domain.

22. **Add unit and golden tests for critical flows**
    - **Files**: `backend/src/tests/*.ts`, `backend/golden_tests/*`.
    - **Work**:
      - Add tests that:
        - Run the full orchestrator for representative prompts in each mode.
        - Assert basic structural metrics (layer count, presence of key roles, non-trivial motion).
        - Optionally compare rendered frames against golden images within tolerance.
    - **Outcome**: Prevent regressions and track quality improvements over time.

23. **Document developer workflows and tuning knobs**
    - **Files**: `backend/README.md`, `docs/*.md`.
    - **Work**:
      - Document:
        - How to run orchestrator and inspect storyboard/ScenePlan/MotionScript.
        - How to tweak critic thresholds, max attempts, modes.
        - How to add new domain modes and few-shot examples.
    - **Outcome**: Future contributors can evolve the system without re-discovering design intent.

---

## 6. Expected Impact

- **More sophisticated, semantically aligned animations**:
  - Objects and motions will correspond directly to user concepts (e.g. paddles + ball + table for a ping pong demo), not just abstract shapes.

- **Richer motion and composition**:
  - Better use of layering, springs, easing, and staged timelines once MotionScript supports the SDK’s full expressiveness.

- **Scalable to many prompt types**:
  - Prompt modes and ScenePlan make it possible to support banners, game demos, product demos, and character moments with tailored behaviors.

- **More effective refinement loop**:
  - Critic feedback becomes structured and targeted, enabling incremental improvements instead of repeated, similar failures.
