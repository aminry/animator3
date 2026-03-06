import type { LLMClient } from "./directorAgent";
import type { AnimationMode } from "./scenePlan";
import { debugLog } from "./logger";
import { writeDebugJSON } from "./debugDump";

export interface PromptModeFlags {
  requiresCharacters: boolean;
  uiDemo: boolean;
  gameplay: boolean;
  banner: boolean;
}

export interface PromptClassification {
  mode: AnimationMode;
  targetDurationSeconds: number;
  flags: PromptModeFlags;
}

export interface PromptClassifierAgentOptions {
  prompt: string;
  assets?: string[];
}

export const PROMPT_CLASSIFIER_MODEL = "TEXT MODEL";

export const PROMPT_CLASSIFIER_SYSTEM_PROMPT = `You are MotionGen's Prompt Classifier.
Your job is to read a user's natural-language request for an animation and any available
asset metadata, then choose an appropriate high-level animation mode and a target
duration, plus a few boolean flags describing special requirements.

You must output ONLY a single JSON object with the following structure:
{
  "mode": string,
  "targetDurationSeconds": number,
  "flags": {
    "requiresCharacters": boolean,
    "uiDemo": boolean,
    "gameplay": boolean,
    "banner": boolean
  }
}

Mode should, when possible, be one of these canonical values:
- "banner"
- "game-demo"
- "product-demo"
- "data-viz"
- "explainer"
- "loader/loop"
- "logo-sting"
- "character-moment"

Interpretation guidelines:
- "banner": short promotional or informational banner, headline + supporting text and shapes.
- "game-demo": gameplay, score, controls, or game field are central.
- "product-demo": UI panels, app screens, device frames, or product usage.
- "data-viz": charts, metrics, dashboards, or quantified changes.
- "explainer": narrative or concept explanation, often with diagrams or labeled parts.
- "loader/loop": small looping motion, often abstract, used as a loading indicator or idle loop.
- "logo-sting": short logo or brand reveal.
- "character-moment": characters, avatars, or people are visually central.

Mode-specific conventions (these will guide later ScenePlan structure):
- For "banner" prompts, look for language about headlines, sales, hero banners, or hero sections.
  - Canonical roles in the scene include: "background", "bg-panel", "accent-shape", "main-text", "secondary-text", "cta-text", "logo-mark", "logo-text".
  - Typical motion patterns: text or panels sliding/fading in, subtle hover or pulse on the call-to-action, gentle parallax between background and foreground.
- For "game-demo" prompts, look for gameplay terms (match, level, score, ball, paddles, arena, etc.).
  - Canonical roles include: "playfield", "table", "court", "ball", "paddle-left", "paddle-right", "player-1", "player-2", "score-text", "hud", "background".
  - Typical motion patterns: ball trajectories with bounces, paddles or players tracking the ball, score updates, and camera or background motion that reinforces gameplay.
- For "product-demo" prompts, look for UI, app flows, screens, dashboards, or device frames.
  - Canonical roles include: "device-frame", "app-screen-main", "app-screen-secondary", "ui-panel", "cta-button", "nav-bar", "tab-bar", "cursor", "highlight-region".
  - Typical motion patterns: panels sliding in, highlighted regions pulsing, cursor/touch indicators moving between elements, and simple step-by-step transitions.
- For "data-viz" prompts, look for charts, graphs, metrics, KPIs, or dashboards.
  - Canonical roles include: "chart-area", "axis-x", "axis-y", "chart-line-main", "chart-bar-series", "data-point-highlight", "legend-panel", "annotation-text", "grid-lines".
  - Typical motion patterns: values changing over time, lines or areas animating from left to right, bars growing, and numbers or labels updating.
- For "explainer" prompts, look for multi-step explanations, diagrams, labeled parts, or flows.
  - Canonical roles include: "diagram-node", "connector-line", "label-text", "title-text", "callout-box", "step-number", "background".
  - Typical motion patterns: sequential reveals of nodes or steps, connectors drawing in, and moderate camera or layout shifts between concepts.
- For "loader/loop" prompts, look for loading indicators, spinners, or idle animations.
  - Canonical roles include: "loader-core", "orbit-dot", "ring", "spinner-arm", "background".
  - Typical motion patterns: continuous rotation, orbiting dots, pulsing shapes, or looping progress arcs that are seamless when repeated.
- For "logo-sting" prompts, look for brand or logo reveals.
  - Canonical roles include: "logo-mark", "logo-text", "accent-shape", "background".
  - Typical motion patterns: logo pieces assembling, scaling or fading in, and then settling into a stable end-lockup, sometimes with a short glow or underline.
- For "character-moment" prompts, look for characters, avatars, mascots, or people.
  - Canonical roles include: "character-main", "character-secondary", "prop", "background", "foreground-effect", "speech-bubble".
  - Typical motion patterns: idle loops (breathing, hair or clothing drift), blinks, small gestures, and subtle camera motion to keep the character feeling alive.

Flags guidelines:
- "requiresCharacters": true when the animation clearly needs characters, avatars, or people.
- "uiDemo": true when the focus is on UI, app flows, dashboards, or product screens.
- "gameplay": true when the prompt describes a game, match, level, score, or similar.
- "banner": true when the request is closest to a banner-style composition.

Target duration guidelines:
- If the user specifies a duration, respect it.
- Otherwise choose a reasonable default based on mode:
  - banner, logo-sting: typically 3–6 seconds.
  - game-demo, product-demo, explainer: typically 5–10 seconds.
  - loader/loop: typically 2–4 seconds.

Rules:
- Return valid JSON only. Do not include comments or extra keys.
- Always provide a non-empty "mode" string.
- Always provide a positive "targetDurationSeconds" (in seconds).
- Always provide all four flags, set to true or false.
`;

function coerceBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === "true" || trimmed === "yes") {
      return true;
    }
    if (trimmed === "false" || trimmed === "no") {
      return false;
    }
  }
  return fallback;
}

function coerceNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function canonicalizeMode(value: unknown): AnimationMode {
  if (typeof value !== "string" || !value.trim()) {
    return "banner";
  }
  const lower = value.trim().toLowerCase();

  if (lower.includes("game")) {
    return "game-demo";
  }
  if (lower.includes("product") || lower.includes("ui") || lower.includes("interface")) {
    return "product-demo";
  }
  if (lower.includes("data") || lower.includes("chart") || lower.includes("graph")) {
    return "data-viz";
  }
  if (lower.includes("logo")) {
    return "logo-sting";
  }
  if (lower.includes("character") || lower.includes("avatar") || lower.includes("person")) {
    return "character-moment";
  }
  if (lower.includes("load") || lower.includes("spinner") || lower.includes("loop")) {
    return "loader/loop";
  }
  if (lower.includes("explain") || lower.includes("tutorial") || lower.includes("walkthrough")) {
    return "explainer";
  }

  return lower as AnimationMode;
}

function inferDefaultDuration(mode: AnimationMode): number {
  if (mode === "loader/loop") {
    return 3;
  }
  if (mode === "banner" || mode === "logo-sting") {
    return 4;
  }
  if (mode === "game-demo" || mode === "product-demo" || mode === "explainer") {
    return 7;
  }
  return 5;
}

export function normalizePromptClassification(raw: unknown): PromptClassification {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid prompt classification payload: expected an object");
  }

  const obj = raw as Record<string, unknown>;

  const modeValue = canonicalizeMode(obj.mode);

  const durationCandidate =
    (obj as any).targetDurationSeconds ??
    (obj as any).targetDuration ??
    (obj as any).durationSeconds;
  let targetDurationSeconds = coerceNumber(
    durationCandidate,
    inferDefaultDuration(modeValue)
  );
  if (!isFinite(targetDurationSeconds) || targetDurationSeconds <= 0) {
    targetDurationSeconds = inferDefaultDuration(modeValue);
  }

  const flagsRaw = (obj as any).flags as Record<string, unknown> | undefined;

  const baseFlags: PromptModeFlags = {
    requiresCharacters: false,
    uiDemo: false,
    gameplay: false,
    banner: false,
  };

  if (flagsRaw && typeof flagsRaw === "object") {
    baseFlags.requiresCharacters = coerceBoolean(
      flagsRaw.requiresCharacters,
      baseFlags.requiresCharacters
    );
    baseFlags.uiDemo = coerceBoolean(flagsRaw.uiDemo, baseFlags.uiDemo);
    baseFlags.gameplay = coerceBoolean(flagsRaw.gameplay, baseFlags.gameplay);
    baseFlags.banner = coerceBoolean(flagsRaw.banner, baseFlags.banner);
  }

  if (!baseFlags.requiresCharacters && modeValue === "character-moment") {
    baseFlags.requiresCharacters = true;
  }
  if (!baseFlags.uiDemo && modeValue === "product-demo") {
    baseFlags.uiDemo = true;
  }
  if (!baseFlags.gameplay && modeValue === "game-demo") {
    baseFlags.gameplay = true;
  }
  if (!baseFlags.banner && modeValue === "banner") {
    baseFlags.banner = true;
  }

  return {
    mode: modeValue,
    targetDurationSeconds,
    flags: baseFlags,
  };
}

export function buildPromptClassifierUserPrompt(
  options: PromptClassifierAgentOptions
): string {
  const lines: string[] = [];

  lines.push(
    "Classify the following animation request into an animation mode and flags as described in the system prompt."
  );
  lines.push("");
  lines.push("User prompt:");
  lines.push(options.prompt);
  lines.push("");

  const assets = Array.isArray(options.assets) ? options.assets : [];
  if (assets.length > 0) {
    lines.push("Assets (filenames or identifiers):");
    assets.forEach((asset, index) => {
      lines.push(`- [${index}] ${asset}`);
    });
  } else {
    lines.push("Assets: none provided");
  }

  lines.push("");
  lines.push(
    "Return ONLY the JSON object with mode, targetDurationSeconds, and flags."
  );

  return lines.join("\n");
}

export class PromptClassifierAgent {
  private readonly client: LLMClient;

  constructor(client: LLMClient) {
    this.client = client;
  }

  async classify(
    options: PromptClassifierAgentOptions
  ): Promise<PromptClassification> {
    const userPrompt = buildPromptClassifierUserPrompt(options);

    debugLog("agent:prompt-classifier", "Requesting prompt classification", {
      model: PROMPT_CLASSIFIER_MODEL,
      promptSnippet: options.prompt.slice(0, 120),
      assetsCount: Array.isArray(options.assets) ? options.assets.length : 0,
    });

    const response = await this.client.generate({
      model: PROMPT_CLASSIFIER_MODEL,
      systemPrompt: PROMPT_CLASSIFIER_SYSTEM_PROMPT,
      userPrompt,
      jsonMode: true,
      temperature: 0.3,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(response);
    } catch {
      throw new Error(
        "PromptClassifierAgent expected JSON response from LLM client"
      );
    }

    const classification = normalizePromptClassification(parsed);

    writeDebugJSON("prompt-classification-latest.json", {
      prompt: options.prompt,
      assets: options.assets ?? [],
      classification,
    });

    debugLog("agent:prompt-classifier", "Prompt classification normalized", {
      mode: classification.mode,
      targetDurationSeconds: classification.targetDurationSeconds,
      flags: classification.flags,
    });

    return classification;
  }
}
