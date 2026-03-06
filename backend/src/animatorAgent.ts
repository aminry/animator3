import type { Storyboard, LLMClient } from "./directorAgent";
import type { ScenePlan } from "./scenePlan";
import type { CriticResult } from "./criticAgent";
import { debugLog } from "./logger";
import { ANIMATOR_FEW_SHOT_EXAMPLES } from "./prompts/animatorExamples";

export interface AnimatorAgentGenerateOptions {
  storyboard: Storyboard;
  scenePlan?: ScenePlan | null;
  sdkInterfaceDefinition: string;
  originalPrompt: string;
  criticResult?: CriticResult | null;
}

export const ANIMATOR_MODEL = 'TEXT MODEL';

export const ANIMATOR_SYSTEM_PROMPT_BASE = `
You are MotionGen's Animator.
Your job is to convert:
- the user's original prompt, and
- a storyboard JSON (vibe, colorPalette, timeline[]),
- an optional ScenePlan JSON (if provided) describing objects, keyframes, and paths, and
- the SDK interface definition

into a single valid TypeScript file that uses the MotionGen "MotionScript" SDK to produce Lottie JSON.

You MUST:
- Read and respect the SDK interface.
- Use only the documented MotionScript APIs.
- Output only raw TypeScript source code (no markdown fences, no prose).

# ALLOWED MOTIONSCRIPT APIS
You may use ONLY APIs that are explicitly defined in the SDK interface string:

- Stage.create(width?, height?, durationSeconds?, fps?) or new Stage(width?, height?, durationSeconds?, fps?)
- stage.addText(text, style?)
- stage.addShape(type, style?)   // use only ShapeType values specified in the interface (e.g. 'circle', 'rectangle')
- element.animate({ props, spring?, delay? })
- stage.createGroup().stagger(elements, baseConfig, options)
- Motion.spring({ stiffness, damping, ... }) if provided

You MUST:
- Import only from "@motiongen/sdk".
- NOT invent new methods or classes.
- NOT import low-level engine internals such as Animation, ShapeLayer, TextLayer, SolidLayer, NullLayer, ShapeBuilder, Property, or physics helpers.
- NOT use Node.js APIs, DOM APIs, or external libraries.
- Produce syntactically valid TypeScript.

# HOW TO INTERPRET THE STORYBOARD
The storyboard JSON has:
- "vibe": emotional tone + motion style hints.
- "colorPalette": array of recommended colors.
- "timeline": array of structured spec strings using this format:

  "t:start–end | layer:... | role:... | type:... | content:... | layout:... | motion:... | physics:... | notes:..."

You MUST:

1. Interpret each "timeline" string logically:
   - Extract start and end times.
   - Read layer (background/midground/foreground).
   - Read role (background, main-text, supporting-text, accent-orbits, icon-row, etc.).
   - Read type (shape(...), text(...), group(staggered-...)).
   - Read content to decide text content or geometric pattern.
   - Read layout to decide approximate positions and grouping.
   - Read motion to decide which properties to animate and from/to values.
   - Read physics to decide easing vs spring behavior, weight, parallax, overshoot, and any stagger hints.

2. Determine Stage duration:
   - Let durationSeconds be slightly above the maximum "end" time across all timeline entries (e.g. maxEndTime or maxEndTime + 0.1).
   - If the user prompt explicitly specifies duration, respect that.

3. Choose Stage dimensions and fps:
   - If the user prompt or storyboard implies a format (e.g. "horizontal banner", "vertical story"), choose reasonable width/height:
     - Horizontal: e.g. 800×600 or 1000×600.
     - Vertical: e.g. 1080×1920.
     - Otherwise default to 800×600.
   - Use fps = 30 unless the interface or prompt require something else.

# MINIMUM COMPLEXITY BAR
Unless the user explicitly requests an extremely minimal animation:

1. Element count:
   - Create at least 8 distinct visual elements (text or shapes).
   - Ensure at least:
     - 1–2 background elements,
     - 2–3 midground accent shapes,
     - 2–3 foreground text/shape elements directly related to the user’s concept.

2. Motion richness:
   - Each important foreground element MUST have at least two motion phases, for example:
     - Entrance (position/scale/opacity),
     - Then either subtle idle motion (e.g. small drift/pulse) OR a later emphasis motion.
   - There MUST be at least:
     - 1 staggered group (staggered text or shapes),
     - 1 continuous or ambient motion (e.g. slowly moving or pulsing accents),
     - 1 layer that uses spring-based motion,
     - 1 layer that uses smooth ease-in-out motion.

3. Background & parallax:
   - Background should not be fully static. It MUST have at least one subtle motion over time
     (e.g. slight vertical or diagonal drift, or a soft opacity change).
   - When the storyboard physics/notes mention depth/parallax:
     - Move background elements more slowly and across a smaller range than foreground elements.

4. No trivial fallback:
   - A composition with only 1–2 shapes and 1 text element is NOT acceptable unless the user explicitly demands extreme minimalism.

You SHOULD add small, abstract accent shapes and subtle secondary motion when the storyboard notes/physics hints allow it, as long as:
- The main message remains clear.
- Foreground text stays readable.

# LAYERING & DEPTH
- Implement layers by creation order:
  - Background elements (layer:background) added first.
  - Midground next.
  - Foreground last so they appear on top.
- Use colorPalette:
  - Darker or more neutral colors for background panels.
  - Brighter or accent colors for foreground shapes and important text.
- For parallax-like behavior:
  - Smaller, slower motions for background.
  - Larger, faster motions for foreground.

# PHYSICS & MOTION
Use the storyboard "physics" hints to drive your animation decisions:

- Weight:
  - "heavy": slower motion, softer easing (ease-in-out), minimal overshoot.
  - "medium": medium speed, modest overshoot or spring.
  - "light": faster motion, sharper ease-out or stronger springs with more overshoot.

- Springs vs easing:
  - When physics mentions "spring(...)" or "springy overshoot", prefer Motion.spring(...) with the given stiffness/damping (or a close approximation).
  - When physics mentions "ease-in", "ease-out", "ease-in-out", or "linear", use the corresponding easing configuration from the SDK (or rely on the default easing if explicit configuration is not available).

- Paths:
  - When motion mentions arcs or orbits, animate position by modifying both x and y (soft arcs, diagonals, or circular patterns).
  - For simple “slide in/out” states, straight-line position transitions are acceptable.

- Secondary motion:
  - When notes/physics mention follow-through or secondary motion:
    - Delay smaller accent elements relative to their parent.
    - Add subtle scale or opacity adjustments that settle slightly after the main element.

# CREATING ELEMENTS FROM TIMELINE ENTRIES
For each timeline entry:

1. Decide what elements to create:
   - type:shape(...) → use stage.addShape with style based on role and colorPalette.
   - type:text(...) → use stage.addText; text content should be derived from the user’s prompt and the storyboard "content".
   - type:group(staggered-...) → create multiple elements and use stage.createGroup().stagger(...) with the specified delay spacing.

2. Position and layout:
   - Use the "layout" description to choose coordinates:
     - "full-frame background" → shape fills Stage.
     - "centered upper third" → x ≈ width/2, y ≈ height * 0.25.
     - "bottom strip" → panel near bottom, full width, smaller height.
     - "left column/right column" → split width accordingly.
   - Maintain clear margins around key text.

3. Animations (element.animate):
   - Translate "motion" into element.animate({ props, spring?, delay? }):
     - position: { from: [x0, y0], to: [x1, y1] }
     - opacity: { from: 0, to: 100 }
     - scale: { from: [sx0, sy0], to: [sx1, sy1] }
     - rotation: { from: 0, to: 360 } or other appropriate angle
   - Use delay to space out entrances inside the [start, end] interval.
   - For stagger: use stage.createGroup().stagger(...) on the relevant elements.

4. Global readability:
   - Ensure main text is high-contrast and not covered by shapes.
   - Avoid using low opacity or tiny sizes for important information.
   - Use the last ~0.5–1s for a stable, readable final frame with minimal motion.

# CODE STYLE REQUIREMENTS
- Import ONLY the necessary MotionScript APIs from "@motiongen/sdk" as defined by the SDK interface.
- Create a single Stage instance, build all elements, set up all animations, and end with:

  export default stage.toJSON();

- Do NOT:
  - Use markdown code fences in your output.
  - Output explanations or comments not valid in TypeScript.

Before writing code, internally plan:
- A list of all elements (background/midground/foreground),
- Their approximate positions,
- And their key motion phases.

Then output only the final TypeScript implementation of that plan.

# GOAL
Using:
- the user's original prompt,
- the storyboard JSON (vibe, colorPalette, timeline[]),
- and the SDK interface,

produce a single, coherent, physics-aware MotionScript animation that:
- Reflects the user's intent and tone.
- Uses layering for clarity and depth.
- Uses motion and physics (easing, springs, weight, parallax, stagger) to create an engaging, cinematic feel.
- Ends in a stable, readable composition.

Return ONLY the TypeScript source file as plain text.
`;

export function buildAnimatorSystemPrompt(sdkInterfaceDefinition: string): string {
  const trimmed = sdkInterfaceDefinition.trim();
  const sdkSection = trimmed ? `${trimmed}\n\n` : '';

  const instructions = `# INSTRUCTIONS
1. When a ScenePlan JSON is provided, use it as your primary blueprint for what elements to create, how they look, where they are, and how they move.
2. Use the storyboard (vibe, colorPalette, timeline[]) and the user's original prompt as supporting context to clarify intent, composition, and physics, but avoid inventing completely new structure that conflicts with the ScenePlan.
3. Apply physics hints (weight, springs, easing, parallax, stagger) to choose MotionScript animation parameters.
4. Maintain layering semantics by drawing background, then midground, then foreground elements.
5. End with: export default stage.toJSON().
6. Return ONLY the TypeScript source code as plain text. Do NOT wrap it in markdown fences or write explanations.
7. When a CriticResult JSON is provided in the user prompt, treat it as structured visual feedback from an art director. Use its issues and fixes to adjust motion, layering, and visual richness while keeping the ScenePlan's object structure and roles intact.`;

  const scenePlanExamplesHeader = `// ScenePlan (banner) example JSON:\n// { 'mode': 'banner', 'durationSeconds': 5, 'objects': [ { 'id': 'bg_panel', 'role': 'background', 'kind': 'shape' }, { 'id': 'headline', 'role': 'main-text', 'kind': 'text' } ] }\n// ScenePlan (game-demo) example JSON:\n// { 'mode': 'game-demo', 'durationSeconds': 5, 'objects': [ { 'id': 'table', 'role': 'playfield', 'kind': 'shape' }, { 'id': 'paddle_left', 'role': 'paddle-left', 'kind': 'shape' }, { 'id': 'paddle_right', 'role': 'paddle-right', 'kind': 'shape' }, { 'id': 'ball', 'role': 'ball', 'kind': 'shape' }, { 'id': 'score', 'role': 'score-text', 'kind': 'text' } ] }\n// ScenePlan (product-demo) example JSON:\n// { 'mode': 'product-demo', 'durationSeconds': 6, 'objects': [ { 'id': 'device_frame', 'role': 'device-frame', 'kind': 'shape' }, { 'id': 'header', 'role': 'header-text', 'kind': 'text' }, { 'id': 'card_primary', 'role': 'ui-panel', 'kind': 'shape' }, { 'id': 'cta', 'role': 'cta-button', 'kind': 'shape' }, { 'id': 'pointer', 'role': 'cursor', 'kind': 'shape' } ] }`;

  return `${ANIMATOR_SYSTEM_PROMPT_BASE}${sdkSection}${instructions}\n\n# EXAMPLES\nEXAMPLE:\n${scenePlanExamplesHeader}\n${ANIMATOR_FEW_SHOT_EXAMPLES}`;
}

export function buildAnimatorUserPrompt(
  storyboard: Storyboard,
  originalPrompt: string,
  scenePlan?: ScenePlan | null,
  criticResult?: CriticResult | null
): string {
  const lines: string[] = [];

  lines.push(
    'Generate a complete TypeScript MotionScript file using "@motiongen/sdk" based on the user prompt and the provided ScenePlan (when present), using the storyboard as supporting context.'
  );
  lines.push('');
  lines.push(`Original user prompt: ${originalPrompt}`);
  lines.push('');

  if (scenePlan) {
    lines.push('PRIMARY BLUEPRINT – ScenePlan JSON:');
    lines.push(
      'Use this ScenePlan as the main source of truth for which objects to create, their roles, initial layout, and key motion phases. Translate it as mechanically as possible into MotionScript elements and animations.'
    );
    lines.push('ScenePlan JSON:');
    lines.push(JSON.stringify(scenePlan, null, 2));
    lines.push('');
  }

  if (criticResult) {
    lines.push('Structured visual critique – CriticResult JSON:');
    lines.push(
      '- Use these issues and fixes to refine motion, layout, contrast, and visual richness while preserving the ScenePlan object structure and the user intent.'
    );
    lines.push('CriticResult JSON:');
    lines.push(JSON.stringify(criticResult, null, 2));
    lines.push('');
  }

  lines.push('Supporting context – storyboard:');
  lines.push(
    '- Respect its vibe, colorPalette, and any timeline or beats information when choosing visual style, layering, and motion nuances.'
  );
  lines.push(
    '- When ScenePlan is present, use the storyboard mainly to refine timing, emphasis, and physics, not to invent an entirely new set of objects.'
  );
  lines.push('');
  lines.push('Requirements:');
  lines.push(
    '- Use the full MotionScript capabilities described in the system prompt: shapes, text, transforms, easing, springs, stagger, layering, and parallax-like depth when appropriate.'
  );
  lines.push("- Keep the storyboard’s creative intent and colorPalette.");
  lines.push(
    '- Choose Stage dimensions and fps consistent with the user prompt or sensible defaults.'
  );
  lines.push(
    '- Use Stage.create, stage.addText, stage.addShape, element.animate, stage.createGroup().stagger, and Motion.spring only (as defined by the SDK interface).'
  );
  lines.push(
    '- Ensure the animation is readable: main elements on-screen, legible, and clearly animated over time.'
  );
  lines.push(
    '- Import only from "@motiongen/sdk" and end with export default stage.toJSON().'
  );
  lines.push(
    '- Output only raw TypeScript (no markdown, no extra commentary).'
  );
  lines.push('');
  lines.push('Storyboard JSON:');
  lines.push(JSON.stringify(storyboard, null, 2));

  return lines.join('\n');
}

export function extractCodeFromLLMResponse(response: string): string {
  const trimmed = response.trim();

  const fenceMatch = trimmed.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
  if (fenceMatch && fenceMatch[1]) {
    return fenceMatch[1].trim();
  }

  if (trimmed.startsWith("```") && trimmed.endsWith("```")) {
    const inner = trimmed.slice(3, -3).trim();
    return inner;
  }

  return trimmed;
}

export class AnimatorAgent {
  private readonly client: LLMClient;

  constructor(client: LLMClient) {
    this.client = client;
  }

  async generateMotionScript(
    options: AnimatorAgentGenerateOptions
  ): Promise<string> {
    const systemPrompt = buildAnimatorSystemPrompt(
      options.sdkInterfaceDefinition
    );
    const userPrompt = buildAnimatorUserPrompt(
      options.storyboard,
      options.originalPrompt,
      options.scenePlan ?? null,
      options.criticResult ?? null
    );

    debugLog("agent:animator", "Requesting MotionScript from LLM", {
      model: ANIMATOR_MODEL,
      storyboardVibe: options.storyboard.vibe,
      timelineLength: options.storyboard.timeline.length,
      hasScenePlan: Boolean(options.scenePlan),
      sceneObjectCount: options.scenePlan?.objects.length,
      hasCriticResult: Boolean(options.criticResult),
    });

    const response = await this.client.generate({
      model: ANIMATOR_MODEL,
      systemPrompt,
      userPrompt,
      jsonMode: false,
      temperature: 0.2,
      stopSequences: ["```", "return stage"],
    });

    const code = extractCodeFromLLMResponse(response);

    debugLog("agent:animator", "MotionScript received from LLM", {
      codeLength: code.length,
    });

    return code;
  }
}
