import type { LLMClient } from "./directorAgent";
import { debugLog } from "./logger";
import { writeDebugJSON } from "./debugDump";
import type { ScenePlan, SceneObject, SceneKeyframe } from "./scenePlan";
import type { CriticResult } from "./criticAgent";

export const SCENE_REFINEMENT_MODEL = "TEXT MODEL";

export interface SceneRefinementTarget {
  id?: string;
  role?: string;
}

export type SceneRefinementAction =
  | "add-object"
  | "update-object"
  | "remove-object"
  | "tweak-keyframes"
  | string;

export interface SceneRefinementOperation {
  target?: SceneRefinementTarget;
  action: SceneRefinementAction;
  object?: Partial<SceneObject>;
  reason?: string;
}

export interface SceneRefinementPatch {
  operations: SceneRefinementOperation[];
  durationSeconds?: number;
}

export interface SceneRefinementAgentOptions {
  scenePlan: ScenePlan;
  criticResult: CriticResult;
  originalPrompt: string;
}

export const SCENE_REFINEMENT_SYSTEM_PROMPT = `You are MotionGen's Scene Refinement Specialist.
Your job is to take an existing ScenePlan JSON and a CriticResult JSON and produce a SMALL, TARGETED patch
that improves the scene while preserving the overall intent and structure.

The inputs are:
- ScenePlan: current object-based description of the scene (objects, roles, keyframes, paths).
- CriticResult: visual QA feedback including issues[] and optional fixes[] entries that reference roles/layers.

You must output ONLY a JSON patch object with this structure:

{
  "durationSeconds"?: number,
  "operations": [
    {
      "action": "add-object" | "update-object" | "remove-object" | "tweak-keyframes" | string,
      "target"?: {
        "id"?: string,
        "role"?: string
      },
      "object"?: {
        "id"?: string,
        "role"?: string,
        "kind"?: string,
        "shapeType"?: string,
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
        "keyframes"?: [
          {
            "t": number,
            "position"?: [number, number],
            "scale"?: [number, number],
            "rotation"?: number,
            "opacity"?: number
          }
        ]
      },
      "reason"?: string
    }
  ]
}

Guidelines:
- Think in terms of PATCHES, not full rewrites.
- Prefer a SMALL number of focused operations (1–5) that directly address the CriticResult issues/fixes.
- Use CriticResult.fixes when available to choose which objects/roles to target.
- Use "add-object" to introduce missing key roles (e.g. ball, score-text, background accents).
- Use "update-object" or "tweak-keyframes" to adjust the motion, layout, or style of existing objects.
- Use "remove-object" sparingly, only when elements clearly harm clarity or composition.
- When you add or update objects, keep ids stable and human-readable when possible
  (e.g. "ball", "score_text", "bg_panel_1").
- Do NOT change the high-level mode or radically change the scene; focus on local improvements.
- Return VALID JSON only. Do not include comments or any extra top-level keys.
`;

function buildSceneRefinementUserPrompt(options: SceneRefinementAgentOptions): string {
  const lines: string[] = [];

  lines.push(
    "You are given the user's original prompt, the current ScenePlan JSON, and the latest CriticResult JSON."
  );
  lines.push(
    "Propose a SMALL patch to the ScenePlan that addresses critic issues while preserving the overall intent and structure."
  );
  lines.push("");
  lines.push("Original user prompt:");
  lines.push(options.originalPrompt);
  lines.push("");
  lines.push("Current ScenePlan JSON:");
  lines.push(JSON.stringify(options.scenePlan, null, 2));
  lines.push("");
  lines.push("Latest CriticResult JSON:");
  lines.push(JSON.stringify(options.criticResult, null, 2));
  lines.push("");
  lines.push("Return ONLY the patch JSON object as described in the system prompt.");

  return lines.join("\n");
}

function normalizeSceneRefinementPatch(raw: unknown): SceneRefinementPatch {
  if (!raw || typeof raw !== "object") {
    return { operations: [] };
  }

  const obj = raw as Record<string, unknown> & {
    operations?: unknown;
    durationSeconds?: unknown;
  };

  const durationSeconds =
    typeof obj.durationSeconds === "number" && isFinite(obj.durationSeconds)
      ? obj.durationSeconds
      : undefined;

  let operationsRaw: unknown[] = [];
  if (Array.isArray(obj.operations)) {
    operationsRaw = obj.operations as unknown[];
  } else if (Array.isArray(raw)) {
    operationsRaw = raw as unknown[];
  }

  const operations: SceneRefinementOperation[] = operationsRaw
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const e = entry as Record<string, unknown>;

      const actionRaw =
        typeof e.action === "string" && e.action.trim().length > 0
          ? (e.action.trim() as SceneRefinementAction)
          : ("update-object" as SceneRefinementAction);

      const targetRaw =
        e.target && typeof e.target === "object"
          ? (e.target as Record<string, unknown>)
          : undefined;

      const id =
        targetRaw && typeof targetRaw.id === "string" && targetRaw.id.trim().length > 0
          ? targetRaw.id.trim()
          : undefined;
      const role =
        targetRaw && typeof targetRaw.role === "string" && targetRaw.role.trim().length > 0
          ? targetRaw.role.trim()
          : undefined;

      const objectRaw =
        e.object && typeof e.object === "object"
          ? (e.object as Partial<SceneObject>)
          : undefined;

      const reason =
        typeof e.reason === "string" && e.reason.trim().length > 0
          ? e.reason.trim()
          : undefined;

      if (!id && !role && !objectRaw) {
        return null;
      }

      const target: SceneRefinementTarget | undefined = id || role ? { id, role } : undefined;

      const op: SceneRefinementOperation = {
        action: actionRaw,
        target,
      };

      if (objectRaw) {
        op.object = objectRaw;
      }

      if (reason) {
        op.reason = reason;
      }

      return op;
    })
    .filter((value): value is SceneRefinementOperation => Boolean(value));

  return {
    operations,
    durationSeconds,
  };
}

function normalizeKeyframesForPatch(raw: unknown): SceneKeyframe[] {
  if (!Array.isArray(raw)) {
    return [{ t: 0 }];
  }

  const keyframes: SceneKeyframe[] = [];

  for (let i = 0; i < raw.length; i += 1) {
    const item = raw[i];
    if (!item || typeof item !== "object") {
      continue;
    }

    const obj = item as Record<string, unknown>;
    const tValue = obj.t;
    const t =
      typeof tValue === "number" && isFinite(tValue)
        ? tValue
        : i === 0
        ? 0
        : i;

    const keyframe: SceneKeyframe = { t };

    const positionRaw = obj.position;
    if (
      Array.isArray(positionRaw) &&
      positionRaw.length === 2 &&
      positionRaw.every((v) => typeof v === "number" && isFinite(v))
    ) {
      keyframe.position = [positionRaw[0], positionRaw[1]];
    }

    const scaleRaw = obj.scale;
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

function applySceneRefinementPatch(
  scenePlan: ScenePlan,
  patch: SceneRefinementPatch
): ScenePlan {
  const updated: ScenePlan = {
    ...scenePlan,
    durationSeconds:
      typeof patch.durationSeconds === "number" && isFinite(patch.durationSeconds)
        ? patch.durationSeconds
        : scenePlan.durationSeconds,
    objects: [...scenePlan.objects],
    paths: scenePlan.paths ? [...scenePlan.paths] : undefined,
  };

  function findObjectIndex(target?: SceneRefinementTarget): number {
    if (!target) {
      return -1;
    }

    if (target.id) {
      const byId = updated.objects.findIndex((o) => o.id === target.id);
      if (byId !== -1) {
        return byId;
      }
    }

    if (target.role) {
      const byRole = updated.objects.findIndex((o) => o.role === target.role);
      if (byRole !== -1) {
        return byRole;
      }
    }

    return -1;
  }

  for (const op of patch.operations) {
    const action = (op.action || "update-object").toLowerCase();

    if (action === "remove-object") {
      const index = findObjectIndex(op.target);
      if (index >= 0) {
        updated.objects.splice(index, 1);
      }
      continue;
    }

    if (action === "add-object") {
      const base = op.object ?? {};
      const id =
        typeof base.id === "string" && base.id.trim().length > 0
          ? base.id.trim()
          : `refined-object-${updated.objects.length}`;

      const role =
        typeof base.role === "string" && base.role.trim().length > 0
          ? base.role.trim()
          : op.target?.role ?? "";

      const kind =
        typeof base.kind === "string" && base.kind.trim().length > 0
          ? base.kind
          : "shape";

      const objectKeyframes =
        Array.isArray(base.keyframes) && base.keyframes.length > 0
          ? normalizeKeyframesForPatch(base.keyframes as unknown[])
          : [{ t: 0 }];

      const newObject: SceneObject = {
        id,
        role,
        kind,
        shapeType: base.shapeType,
        parentId: base.parentId,
        followTargetId: base.followTargetId,
        pathId: base.pathId,
        initialPosition: base.initialPosition,
        initialScale: base.initialScale,
        initialRotation: base.initialRotation,
        initialOpacity: base.initialOpacity,
        style: base.style,
        keyframes: objectKeyframes,
      };

      updated.objects.push(newObject);
      continue;
    }

    const index = findObjectIndex(op.target);
    if (index < 0) {
      continue;
    }

    const existing = updated.objects[index];
    const base = op.object ?? {};

    const merged: SceneObject = {
      ...existing,
      ...base,
      id:
        typeof base.id === "string" && base.id.trim().length > 0
          ? base.id.trim()
          : existing.id,
      role:
        typeof base.role === "string" && base.role.trim().length > 0
          ? base.role.trim()
          : existing.role,
      kind:
        typeof base.kind === "string" && base.kind.trim().length > 0
          ? (base.kind as SceneObject["kind"])
          : existing.kind,
      shapeType:
        typeof base.shapeType === "string" && base.shapeType.trim().length > 0
          ? base.shapeType
          : existing.shapeType,
      parentId:
        typeof base.parentId === "string" && base.parentId.trim().length > 0
          ? base.parentId
          : existing.parentId,
      followTargetId:
        typeof base.followTargetId === "string" && base.followTargetId.trim().length > 0
          ? base.followTargetId
          : existing.followTargetId,
      pathId:
        typeof base.pathId === "string" && base.pathId.trim().length > 0
          ? base.pathId
          : existing.pathId,
      initialPosition:
        base.initialPosition !== undefined
          ? base.initialPosition
          : existing.initialPosition,
      initialScale:
        base.initialScale !== undefined ? base.initialScale : existing.initialScale,
      initialRotation:
        base.initialRotation !== undefined
          ? base.initialRotation
          : existing.initialRotation,
      initialOpacity:
        base.initialOpacity !== undefined
          ? base.initialOpacity
          : existing.initialOpacity,
      style: base.style ? { ...existing.style, ...base.style } : existing.style,
      keyframes:
        Array.isArray(base.keyframes) && base.keyframes.length > 0
          ? normalizeKeyframesForPatch(base.keyframes as unknown[])
          : existing.keyframes,
    };

    updated.objects[index] = merged;
  }

  return updated;
}

export class SceneRefinementAgent {
  private readonly client: LLMClient;

  constructor(client: LLMClient) {
    this.client = client;
  }

  async refineScene(options: SceneRefinementAgentOptions): Promise<ScenePlan> {
    const userPrompt = buildSceneRefinementUserPrompt(options);

    const sceneObjectCount = Array.isArray(options.scenePlan.objects)
      ? options.scenePlan.objects.length
      : 0;

    debugLog("agent:scene-refinement", "Requesting scene refinement from LLM", {
      model: SCENE_REFINEMENT_MODEL,
      sceneObjectCount,
      issuesCount: Array.isArray(options.criticResult.issues)
        ? options.criticResult.issues.length
        : 0,
      fixesCount: Array.isArray(options.criticResult.fixes)
        ? options.criticResult.fixes.length
        : 0,
    });

    const response = await this.client.generate({
      model: SCENE_REFINEMENT_MODEL,
      systemPrompt: SCENE_REFINEMENT_SYSTEM_PROMPT,
      userPrompt,
      jsonMode: true,
      temperature: 0.4,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(response);
    } catch {
      throw new Error("SceneRefinementAgent expected JSON response from LLM client");
    }

    const patch = normalizeSceneRefinementPatch(parsed);
    const refined = applySceneRefinementPatch(options.scenePlan, patch);

    writeDebugJSON("scene-plan-refined-latest.json", {
      prompt: options.originalPrompt,
      criticResult: options.criticResult,
      before: options.scenePlan,
      patch,
      after: refined,
    });

    debugLog("agent:scene-refinement", "Scene plan refined", {
      beforeObjectCount: options.scenePlan.objects.length,
      afterObjectCount: refined.objects.length,
      operationCount: patch.operations.length,
    });

    return refined;
  }
}
