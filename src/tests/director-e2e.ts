import {
  DirectorAgent,
  DIRECTOR_MODEL,
  DIRECTOR_SYSTEM_PROMPT,
  type LLMClient,
  type LLMClientGenerateOptions,
  type Storyboard
} from '../directorAgent';

class MockLLMClient implements LLMClient {
  async generate(options: LLMClientGenerateOptions): Promise<string> {
    if (options.model !== DIRECTOR_MODEL) {
      throw new Error(`Unexpected model: ${options.model}`);
    }

    if (options.systemPrompt !== DIRECTOR_SYSTEM_PROMPT) {
      throw new Error('System prompt did not match Director agent specification');
    }

    if (!options.jsonMode) {
      throw new Error('Director agent must request JSON mode from the LLM client');
    }

    if (options.userPrompt === 'Spooky Halloween Sale') {
      const payload: any = {
        Vibe: 'Spooky Halloween sale with playful ghosts and eerie atmosphere',
        ColorPalette: ['#12002b', '#FF6B00', '#FF9F43'],
        Timeline: [
          'Intro: ghostly fading of the brand logo onto a dark purple background',
          'Main: bold SALE text appears with pulsing glow and floating pumpkins',
          'Outro: ghostly fading transition as ghosts and bats drift off screen'
        ]
      };

      return JSON.stringify(payload);
    }

    throw new Error(`MockLLMClient received unexpected prompt: ${options.userPrompt}`);
  }
}

async function testSpookyHalloweenSale(): Promise<void> {
  const client = new MockLLMClient();
  const agent = new DirectorAgent(client);

  const storyboard: Storyboard = await agent.planStoryboard('Spooky Halloween Sale');

  const vibeLower = storyboard.vibe.toLowerCase();
  if (!vibeLower.includes('spooky')) {
    throw new Error('Expected storyboard vibe to mention "spooky"');
  }

  const paletteLower = storyboard.colorPalette.map(color => color.toLowerCase());
  const hasPurpleLike = paletteLower.some(color => color.startsWith('#12') || color.includes('2b'));
  const hasOrangeLike = paletteLower.some(color => color.startsWith('#ff6b') || color.startsWith('#ff9f'));

  if (!hasPurpleLike || !hasOrangeLike) {
    throw new Error('Expected color palette to include dark purples and oranges for Halloween vibe');
  }

  const timelineText = storyboard.timeline.join(' ').toLowerCase();
  if (!timelineText.includes('ghostly fading')) {
    throw new Error('Expected timeline to mention "ghostly fading"');
  }

  console.log('✓ Director Agent storyboard for "Spooky Halloween Sale" has spooky vibe, dark purple/orange colors, and ghostly fading in the timeline');
}

async function run(): Promise<void> {
  console.log('\n🎬 Running Director Agent (Planner) E2E tests...');

  try {
    await testSpookyHalloweenSale();
    console.log('\n✅ Director Agent E2E tests passed');
  } catch (error) {
    console.error('\n❌ Director Agent E2E tests failed:', error);
    process.exitCode = 1;
  }
}

run().catch(error => {
  console.error('Unexpected error while running Director Agent E2E tests:', error);
  process.exitCode = 1;
});
