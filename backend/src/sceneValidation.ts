import type { ScenePlan } from "./scenePlan";
import type { LottieJSON } from "./types";

export interface SceneValidationIssue {
  type:
    | "missing_layers"
    | "duration_mismatch"
    | "keyframe_count_mismatch"
    | "keyframe_time_mismatch";
  severity: "info" | "warning" | "error";
  message: string;
  details?: Record<string, unknown>;
}

export interface SceneValidationSummary {
  ok: boolean;
  objectCount: number;
  lottieLayerCount: number;
  sceneKeyframeCount: number;
  lottieKeyframeCount: number;
  sceneDurationSeconds: number;
  lottieDurationSeconds: number;
  sceneMaxKeyframeTimeSeconds: number;
  lottieMaxKeyframeTimeSeconds: number;
  issues: SceneValidationIssue[];
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

function getKeyframeStatsFromProperty(value: unknown): {
  count: number;
  maxFrame: number;
} {
  if (!value || typeof value !== "object") {
    return { count: 0, maxFrame: 0 };
  }

  const obj = value as { a?: unknown; k?: unknown };
  const k = obj.k as unknown;

  if (Array.isArray(k)) {
    let count = 0;
    let maxFrame = 0;

    for (let i = 0; i < k.length; i += 1) {
      const item = k[i];
      if (!item || typeof item !== "object") {
        continue;
      }
      const frame = (item as { t?: unknown }).t;
      const t = coerceNumber(frame, NaN);
      if (isFinite(t)) {
        count += 1;
        if (t > maxFrame) {
          maxFrame = t;
        }
      }
    }

    return { count, maxFrame };
  }

  return { count: 0, maxFrame: 0 };
}

function extractLottieKeyframeStats(lottie: LottieJSON): {
  totalKeyframes: number;
  maxFrame: number;
} {
  let totalKeyframes = 0;
  let maxFrame = 0;

  if (!Array.isArray(lottie.layers)) {
    return { totalKeyframes, maxFrame };
  }

  for (let i = 0; i < lottie.layers.length; i += 1) {
    const layer = lottie.layers[i] as any;
    const ks = layer && typeof layer === "object" ? (layer.ks as unknown) : undefined;

    if (!ks || typeof ks !== "object") {
      continue;
    }

    const transform = ks as Record<string, unknown>;

    const props = [
      transform.p,
      transform.a,
      transform.s,
      transform.r,
      transform.o,
      transform.sk,
      transform.sa,
    ];

    for (let j = 0; j < props.length; j += 1) {
      const stats = getKeyframeStatsFromProperty(props[j]);
      totalKeyframes += stats.count;
      if (stats.maxFrame > maxFrame) {
        maxFrame = stats.maxFrame;
      }
    }
  }

  return { totalKeyframes, maxFrame };
}

export function validateScenePlanAgainstLottie(
  scenePlan: ScenePlan | null | undefined,
  lottie: LottieJSON | null | undefined
): SceneValidationSummary | null {
  if (!scenePlan || !lottie) {
    return null;
  }

  const objectCount = Array.isArray(scenePlan.objects)
    ? scenePlan.objects.length
    : 0;
  const sceneDurationSeconds = coerceNumber(
    scenePlan.durationSeconds,
    0
  );

  let sceneKeyframeCount = 0;
  let sceneMaxKeyframeTimeSeconds = 0;

  if (Array.isArray(scenePlan.objects)) {
    for (let i = 0; i < scenePlan.objects.length; i += 1) {
      const obj = scenePlan.objects[i];
      if (!obj || !Array.isArray(obj.keyframes)) {
        continue;
      }
      sceneKeyframeCount += obj.keyframes.length;
      for (let j = 0; j < obj.keyframes.length; j += 1) {
        const kf = obj.keyframes[j];
        const t = coerceNumber(kf?.t, NaN);
        if (isFinite(t) && t > sceneMaxKeyframeTimeSeconds) {
          sceneMaxKeyframeTimeSeconds = t;
        }
      }
    }
  }

  const fr = coerceNumber(lottie.fr, 30);
  const ip = coerceNumber((lottie as any).ip, 0);
  const op = coerceNumber((lottie as any).op, ip + fr * 3);
  const lottieDurationSeconds = fr > 0 ? (op - ip) / fr : 0;

  const lottieLayerCount = Array.isArray(lottie.layers)
    ? lottie.layers.length
    : 0;

  const { totalKeyframes: lottieKeyframeCount, maxFrame } =
    extractLottieKeyframeStats(lottie);
  const lottieMaxKeyframeTimeSeconds = fr > 0 ? maxFrame / fr : 0;

  const issues: SceneValidationIssue[] = [];

  if (objectCount > 0 && lottieLayerCount === 0) {
    issues.push({
      type: "missing_layers",
      severity: "error",
      message:
        "ScenePlan defines objects but the resulting Lottie JSON has no layers.",
      details: { objectCount, lottieLayerCount },
    });
  } else if (objectCount > 0 && lottieLayerCount < objectCount) {
    issues.push({
      type: "missing_layers",
      severity: "warning",
      message:
        "Lottie JSON has fewer layers than ScenePlan objects. Some planned objects may have been ignored.",
      details: { objectCount, lottieLayerCount },
    });
  }

  if (sceneDurationSeconds > 0 && lottieDurationSeconds > 0) {
    const diff = Math.abs(lottieDurationSeconds - sceneDurationSeconds);
    const allowed = Math.max(0.5, sceneDurationSeconds * 0.25);
    if (diff > allowed) {
      issues.push({
        type: "duration_mismatch",
        severity: "warning",
        message:
          "Lottie duration differs significantly from ScenePlan duration.",
        details: {
          sceneDurationSeconds,
          lottieDurationSeconds,
          differenceSeconds: diff,
        },
      });
    }
  }

  if (sceneKeyframeCount > 0 && lottieKeyframeCount === 0) {
    issues.push({
      type: "keyframe_count_mismatch",
      severity: "warning",
      message:
        "ScenePlan defines keyframes but the Lottie transform data appears static.",
      details: { sceneKeyframeCount, lottieKeyframeCount },
    });
  } else if (
    sceneKeyframeCount > 0 &&
    lottieKeyframeCount > 0 &&
    sceneKeyframeCount >= lottieKeyframeCount * 3 &&
    sceneKeyframeCount - lottieKeyframeCount >= 5
  ) {
    issues.push({
      type: "keyframe_count_mismatch",
      severity: "warning",
      message:
        "Lottie JSON has far fewer transform keyframes than ScenePlan specifies.",
      details: { sceneKeyframeCount, lottieKeyframeCount },
    });
  }

  if (
    sceneMaxKeyframeTimeSeconds > 0 &&
    lottieMaxKeyframeTimeSeconds > 0
  ) {
    const diff = Math.abs(
      lottieMaxKeyframeTimeSeconds - sceneMaxKeyframeTimeSeconds
    );
    const allowed = Math.max(0.5, sceneDurationSeconds * 0.25);
    if (diff > allowed) {
      issues.push({
        type: "keyframe_time_mismatch",
        severity: "warning",
        message:
          "Latest Lottie keyframe time differs significantly from ScenePlan.",
        details: {
          sceneMaxKeyframeTimeSeconds,
          lottieMaxKeyframeTimeSeconds,
          differenceSeconds: diff,
        },
      });
    }
  }

  const ok = !issues.some((issue) => issue.severity === "error");

  return {
    ok,
    objectCount,
    lottieLayerCount,
    sceneKeyframeCount,
    lottieKeyframeCount,
    sceneDurationSeconds,
    lottieDurationSeconds,
    sceneMaxKeyframeTimeSeconds,
    lottieMaxKeyframeTimeSeconds,
    issues,
  };
}
