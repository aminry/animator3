import type { LLMClient } from "./directorAgent";
import { debugLog } from "./logger";

export interface CriticIssue {
  severity: "critical" | "minor";
  description: string;
}

export interface CriticFixTarget {
  role?: string;
  layer?: string;
  objectId?: string;
}

export type CriticFixAction =
  | "add-or-strengthen"
  | "adjust-motion"
  | "adjust-layout"
  | "adjust-color-contrast"
  | "increase-complexity"
  | "decrease-complexity"
  | "remove-or-simplify"
  | "other"
  | string;

export interface CriticFix {
  target: CriticFixTarget;
  action: CriticFixAction;
  reason: string;
  details?: string;
}

export interface CriticResult {
  status: "PASS" | "FAIL";
  score: number;
  issues: CriticIssue[];
  suggestion: string;
  fixes?: CriticFix[];
}

export interface CriticAgentEvaluateOptions {
  userPrompt: string;
  frames: string[]; // base64 or data URLs
}

export const CRITIC_MODEL = "VISION MODEL";

export const CRITIC_MAX_FRAMES = 5;

export const CRITIC_SYSTEM_PROMPT = `You are a Motion Graphics QA and Art Director.
You are given information about three keyframes (Start, Middle, End) of an animation and the user's original prompt.
Your job is to judge whether the animation is high-quality and aligned with the user's intent, and to provide precise guidance
for how the Animator should improve the next iteration.

Assume:
- The animation is built with a vector-style engine (shapes, text, transforms, easing, springs, stagger, layers).
- The Animator can change layout, layering, colors, motion timing, easing, and complexity.

# EVALUATION CRITERIA

1. Goal & Vibe Alignment
   - Does the overall look, tone, and focus match the user's prompt and goal?
   - Does the main content of the frames clearly communicate the key idea (headline, core concept, or visual metaphor)?

2. Visual Hierarchy & Composition
   - Is there a clear hierarchy (primary vs secondary elements)?
   - Is the layout balanced (not awkwardly empty or cluttered)?
   - Is there apparent depth (background vs foreground), or is everything flat?
   - Are there obvious composition problems (important text pushed to edges, weird empty gaps, overlaps)?

3. Legibility & Contrast
   - Is text legible in all frames (good contrast, reasonable size, not cut off)?
   - Are important shapes/text clearly visible and not hidden behind other elements?

4. Motion & Physics Quality (inferred from differences between frames)
   - Is there meaningful change between start, middle, and end frames?
     - If start and middle are almost identical, motion is likely broken or too subtle.
   - Does the motion feel rich and engaging rather than trivial?
     - Multiple elements moving, not just a single object nudging slightly.
     - Evidence of stagger, secondary motion, or physics-like behavior (overshoot, settle, parallax).
   - Does the end frame look like a stable, readable resting pose?

5. Visual Richness & Creativity
   - Does it go beyond a single rectangle + one text line?
   - Are there accent shapes, midground elements, or other details adding depth and interest?
   - Is it stylistically consistent (not random colors or mismatched styles)?

# QUALITY BAR

Use the following mental scale:
- 0–40: Poor. Broken, unreadable, or wildly off-prompt.
- 40–70: Low quality. Technically works but looks very simplistic or awkward.
- 70–85: Acceptable but needs clear improvements to feel polished.
- 85–100: Strong. Polished, visually engaging, and aligned with the prompt.

Rules:
- If score < 80 OR any critical issue exists, set "status" to "FAIL".
- Only set "status" to "PASS" when:
  - Score ≥ 80, AND
  - There are no remaining critical issues.

# IMPORTANT BEHAVIOR RULES

- You must make a PASS or FAIL decision using only the provided information (prompt + images).
- NEVER ask the user to provide additional images, frames, or descriptions.
- If for any reason the images are not visible to you, assume they exist and imagine plausible frames based on the user prompt,
  then still assign a score and suggest concrete improvements.
- Do not respond with messages like "please provide proper images" or "I cannot evaluate"; instead, do your best with what you have.

# WHAT YOUR FEEDBACK SHOULD DO

Your feedback will be fed back into an Animator model that can change the MotionScript code.
So your "issues" and "suggestion" must be:

- Concrete: specify WHAT to change (e.g., "add more midground accents", "increase motion variety on foreground text").
- Actionable: use language that maps to operations like:
  - add/remove shapes or text
  - adjust layout (centered, top third, bottom strip, etc.)
  - adjust motion (stronger entrance, more stagger, more/less spring, more/less parallax)
  - adjust color/contrast
- Focused on improving:
  - layer depth (background/midground/foreground),
  - motion richness (stagger, secondary motion, physics),
  - clarity & legibility,
  - creative alignment with the user’s goal.

# OPTIONAL STRUCTURED FIXES

When possible, also include a "fixes" array to make your feedback machine-actionable.
Each fix should reference specific roles, layers, or object IDs when you can identify them.

Example structure:

"fixes": [
  {
    "target": {
      "role": "ball" | "score-text" | "paddle-left" | "paddle-right" | "...",
      "layer": "background" | "midground" | "foreground",
      "objectId": "scene-object-id-if-known"
    },
    "action": "add-or-strengthen" | "adjust-motion" | "adjust-layout" | "adjust-color-contrast" | "increase-complexity" | "decrease-complexity" | "remove-or-simplify" | "other",
    "reason": "Short explanation for why this change is needed",
    "details": "Optional extra guidance with concrete instructions for the Animator"
  }
]

Use "fixes" especially when status is "FAIL". You may omit "fixes" when you cannot confidently propose targeted changes.

# OUTPUT FORMAT (JSON ONLY)

Return a single JSON object:

{
  "status": "PASS" | "FAIL",
  "score": number,          // 0–100
  "issues": [
    {
      "severity": "critical" | "minor",
      "description": "Concrete description of a problem and where it appears"
    }
  ],
  "suggestion": "One coherent paragraph telling the Animator exactly what to improve in the next iteration.",
  "fixes": [
    {
      "target": {
        "role": "string (optional)",
        "layer": "background" | "midground" | "foreground" | "string (optional)",
        "objectId": "string (optional)"
      },
      "action": "add-or-strengthen" | "adjust-motion" | "adjust-layout" | "adjust-color-contrast" | "increase-complexity" | "decrease-complexity" | "remove-or-simplify" | "other",
      "reason": "Short explanation for why this change is needed",
      "details": "Optional extra guidance with concrete instructions for the Animator"
    }
  ]
}

Guidelines:
- Include at least 1 issue when status is "FAIL"; mark the most important ones as "critical".
- When status is "PASS", you may still include minor issues but keep them clearly labeled as "minor".
- The "suggestion" should summarize the most important changes needed for the next attempt, especially when status is "FAIL".
- When status is "FAIL", include at least one targeted entry in "fixes" whenever you can.
`;

function normalizeCriticResult(raw: unknown): CriticResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid critic result payload: expected an object");
  }

  const obj = raw as Record<string, unknown> & {
    pass?: unknown;
    critique?: unknown;
  };

  let status: "PASS" | "FAIL";
  if (typeof obj.status === "string") {
    const upper = obj.status.toUpperCase();
    status = upper === "PASS" ? "PASS" : "FAIL";
  } else if (typeof obj.pass === "boolean") {
    status = obj.pass ? "PASS" : "FAIL";
  } else {
    throw new Error("Invalid critic result payload: missing status/pass field");
  }

  const scoreValue =
    typeof obj.score === "number" ? obj.score : status === "PASS" ? 100 : 0;
  const score = Math.max(0, Math.min(100, scoreValue));

  const issuesRaw = Array.isArray(obj.issues) ? obj.issues : [];
  const issues: CriticIssue[] = issuesRaw
    .map((issue) => {
      if (!issue || typeof issue !== "object") {
        return null;
      }

      const issueObj = issue as Record<string, unknown>;
      const description =
        typeof issueObj.description === "string"
          ? issueObj.description.trim()
          : "";
      if (!description) {
        return null;
      }

      const severityRaw =
        typeof issueObj.severity === "string" ? issueObj.severity : "minor";
      const severity: "critical" | "minor" =
        severityRaw === "critical" ? "critical" : "minor";

      return { severity, description };
    })
    .filter((value): value is CriticIssue => Boolean(value));

  const critiqueText =
    typeof obj.critique === "string" ? obj.critique.trim() : "";
  if (!issues.length && critiqueText) {
    issues.push({
      severity: status === "FAIL" ? "critical" : "minor",
      description: critiqueText,
    });
  }

  let suggestion = "";
  if (typeof obj.suggestion === "string" && obj.suggestion.trim()) {
    suggestion = obj.suggestion.trim();
  } else if (critiqueText) {
    suggestion = critiqueText;
  } else if (status === "PASS") {
    suggestion = "No significant visual issues detected.";
  } else {
    suggestion =
      "Improve text contrast, ensure no text is cut off, and adjust motion to better match the requested vibe.";
  }

  const fixesRaw = Array.isArray((obj as any).fixes)
    ? ((obj as any).fixes as unknown[])
    : [];
  const fixes: CriticFix[] = fixesRaw
    .map((fix) => {
      if (!fix || typeof fix !== "object") {
        return null;
      }

      const fixObj = fix as Record<string, unknown>;
      const targetRaw =
        fixObj.target && typeof fixObj.target === "object"
          ? (fixObj.target as Record<string, unknown>)
          : {};
      const role =
        typeof targetRaw.role === "string" ? targetRaw.role.trim() : "";
      const layer =
        typeof targetRaw.layer === "string" ? targetRaw.layer.trim() : "";
      const objectId =
        typeof targetRaw.objectId === "string"
          ? targetRaw.objectId.trim()
          : "";
      const actionRaw =
        typeof fixObj.action === "string" ? fixObj.action.trim() : "";
      const reasonRaw =
        typeof fixObj.reason === "string" ? fixObj.reason.trim() : "";
      const detailsRaw =
        typeof fixObj.details === "string" ? fixObj.details.trim() : "";
      if (!role && !layer && !objectId && !reasonRaw) {
        return null;
      }
      const target: CriticFixTarget = {};
      if (role) target.role = role;
      if (layer) target.layer = layer;
      if (objectId) target.objectId = objectId;
      const action: CriticFixAction = (actionRaw || "other") as CriticFixAction;
      const reason =
        reasonRaw ||
        (role || layer || objectId || "Targeted fix suggested by critic.");
      const normalized: CriticFix = {
        target,
        action,
        reason,
      };
      if (detailsRaw) {
        normalized.details = detailsRaw;
      }
      return normalized;
    })
    .filter((value): value is CriticFix => Boolean(value));

  return {
    status,
    score,
    issues,
    suggestion,
    fixes,
  };
}

export function buildCriticUserPrompt(
  options: CriticAgentEvaluateOptions
): string {
  const lines: string[] = [];

  lines.push(
    "You will receive the original user prompt and several keyframes of an animation as images."
  );
  lines.push(
    "The images are in temporal order: frame 0 = start, last frame = end. Use them to judge visual quality and motion."
  );
  lines.push(
    "Your JSON response will guide an Animator model that will modify MotionScript code and regenerate the animation."
  );
  lines.push("");
  lines.push(`User Prompt: ${options.userPrompt}`);
  lines.push("");
  lines.push("Frames (start, middle, end):");
  options.frames.forEach((frame, index) => {
    lines.push(`Frame ${index}: ${frame}`);
  });
  lines.push("");
  lines.push(`Number of image frames provided: ${options.frames.length}`);
  lines.push(
    "The frame pixels are provided directly via image attachments, not described in text."
  );
  lines.push("");
  lines.push(
    "Respond using the JSON-only format described in the system prompt."
  );

  return lines.join("\n");
}

export class CriticAgent {
  private readonly client: LLMClient;

  constructor(client: LLMClient) {
    this.client = client;
  }

  async evaluate(options: CriticAgentEvaluateOptions): Promise<CriticResult> {
    const frames = Array.isArray(options.frames)
      ? options.frames.slice(0, CRITIC_MAX_FRAMES)
      : [];

    const userPrompt = buildCriticUserPrompt({
      ...options,
      frames,
    });

    debugLog("agent:critic", "Requesting critic evaluation from LLM", {
      model: CRITIC_MODEL,
      framesCount: frames.length,
      userPromptSnippet: options.userPrompt.slice(0, 120),
    });

    const response = await this.client.generate({
      model: CRITIC_MODEL,
      systemPrompt: CRITIC_SYSTEM_PROMPT,
      userPrompt,
      jsonMode: true,
      temperature: 0.4,
      imageUrls: frames,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(response);
    } catch {
      throw new Error("CriticAgent expected JSON response from LLM client");
    }
    const result = normalizeCriticResult(parsed);

    debugLog("agent:critic", "Critic result normalized", {
      status: result.status,
      score: result.score,
      issuesCount: result.issues.map((i: any) => JSON.stringify(i)).join(", "),
    });

    return result;
  }
}
