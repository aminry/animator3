import { normalizePromptClassification } from "../promptClassifierAgent";

function expect(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function testBannerDefaults(): void {
  const raw: any = {};

  const result = normalizePromptClassification(raw);

  expect(result.mode === "banner", `Expected mode=banner, got ${result.mode}`);
  expect(
    result.targetDurationSeconds === 4,
    `Expected default durationSeconds=4 for banner, got ${result.targetDurationSeconds}`
  );
  expect(
    result.flags.banner === true,
    "Expected banner flag to be true when mode is banner"
  );
}

function testGameDemoMapping(): void {
  const raw: any = {
    mode: "game demo about ping pong",
    targetDurationSeconds: 9,
    flags: {
      gameplay: "true",
    },
  };

  const result = normalizePromptClassification(raw);

  expect(
    result.mode === "game-demo",
    `Expected mode=game-demo, got ${result.mode}`
  );
  expect(
    result.targetDurationSeconds === 9,
    `Expected targetDurationSeconds=9, got ${result.targetDurationSeconds}`
  );
  expect(
    result.flags.gameplay === true,
    "Expected gameplay flag to be true for game-demo prompts"
  );
}

function testProductDemoAndDurationFallback(): void {
  const raw: any = {
    mode: "Product UI walkthrough",
    targetDurationSeconds: "0",
    flags: {},
  };

  const result = normalizePromptClassification(raw);

  expect(
    result.mode === "product-demo",
    `Expected mode=product-demo, got ${result.mode}`
  );
  expect(
    result.targetDurationSeconds === 7,
    `Expected duration fallback=7 for product-demo, got ${result.targetDurationSeconds}`
  );
  expect(
    result.flags.uiDemo === true,
    "Expected uiDemo flag to be true for product-demo prompts"
  );
}

async function run(): Promise<void> {
  console.log("\n🎬 Running promptClassifier normalization tests...\n");

  try {
    testBannerDefaults();
    console.log("✓ normalizePromptClassification applies banner defaults");

    testGameDemoMapping();
    console.log("✓ normalizePromptClassification maps game-related prompts to game-demo with gameplay flag");

    testProductDemoAndDurationFallback();
    console.log("✓ normalizePromptClassification infers product-demo mode, duration fallback, and uiDemo flag");

    console.log("\n✅ promptClassifier normalization tests passed");
  } catch (error) {
    console.error("\n❌ promptClassifier normalization tests failed:", error);
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error("Unexpected error while running promptClassifier normalization tests:", error);
  process.exitCode = 1;
});
