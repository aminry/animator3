import {
  CriticAgent,
  CRITIC_MODEL,
  CRITIC_SYSTEM_PROMPT,
  type CriticResult
} from '../criticAgent';
import { type LLMClient, type LLMClientGenerateOptions } from '../directorAgent';

class MockLLMClient implements LLMClient {
  async generate(options: LLMClientGenerateOptions): Promise<string> {
    if (options.model !== CRITIC_MODEL) {
      throw new Error(`Unexpected model: ${options.model}`);
    }

    if (options.systemPrompt !== CRITIC_SYSTEM_PROMPT) {
      throw new Error('Critic agent system prompt did not match specification');
    }

    if (!options.jsonMode) {
      throw new Error('Critic agent must request JSON mode from the LLM client');
    }

    if (options.temperature !== 0.4) {
      throw new Error(`Critic agent must use temperature 0.4, received ${options.temperature}`);
    }

    if (!options.userPrompt.includes('User Prompt: Spooky Halloween Sale')) {
      throw new Error('Critic agent user prompt did not include the original user prompt');
    }

    if (!options.userPrompt.includes('Frames (start, middle, end):')) {
      throw new Error('Critic agent user prompt did not describe the three keyframes');
    }

    if (!options.userPrompt.includes('Frame 0: frame-0.png')) {
      throw new Error('Critic agent user prompt is missing Frame 0 reference');
    }

    if (!options.userPrompt.includes('Frame 1: frame-1.png')) {
      throw new Error('Critic agent user prompt is missing Frame 1 reference');
    }

    if (!options.userPrompt.includes('Frame 2: frame-2.png')) {
      throw new Error('Critic agent user prompt is missing Frame 2 reference');
    }

    const payload: CriticResult = {
      status: 'FAIL',
      score: 40,
      issues: [
        {
          severity: 'critical',
          description:
            'Text appears nearly black on a dark background in the middle frame; contrast is too low for legibility.'
        },
        {
          severity: 'minor',
          description: 'The overall vibe feels less "spooky" and more generic sale banner.'
        }
      ],
      suggestion:
        'Increase text brightness or darken the background to achieve at least 4.5:1 contrast and add more spooky elements (e.g., ghosts, bats).' 
    };

    return JSON.stringify(payload);
  }
}

async function testSpookyHalloweenCriticAgent(): Promise<void> {
  const client = new MockLLMClient();
  const agent = new CriticAgent(client);

  const result = await agent.evaluate({
    userPrompt: 'Spooky Halloween Sale',
    frames: ['frame-0.png', 'frame-1.png', 'frame-2.png']
  });

  if (result.status !== 'FAIL') {
    throw new Error('Expected critic result status to be FAIL for low-contrast Halloween frames');
  }

  if (result.score < 0 || result.score > 100) {
    throw new Error(`Expected critic score to be between 0 and 100, got ${result.score}`);
  }

  if (!result.issues.length) {
    throw new Error('Expected critic result to contain at least one issue');
  }

  const lowerIssuesText = result.issues.map(issue => issue.description.toLowerCase()).join(' ');
  if (!lowerIssuesText.includes('contrast')) {
    throw new Error('Expected critic issues to mention contrast problems');
  }

  const suggestionLower = result.suggestion.toLowerCase();
  if (!suggestionLower.includes('contrast') && !suggestionLower.includes('4.5:1')) {
    throw new Error('Expected critic suggestion to reference improving contrast or accessibility');
  }

  console.log(
    '✓ Critic Agent (Visual QA) flags low-contrast spooky Halloween frames as FAIL with actionable suggestions'
  );
}

async function run(): Promise<void> {
  console.log('\n🎬 Running Critic Agent (Visual QA) E2E tests...');

  try {
    await testSpookyHalloweenCriticAgent();
    console.log('\n✅ Critic Agent E2E tests passed');
  } catch (error) {
    console.error('\n❌ Critic Agent E2E tests failed:', error);
    process.exitCode = 1;
  }
}

run().catch(error => {
  console.error('Unexpected error while running Critic Agent E2E tests:', error);
  process.exitCode = 1;
});
