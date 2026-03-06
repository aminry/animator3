import dotenv from "dotenv";

dotenv.config();

export type LogDetails = Record<string, unknown> | undefined;

function parseBooleanFlag(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

const DEBUG_ENABLED =
  parseBooleanFlag(process.env.MOTIONGEN_DEBUG) ||
  parseBooleanFlag(process.env.MOTIONGEN_ORCHESTRATOR_DEBUG);

export function debugLog(scope: string, message: string, details?: LogDetails): void {
  if (!DEBUG_ENABLED) {
    return;
  }

  const ts = new Date().toISOString();
  if (details && Object.keys(details).length > 0) {
    // eslint-disable-next-line no-console
    console.log(`[${ts}] [${scope}] ${message}`, details);
  } else {
    // eslint-disable-next-line no-console
    console.log(`[${ts}] [${scope}] ${message}`);
  }
}
