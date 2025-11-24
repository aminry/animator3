import type { LLMClient } from './directorAgent';

export interface CriticIssue {
  severity: 'critical' | 'minor';
  description: string;
}

export interface CriticResult {
  status: 'PASS' | 'FAIL';
  score: number;
  issues: CriticIssue[];
  suggestion: string;
}

export interface CriticAgentEvaluateOptions {
  userPrompt: string;
  frames: string[];
}

export const CRITIC_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

export const CRITIC_SYSTEM_PROMPT = `You are a QA Visual Specialist. You are looking at three keyframes (Start, Middle, End) of an animation.
Your job is to verify if the animation meets the User's Intent and Design Standards.

# CRITERIA
1. Legibility: Is text contrast > 4.5:1? Is text cut off by the edge?
2. Relevance: Does the imagery match the prompt? (e.g., if prompt says "Halloween", is it dark/orange?)
3. Motion Quality: (Inferred) Does the middle frame show significant change from the start frame? (If identical, animation is broken).

# QUESTIONS TO CONSIDER
- Does the text contrast well with the background?
- Is any text cut off?
- Does the overall vibe match the user's prompt?

# OUTPUT FORMAT (JSON ONLY)
{
  "status": "PASS" | "FAIL",
  "score": number (0-100),
  "issues": [
    { "severity": "critical|minor", "description": "Text 'Sale' overlaps with logo at t=1.5s" }
  ],
  "suggestion": "Move the 'Sale' text layer y-position up by 50px."
}`;

function normalizeCriticResult(raw: unknown): CriticResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid critic result payload: expected an object');
  }

  const obj = raw as Record<string, unknown> & {
    pass?: unknown;
    critique?: unknown;
  };

  let status: 'PASS' | 'FAIL';
  if (typeof obj.status === 'string') {
    const upper = obj.status.toUpperCase();
    status = upper === 'PASS' ? 'PASS' : 'FAIL';
  } else if (typeof obj.pass === 'boolean') {
    status = obj.pass ? 'PASS' : 'FAIL';
  } else {
    throw new Error('Invalid critic result payload: missing status/pass field');
  }

  const scoreValue = typeof obj.score === 'number' ? obj.score : status === 'PASS' ? 100 : 0;
  const score = Math.max(0, Math.min(100, scoreValue));

  const issuesRaw = Array.isArray(obj.issues) ? obj.issues : [];
  const issues: CriticIssue[] = issuesRaw
    .map(issue => {
      if (!issue || typeof issue !== 'object') {
        return null;
      }

      const issueObj = issue as Record<string, unknown>;
      const description = typeof issueObj.description === 'string' ? issueObj.description.trim() : '';
      if (!description) {
        return null;
      }

      const severityRaw = typeof issueObj.severity === 'string' ? issueObj.severity : 'minor';
      const severity: 'critical' | 'minor' = severityRaw === 'critical' ? 'critical' : 'minor';

      return { severity, description };
    })
    .filter((value): value is CriticIssue => Boolean(value));

  const critiqueText = typeof obj.critique === 'string' ? obj.critique.trim() : '';
  if (!issues.length && critiqueText) {
    issues.push({ severity: status === 'FAIL' ? 'critical' : 'minor', description: critiqueText });
  }

  let suggestion = '';
  if (typeof obj.suggestion === 'string' && obj.suggestion.trim()) {
    suggestion = obj.suggestion.trim();
  } else if (critiqueText) {
    suggestion = critiqueText;
  } else if (status === 'PASS') {
    suggestion = 'No significant visual issues detected.';
  } else {
    suggestion = 'Improve text contrast, ensure no text is cut off, and adjust motion to better match the requested vibe.';
  }

  return {
    status,
    score,
    issues,
    suggestion
  };
}

export function buildCriticUserPrompt(options: CriticAgentEvaluateOptions): string {
  const lines: string[] = [];

  lines.push('You will receive the original user prompt and three keyframes (start, middle, end) of an animation.');
  lines.push('Use the system instructions to evaluate legibility, relevance, and motion quality.');
  lines.push('');
  lines.push(`User Prompt: ${options.userPrompt}`);
  lines.push('');
  lines.push('Frames (start, middle, end):');

  options.frames.forEach((frame, index) => {
    lines.push(`Frame ${index}: ${frame}`);
  });

  lines.push('');
  lines.push('Respond using the JSON-only format described in the system prompt.');

  return lines.join('\n');
}

export class CriticAgent {
  private readonly client: LLMClient;

  constructor(client: LLMClient) {
    this.client = client;
  }

  async evaluate(options: CriticAgentEvaluateOptions): Promise<CriticResult> {
    const userPrompt = buildCriticUserPrompt(options);

    const response = await this.client.generate({
      model: CRITIC_MODEL,
      systemPrompt: CRITIC_SYSTEM_PROMPT,
      userPrompt,
      jsonMode: true,
      temperature: 0.4
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(response);
    } catch {
      throw new Error('CriticAgent expected JSON response from LLM client');
    }

    return normalizeCriticResult(parsed);
  }
}
