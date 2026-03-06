import { Annotation, StateGraph, END } from "@langchain/langgraph";
import type { Storyboard, LLMClient } from "./directorAgent";
import { DirectorAgent } from "./directorAgent";
import { AnimatorAgent } from "./animatorAgent";
import { CriticAgent, CRITIC_MAX_FRAMES } from "./criticAgent";
import type { CriticResult } from "./criticAgent";
import { runSandbox } from "./sandboxRunner";
import type { SandboxResult } from "./sandboxRunner";
import type { LottieJSON } from "./types";
import { renderFrames } from "./renderer";
import { GroqLLMClient } from "./groqClient";
import { debugLog } from "./logger";
import type { LottieMetricsSummary } from "./sharedApiTypes";
import { computeLottieMetrics } from "./lottieMetrics";
import { writeDebugJSON, writeDebugText } from "./debugDump";
import type { ScenePlan, AnimationMode } from "./scenePlan";
import { ScenePlannerAgent } from "./scenePlannerAgent";
import { SceneRefinementAgent } from "./sceneRefinementAgent";
import { validateScenePlanAgainstLottie } from "./sceneValidation";
import type { PromptClassification } from "./promptClassifierAgent";
import { PromptClassifierAgent } from "./promptClassifierAgent";

export interface StudioStateValue {
  prompt: string;
  assets: string[];
  storyboard: Storyboard | null;
  scenePlan: ScenePlan | null;
  code: string | null;
  lottieJson: unknown;
  frames?: string[];
  errorLogs: string[];
  lottieMetrics?: LottieMetricsSummary;
  critique?: string;
  criticResult?: CriticResult;
  attemptCount: number;
  promptClassification?: PromptClassification | null;
  mode?: AnimationMode | null;
  targetDurationSecondsHint?: number;
}

export const StudioState = Annotation.Root({
  prompt: Annotation(),
  assets: Annotation(),
  storyboard: Annotation(),
  scenePlan: Annotation(),
  code: Annotation(),
  lottieJson: Annotation(),
  frames: Annotation(),
  errorLogs: Annotation({
    // OVERRIDE instead of concat so each node can reset errors
    reducer: (_curr: string[], next: string[]) => next,
    default: () => [] as string[],
  }),
  critique: Annotation(),
  criticResult: Annotation(),
  attemptCount: Annotation({
    reducer: (_curr: number, next: number) => next,
    default: () => 0,
  }),
  lottieMetrics: Annotation(),
  promptClassification: Annotation(),
  mode: Annotation(),
  targetDurationSecondsHint: Annotation(),
});

export type StudioNodeResult =
  | Partial<StudioStateValue>
  | Promise<Partial<StudioStateValue>>;

export interface StudioNodes {
  promptClassifier(state: StudioStateValue): StudioNodeResult;
  director(state: StudioStateValue): StudioNodeResult;
  scenePlanner(state: StudioStateValue): StudioNodeResult;
  sceneRefinement(state: StudioStateValue): StudioNodeResult;
  animator(state: StudioStateValue): StudioNodeResult;
  sandbox(state: StudioStateValue): StudioNodeResult;
  renderer(state: StudioStateValue): StudioNodeResult;
  critic(state: StudioStateValue): StudioNodeResult;
}

export interface StudioGraph {
  invoke(
    initialState: Partial<StudioStateValue>,
    config?: { recursionLimit?: number; [key: string]: unknown }
  ): Promise<StudioStateValue>;
}

export function createStudioGraph(nodes: StudioNodes): StudioGraph {
  const workflow = new StateGraph(StudioState)
    .addNode("promptClassifier", (state: StudioStateValue) =>
      nodes.promptClassifier(state)
    )
    .addNode("director", (state: StudioStateValue) => nodes.director(state))
    .addNode("scenePlanner", (state: StudioStateValue) =>
      nodes.scenePlanner(state)
    )
    .addNode("sceneRefinement", (state: StudioStateValue) =>
      nodes.sceneRefinement(state)
    )
    .addNode("animator", (state: StudioStateValue) => nodes.animator(state))
    .addNode("sandbox", (state: StudioStateValue) => nodes.sandbox(state))
    .addNode("renderer", (state: StudioStateValue) => nodes.renderer(state))
    .addNode("critic", (state: StudioStateValue) => nodes.critic(state));

  // Linear edges
  workflow.addEdge("__start__", "promptClassifier");
  workflow.addEdge("promptClassifier", "director");
  workflow.addEdge("director", "scenePlanner");
  workflow.addEdge("scenePlanner", "animator");
  workflow.addEdge("animator", "sandbox");
  workflow.addEdge("renderer", "critic");
   workflow.addEdge("sceneRefinement", "animator");

  // Conditional edge for compilation errors
  workflow.addConditionalEdges("sandbox", (state: StudioStateValue) => {
    if (
      Array.isArray(state.errorLogs) &&
      state.errorLogs.length > 0 &&
      state.attemptCount < 5
    ) {
      return "animator";
    }
    return "renderer";
  });

  // Conditional edge for visual quality check
  workflow.addConditionalEdges("critic", (state: StudioStateValue) => {
    const shouldRetry =
      typeof state.critique === "string" &&
      state.critique.includes("REJECT") &&
      state.attemptCount < 5;

    if (!shouldRetry) {
      return END;
    }

    // When we have a ScenePlan and structured critic feedback, refine the scene
    // before asking the Animator to regenerate MotionScript.
    if (state.scenePlan && state.criticResult) {
      return "sceneRefinement";
    }

    // Fallback: no scene plan or critic result available, retry animator directly.
    return "animator";
  });

  const graph = workflow.compile();
  return graph as unknown as StudioGraph;
}

const SDK_INTERFACE_DEFINITION = `
declare module '@motiongen/sdk' {
  export type ColorRGB=[number,number,number];
  export type EasingName='linear'|'easeIn'|'easeOut'|'easeInOut';
  export type Easing=EasingName|[number,number,number,number];
  export interface TextStyle{fontSize?:number;fontFamily?:string;color?:ColorRGB;justification?:0|1|2;}
  export type ShapeType='rectangle'|'roundedRectangle'|'circle'|'ellipse'|'polygon'|'star';
  export interface ShapeStyle{fillColor?:ColorRGB;strokeColor?:ColorRGB;strokeWidth?:number;width?:number;height?:number;cornerRadius?:number;radius?:number;radiusX?:number;radiusY?:number;points?:number;innerRadius?:number;outerRadius?:number;}
  export interface MotionScalar{from?:number;to:number;}
  export interface MotionVector2{from?:[number,number];to:[number,number];}
  export interface MotionColor{from?:ColorRGB;to:ColorRGB;}
  export interface MotionProps{position?:MotionVector2;opacity?:MotionScalar;scale?:MotionVector2;rotation?:MotionScalar;fillColor?:MotionColor;color?:MotionColor;}
  export interface SpringConfig{stiffness:number;damping:number;}
  export interface MotionTiming{start?:number;end?:number;}
  export interface MotionConfig{props:MotionProps;spring?:SpringConfig;easing?:Easing;delay?:number;duration?:number;time?:MotionTiming;}
  export class MotionElement{animate(config:MotionConfig):MotionElement;}
  export interface StaggerOptions{delay:number;}
  export class MotionGroup{stagger(elements:MotionElement[],baseConfig:MotionConfig,options:StaggerOptions):void;}
  export class Stage{constructor(width?:number,height?:number,durationSeconds?:number,fps?:number);static create(width?:number,height?:number,durationSeconds?:number,fps?:number):Stage;addText(content:string,style?:TextStyle):MotionElement;addShape(type:ShapeType,style?:ShapeStyle):MotionElement;createGroup():MotionGroup;toJSON(pretty?:boolean):unknown;}
  export const Motion:{Stage:typeof Stage;spring(config:SpringConfig):SpringConfig;}
}
`.trim();

function createFallbackStoryboard(prompt: string): Storyboard {
  return {
    vibe: "Fallback storyboard",
    colorPalette: ["#12002b", "#ff6b00"],
    timeline: [prompt],
  };
}

const MAX_CRITIC_FRAMES = CRITIC_MAX_FRAMES;

function computeCriticTimestamps(
  durationSeconds: number,
  mode?: AnimationMode | null
): number[] {
  const clampedDuration = durationSeconds > 0 ? durationSeconds : 0.1;

  let frameCount: number;
  if (clampedDuration <= 3) {
    frameCount = 4;
  } else if (clampedDuration <= 7) {
    frameCount = 6;
  } else if (clampedDuration <= 14) {
    frameCount = 8;
  } else {
    frameCount = 9;
  }

  const highMotionModes: AnimationMode[] = [
    "game-demo",
    "product-demo",
    "character-moment",
  ];

  if (mode && highMotionModes.includes(mode)) {
    if (clampedDuration > 4 && frameCount < 7) {
      frameCount = 7;
    }
    if (clampedDuration > 8 && frameCount < 9) {
      frameCount = 9;
    }
  }

  frameCount = Math.min(frameCount, MAX_CRITIC_FRAMES);

  if (frameCount <= 1) {
    return [0];
  }

  let positions: number[];
  switch (frameCount) {
    case 4:
      positions = [0, 0.3, 0.7, 1];
      break;
    default: {
      const step = 1 / (frameCount - 1);
      positions = Array.from({ length: frameCount }, (_, i) => i * step);
      break;
    }
  }

  return positions.map((p) => p * clampedDuration);
}

export function createStudioNodes(llmClient: LLMClient): StudioNodes {
  const promptClassifierAgent = new PromptClassifierAgent(llmClient);
  const directorAgent = new DirectorAgent(llmClient);
  const animatorAgent = new AnimatorAgent(llmClient);
  const criticAgent = new CriticAgent(llmClient);
  const scenePlannerAgent = new ScenePlannerAgent(llmClient);
  const sceneRefinementAgent = new SceneRefinementAgent(llmClient);

  return {
    async promptClassifier(state: StudioStateValue) {
      const assets = Array.isArray(state.assets) ? state.assets : [];

      debugLog(
        "orchestrator:promptClassifier",
        "Classifying prompt for animation mode and duration",
        {
          prompt: state.prompt,
          assetsCount: assets.length,
        }
      );

      const classification = await promptClassifierAgent.classify({
        prompt: state.prompt,
        assets,
      });

      return {
        promptClassification: classification,
        mode: classification.mode,
        targetDurationSecondsHint: classification.targetDurationSeconds,
      };
    },

    async director(state: StudioStateValue) {
      debugLog("orchestrator:director", "Planning storyboard", {
        prompt: state.prompt,
      });
      const mode: AnimationMode | null =
        (state.mode as AnimationMode | null) ?? null;
      const classification =
        (state.promptClassification as PromptClassification | null) ?? null;
      const targetDurationSecondsHint =
        typeof state.targetDurationSecondsHint === "number" &&
        isFinite(state.targetDurationSecondsHint) &&
        state.targetDurationSecondsHint > 0
          ? state.targetDurationSecondsHint
          : undefined;

      let storyboard: Storyboard;
      if (!mode && !classification && targetDurationSecondsHint === undefined) {
        storyboard = await directorAgent.planStoryboard(state.prompt);
      } else {
        storyboard = await directorAgent.planStoryboardForMode({
          prompt: state.prompt,
          mode,
          classification,
          targetDurationSecondsHint,
        });
      }

      debugLog("orchestrator:director", "Storyboard planned", {
        vibe: storyboard.vibe,
        timelineLength: storyboard.timeline.length,
      });

      debugLog("orchestrator:director", "Storyboard sample", {
        firstTimelineEntries: storyboard.timeline.slice(0, 3),
        colorPaletteSize: storyboard.colorPalette.length,
      });

      return { storyboard };
    },

    async scenePlanner(state: StudioStateValue) {
      const baseStoryboard =
        state.storyboard ?? createFallbackStoryboard(state.prompt);

      const mode: AnimationMode =
        (state.mode as AnimationMode | null) ?? "banner";

      debugLog(
        "orchestrator:scenePlanner",
        "Planning scene from storyboard",
        {
          mode,
          prompt: state.prompt,
          hasStoryboard: Boolean(state.storyboard),
        }
      );

      const scenePlan = await scenePlannerAgent.planScene({
        storyboard: baseStoryboard,
        mode,
        originalPrompt: state.prompt,
      });

      writeDebugJSON("scene-plan-latest.json", {
        prompt: state.prompt,
        mode,
        storyboard: baseStoryboard,
        scenePlan,
      });

      return { scenePlan };
    },

    async sceneRefinement(state: StudioStateValue) {
      const scenePlan = state.scenePlan;
      const criticResult = state.criticResult;

      if (!scenePlan || !criticResult) {
        debugLog(
          "orchestrator:sceneRefinement",
          "Skipping scene refinement because scenePlan or criticResult is missing",
          {
            hasScenePlan: Boolean(scenePlan),
            hasCriticResult: Boolean(criticResult),
          }
        );

        return {};
      }

      debugLog(
        "orchestrator:sceneRefinement",
        "Refining scene plan using critic feedback",
        {
          objectCount: Array.isArray(scenePlan.objects)
            ? scenePlan.objects.length
            : 0,
          issuesCount: Array.isArray(criticResult.issues)
            ? criticResult.issues.length
            : 0,
          fixesCount: Array.isArray(criticResult.fixes)
            ? criticResult.fixes.length
            : 0,
        }
      );

      const refinedScenePlan = await sceneRefinementAgent.refineScene({
        scenePlan,
        criticResult,
        originalPrompt: state.prompt,
      });

      return {
        scenePlan: refinedScenePlan,
      };
    },

    async animator(state: StudioStateValue) {
      const baseStoryboard =
        state.storyboard ?? createFallbackStoryboard(state.prompt);

      const scenePlan = state.scenePlan ?? null;

      // Use critic feedback and error logs as additional context for retries
      const critiqueText =
        typeof state.critique === "string" && state.critique.length > 0
          ? `\n\nPrevious visual critique from art director:\n${state.critique}\n\nAddress these issues while preserving the user intent and storyboard structure.`
          : "";

      const errorText =
        Array.isArray(state.errorLogs) && state.errorLogs.length > 0
          ? `\n\nPrevious compilation/runtime errors:\n${state.errorLogs.join(
              "\n"
            )}\n\nFix all of these errors in the new code.`
          : "";

      const enhancedPrompt = `${state.prompt}${critiqueText}${errorText}`;

      debugLog(
        "orchestrator:animator",
        "Generating MotionScript from storyboard and scene plan (when available)",
        {
          prompt: state.prompt,
          vibe: baseStoryboard.vibe,
          timelineLength: baseStoryboard.timeline.length,
          hasScenePlan: Boolean(scenePlan),
          sceneObjectCount: Array.isArray(scenePlan?.objects)
            ? scenePlan?.objects.length
            : 0,
          previousAttemptCount: state.attemptCount,
        }
      );

      const code = await animatorAgent.generateMotionScript({
        storyboard: baseStoryboard,
        scenePlan,
        sdkInterfaceDefinition: SDK_INTERFACE_DEFINITION,
        originalPrompt: enhancedPrompt, // was state.prompt
        criticResult: state.criticResult ?? null,
      });

      const attempt = (state.attemptCount ?? 0) + 1;

      debugLog("orchestrator:animator", "MotionScript generated", {
        attemptCount: attempt,
        codeLength: code.length,
      });

      writeDebugText("motionscript-latest.ts", code);

      return {
        code,
        attemptCount: attempt,
        errorLogs: [], // will replace previous errors due to new reducer
      };
    },

    async sandbox(state: StudioStateValue) {
      if (!state.code) {
        debugLog(
          "orchestrator:sandbox",
          "No code available for sandbox execution",
          {
            prompt: state.prompt,
          }
        );
        return {
          lottieJson: null,
          errorLogs: ["No code was generated"],
        };
      }

      debugLog("orchestrator:sandbox", "Running sandbox", {
        codeLength: state.code.length,
      });

      const result: SandboxResult = await runSandbox(state.code);

      if (result.ok) {
        const lottie = result.json as LottieJSON;

        debugLog("orchestrator:sandbox", "Sandbox produced Lottie JSON", {
          hasJson: Boolean(lottie),
        });

        const metrics = computeLottieMetrics(lottie);

        debugLog("orchestrator:sandbox", "Lottie metrics", { metrics });

        writeDebugJSON("lottie-latest.json", lottie);
        writeDebugJSON("lottie-metrics-latest.json", metrics);

        if (state.scenePlan) {
          const validation = validateScenePlanAgainstLottie(
            state.scenePlan,
            lottie
          );

          if (validation) {
            debugLog(
              "orchestrator:validation",
              "ScenePlan vs Lottie validation summary",
              {
                ok: validation.ok,
                issueCount: validation.issues.length,
              }
            );

            writeDebugJSON("scene-validation-latest.json", {
              scenePlan: state.scenePlan,
              validation,
            });
          }
        }

        return {
          lottieJson: lottie,
          errorLogs: [],
          lottieMetrics: metrics,
        };
      }

      debugLog("orchestrator:sandbox", "Sandbox failed", {
        errorType: result.errorType,
        message: result.message,
      });

      return {
        lottieJson: null,
        errorLogs: [result.message],
      };
    },

    async renderer(state: StudioStateValue) {
      const lottie = state.lottieJson as LottieJSON | null;

      if (!lottie) {
        debugLog(
          "orchestrator:renderer",
          "No lottieJson present, skipping frame rendering",
          {}
        );
        return {
          frames: [],
        };
      }

      const fr =
        typeof (lottie as any).fr === "number" && (lottie as any).fr > 0
          ? (lottie as any).fr
          : 30;
      const ip =
        typeof (lottie as any).ip === "number" ? (lottie as any).ip : 0;
      const op =
        typeof (lottie as any).op === "number"
          ? (lottie as any).op
          : ip + fr * 3;
      const durationSeconds = (op - ip) / fr;

      const mode: AnimationMode | null =
        (state.mode as AnimationMode | null) ?? null;

      const timestamps = computeCriticTimestamps(durationSeconds, mode);

      debugLog("orchestrator:renderer", "Rendering frames", {
        durationSeconds,
        mode,
        timestamps,
      });

      try {
        const images = await renderFrames(lottie, timestamps);

        debugLog("orchestrator:renderer", "Rendered frames", {
          count: images.length,
        });

        return {
          frames: images,
        };
      } catch (error) {
        debugLog("orchestrator:renderer", "Error while rendering frames", {
          error: error instanceof Error ? error.message : String(error),
        });

        return {
          frames: [],
          errorLogs: [
            ...((state.errorLogs as string[]) ?? []),
            `Renderer error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          ],
        };
      }
    },

    async critic(state: StudioStateValue) {
      const framesFromState = Array.isArray(state.frames) ? state.frames : [];
      const imageFrames = framesFromState
        .filter((img): img is string => typeof img === "string")
        // Cap to a reasonable number for long animations
        .slice(0, MAX_CRITIC_FRAMES);

      debugLog("orchestrator:critic", "Passing frames to critic", {
        framesCount: imageFrames.length,
        firstFramePrefix: imageFrames[0]?.slice(0, 40),
      });

      const result = await criticAgent.evaluate({
        userPrompt: state.prompt,
        frames: imageFrames,
      });

      const prefix = result.status === "PASS" ? "ACCEPT" : "REJECT";
      const summary =
        result.suggestion ||
        (result.issues.length ? result.issues[0].description : "");

      debugLog("orchestrator:critic", "Critic evaluation completed", {
        status: result.status,
        score: result.score,
        issuesCount: result.issues.length,
      });

      return {
        critique: `${prefix}: ${summary}`,
        criticResult: result,
      };
    },
  };
}

const llmClient = new GroqLLMClient();
export const studioGraph: StudioGraph = createStudioGraph(
  createStudioNodes(llmClient)
);
