import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config();

const envFlag = process.env.MOTIONGEN_DEBUG_DUMP;
const debugEnabled = envFlag === "1" || envFlag === "true";
const debugDirEnv = process.env.MOTIONGEN_DEBUG_DIR;

function getBaseDir(): string {
  if (debugDirEnv && debugDirEnv.length > 0) {
    return debugDirEnv;
  }
  return path.join(__dirname, "..", "debug");
}

export function writeDebugText(fileName: string, contents: string): void {
  if (!debugEnabled) {
    return;
  }

  try {
    const baseDir = getBaseDir();
    fs.mkdirSync(baseDir, { recursive: true });
    const filePath = path.join(baseDir, fileName);
    fs.writeFileSync(filePath, contents);
  } catch {
  }
}

export function writeDebugJSON(fileName: string, data: unknown): void {
  if (!debugEnabled) {
    return;
  }

  try {
    const text = JSON.stringify(data, null, 2);
    writeDebugText(fileName, text);
  } catch {
  }
}
