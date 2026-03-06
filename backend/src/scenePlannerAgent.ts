import type { LLMClient, Storyboard } from "./directorAgent";
import { debugLog } from "./logger";
import { writeDebugJSON } from "./debugDump";
import type { StoryboardBeat, StoryboardV2 } from "./storyboardTypes";
import { parseStoryboardTimelineToBeats } from "./storyboardTypes";
import type {
  SceneKeyframe,
  SceneObject,
  SceneObjectKind,
  ScenePlan,
  ScenePath,
  SceneShapeType,
} from "./scenePlan";

export const SCENE_PLANNER_MODEL = "TEXT MODEL";

export const SCENE_PLANNER_SYSTEM_PROMPT = `You are MotionGen's Scene Planner.
Your job is to convert a structured storyboard (StoryboardV2) and the user's
original prompt into a concrete ScenePlan JSON.

USE VISUAL REASONING: Think like a motion designer. Consider composition,
visual hierarchy, depth (background / midground / foreground), and how
each element moves through time. Design freely — there are no fixed templates.
Create as many or as few objects as the animation truly needs.

The ScenePlan describes:
- durationSeconds: total animation length in seconds.
- objects: an array of SceneObject entries describing every important
  visual element in the scene.
- paths: optional motion paths for objects that move along arcs/orbits.

You must output ONLY a single JSON object matching this schema:
{
  "durationSeconds": number,
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

Design principles:
- Every important semantic role from the storyboard MUST map to at least
  one SceneObject. Invent roles freely to name what each element represents.
- Use stable string ids (e.g. "ball", "bg_panel", "headline_text").
- Use keyframes to capture the main motion phases:
  - t is in seconds from the start of the animation.
  - For static objects, a single keyframe with t = 0 is acceptable.
  - For moving objects, include multiple keyframes across the duration.
- Ensure visual complexity: include background, midground, and foreground
  objects. Animate at least 5 properties across the scene.
- Use spring-like pacing in keyframe timing (fast entrance, ease to rest).
- Return valid JSON only. Do not include comments or extra top-level keys.

You are not writing code. Focus on a clear, machine-readable plan that a
separate Animator will translate into MotionScript.`;

export interface ScenePlannerAgentOptions {
  storyboard: Storyboard;
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
  fallbackDurationSeconds: number
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
      ? obj.mode
      : undefined;

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

  const plan: ScenePlan = {
    durationSeconds,
    objects,
    paths: paths.length ? paths : undefined,
  };

  if (modeValue) {
    plan.mode = modeValue;
  }

  return plan;
}

export function buildScenePlannerUserPrompt(options: {
  storyboard: StoryboardV2;
  inferredDurationSeconds: number;
  originalPrompt: string;
}): string {
  const lines: string[] = [];

  lines.push("You are given the user's original prompt and a structured storyboard.");
  lines.push("Your task is to design a concrete ScenePlan JSON as described in the system prompt.");
  lines.push("Be creative and design freely — there are no fixed templates or required roles.");
  lines.push("");
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
      inferredDurationSeconds,
      originalPrompt: options.originalPrompt,
    });

    debugLog("agent:scene-planner", "Requesting scene plan from LLM", {
      model: SCENE_PLANNER_MODEL,
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

    const scenePlan = normalizeScenePlan(parsed, inferredDurationSeconds);

    writeDebugJSON("scene-plan-latest.json", {
      prompt: options.originalPrompt,
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
