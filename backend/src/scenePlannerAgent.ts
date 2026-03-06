import type { LLMClient, Storyboard } from "./directorAgent";
import { debugLog } from "./logger";
import { writeDebugJSON } from "./debugDump";
import type { StoryboardBeat, StoryboardV2 } from "./storyboardTypes";
import { parseStoryboardTimelineToBeats } from "./storyboardTypes";
import type {
  AnimationMode,
  SceneKeyframe,
  SceneObject,
  SceneObjectKind,
  ScenePlan,
  ScenePath,
  SceneShapeType,
} from "./scenePlan";

export const SCENE_PLANNER_MODEL = "TEXT MODEL";

export const SCENE_PLANNER_SYSTEM_PROMPT = `You are MotionGen's Scene Planner.
Your job is to convert a structured storyboard (StoryboardV2) plus the user's
original prompt and an animation mode into a concrete ScenePlan JSON.

The ScenePlan describes:
- durationSeconds: total animation length in seconds.
- mode: high-level animation archetype (e.g. "banner", "game-demo").
- objects: an array of SceneObject entries describing every important
  visual element in the scene.
- paths: optional motion paths for objects that move along arcs/orbits.

You must output ONLY a single JSON object matching this schema:
{
  "durationSeconds": number,
  "mode": string,
  "objects": [
    {
      "id": string,
      "role": string,
      "kind": "text" | "shape" | "character" | "ui-element" | "camera" | "group" | string,
      "shapeType"?: "rectangle" | "roundedRectangle" | "circle" | "ellipse" | "polygon" | "star" | string,
      "parentId"?: string,
      "followTargetId"?: string,
      "pathId"?: string,
      "initialPosition"?: [number, number],
      "initialScale"?: [number, number],
      "initialRotation"?: number,
      "initialOpacity"?: number,
      "style"?: {
        "fillColor"?: [number, number, number],
        "strokeColor"?: [number, number, number],
        "strokeWidth"?: number,
        "textColor"?: [number, number, number],
        "fontSize"?: number
      },
      "keyframes": [
        {
          "t": number,
          "position"?: [number, number],
          "scale"?: [number, number],
          "rotation"?: number,
          "opacity"?: number
        }
      ]
    }
  ],
  "paths"?: [
    {
      "id": string,
      "type": "line" | "arc" | "circle" | "bezier" | "orbit" | string,
      "controlPoints": [ [number, number] ]
    }
  ]
}

Rules:
- Return valid JSON only. Do not include comments or extra top-level keys.
- Every important semantic role from the storyboard (ball, paddles, table,
  background panels, title text, score text, etc.) MUST map to at least
  one SceneObject.
- Use stable string ids for objects and paths (e.g. "ball", "paddle_left",
  "bg_panel_1", not random UUIDs).
- Use keyframes to capture the main motion phases for each object:
  - t is in seconds from the start of the animation.
  - For static objects, a single keyframe with t = 0 is acceptable.
  - For moving objects, include multiple keyframes across the duration.
- Use the provided mode to choose an appropriate structure and canonical roles:
  - "banner": strong text hierarchy, background panels, accent shapes.
    - Include at least one main headline text object (role like "main-text"), one supporting text object (e.g. "secondary-text"), and at least one background panel or accent shape layer (roles like "background", "bg-panel", "accent-shape").
    - Include optional logo objects (roles like "logo-mark", "logo-text") and a clear call-to-action text object (role like "cta-text").
    - Ensure beats cover an intro (elements entering), a main reading state, and an outro that stabilizes into a clean banner layout with subtle motion (hover, parallax, or glow).
  - "game-demo": explicit game entities (players, ball, field, score), clear
    motion arcs for gameplay.
    - Include separate objects for players or paddles, the ball, the playfield/table/court, a score or scoreboard text object, and optional HUD or background elements (roles like "playfield", "ball", "paddle-left", "paddle-right", "player-1", "player-2", "score-text", "hud", "background").
    - Use keyframes to show ball trajectories and interactions (serves, bounces, rallies), paddle or player motion reacting to the ball, and score changes across the duration.
  - "product-demo": UI elements, device frames, focus on interactions.
    - Include objects for at least one primary UI panel or app screen, optional device frame, and key interactive elements (buttons, menus, highlight regions) with roles like "device-frame", "app-screen-main", "app-screen-secondary", "ui-panel", "cta-button", "nav-bar", "tab-bar", "cursor", "highlight-region".
    - Structure beats to show a simple user flow: initial view, one or two interaction steps (cursor/touch moving between elements, panels changing), and a final summarized state.
  - "data-viz": charts, metrics, dashboards, or quantified changes.
    - Include objects representing chart scaffolding and data, such as roles like "chart-area", "axis-x", "axis-y", "chart-line-main", "chart-bar-series", "data-point-highlight", "legend-panel", "annotation-text", "grid-lines".
    - Use keyframes to show metrics evolving over time: lines drawing from left to right, bars growing, highlighted points appearing or pulsing, and numeric labels updating.
  - "explainer": narrative or concept explanation, often with diagrams or labeled parts.
    - Include objects for labeled nodes and connectors, using roles like "diagram-node", "connector-line", "label-text", "title-text", "callout-box", "step-number", "background".
    - Use keyframes to reveal nodes and labels in sequence, draw connectors, and optionally shift emphasis or camera framing between steps.
  - "loader/loop": small looping motion, often abstract, used as a loading indicator or idle loop.
    - Include a small number of looping elements with roles like "loader-core", "orbit-dot", "ring", "spinner-arm", "background".
    - Ensure keyframes produce a smooth, seamless loop (e.g. rotation or orbit cycles that end where they start, pulsing that returns to the initial state).
  - "logo-sting": short logo or brand reveal.
    - Include logo mark and logo text objects (roles like "logo-mark", "logo-text") plus optional accent shapes and background elements.
    - Use keyframes so the logo enters dynamically (scale/position/opacity changes) and then settles into a stable resting state by the end of the duration.
  - "character-moment": characters, avatars, or people are visually central.
    - Include one or more character objects (roles like "character-main", "character-secondary"), supporting props, and environment or effect layers (roles like "prop", "background", "foreground-effect", "speech-bubble").
    - Use keyframes to define expressive but contained motion: idle loops (breathing, subtle sways), blinks, small gestures, and possibly short camera or framing adjustments.

You are not writing code. Focus on a clear, machine-readable plan that a
separate Animator will translate into MotionScript.`;

export interface ScenePlannerAgentOptions {
  storyboard: Storyboard;
  mode: AnimationMode;
  originalPrompt: string;
}

function toStoryboardV2(storyboard: Storyboard): StoryboardV2 {
  const beats: StoryboardBeat[] =
    Array.isArray(storyboard.beats) && storyboard.beats.length > 0
      ? storyboard.beats
      : parseStoryboardTimelineToBeats(storyboard.timeline);

  return {
    vibe: storyboard.vibe,
    colorPalette: storyboard.colorPalette,
    timeline: beats,
  };
}

function inferDurationSecondsFromBeats(beats: StoryboardBeat[]): number {
  if (!Array.isArray(beats) || beats.length === 0) {
    return 5;
  }

  let maxEnd = 0;
  for (let i = 0; i < beats.length; i += 1) {
    const end = typeof beats[i].end === "number" ? beats[i].end : 0;
    if (end > maxEnd) {
      maxEnd = end;
    }
  }

  if (!isFinite(maxEnd) || maxEnd <= 0) {
    return Math.max(3, beats.length);
  }

  return maxEnd + 0.1;
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

function normalizeKeyframes(raw: unknown[]): SceneKeyframe[] {
  const keyframes: SceneKeyframe[] = [];

  for (let i = 0; i < raw.length; i += 1) {
    const item = raw[i];
    if (!item || typeof item !== "object") {
      continue;
    }

    const obj = item as Record<string, unknown>;
    const t = coerceNumber(obj.t, i === 0 ? 0 : i);

    const positionRaw = obj.position;
    const scaleRaw = obj.scale;

    const keyframe: SceneKeyframe = { t };

    if (
      Array.isArray(positionRaw) &&
      positionRaw.length === 2 &&
      positionRaw.every((v) => typeof v === "number" && isFinite(v))
    ) {
      keyframe.position = [positionRaw[0], positionRaw[1]];
    }

    if (
      Array.isArray(scaleRaw) &&
      scaleRaw.length === 2 &&
      scaleRaw.every((v) => typeof v === "number" && isFinite(v))
    ) {
      keyframe.scale = [scaleRaw[0], scaleRaw[1]];
    }

    if (typeof obj.rotation === "number" && isFinite(obj.rotation)) {
      keyframe.rotation = obj.rotation;
    }

    if (typeof obj.opacity === "number" && isFinite(obj.opacity)) {
      keyframe.opacity = obj.opacity;
    }

    keyframes.push(keyframe);
  }

  if (!keyframes.length) {
    keyframes.push({ t: 0 });
  }

  return keyframes;
}

function normalizeScenePlan(
  raw: unknown,
  fallbackDurationSeconds: number,
  fallbackMode: AnimationMode
): ScenePlan {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid scene plan payload: expected an object");
  }

  const obj = raw as Record<string, unknown>;

  const durationSeconds = coerceNumber(
    (obj as any).durationSeconds,
    fallbackDurationSeconds
  );

  const modeValue =
    typeof obj.mode === "string" && obj.mode.trim().length > 0
      ? (obj.mode as AnimationMode)
      : fallbackMode;

  const objectsRaw = Array.isArray(obj.objects) ? obj.objects : [];
  const objects: SceneObject[] = [];

  for (let i = 0; i < objectsRaw.length; i += 1) {
    const item = objectsRaw[i];
    if (!item || typeof item !== "object") {
      continue;
    }

    const o = item as Record<string, unknown>;

    const id =
      typeof o.id === "string" && o.id.trim().length > 0
        ? o.id
        : `object-${i}`;
    const role = typeof o.role === "string" ? o.role : "";
    const kind: SceneObjectKind =
      typeof o.kind === "string" && o.kind.trim().length > 0
        ? (o.kind as SceneObjectKind)
        : "shape";

    const shapeType: SceneShapeType | undefined =
      typeof o.shapeType === "string" && o.shapeType.trim().length > 0
        ? (o.shapeType as SceneShapeType)
        : undefined;

    const parentId =
      typeof o.parentId === "string" && o.parentId.trim().length > 0
        ? o.parentId
        : undefined;
    const followTargetId =
      typeof o.followTargetId === "string" && o.followTargetId.trim().length > 0
        ? o.followTargetId
        : undefined;
    const pathId =
      typeof o.pathId === "string" && o.pathId.trim().length > 0
        ? o.pathId
        : undefined;

    const initialPositionRaw = (o as any).initialPosition;
    const initialScaleRaw = (o as any).initialScale;

    let initialPosition: [number, number] | undefined;
    if (
      Array.isArray(initialPositionRaw) &&
      initialPositionRaw.length === 2 &&
      initialPositionRaw.every((v) => typeof v === "number" && isFinite(v))
    ) {
      initialPosition = [initialPositionRaw[0], initialPositionRaw[1]];
    }

    let initialScale: [number, number] | undefined;
    if (
      Array.isArray(initialScaleRaw) &&
      initialScaleRaw.length === 2 &&
      initialScaleRaw.every((v) => typeof v === "number" && isFinite(v))
    ) {
      initialScale = [initialScaleRaw[0], initialScaleRaw[1]];
    }

    const initialRotation =
      typeof o.initialRotation === "number" && isFinite(o.initialRotation)
        ? o.initialRotation
        : undefined;
    const initialOpacity =
      typeof o.initialOpacity === "number" && isFinite(o.initialOpacity)
        ? o.initialOpacity
        : undefined;

    const styleRaw = o.style as Record<string, unknown> | undefined;
    let style: SceneObject["style"] | undefined;
    if (styleRaw && typeof styleRaw === "object") {
      const fillColorRaw = styleRaw.fillColor;
      const strokeColorRaw = styleRaw.strokeColor;

      let fillColor: [number, number, number] | undefined;
      if (
        Array.isArray(fillColorRaw) &&
        fillColorRaw.length === 3 &&
        fillColorRaw.every((v) => typeof v === "number" && isFinite(v))
      ) {
        fillColor = [fillColorRaw[0], fillColorRaw[1], fillColorRaw[2]];
      }

      let strokeColor: [number, number, number] | undefined;
      if (
        Array.isArray(strokeColorRaw) &&
        strokeColorRaw.length === 3 &&
        strokeColorRaw.every((v) => typeof v === "number" && isFinite(v))
      ) {
        strokeColor = [
          strokeColorRaw[0],
          strokeColorRaw[1],
          strokeColorRaw[2],
        ];
      }

      const strokeWidth =
        typeof styleRaw.strokeWidth === "number" &&
        isFinite(styleRaw.strokeWidth)
          ? styleRaw.strokeWidth
          : undefined;

      const textColorRaw = styleRaw.textColor;
      let textColor: [number, number, number] | undefined;
      if (
        Array.isArray(textColorRaw) &&
        textColorRaw.length === 3 &&
        textColorRaw.every((v) => typeof v === "number" && isFinite(v))
      ) {
        textColor = [textColorRaw[0], textColorRaw[1], textColorRaw[2]];
      }

      const fontSize =
        typeof styleRaw.fontSize === "number" && isFinite(styleRaw.fontSize)
          ? styleRaw.fontSize
          : undefined;

      style = {
        fillColor,
        strokeColor,
        strokeWidth,
        textColor,
        fontSize,
      };
    }

    const keyframesRaw = Array.isArray(o.keyframes) ? o.keyframes : [];
    const keyframes = normalizeKeyframes(keyframesRaw);

    const sceneObject: SceneObject = {
      id,
      role,
      kind,
      shapeType,
      parentId,
      followTargetId,
      pathId,
      initialPosition,
      initialScale,
      initialRotation,
      initialOpacity,
      style,
      keyframes,
    };

    objects.push(sceneObject);
  }

  const pathsRaw = Array.isArray(obj.paths) ? obj.paths : [];
  const paths: ScenePath[] = [];

  for (let i = 0; i < pathsRaw.length; i += 1) {
    const item = pathsRaw[i];
    if (!item || typeof item !== "object") {
      continue;
    }

    const p = item as Record<string, unknown>;

    const id =
      typeof p.id === "string" && p.id.trim().length > 0
        ? p.id
        : `path-${i}`;
    const typeValue =
      typeof p.type === "string" && p.type.trim().length > 0
        ? (p.type as ScenePath["type"])
        : "line";

    const controlPointsRaw = Array.isArray(p.controlPoints)
      ? p.controlPoints
      : [];
    const controlPoints: [number, number][] = [];

    for (let j = 0; j < controlPointsRaw.length; j += 1) {
      const cp = controlPointsRaw[j];
      if (
        Array.isArray(cp) &&
        cp.length === 2 &&
        cp.every((v) => typeof v === "number" && isFinite(v))
      ) {
        controlPoints.push([cp[0], cp[1]]);
      }
    }

    if (!controlPoints.length) {
      continue;
    }

    paths.push({ id, type: typeValue, controlPoints });
  }

  return {
    durationSeconds,
    mode: modeValue,
    objects,
    paths: paths.length ? paths : undefined,
  };
}

export function buildScenePlannerUserPrompt(options: {
  storyboard: StoryboardV2;
  mode: AnimationMode;
  inferredDurationSeconds: number;
  originalPrompt: string;
}): string {
  const lines: string[] = [];

  lines.push("You are given the user's original prompt, an animation mode, and a structured storyboard.");
  lines.push("Your task is to design a concrete ScenePlan JSON as described in the system prompt.");
  lines.push("");
  lines.push(`Animation mode: ${options.mode}`);
  lines.push(`Inferred durationSeconds (hint): ${options.inferredDurationSeconds}`);
  lines.push("");
  lines.push("Original user prompt:");
  lines.push(options.originalPrompt);
  lines.push("");
  lines.push("StoryboardV2 JSON:");
  lines.push(JSON.stringify(options.storyboard, null, 2));
  lines.push("");
  lines.push("Return ONLY the ScenePlan JSON object, with no extra commentary.");

  return lines.join("\n");
}

export class ScenePlannerAgent {
  private readonly client: LLMClient;

  constructor(client: LLMClient) {
    this.client = client;
  }

  async planScene(options: ScenePlannerAgentOptions): Promise<ScenePlan> {
    const storyboardV2 = toStoryboardV2(options.storyboard);
    const inferredDurationSeconds = inferDurationSecondsFromBeats(
      storyboardV2.timeline
    );

    const userPrompt = buildScenePlannerUserPrompt({
      storyboard: storyboardV2,
      mode: options.mode,
      inferredDurationSeconds,
      originalPrompt: options.originalPrompt,
    });

    debugLog("agent:scene-planner", "Requesting scene plan from LLM", {
      model: SCENE_PLANNER_MODEL,
      mode: options.mode,
      beatCount: storyboardV2.timeline.length,
      inferredDurationSeconds,
    });

    const response = await this.client.generate({
      model: SCENE_PLANNER_MODEL,
      systemPrompt: SCENE_PLANNER_SYSTEM_PROMPT,
      userPrompt,
      jsonMode: true,
      temperature: 0.5,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(response);
    } catch {
      throw new Error(
        "ScenePlannerAgent expected JSON response from LLM client"
      );
    }

    const scenePlan = normalizeScenePlan(
      parsed,
      inferredDurationSeconds,
      options.mode
    );

    writeDebugJSON("scene-plan-latest.json", {
      prompt: options.originalPrompt,
      mode: options.mode,
      storyboard: storyboardV2,
      scenePlan,
    });

    debugLog("agent:scene-planner", "Scene plan normalized", {
      durationSeconds: scenePlan.durationSeconds,
      objectCount: scenePlan.objects.length,
      pathCount: Array.isArray(scenePlan.paths) ? scenePlan.paths.length : 0,
    });

    return scenePlan;
  }
}
