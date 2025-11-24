This is a comprehensive technical roadmap designed to be fed into an **AI Coder** (like Cursor, Windsurf, or a custom agent). It breaks down the **MotionGen V3** architecture into executable tasks.

### Architectural Preamble for AI Coder
* **Goal:** Build a text-to-Lottie generation engine.
* **Core Logic:** LLMs generate TypeScript code using a custom SDK; this code runs in a sandbox to produce Lottie JSON.
* **Groq Model Mapping:**
    * **Logic/Coding:** `GPT OSS 120B 128k` (Used for the Director and Animator agents).
    * **Routing/Fast Parsing:** `GPT OSS 20B 128k` (Used for safety checks and simple intent extraction).
    * **Vision/QA:** `meta-llama/llama-4-scout-17b-16e-instruct` (Used for visual verification of frames).

---

## Phase 1: The Core Foundation (MotionScript SDK)
**Context:** We cannot let the LLM write raw Lottie JSON. We need a type-safe TypeScript abstraction layer (DSL) that handles the complex math.

### Task 1.1: Build the Lottie JSON Builder
* **Description:** Create a TypeScript class structure that maps to the Lottie Schema (bodymovin).
* **Technical Details:**
    * Create classes: `Animation`, `Layer` (Shape, Text, Image), `Property` (Position, Scale, Opacity).
    * Implement a `.toJSON()` method on the root class that outputs strictly valid Lottie JSON.
    * **Critical:** Do not rely on external DOM dependencies (window, document). This must run in a pure Node.js environment.
* **Groq Usage:** None (Pure Typescript).
* **Verification:** Write a unit test that instantiates a simple red rectangle, exports JSON, and validates it against the official [Lottie Schema](https://lottiefiles.github.io/lottie-docs/schema/).

### Task 1.2: Implement Physics & Easing Engine
* **Description:** Implement spring physics math to convert user-friendly configs (stiffness, damping) into keyframes.
* **Technical Details:**
    * Port a spring solver (like `wobble` or `react-spring` logic) to raw TypeScript.
    * Create a function `generateKeyframes(start, end, physicsConfig, fps)` that returns an array of time/value pairs.
    * Standardize easing curves (Cubic Bezier) support.
* **Verification:** Generate a JSON where a circle moves from X=0 to X=100 using `stiffness: 200`. Load the JSON in a Lottie player; the circle should overshoot and settle (bounce), not move linearly.

### Task 1.3: The "MotionScript" High-Level API
* **Description:** Create the actual API the LLM will use. It acts as a wrapper around 1.1 and 1.2.
* **Technical Details:**
    * **Namespace:** `import { Stage, Motion } from '@motiongen/sdk'`
    * **Methods to build:**
        * `stage.addText(content, style)`
        * `stage.addShape(type, style)`
        * `element.animate({ props, spring, delay })`: This must handle the logic of calculating start times based on delay.
        * `group.stagger(elements, config)`: Helper to apply incremental delays.
* **Verification:** Manually write a 10-line script using this SDK that creates a staggered text reveal. Compile it. Ensure the output Lottie JSON works.

---

## Phase 2: The Execution Sandbox (Backend)
**Context:** We need a safe place to run the LLM-generated code and a way to "see" it.

### Task 2.1: Secure Node.js Sandbox Service
* **Description:** Set up a secure runner that accepts a string of code and returns Lottie JSON.
* **Technical Details:**
    * Use `vm2` or `isolated-vm` in Node.js.
    * **Hard Limits:** 500ms execution timeout, 256MB RAM limit (prevents infinite loops).
    * Inject the SDK (from Phase 1) into the VM context.
    * **Input:** TypeScript string. **Output:** JSON object or Error Trace.
* **Verification:** Send a script `while(true){}` to the endpoint; it must return a 408 Timeout, not crash the server.

### Task 2.2: Headless Renderer (The "Eyes")
* **Description:** A service that takes Lottie JSON and outputs PNG buffers.
* **Technical Details:**
    * Use `skia-canvas` or `puppeteer` with `lottie-web`.
    * Endpoint: `POST /render-frames`.
    * Input: `lottie_json`, `timestamps: [0, 1.5, 3.0]`.
    * Output: Array of Base64 Images.
* **Verification:** Send a valid Lottie file. Receive 3 distinct PNGs showing the animation progression.

---

## Phase 3: The Intelligence Layer (Groq Agents)
**Context:** Building the Brains using the specific Groq models.

### Task 3.1: The Director Agent (Planner)
* **Description:** Analyzes the prompt and outputs a "Storyboard" JSON.
* **Technical Details:**
    * **Model:** `GPT OSS 120B 128k`.
    * **System Prompt:** "You are an Art Director. Output JSON defining the 'Vibe', 'Color Palette' (Hex codes), and 'Timeline' (Beat sheet)."
    * **Constraint:** Force JSON mode.
* **Verification:** Input "Spooky Halloween Sale". Check if output contains dark colors (Purples/Oranges) and a timeline mentioning "ghostly fading."

### Task 3.2: The Animator Agent (Coder)
* **Description:** Translates the Director's Storyboard into MotionScript SDK code.
* **Technical Details:**
    * **Model:** `GPT OSS 120B 128k`.
    * **Context Injection:** You must inject the *Interface Definition* (`.d.ts` file) of the Phase 1 SDK into the system prompt so the model knows available functions.
    * **Prompt Strategy:** "You are a TypeScript expert. Use the provided SDK. Do not use external libraries. Return only code."
* **Verification:** Feed the "Halloween" storyboard from 3.1. The agent should output valid TypeScript code calling `stage.addText()` and `Motion.spring()`.

### Task 3.3: The Critic Agent (Visual QA)
* **Description:** Looks at the frames from Task 2.2 and judges quality.
* **Technical Details:**
    * **Model:** `meta-llama/llama-4-scout-17b-16e-instruct` (Groq Vision).
    * **Input:** The 3 PNG snapshots + The original User Prompt.
    * **Prompt:** "Does the text contrast well with the background? Is any text cut off? Does the vibe match '[User Prompt]'? Reply JSON: { pass: boolean, critique: string }."
* **Verification:** Intentionally create a Lottie with black text on a black background. Send to Critic. It must return `pass: false` and complain about legibility.

---

## Phase 4: Orchestration (The Glue)

### Task 4.1: LangGraph State Machine
* **Description:** Connect the agents in a loop.
* **Technical Details:**
    * **State Object:** `{ prompt, storyboard, code, lottie_json, error_logs, attempt_count }`.
    * **Flow:**
        1.  `Director` -> generates storyboard.
        2.  `Animator` -> generates code.
        3.  `Sandbox` -> compiles code. (If error -> go back to Animator with error log).
        4.  `Renderer` -> makes images.
        5.  `Critic` -> reviews images. (If fail -> go back to Animator with critique).
        6.  End.
* **Verification:** Run an end-to-end request. Inspect logs to see the loop handle a syntax error (simulated) and self-correct.

### Task 4.2: Asset Processor
* **Description:** Handle user uploads (SVG/Images).
* **Technical Details:**
    * **Model:** `GPT OSS 20B` (for SVG analysis).
    * Sanitize uploaded SVGs (remove scripts).
    * Use 20B model to identify layer IDs in SVG (e.g., "Which ID is the 'wheel'?").
* **Verification:** Upload a complex SVG logo. System should identify groups and expose them to the Animator agent context.

---

## Phase 5: Frontend (The Studio)

**Global Technical Context for AI Coder:**
* **Framework:** Next.js 16 (App Router).
* **Language:** TypeScript (Strict Mode).
* **Styling:** Tailwind CSS + `shadcn/ui` components.
* **State:** `zustand` (Global Client State).
* **Icons:** `lucide-react`.

---

### Task 5.1: Project Scaffold & Global State Store
**Goal:** Initialize the Next.js application, install UI dependencies, and create the central data store that will hold the "Brain" of the application.
**Description:** Set up a clean Next.js 15 project. Install `shadcn/ui` (button, scroll-area, tabs, card). Create a `zustand` store to manage the application state (Code, Logs, Storyboard).

**Technical Specs:**
* Initialize `next-app` with TypeScript/Tailwind/ESLint.
* **Store Definition (`src/store/studioStore.ts`):**
    * `logs`: Array of `{ source: 'Director'|'Animator'|'Critic', message: string, timestamp: number }`.
    * `code`: String (current TypeScript SDK code).
    * `lottieJson`: Object (current compiled animation).
    * `storyboard`: Object (current Director plan).
    * `isStreaming`: Boolean.
    * Actions: `addLog`, `setCode`, `setLottie`, `setStoryboard`.

**Files to Create:**
* `src/store/studioStore.ts`
* `src/components/ui/...` (Shadcn components)

**Verification:**
1.  Run `npm run dev`.
2.  Create a temporary `<TestComponent />` that calls `useStudioStore`.
3.  Click a button to add a mock log.
4.  **Expectation:** The log count increases in the UI, confirming Zustand is working.

---

### Task 5.2: The Resizable "Mosaic" Layout
**Goal:** Implement the "Three-Pane" IDE layout using `react-resizable-panels`.
**Description:** Create the main page layout. It must support resizing between the **Left** (Director/Logs), **Center** (Stage), and **Right** (Code/Controls) panels.

**Technical Specs:**
* Use `react-resizable-panels`.
* **Structure:**
    * Horizontal Group.
    * Panel 1 (Left): default size 20%.
    * Handle.
    * Panel 2 (Center): default size 50%.
    * Handle.
    * Panel 3 (Right): default size 30%.
* Persist layout to `localStorage` (built-in feature of the library).

**Files to Create:**
* `src/app/page.tsx` (Main layout implementation).
* `src/components/studio/StudioLayout.tsx`.

**Verification:**
1.  Render the page with colored placeholders in each panel (Red/Green/Blue).
2.  Drag the borders.
3.  Refresh the page.
4.  **Expectation:** The panels should remain at the resized positions after refresh.

---

### Task 5.3: Left Pane - The "Thought Stream" (SSE Log Terminal)
**Goal:** Build the visual interface for the AI Agents' "thought process."
**Description:** A scrollable terminal view. As logs arrive in the Zustand store, they should appear here. It needs auto-scroll-to-bottom functionality.

**Technical Specs:**
* **UI:** `ScrollArea` (shadcn).
* **Styling:**
    * Director logs: Blue accent.
    * Animator logs: Green accent (monospace font for code snippets).
    * Critic logs: Red accent.
* **Auto-Scroll:** Use a `useRef` on the viewport end to scroll into view when `logs` array changes.

**Files to Create:**
* `src/components/studio/LogTerminal.tsx`.
* `src/hooks/useAutoScroll.ts`.

**Verification:**
1.  Use the `TestComponent` from Task 5.1 to push 20 logs rapidly.
2.  **Expectation:** The view should automatically scroll to keep the newest log visible.
3.  **Expectation:** Logs should be color-coded by source.

---

### Task 5.4: Right Pane - Monaco Editor with SDK Injection
**Goal:** Embed VS Code (Monaco) into the browser to display the generated code. Crucially, it must know our "Motion SDK" types.
**Description:** Integrate `@monaco-editor/react`. Configure it to be read-only by default (but unlockable). Inject a mock `.d.ts` definition string so the editor highlights our `stage.addText()` functions correctly.

**Technical Specs:**
* **Library:** `@monaco-editor/react`.
* **Theme:** 'vs-dark'.
* **Type Injection:** On mount, use `monaco.languages.typescript.javascriptDefaults.addExtraLib(SDK_TYPES, 'sdk.d.ts')`.
    * *Mock SDK Type:* `declare class Stage { addText(s:string): void; render(): void; }`
* **State Sync:** Bind the editor content to `studioStore.code`.

**Files to Create:**
* `src/components/studio/CodeEditor.tsx`.
* `src/lib/sdk-definitions.ts` (The string containing our type definitions).

**Verification:**
1.  Open the editor.
2.  Type `stage.`.
3.  **Expectation:** IntelliSense should pop up showing `.addText()` and `.render()`.
4.  **Expectation:** Syntax highlighting should work for TypeScript.

---

### Task 5.5: Center Pane - Lottie Player & Scrubber
**Goal:** Render the Lottie JSON and provide frame-perfect control.
**Description:** Implement `lottie-react`. Do *not* use the default controls. Build a custom timeline bar (Slider) that scrubs through the animation frames.

**Technical Specs:**
* **Library:** `lottie-react`.
* **Ref Handling:** Use `lottieRef.current.goToAndStop(frame, true)` for scrubbing.
* **UI:**
    * Play/Pause button (`lucide-react` icons).
    * `Slider` (shadcn) representing 0% to 100% of animation.
    * Time display: `00:02 / 00:05`.

**Files to Create:**
* `src/components/studio/StagePlayer.tsx`.
* `src/components/studio/TimelineControls.tsx`.

**Verification:**
1.  Load a sample Lottie JSON into `studioStore.lottieJson`.
2.  Press Play. **Expectation:** Animation plays.
3.  Drag Slider to middle. **Expectation:** Animation freezes at exact middle frame.

---

### Task 5.6: Center Pane - The "Critic" Overlay
**Goal:** Visualize the AI Critic's feedback directly on the canvas.
**Description:** Create an overlay layer on top of the Lottie player. It renders bounding boxes (divs with red borders) based on specific coordinates, mimicking "computer vision" debugging tools.

**Technical Specs:**
* **Coordinate System:** The Critic returns 0-1 normalized coordinates (e.g., `x: 0.5, y: 0.5`). Map these to the container's pixel width/height.
* **Component:** `CriticOverlay.tsx`. Accepts an array of `{ rect: [x,y,w,h], message: string }`.
* **Interaction:** Hovering the red box shows a Tooltip with the `message`.

**Files to Create:**
* `src/components/studio/CriticOverlay.tsx`.

**Verification:**
1.  Hardcode a bounding box `{ rect: [0.1, 0.1, 0.2, 0.2], message: "Low Contrast" }`.
2.  **Expectation:** A red box appears in the top-left corner (10% offset).
3.  **Expectation:** Hovering the box reveals "Low Contrast".

---

### Task 5.7: Server-Sent Events (SSE) Hook
**Goal:** Connect the frontend to the backend stream.
**Description:** Create a custom React hook `useAgentStream(sessionId)`. It connects to `/api/stream`, listens for message events, and dispatches them to the `studioStore`.

**Technical Specs:**
* Use native `EventSource` API.
* **Event Handling:**
    * `onmessage`: Parse JSON.
    * If `type === 'log'`, call `addLog`.
    * If `type === 'code_update'`, call `setCode`.
    * If `type === 'lottie_update'`, call `setLottie`.
* Handle connection cleanup (close on unmount).

**Files to Create:**
* `src/hooks/useAgentStream.ts`.

**Verification:**
1.  Create a dummy Next.js API route `/api/stream/test` that sends a message every second.
2.  Connect the hook.
3.  **Expectation:** The UI log terminal updates automatically every second without page refresh.

---

### Task 5.8: Telemetry & The "Glass Box" Experiment
**Goal:** Instrument the UI to track user behavior for the A/B test.
**Description:** Add analytics tracking to key events. Wrap the UI in a Logic Toggle that can hide/show the "Glass Box" features (Logs/Code) based on a feature flag.

**Technical Specs:**
* **Analytics:** Create a `trackEvent(name, properties)` utility (mock implementation simply logging to console is fine for now).
* **Events to Track:**
    * `code_editor_focus` (User intends to edit).
    * `scrubber_interaction` (User is inspecting).
    * `generation_complete_view_time` (Time spent looking at result).
* **Feature Flag:** `const showGlassBox = useFeatureFlag('glass-box-mode')`.
    * If `false`, hide Left Pane and Right Pane, center the Stage.

**Files to Create:**
* `src/lib/telemetry.ts`.
* `src/hooks/useFeatureFlag.ts` (Mock implementation).

**Verification:**
1.  Set flag to `false`. **Expectation:** Only the Lottie Player is visible (Simple Mode).
2.  Set flag to `true`. **Expectation:** Full IDE is visible.
3.  Click the code editor. **Expectation:** Console logs `[Telemetry] code_editor_focus`.