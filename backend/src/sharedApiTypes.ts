import type { LottieJSON } from "./types";
import type { Storyboard } from "./directorAgent";
import type { StoryboardBeat, StoryboardV2 } from "./storyboardTypes";
import type { ScenePlan, AnimationMode } from "./scenePlan";
import type { PromptClassification } from "./promptClassifierAgent";
import type { CriticResult } from "./criticAgent";

/**
 * Shared domain types intended to be consumed by both backend and frontend.
 */

export interface LottieMetricsSummary {
  layerCount: number;
  textLayerCount: number;
  shapeLayerCount: number;
  solidLayerCount: number;
  imageLayerCount: number;
  animatedPropertyCount: number;
  averageKeyframesPerAnimatedProperty: number;
}

export type AgentSource = "Director" | "Animator" | "Critic";

export interface LogEntry {
  source: AgentSource;
  message: string;
  timestamp: number;
}

/**
 * High-level studio/orchestrator state that can be surfaced to the frontend.
 */
export interface StudioSummary {
  prompt: string;
  assets: string[];
  storyboard: Storyboard | null;
  code: string | null;
  lottieJson: LottieJSON | unknown | null;
  errorLogs: string[];
  lottieMetrics?: LottieMetricsSummary;
  critique?: string;
  criticResult?: CriticResult;  // <-- add this line
  attemptCount: number;
  mode?: AnimationMode | null;
  promptClassification?: PromptClassification | null;
}

export type { StoryboardBeat, StoryboardV2, ScenePlan };

/**
 * Streaming events for a future SSE/WebSocket based agent stream.
 * These are not yet wired to a concrete transport but are shared so
 * frontend and backend can agree on the payload shapes.
 */
export interface StudioLogEvent {
  type: "log";
  payload: LogEntry;
}

export interface StudioCodeUpdateEvent {
  type: "code_update";
  code: string;
}

export interface StudioLottieUpdateEvent {
  type: "lottie_update";
  lottie: LottieJSON | unknown;
}

export type StudioStreamEvent =
  | StudioLogEvent
  | StudioCodeUpdateEvent
  | StudioLottieUpdateEvent;

/**
 * HTTP API DTOs for the sandbox (build-lottie) endpoint.
 * These mirror the JSON payloads served by sandboxServer.ts.
 */
export interface BuildLottieRequestBody {
  code: string;
}

export interface BuildLottieSuccessResponse {
  ok: true;
  lottie: LottieJSON | unknown;
}

export interface BuildLottieErrorResponse {
  ok: false;
  errorType?: string;
  message?: string;
  stack?: string;
  diagnostics?: string[];
}

export type BuildLottieResponse = BuildLottieSuccessResponse | BuildLottieErrorResponse;

/**
 * HTTP API DTOs for the renderer /render-frames endpoint.
 */
export interface RenderFramesRequestBody {
  lottie_json: LottieJSON;
  timestamps: number[];
}

export interface RenderFramesSuccessResponse {
  ok: true;
  images: string[];
}

export interface RenderFramesErrorResponse {
  ok: false;
  errorType: string;
  message: string;
}

export type RenderFramesResponse = RenderFramesSuccessResponse | RenderFramesErrorResponse;

export interface OrchestrateRequestBody {
  prompt: string;
  assets?: string[];
}

export interface OrchestrateSuccessResponse {
  ok: true;
  studio: StudioSummary;
}

export interface OrchestrateErrorResponse {
  ok: false;
  errorType: string;
  message: string;
}

export type OrchestrateResponse = OrchestrateSuccessResponse | OrchestrateErrorResponse;
