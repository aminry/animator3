import { validateScenePlanAgainstLottie } from "../sceneValidation";
import type { ScenePlan } from "../scenePlan";
import type { LottieJSON } from "../types";

function expect(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function makeMinimalLottie(layers: LottieJSON["layers"]): LottieJSON {
  return {
    v: "5.7.0",
    fr: 30,
    ip: 0,
    op: 60,
    w: 512,
    h: 512,
    layers,
  };
}

function testReturnsNullWhenInputsMissing(): void {
  const scenePlan: ScenePlan = {
    durationSeconds: 2,
    mode: "banner",
    objects: [],
  };

  const lottie = makeMinimalLottie([]);

  const result1 = validateScenePlanAgainstLottie(null, lottie);
  expect(result1 === null, "Expected null when scenePlan is null");

  const result2 = validateScenePlanAgainstLottie(scenePlan, null as any);
  expect(result2 === null, "Expected null when lottie is null");
}

function testMissingLayersErrorWhenObjectsButNoLayers(): void {
  const scenePlan: ScenePlan = {
    durationSeconds: 3,
    mode: "banner",
    objects: [
      {
        id: "obj-1",
        role: "main",
        kind: "shape",
        keyframes: [{ t: 0 }, { t: 1 }],
      },
    ],
  };

  const lottie = makeMinimalLottie([]);

  const result = validateScenePlanAgainstLottie(scenePlan, lottie);
  expect(result !== null, "Expected validation summary when both inputs are present");
  expect(result!.ok === false, "Expected ok=false when no layers but objects exist");
  const hasMissingLayersError = result!.issues.some(
    (issue) => issue.type === "missing_layers" && issue.severity === "error"
  );
  expect(hasMissingLayersError, "Expected a missing_layers error issue");
}

function testKeyframeCountMismatchWhenSceneAnimatedButLottieStatic(): void {
  const scenePlan: ScenePlan = {
    durationSeconds: 2,
    mode: "banner",
    objects: [
      {
        id: "obj-1",
        role: "moving",
        kind: "shape",
        keyframes: [{ t: 0 }, { t: 1 }, { t: 2 }],
      },
    ],
  };

  const staticTransform = {
    a: { a: 0, k: [0, 0] },
    p: { a: 0, k: [256, 256] },
    s: { a: 0, k: [100, 100] },
    r: { a: 0, k: 0 },
    o: { a: 0, k: 100 },
    sk: { a: 0, k: 0 },
    sa: { a: 0, k: 0 },
  } as any;

  const lottie = makeMinimalLottie([
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: "Static Layer",
      ks: staticTransform,
      ip: 0,
      op: 60,
      st: 0,
    },
  ]);

  const result = validateScenePlanAgainstLottie(scenePlan, lottie);
  expect(result !== null, "Expected validation summary");
  const hasKeyframeWarning = result!.issues.some(
    (issue) => issue.type === "keyframe_count_mismatch"
  );
  expect(
    hasKeyframeWarning,
    "Expected keyframe_count_mismatch warning when scene has keyframes but Lottie appears static"
  );
}

function testDurationMismatchWarning(): void {
  const scenePlan: ScenePlan = {
    durationSeconds: 10,
    mode: "banner",
    objects: [],
  };

  // Lottie duration ~2 seconds (60 frames / 30fps)
  const lottie = makeMinimalLottie([
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: "Layer",
      ks: {
        a: { a: 0, k: [0, 0] },
        p: { a: 0, k: [256, 256] },
        s: { a: 0, k: [100, 100] },
        r: { a: 0, k: 0 },
        o: { a: 0, k: 100 },
        sk: { a: 0, k: 0 },
        sa: { a: 0, k: 0 },
      } as any,
      ip: 0,
      op: 60,
      st: 0,
    },
  ]);

  const result = validateScenePlanAgainstLottie(scenePlan, lottie);
  expect(result !== null, "Expected validation summary");
  const hasDurationWarning = result!.issues.some(
    (issue) => issue.type === "duration_mismatch"
  );
  expect(
    hasDurationWarning,
    "Expected duration_mismatch warning when durations differ significantly"
  );
}

async function run(): Promise<void> {
  console.log("\n🎬 Running sceneValidation unit tests...\n");

  try {
    testReturnsNullWhenInputsMissing();
    console.log("✓ validateScenePlanAgainstLottie returns null when inputs are missing");

    testMissingLayersErrorWhenObjectsButNoLayers();
    console.log("✓ missing_layers error when ScenePlan has objects but Lottie has no layers");

    testKeyframeCountMismatchWhenSceneAnimatedButLottieStatic();
    console.log("✓ keyframe_count_mismatch warning when ScenePlan has keyframes but Lottie appears static");

    testDurationMismatchWarning();
    console.log("✓ duration_mismatch warning when durations differ significantly");

    console.log("\n✅ sceneValidation unit tests passed");
  } catch (error) {
    console.error("\n❌ sceneValidation unit tests failed:", error);
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error("Unexpected error while running sceneValidation unit tests:", error);
  process.exitCode = 1;
});
