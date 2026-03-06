// renderer.ts
import type { LottieJSON } from "./types";
import { debugLog } from "./logger";
import { renderFramesWithBrowser } from "./browserRenderer";

export interface RenderFramesOptions {
  width?: number;
  height?: number;
}

export async function renderFrames(
  lottieJson: LottieJSON,
  timestamps: number[],
  options: RenderFramesOptions = {}
): Promise<string[]> {
  if (!Array.isArray(timestamps) || timestamps.length === 0) {
    throw new Error("timestamps must be a non-empty array");
  }

  debugLog("renderer:lottie", "Using headless browser renderer via lottie-web", {
    timestampsCount: timestamps.length
  });

  const images = await renderFramesWithBrowser(lottieJson, timestamps, options);

  debugLog("renderer:lottie", "Rendered frames via headless browser", {
    count: images.length,
    firstFramePrefix: images[0]?.slice(0, 40)
  });

  return images;
}
