import type { Storyboard, LLMClient } from './directorAgent';

export const ANIMATOR_MODEL = 'GPT OSS 120B 128k';

export const ANIMATOR_SYSTEM_PROMPT_BASE = `You are a Senior Creative Technologist.
You will convert a JSON Storyboard into a TypeScript executable using the MotionGen "MotionScript" SDK.

# SDK INTERFACE (Strictly follow this)
`;

export const ANIMATOR_FEW_SHOT_EXAMPLES = `EXAMPLE 1: Simple title spring-in

Storyboard JSON:
{
  "meta": { "duration": 3, "fps": 30, "bg_color": "#000000" },
  "assets": [
    { "id": "title", "type": "text", "content": "Spooky Halloween Sale" }
  ],
  "timeline": [
    {
      "time": 0,
      "target_asset_id": "title",
      "action": "enter",
      "parameters": { "x": 400, "y": 700, "scale": 1, "opacity": 0 },
      "physics": {
        "type": "spring",
        "config": { "stiffness": 200, "damping": 20 }
      }
    }
  ]
}

TypeScript:
import { Stage, Motion } from '@motiongen/sdk';

const stage = Stage.create(800, 600, 3, 30);

const title = stage.addText('Spooky Halloween Sale', {
  fontSize: 64,
  color: [1, 0.6, 0]
});

title.animate({
  props: {
    position: { from: [400, 700], to: [400, 320] },
    opacity: { from: 0, to: 1 }
  },
  spring: Motion.spring({ stiffness: 200, damping: 20 }),
  delay: 0
});

export default stage.toJSON();

EXAMPLE 2: Title and subtitle staggered reveal

Storyboard JSON:
{
  "meta": { "duration": 4, "fps": 30, "bg_color": "#12002b" },
  "assets": [
    { "id": "title", "type": "text", "content": "Cyber Monday" },
    { "id": "subtitle", "type": "text", "content": "Up to 70% off" }
  ],
  "timeline": [
    {
      "time": 0,
      "target_asset_id": "title",
      "action": "enter",
      "parameters": { "x": 400, "y": 260, "scale": 1, "opacity": 0 },
      "physics": {
        "type": "spring",
        "config": { "stiffness": 220, "damping": 22 }
      }
    },
    {
      "time": 0.4,
      "target_asset_id": "subtitle",
      "action": "enter",
      "parameters": { "x": 400, "y": 340, "scale": 1, "opacity": 0 },
      "physics": {
        "type": "spring",
        "config": { "stiffness": 200, "damping": 20 }
      }
    }
  ]
}

TypeScript:
import { Stage, Motion } from '@motiongen/sdk';

const stage = Stage.create(800, 600, 4, 30);

const title = stage.addText('Cyber Monday', {
  fontSize: 72,
  color: [0.3, 1, 0.8]
});

const subtitle = stage.addText('Up to 70% off', {
  fontSize: 40,
  color: [1, 1, 1]
});

title.animate({
  props: {
    position: { from: [400, 100], to: [400, 260] },
    opacity: { from: 0, to: 1 }
  },
  spring: Motion.spring({ stiffness: 220, damping: 22 }),
  delay: 0
});

subtitle.animate({
  props: {
    position: { from: [400, 420], to: [400, 340] },
    opacity: { from: 0, to: 1 }
  },
  spring: Motion.spring({ stiffness: 200, damping: 20 }),
  delay: 0.4
});

export default stage.toJSON();
`;

export interface AnimatorAgentGenerateOptions {
  storyboard: Storyboard;
  sdkInterfaceDefinition: string;
}

export function buildAnimatorSystemPrompt(sdkInterfaceDefinition: string): string {
  const trimmed = sdkInterfaceDefinition.trim();
  const sdkSection = trimmed ? `${trimmed}\n\n` : '';

  const instructions = `# INSTRUCTIONS
1. Initialize the Stage with dimensions and timing derived from the storyboard metadata when available.
2. Instantiate all assets defined in the storyboard before animating them.
3. Apply animations strictly matching the storyboard timeline events and parameters.
4. If a physics or easing configuration is present in the storyboard, convert it to the SDK's expected spring/easing format.
5. Do not introduce new assets, text, or colors that are not described in the storyboard.
6. Return ONLY the TypeScript code block. No markdown fences, no explanations.
7. Do not use external libraries or Node.js APIs. Use only the provided SDK.`;

  return `${ANIMATOR_SYSTEM_PROMPT_BASE}${sdkSection}${instructions}\n\n# EXAMPLES\n${ANIMATOR_FEW_SHOT_EXAMPLES}`;
}

export function buildAnimatorUserPrompt(storyboard: Storyboard): string {
  const lines: string[] = [
    'You will receive a storyboard JSON and must translate it into a complete TypeScript script using the MotionGen SDK.',
    '',
    'Follow these rules when writing the code:',
    '- Do NOT change the creative intent, vibe, or color palette of the storyboard.',
    '- Do NOT invent new assets, scenes, or copy; only use what is described in the storyboard.',
    '- Import the SDK from "@motiongen/sdk".',
    '- Create a Stage and add text and/or shapes that correspond to the storyboard assets.',
    '- Use stage.addText() for text elements and any other appropriate SDK helpers defined in the interface.',
    '- Use Motion.spring() (or the configured physics types) when the storyboard specifies spring or non-linear motion.',
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
      jsonMode: false,
      temperature: 0.2,
      stopSequences: ['```', 'return stage']
    });

    return extractCodeFromLLMResponse(response);
  }
}
