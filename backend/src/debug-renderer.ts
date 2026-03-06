
import * as fs from "fs";
import * as path from "path";
import type { LottieJSON } from "./types";
import { renderFramesWithBrowser } from "./browserRenderer";

const lottieJsonPath = path.join(process.cwd(), "golden_tests", "test13-text-layer.json");

async function run() {
  const raw = fs.readFileSync(lottieJsonPath, "utf8");
  const lottieJson = JSON.parse(raw) as LottieJSON;

  const timestamps = [0];
  const images = await renderFramesWithBrowser(lottieJson, timestamps);
  if (!images.length) {
    throw new Error("No images returned from browser renderer");
  }

  const buffer = Buffer.from(images[0], "base64");
  const outputPath = path.join(process.cwd(), "debug-text-test-browser.png");
  fs.writeFileSync(outputPath, buffer);
  console.log("Saved debug-text-test-browser.png, size:", buffer.length);
}

run().catch(err => {
  console.error(err);
  process.exitCode = 1;
});

