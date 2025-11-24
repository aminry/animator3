export interface Storyboard {
  vibe: string;
  colorPalette: string[];
  timeline: string[];
}

export interface LLMClientGenerateOptions {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  jsonMode: boolean;
}

export interface LLMClient {
  generate(options: LLMClientGenerateOptions): Promise<string>;
}

export const DIRECTOR_MODEL = 'GPT OSS 120B 128k';

export const DIRECTOR_SYSTEM_PROMPT =
  "You are an Art Director. Output JSON defining the 'Vibe', 'Color Palette' (Hex codes), and 'Timeline' (Beat sheet).";

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(item => typeof item === 'string') as string[];
}

export function normalizeStoryboard(raw: unknown): Storyboard {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid storyboard payload: expected an object');
  }

  const obj = raw as Record<string, unknown>;

  const vibeValue =
    typeof obj.vibe === 'string'
      ? obj.vibe
      : typeof (obj as any).Vibe === 'string'
      ? (obj as any).Vibe
      : '';

  const paletteRaw =
    (obj as any).colorPalette !== undefined
      ? (obj as any).colorPalette
      : (obj as any).ColorPalette;

  const timelineRaw =
    (obj as any).timeline !== undefined ? (obj as any).timeline : (obj as any).Timeline;

  const colorPalette = normalizeStringArray(paletteRaw);
  const timeline = normalizeStringArray(timelineRaw);

  if (!vibeValue || !colorPalette.length || !timeline.length) {
    throw new Error('Invalid storyboard payload: missing required fields');
  }

  return {
    vibe: vibeValue,
    colorPalette,
    timeline
  };
}

export class DirectorAgent {
  private readonly client: LLMClient;

  constructor(client: LLMClient) {
    this.client = client;
  }

  async planStoryboard(prompt: string): Promise<Storyboard> {
    const response = await this.client.generate({
      model: DIRECTOR_MODEL,
      systemPrompt: DIRECTOR_SYSTEM_PROMPT,
      userPrompt: prompt,
      jsonMode: true
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(response);
    } catch {
      throw new Error('DirectorAgent expected JSON response from LLM client');
    }

    return normalizeStoryboard(parsed);
  }
}
