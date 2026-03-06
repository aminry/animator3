import { debugLog } from "./logger";
import { writeDebugJSON } from "./debugDump";
import {
  normalizeStoryboardBeats,
  parseStoryboardTimelineToBeats,
} from "./storyboardTypes";
import type { StoryboardBeat } from "./storyboardTypes";
import type { AnimationMode } from "./scenePlan";
import type { PromptClassification } from "./promptClassifierAgent";

export interface Storyboard {
  vibe: string;
  colorPalette: string[];
  timeline: string[];
  beats?: StoryboardBeat[];
}

export interface DirectorPlanOptions {
  prompt: string;
  mode?: AnimationMode | null;
  classification?: PromptClassification | null;
  targetDurationSecondsHint?: number;
}

export interface LLMClientGenerateOptions {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  jsonMode: boolean;
  temperature?: number;
  stopSequences?: string[];

  // NEW: for vision models
  imageUrls?: string[];
}

export interface LLMClient {
  generate(options: LLMClientGenerateOptions): Promise<string>;
}

export const DIRECTOR_MODEL = "TEXT MODEL";

export const DIRECTOR_SYSTEM_PROMPT = `
You are the Creative Director of a high-end motion graphics studio.
Your job is to turn the user's request into a compact but highly informative storyboard JSON that a separate Animator will turn into MotionScript code.

The Animator:
- Can create shapes (rectangles, rounded rectangles, circles, ellipses, polygons, stars) and text.
- Can animate position, scale, rotation, opacity, and (when the SDK allows) color.
- Can use easing curves and spring-based motion to approximate physics (weight, elasticity, overshoot, settle).
- Can stagger multiple similar elements (e.g. lines of text, icons) over time.
- Can layer elements (background, midground, foreground) by draw order.
- Uses a Stage with width/height/duration/fps; if not specified, it will choose defaults.

Your storyboard must give enough detail that the Animator can build a clear, creative, physics-aware motion piece WITHOUT guessing the core structure.

# GENERAL RULES
1. You must NOT write code. Output strict JSON only.
2. Output MUST be a single JSON object with top-level keys "vibe", "colorPalette", "timeline", and optionally "beats" (no other top-level keys).
3. Timing is in seconds. If the user does not specify, assume total duration ≈ 5–7 seconds and keep times consistent.
4. Respect the user's intent, text, tone, and constraints (duration, colors, density, emphasis). When the user is vague, fill in creative but coherent details.
5. "vibe" must combine emotional tone + motion/physics style (e.g. "Playful, medium tempo, springy overshoot", "Calm, slow ease-in-out, subtle parallax").
6. You must define a color palette (3–6 colors) aligned with the user’s brand/goal, using hex strings or CSS-like color names.

# OUTPUT FORMAT (STRICT)
{
  "vibe": string,
  "colorPalette": string[],
  "timeline": string[],
  "beats": {
    "id": string,
    "start": number,
    "end": number,
    "layer": "background" | "midground" | "foreground",
    "role": string,
    "type": string,
    "content": string,
    "layout": string,
    "motion": string,
    "physics": string,
    "notes"?: string
  }[]
}

- "vibe": 1 short sentence describing emotional tone + motion/physics behavior.
- "colorPalette": 3–6 primary colors you recommend for the design.
- "timeline": ordered list of compact timeline entries, each describing a specific phase or event in the animation.
- "beats": array of structured storyboard beats aligned 1:1 with "timeline" entries, each containing id, start, end, layer, role, type, content, layout, motion, physics, and optional notes.

# TIMELINE MINI-DSL (VERY IMPORTANT)
Each entry in "timeline" MUST be a single string using this structure:

"t:start–end | layer:... | role:... | type:... | content:... | layout:... | motion:... | physics:... | notes:..."

All fields are required except "notes", which is optional.

Field definitions:
- t:start–end:
  - Start and end times in seconds, e.g. "t:0–1.2", "t:1.2–3".
  - Times must be non-decreasing across entries and describe the overall flow (intro → main → outro).
- layer:
  - Visual stack position: "background", "midground", or "foreground".
- role:
  - Semantic role, e.g. "base-background", "main-text", "supporting-text", "data-bars", "accent-orbits", "icon-row", "logo-mark", "diagram", "particles".
- type:
  - "shape(rectangle)", "shape(roundedRectangle)", "shape(circle)", "shape(ellipse)", "shape(polygon)", "shape(star)"
  - "text(single-line)" or "text(multi-line)"
  - "group(staggered-text)" or "group(staggered-shapes)" for staggered sequences.
- content:
  - For text: describe what the text should say or represent, e.g. "main keyword from user prompt", "short supporting phrases summarizing benefits".
  - For shapes: describe what they represent, e.g. "abstract bars to imply growth", "orbiting circles to suggest activity", "tiles representing items", "simple nodes and links for a network".
- layout:
  - Rough placement and grouping, e.g. "full-frame background", "centered upper third", "bottom strip", "left column shapes, right column text", "clustered around center", "distributed along bottom".
- motion:
  - Describe WHAT changes, e.g.:
    - "position: off-screen bottom → center"
    - "position: left → right with slight vertical arc"
    - "scale: small → medium", "rotation: 0° → 360°", "opacity: 0 → 100"
    - "stagger: 4 items, 0.15s apart"
    - If multiple properties animate, list them: "position: off-screen top → target, opacity: 0 → 100, scale: 80% → 100%".
- physics:
  - Describe HOW it moves physically:
    - Weight: "light", "medium", "heavy".
    - Behavior: "springy overshoot", "gentle ease-in-out", "snappy ease-out", "constant speed", "slow-in-fast-out".
    - Curves: "easing: ease-out", "easing: ease-in-out", "easing: linear", or "spring(220, 20)" (stiffness, damping).
    - Depth: "parallax: slower than foreground", "follow-through on small accents", "secondary motion lagging by 0.1s".
- notes (optional but recommended):
  - Contrast/readability hints: "high-contrast text over darkest palette color".
  - Composition hints: "keep clear margin around main text", "avoid overlapping critical elements".
  - Goal-focused notes: "focus viewer attention on main number", "emphasize motion of central concept, keep background subtle".
  - Richness hints: "ok to add small accent shapes around this cluster for visual interest".

# COMPLEXITY REQUIREMENTS
Unless the user explicitly asks for an ultra-minimal animation:

- "timeline" MUST contain at least 6–10 entries.
- There MUST be entries for:
  - at least 1 background layer,
  - at least 1 midground accent layer,
  - at least 2 distinct foreground roles (e.g. main-text + supporting-text or main-shape + labels),
  - at least 1 staggered group (group(staggered-text) or group(staggered-shapes)),
  - at least 1 secondary/ambient motion layer (e.g. orbiting accents, soft moving panel, particles).
- At least 3 entries MUST specify spring-based behavior (e.g. "physics:light, spring(220, 20), overshoot") for key entrances.
- At least 2 entries MUST specify easing curves (ease-in, ease-out, ease-in-out, or custom bezier).
- At least 1 entry MUST mention staggered timing.

You MAY introduce additional abstract shapes or small accent elements to improve visual richness, as long as they:
- Do not change the core message.
- Follow the same vibe and color palette.
- Do not make the scene noisy or illegible.

# ANIMATION & PHYSICS BEST PRACTICES
- Structure:
  - Intro (~20–30%): bring in key elements with clear motion and anticipation.
  - Development (~40–60%): show relationships, supporting details, or visual metaphors using layered motion and staggered entrances.
  - Outro (~20–30%): stabilize into a clean, readable composition with minimal motion.
- Layering & depth:
  - Background: big color panels and soft, slower motion (parallax).
  - Midground: abstract shapes, charts, or icons that support the theme.
  - Foreground: main text and key icons; their motion defines the main beats.
- Physics & motion:
  - Heavy elements: slower, smoother, less overshoot.
  - Light elements: quicker, more bounce/spring, slightly exaggerated overshoot.
  - Prefer arcs over perfectly straight-line motion when appropriate.
  - Use anticipation (small motion opposite direction before a big move) on key entrances when it fits the vibe.
  - Use follow-through/overlap: small accents can finish slightly after the main element.
- Readability:
  - Main text must always be high contrast and not occluded.
  - Avoid putting critical content over highly detailed/high-contrast patterns.
  - Ensure a stable, clean frame near the end where the viewer can comfortably read the main message.

# HOW TO USE THE USER PROMPT
From the user prompt:
- Extract:
  - The main idea (what this animation is trying to communicate).
  - The target emotion and energy level (fun, serious, premium, bold, calm, etc.).
  - Any explicit constraints (duration, format, specific words, colors, or required elements).
- Reflect these in:
  - "vibe": emotional tone + motion/physics style.
  - "colorPalette": colors that support that tone.
  - "timeline": a coherent sequence (≥ 6 entries) that brings the idea to life.

# FINAL INSTRUCTIONS
- Output MUST be valid JSON matching the exact schema:
  {
    "vibe": string,
    "colorPalette": string[],
    "timeline": string[],
    "beats"?: {
      "id": string,
      "start": number,
      "end": number,
      "layer": "background" | "midground" | "foreground",
      "role": string,
      "type": string,
      "content": string,
      "layout": string,
      "motion": string,
      "physics": string,
      "notes"?: string
    }[]
  }
- Do NOT include comments, explanations, or any extra top-level keys.
- Do NOT output code, markdown, or prose outside the JSON.
`;

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item) => typeof item === "string") as string[];
}

export function normalizeStoryboard(raw: unknown): Storyboard {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid storyboard payload: expected an object");
  }

  const obj = raw as Record<string, unknown>;

  const vibeValue =
    typeof obj.vibe === "string"
      ? obj.vibe
      : typeof (obj as any).Vibe === "string"
      ? (obj as any).Vibe
      : "";

  const paletteRaw =
    (obj as any).colorPalette !== undefined
      ? (obj as any).colorPalette
      : (obj as any).ColorPalette;

  const timelineRaw =
    (obj as any).timeline !== undefined
      ? (obj as any).timeline
      : (obj as any).Timeline;

  const beatsRaw =
    (obj as any).beats !== undefined
      ? (obj as any).beats
      : (obj as any).TimelineBeats;

  const colorPalette = normalizeStringArray(paletteRaw);
  const timeline = normalizeStringArray(timelineRaw);

  let beats: StoryboardBeat[] = [];
  if (Array.isArray(beatsRaw)) {
    beats = normalizeStoryboardBeats(beatsRaw);
  }

  if (!beats.length && timeline.length) {
    beats = parseStoryboardTimelineToBeats(timeline);
  }

  if (!vibeValue || !colorPalette.length || !timeline.length) {
    throw new Error("Invalid storyboard payload: missing required fields");
  }

  return {
    vibe: vibeValue,
    colorPalette,
    timeline,
    beats,
  };
}

export function buildDirectorUserPrompt(options: DirectorPlanOptions): string {
  const lines: string[] = [];

  lines.push(
    "You are given the user's original animation request plus an optional animation mode classification."
  );
  lines.push(
    "Use this information to produce a detailed storyboard JSON as described in the system prompt."
  );
  lines.push("");

  if (options.mode) {
    lines.push(`Animation mode (hint): ${options.mode}`);
  }

  if (
    typeof options.targetDurationSecondsHint === "number" &&
    isFinite(options.targetDurationSecondsHint) &&
    options.targetDurationSecondsHint > 0
  ) {
    lines.push(
      `Target durationSeconds (hint): ${options.targetDurationSecondsHint}`
    );
  }

  if (options.mode) {
    const modeLower = String(options.mode).toLowerCase();
    lines.push("");
    lines.push("Mode-specific guidance:");

    if (modeLower === "banner") {
      lines.push(
        "- Treat this as a banner or promo scene with strong text hierarchy and brand-like layout."
      );
      lines.push(
        "- Ensure roles such as 'main-text', 'supporting-text', and a brand or 'logo-mark' element appear across beats."
      );
      lines.push(
        "- Use background and midground accent shapes to support the message without overwhelming readability."
      );
    } else if (modeLower === "game-demo") {
      lines.push(
        "- Treat this as a small 2D game or match demonstration (e.g. paddles, ball, table, score)."
      );
      lines.push(
        "- Ensure there are explicit beats and roles for players/paddles, the ball, the playfield/table/court, and score or scoreboard text."
      );
      lines.push(
        "- Motion should emphasize gameplay arcs, rallies, and clear cause/effect moments, not just abstract motion."
      );
    } else if (modeLower === "product-demo") {
      lines.push(
        "- Treat this as a product or UI demonstration (app screens, panels, device frames)."
      );
      lines.push(
        "- Ensure roles such as 'ui-panel', 'device-frame', key labels, and interaction hints (cursor, highlight) appear in the beats."
      );
      lines.push(
        "- Structure the timeline around showing a focused flow: intro frame, key interaction steps, and a clear summary/outro frame."
      );
    }
  }

  if (options.classification) {
    lines.push("");
    lines.push("Prompt classification JSON (mode, flags, duration):");
    lines.push(JSON.stringify(options.classification, null, 2));
  }

  lines.push("");
  lines.push("Original user prompt:");
  lines.push(options.prompt);

  return lines.join("\n");
}

export class DirectorAgent {
  private readonly client: LLMClient;

  constructor(client: LLMClient) {
    this.client = client;
  }

  async planStoryboard(prompt: string): Promise<Storyboard> {
    debugLog("agent:director", "Requesting storyboard from LLM", {
      model: DIRECTOR_MODEL,
      promptSnippet: prompt.slice(0, 120),
    });

    const response = await this.client.generate({
      model: DIRECTOR_MODEL,
      systemPrompt: DIRECTOR_SYSTEM_PROMPT,
      userPrompt: prompt,
      jsonMode: true,
      temperature: 0.85,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(response);
    } catch {
      throw new Error("DirectorAgent expected JSON response from LLM client");
    }
    const storyboard = normalizeStoryboard(parsed);

    writeDebugJSON("storyboard-latest.json", {
      prompt,
      storyboard,
    });

    debugLog("agent:director", "Storyboard normalized", {
      vibe: storyboard.vibe,
      timelineLength: storyboard.timeline.length,
    });

    return storyboard;
  }

  async planStoryboardForMode(options: DirectorPlanOptions): Promise<Storyboard> {
    const userPrompt = buildDirectorUserPrompt(options);

    debugLog("agent:director", "Requesting storyboard from LLM", {
      model: DIRECTOR_MODEL,
      promptSnippet: options.prompt.slice(0, 120),
      mode: options.mode,
    });

    const response = await this.client.generate({
      model: DIRECTOR_MODEL,
      systemPrompt: DIRECTOR_SYSTEM_PROMPT,
      userPrompt,
      jsonMode: true,
      temperature: 0.85,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(response);
    } catch {
      throw new Error("DirectorAgent expected JSON response from LLM client");
    }
    const storyboard = normalizeStoryboard(parsed);

    writeDebugJSON("storyboard-latest.json", {
      prompt: options.prompt,
      mode: options.mode ?? null,
      classification: options.classification ?? null,
      targetDurationSecondsHint: options.targetDurationSecondsHint,
      storyboard,
    });

    debugLog("agent:director", "Storyboard normalized", {
      vibe: storyboard.vibe,
      timelineLength: storyboard.timeline.length,
    });

    return storyboard;
  }
}
