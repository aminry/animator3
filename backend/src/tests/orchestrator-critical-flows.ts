import { createStudioGraph, createStudioNodes, type StudioStateValue } from "../orchestrator";
import {
  type LLMClient,
  type LLMClientGenerateOptions,
} from "../directorAgent";
import { PROMPT_CLASSIFIER_SYSTEM_PROMPT } from "../promptClassifierAgent";
import { DIRECTOR_SYSTEM_PROMPT } from "../directorAgent";
import { SCENE_PLANNER_SYSTEM_PROMPT } from "../scenePlannerAgent";
import { ANIMATOR_MODEL } from "../animatorAgent";
import type { ScenePlan } from "../scenePlan";

function expect(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const BANNER_PROMPT =
  "BANNER FLOW: Promotional banner with headline, supporting text, and CTA button.";
const GAME_PROMPT =
  "GAME DEMO FLOW: Quick ping pong game demo with paddles, ball, and score HUD.";
const PRODUCT_PROMPT =
  "PRODUCT DEMO FLOW: Product dashboard UI demo with panels and CTA.";
const DATAVIZ_PROMPT =
  "DATA VIZ FLOW: Data visualization with line chart and metric highlights.";
const CHARACTER_PROMPT =
  "CHARACTER MOMENT FLOW: Mascot character waving hello with subtle idle motion.";

const BANNER_SCENE_PLAN: ScenePlan = {
  durationSeconds: 5,
  mode: "banner",
  objects: [
    {
      id: "bg",
      role: "background",
      kind: "shape",
      keyframes: [{ t: 0 }],
    },
    {
      id: "headline",
      role: "main-text",
      kind: "text",
      keyframes: [
        { t: 0, opacity: 0 },
        { t: 1, opacity: 1, position: [400, 200] },
      ],
    },
    {
      id: "cta",
      role: "cta-text",
      kind: "text",
      keyframes: [
        { t: 0, opacity: 0 },
        { t: 1.2, opacity: 1, position: [400, 260] },
      ],
    },
  ],
};

const GAME_SCENE_PLAN: ScenePlan = {
  durationSeconds: 6,
  mode: "game-demo",
  objects: [
    {
      id: "table",
      role: "playfield",
      kind: "shape",
      keyframes: [{ t: 0 }],
    },
    {
      id: "ball",
      role: "ball",
      kind: "shape",
      keyframes: [
        { t: 0, position: [300, 220] },
        { t: 1.5, position: [400, 240] },
        { t: 3, position: [500, 260] },
      ],
    },
    {
      id: "paddleLeft",
      role: "paddle-left",
      kind: "shape",
      keyframes: [
        { t: 0, position: [260, 260] },
        { t: 2, position: [260, 220] },
      ],
    },
    {
      id: "paddleRight",
      role: "paddle-right",
      kind: "shape",
      keyframes: [
        { t: 0, position: [540, 260] },
        { t: 2, position: [540, 300] },
      ],
    },
    {
      id: "score",
      role: "score-text",
      kind: "text",
      keyframes: [
        { t: 0, opacity: 0 },
        { t: 2, opacity: 1 },
      ],
    },
  ],
};

const PRODUCT_SCENE_PLAN: ScenePlan = {
  durationSeconds: 7,
  mode: "product-demo",
  objects: [
    {
      id: "device",
      role: "device-frame",
      kind: "shape",
      keyframes: [{ t: 0 }],
    },
    {
      id: "screenMain",
      role: "app-screen-main",
      kind: "ui-element",
      keyframes: [
        { t: 0, opacity: 0 },
        { t: 1.5, opacity: 1 },
      ],
    },
    {
      id: "panel",
      role: "ui-panel",
      kind: "ui-element",
      keyframes: [
        { t: 1, opacity: 0 },
        { t: 3, opacity: 1 },
      ],
    },
    {
      id: "cta",
      role: "cta-button",
      kind: "ui-element",
      keyframes: [
        { t: 2, scale: [1, 1] },
        { t: 4, scale: [1.1, 1.1] },
      ],
    },
    {
      id: "cursor",
      role: "cursor",
      kind: "ui-element",
      keyframes: [
        { t: 1, position: [260, 320] },
        { t: 4, position: [520, 340] },
      ],
    },
  ],
};

const DATAVIZ_SCENE_PLAN: ScenePlan = {
  durationSeconds: 6,
  mode: "data-viz",
  objects: [
    {
      id: "chartArea",
      role: "chart-area",
      kind: "shape",
      keyframes: [{ t: 0 }],
    },
    {
      id: "axisX",
      role: "axis-x",
      kind: "shape",
      keyframes: [{ t: 0 }],
    },
    {
      id: "axisY",
      role: "axis-y",
      kind: "shape",
      keyframes: [{ t: 0 }],
    },
    {
      id: "line",
      role: "chart-line-main",
      kind: "shape",
      keyframes: [
        { t: 0, opacity: 0 },
        { t: 3, opacity: 1 },
      ],
    },
    {
      id: "highlight",
      role: "data-point-highlight",
      kind: "shape",
      keyframes: [
        { t: 2, opacity: 0 },
        { t: 4, opacity: 1 },
      ],
    },
  ],
};

const CHARACTER_SCENE_PLAN: ScenePlan = {
  durationSeconds: 5,
  mode: "character-moment",
  objects: [
    {
      id: "character",
      role: "character-main",
      kind: "character",
      keyframes: [
        { t: 0, position: [400, 320] },
        { t: 1, position: [405, 318] },
        { t: 2, position: [400, 320] },
      ],
    },
    {
      id: "speech",
      role: "speech-bubble",
      kind: "shape",
      keyframes: [
        { t: 1.5, opacity: 0 },
        { t: 3, opacity: 1 },
      ],
    },
    {
      id: "bg",
      role: "background",
      kind: "shape",
      keyframes: [{ t: 0 }],
    },
  ],
};

class MockLLMClient implements LLMClient {
  async generate(options: LLMClientGenerateOptions): Promise<string> {
    const { systemPrompt, userPrompt, jsonMode, model } = options;

    if (systemPrompt === PROMPT_CLASSIFIER_SYSTEM_PROMPT) {
      let mode = "banner";
      let durationSeconds = 5;
      const flags: { requiresCharacters: boolean; uiDemo: boolean; gameplay: boolean; banner: boolean } = {
        requiresCharacters: false,
        uiDemo: false,
        gameplay: false,
        banner: false,
      };

      if (userPrompt.includes("BANNER FLOW")) {
        mode = "banner";
        flags.banner = true;
        durationSeconds = 5;
      } else if (userPrompt.includes("GAME DEMO FLOW")) {
        mode = "game-demo";
        flags.gameplay = true;
        durationSeconds = 7;
      } else if (userPrompt.includes("PRODUCT DEMO FLOW")) {
        mode = "product-demo";
        flags.uiDemo = true;
        durationSeconds = 7;
      } else if (userPrompt.includes("DATA VIZ FLOW")) {
        mode = "data-viz";
        durationSeconds = 6;
      } else if (userPrompt.includes("CHARACTER MOMENT FLOW")) {
        mode = "character-moment";
        flags.requiresCharacters = true;
        durationSeconds = 5;
      } else {
        throw new Error(
          `MockLLMClient (prompt classifier) received unexpected userPrompt: ${userPrompt}`
        );
      }

      const payload = {
        mode,
        targetDurationSeconds: durationSeconds,
        flags,
      };

      return JSON.stringify(payload);
    }

    if (systemPrompt === DIRECTOR_SYSTEM_PROMPT) {
      let vibe = "";
      let colorPalette: string[] = [];
      let timeline: string[] = [];

      if (userPrompt.includes("BANNER FLOW")) {
        vibe = "Test banner flow, bold headline and smooth entrance";
        colorPalette = ["#12002b", "#ff6b00", "#ffffff"];
        timeline = [
          "Intro: background panel and logo ease in",
          "Main: headline and CTA text appear with slight bounce",
          "Outro: elements settle into a clean banner layout",
        ];
      } else if (userPrompt.includes("GAME DEMO FLOW")) {
        vibe = "Fast-paced game demo with clear table, paddles, ball, and score";
        colorPalette = ["#003366", "#00ff99", "#ffffff"];
        timeline = [
          "Intro: table and paddles appear",
          "Main: ball rallies across the table with score updating",
          "Outro: final score and logo lockup",
        ];
      } else if (userPrompt.includes("PRODUCT DEMO FLOW")) {
        vibe = "Modern product UI demo with smooth panel transitions";
        colorPalette = ["#0b1020", "#3b82f6", "#f9fafb"];
        timeline = [
          "Intro: device frame and primary dashboard appear",
          "Main: cursor highlights key panels and metrics",
          "Outro: summary state with emphasized CTA",
        ];
      } else if (userPrompt.includes("DATA VIZ FLOW")) {
        vibe = "Clean data visualization with animated chart and metrics";
        colorPalette = ["#111827", "#10b981", "#6b7280"];
        timeline = [
          "Intro: axes and chart area fade in",
          "Main: line and bars animate to show metric changes",
          "Outro: key data points highlighted with annotations",
        ];
      } else if (userPrompt.includes("CHARACTER MOMENT FLOW")) {
        vibe = "Friendly character moment with subtle idle motion";
        colorPalette = ["#111827", "#f97316", "#f9fafb"];
        timeline = [
          "Intro: mascot character appears on stage",
          "Main: character waves and blinks with gentle motion",
          "Outro: character holds a friendly resting pose",
        ];
      } else {
        throw new Error(
          `MockLLMClient (director) received unexpected userPrompt: ${userPrompt}`
        );
      }

      const payload = {
        vibe,
        colorPalette,
        timeline,
      };

      return JSON.stringify(payload);
    }

    if (systemPrompt === SCENE_PLANNER_SYSTEM_PROMPT) {
      if (userPrompt.includes("Animation mode: banner")) {
        return JSON.stringify(BANNER_SCENE_PLAN);
      }
      if (userPrompt.includes("Animation mode: game-demo")) {
        return JSON.stringify(GAME_SCENE_PLAN);
      }
      if (userPrompt.includes("Animation mode: product-demo")) {
        return JSON.stringify(PRODUCT_SCENE_PLAN);
      }
      if (userPrompt.includes("Animation mode: data-viz")) {
        return JSON.stringify(DATAVIZ_SCENE_PLAN);
      }
      if (userPrompt.includes("Animation mode: character-moment")) {
        return JSON.stringify(CHARACTER_SCENE_PLAN);
      }

      throw new Error(
        `MockLLMClient (scene planner) received unexpected userPrompt: ${userPrompt}`
      );
    }

    if (!jsonMode && model === ANIMATOR_MODEL) {
      const code = `
import { Stage } from '@motiongen/sdk';

const stage = Stage.create(800, 600, 3, 30);

const rect = stage.addShape('rectangle', {
  width: 120,
  height: 80,
  fillColor: [1, 0, 0],
});
rect.getLayer().setPosition(200, 150);

const circle = stage.addShape('circle', {
  radius: 40,
  fillColor: [0.2, 0.8, 1],
});
circle.getLayer().setPosition(500, 320);

export default stage.toJSON();
      `;

      return code.trim();
    }

    throw new Error(
      `MockLLMClient received unexpected generate() call for model=${model}`
    );
  }
}

interface FlowTestCase {
  name: string;
  prompt: string;
  expectedMode: string;
  requiredRoles: string[];
}

const FLOW_TEST_CASES: FlowTestCase[] = [
  {
    name: "banner",
    prompt: BANNER_PROMPT,
    expectedMode: "banner",
    requiredRoles: ["background", "main-text", "cta-text"],
  },
  {
    name: "game-demo",
    prompt: GAME_PROMPT,
    expectedMode: "game-demo",
    requiredRoles: ["playfield", "ball", "paddle-left", "score-text"],
  },
  {
    name: "product-demo",
    prompt: PRODUCT_PROMPT,
    expectedMode: "product-demo",
    requiredRoles: ["device-frame", "app-screen-main", "ui-panel", "cta-button"],
  },
  {
    name: "data-viz",
    prompt: DATAVIZ_PROMPT,
    expectedMode: "data-viz",
    requiredRoles: ["chart-area", "axis-x", "chart-line-main", "data-point-highlight"],
  },
  {
    name: "character-moment",
    prompt: CHARACTER_PROMPT,
    expectedMode: "character-moment",
    requiredRoles: ["character-main", "speech-bubble", "background"],
  },
];

async function runFlowTest(testCase: FlowTestCase): Promise<void> {
  const client = new MockLLMClient();
  const realNodes = createStudioNodes(client);

  const nodes = {
    ...realNodes,
    renderer: async (_state: StudioStateValue) => {
      return {};
    },
    critic: async (_state: StudioStateValue) => {
      return { critique: "ACCEPT: stub" };
    },
  };

  const graph = createStudioGraph(nodes);

  const result = await graph.invoke({
    prompt: testCase.prompt,
    assets: [],
  });

  expect(!!result.scenePlan, `Expected scenePlan for flow ${testCase.name}`);
  expect(result.mode === testCase.expectedMode, `Expected mode=${testCase.expectedMode} for flow ${testCase.name}, got ${result.mode}`);

  if (result.promptClassification) {
    expect(
      result.promptClassification.mode === testCase.expectedMode,
      `Expected promptClassification.mode=${testCase.expectedMode} for flow ${testCase.name}, got ${result.promptClassification.mode}`
    );
  }

  const scenePlan = result.scenePlan as ScenePlan;
  const roles = new Set(scenePlan.objects.map((o) => o.role));

  for (const role of testCase.requiredRoles) {
    expect(
      roles.has(role),
      `Expected scenePlan for flow ${testCase.name} to contain role "${role}"`
    );
  }

  expect(!!result.lottieJson, `Expected lottieJson for flow ${testCase.name}`);

  const metrics = result.lottieMetrics as any;
  expect(!!metrics, `Expected lottieMetrics for flow ${testCase.name}`);
  expect(
    typeof metrics.layerCount === "number" && metrics.layerCount > 0,
    `Expected positive layerCount in lottieMetrics for flow ${testCase.name}`
  );
  expect(
    typeof metrics.animatedPropertyCount === "number" &&
      metrics.animatedPropertyCount >= 0,
    `Expected numeric animatedPropertyCount in lottieMetrics for flow ${testCase.name}`
  );
}

async function run(): Promise<void> {
  console.log("\n🎬 Running Orchestrator critical flow tests (no external LLM)...\n");

  try {
    for (const testCase of FLOW_TEST_CASES) {
      await runFlowTest(testCase);
      console.log(
        `✓ Orchestrator critical flow for ${testCase.name} produced ScenePlan and Lottie with expected roles and metrics`
      );
    }

    console.log("\n✅ Orchestrator critical flow tests passed");
  } catch (error) {
    console.error("\n❌ Orchestrator critical flow tests failed:", error);
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(
    "Unexpected error while running Orchestrator critical flow tests:",
    error
  );
  process.exitCode = 1;
});
