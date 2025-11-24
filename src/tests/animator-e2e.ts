import {
  AnimatorAgent,
  ANIMATOR_MODEL,
  ANIMATOR_SYSTEM_PROMPT_BASE
} from '../animatorAgent';
import {
  type LLMClient,
  type LLMClientGenerateOptions,
  type Storyboard
} from '../directorAgent';

const FAKE_SDK_INTERFACE_DEFINITION = `
declare module '@motiongen/sdk' {
  export class Stage {
    constructor(width?: number, height?: number, durationSeconds?: number, fps?: number);
    static create(width?: number, height?: number, durationSeconds?: number, fps?: number): Stage;
    addText(content: string, style?: any): any;
  }

  export const Motion: {
    Stage: typeof Stage;
    spring(config: { stiffness: number; damping: number }): { stiffness: number; damping: number };
  };
}
`.trim();

class MockLLMClient implements LLMClient {
  async generate(options: LLMClientGenerateOptions): Promise<string> {
    if (options.model !== ANIMATOR_MODEL) {
      throw new Error(`Unexpected model: ${options.model}`);
    }

    if (!options.systemPrompt.startsWith(ANIMATOR_SYSTEM_PROMPT_BASE)) {
      throw new Error('Animator agent system prompt must start with the base TypeScript expert instructions');
    }

    if (!options.systemPrompt.includes(FAKE_SDK_INTERFACE_DEFINITION)) {
      throw new Error('Animator agent did not inject the SDK interface definition (.d.ts) into the system prompt');
    }

    if (options.jsonMode !== false) {
      throw new Error('Animator agent must request non-JSON (code) mode from the LLM client');
    }

    if (!options.userPrompt.includes('Spooky Halloween sale with playful ghosts and eerie atmosphere')) {
      throw new Error('Animator agent user prompt did not include the storyboard content');
    }

    return `
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
`.trim();
  }
}

async function testSpookyHalloweenSaleAnimatorAgent(): Promise<void> {
  const storyboard: Storyboard = {
    vibe: 'Spooky Halloween sale with playful ghosts and eerie atmosphere',
    colorPalette: ['#12002b', '#FF6B00', '#FF9F43'],
    timeline: [
      'Intro: ghostly fading of the brand logo onto a dark purple background',
      'Main: bold SALE text appears with pulsing glow and floating pumpkins',
      'Outro: ghostly fading transition as ghosts and bats drift off screen'
    ]
  };

  const client = new MockLLMClient();
  const agent = new AnimatorAgent(client);

  const code = await agent.generateMotionScript({
    storyboard,
    sdkInterfaceDefinition: FAKE_SDK_INTERFACE_DEFINITION
  });

  if (!code.includes('stage.addText')) {
    throw new Error('Expected generated MotionScript code to call stage.addText()');
  }

  if (!code.includes('Motion.spring')) {
    throw new Error('Expected generated MotionScript code to call Motion.spring()');
  }

  console.log(
    '✓ Animator Agent MotionScript for "Spooky Halloween Sale" includes stage.addText() and Motion.spring() calls'
  );
}

async function run(): Promise<void> {
  console.log('\n🎬 Running Animator Agent (Coder) E2E tests...');

  try {
    await testSpookyHalloweenSaleAnimatorAgent();
    console.log('\n✅ Animator Agent E2E tests passed');
  } catch (error) {
    console.error('\n❌ Animator Agent E2E tests failed:', error);
    process.exitCode = 1;
  }
}

run().catch(error => {
  console.error('Unexpected error while running Animator Agent E2E tests:', error);
  process.exitCode = 1;
});
