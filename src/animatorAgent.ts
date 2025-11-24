import type { Storyboard, LLMClient } from './directorAgent';

export const ANIMATOR_MODEL = 'GPT OSS 120B 128k';

export const ANIMATOR_SYSTEM_PROMPT_BASE =
  'You are a TypeScript expert. Use the provided SDK. Do not use external libraries. Return only code.';

export interface AnimatorAgentGenerateOptions {
  storyboard: Storyboard;
  sdkInterfaceDefinition: string;
}

export function buildAnimatorSystemPrompt(sdkInterfaceDefinition: string): string {
  const trimmed = sdkInterfaceDefinition.trim();

  if (!trimmed) {
    return ANIMATOR_SYSTEM_PROMPT_BASE;
  }

  return (
    ANIMATOR_SYSTEM_PROMPT_BASE +
    '\n\n' +
    'Here is the MotionGen SDK TypeScript interface definition (.d.ts):\n\n' +
    trimmed
  );
}

export function buildAnimatorUserPrompt(storyboard: Storyboard): string {
  const lines: string[] = [
    'Translate the following storyboard into a complete TypeScript script using the MotionGen SDK.',
    'The script should:',
    '- Import the SDK from "@motiongen/sdk".',
    '- Create a Stage and add text and/or shapes that reflect the storyboard.',
    '- Use stage.addText() for text elements.',
    '- Use Motion.spring() when configuring spring-based animations.',
    '- Export the final Lottie JSON as the default export.',
    '',
    'Storyboard JSON:',
    JSON.stringify(storyboard, null, 2)
  ];

  return lines.join('\n');
}

export function extractCodeFromLLMResponse(response: string): string {
  const trimmed = response.trim();

  const fenceMatch = trimmed.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
  if (fenceMatch && fenceMatch[1]) {
    return fenceMatch[1].trim();
  }

  if (trimmed.startsWith('```') && trimmed.endsWith('```')) {
    const inner = trimmed.slice(3, -3).trim();
    return inner;
  }

  return trimmed;
}

export class AnimatorAgent {
  private readonly client: LLMClient;

  constructor(client: LLMClient) {
    this.client = client;
  }

  async generateMotionScript(options: AnimatorAgentGenerateOptions): Promise<string> {
    const systemPrompt = buildAnimatorSystemPrompt(options.sdkInterfaceDefinition);
    const userPrompt = buildAnimatorUserPrompt(options.storyboard);

    const response = await this.client.generate({
      model: ANIMATOR_MODEL,
      systemPrompt,
      userPrompt,
      jsonMode: false
    });

    return extractCodeFromLLMResponse(response);
  }
}
