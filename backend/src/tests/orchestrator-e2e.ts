import { createStudioGraph, StudioStateValue } from '../orchestrator';
import type { Storyboard } from '../directorAgent';

function createStoryboard(prompt: string): Storyboard {
  return {
    vibe: 'test',
    colorPalette: ['#ffffff'],
    timeline: [prompt]
  };
}

let animatorCalls = 0;
let sandboxCalls = 0;

async function promptClassifierNode(_state: StudioStateValue) {
  return {};
}

async function directorNode(state: StudioStateValue) {
  return {
    storyboard: createStoryboard(state.prompt)
  };
}

async function scenePlannerNode(_state: StudioStateValue) {
  return {};
}

async function sceneRefinementNode(_state: StudioStateValue) {
  // For this E2E, we only care that the node exists and does not break the graph.
  // Real refinement behavior is covered in dedicated agent tests.
  return {};
}

async function animatorNode(state: StudioStateValue) {
  const nextAttempt = (state.attemptCount ?? 0) + 1;
  animatorCalls += 1;
  return {
    code: `// attempt ${nextAttempt}`,
    attemptCount: nextAttempt,
    errorLogs: [],
    critique: undefined
  };
}

async function sandboxNode(state: StudioStateValue) {
  sandboxCalls += 1;
  if (sandboxCalls === 1) {
    return {
      errorLogs: ['compile error'],
      lottieJson: null
    };
  }
  return {
    errorLogs: [],
    lottieJson: { ok: true }
  };
}

async function rendererNode(_state: StudioStateValue) {
  return {};
}

async function criticNode(_state: StudioStateValue) {
  return {
    critique: 'OK'
  };
}

async function run() {
  const graph = createStudioGraph({
    promptClassifier: promptClassifierNode,
    director: directorNode,
    scenePlanner: scenePlannerNode,
    sceneRefinement: sceneRefinementNode,
    animator: animatorNode,
    sandbox: sandboxNode,
    renderer: rendererNode,
    critic: criticNode
  });

  const result = await graph.invoke({
    prompt: 'Make a bouncing logo',
    assets: []
  });

  if (!result.storyboard) {
    throw new Error('Expected storyboard in result');
  }

  if (!result.lottieJson) {
    throw new Error('Expected lottieJson in result');
  }

  if (animatorCalls < 2) {
    throw new Error('Expected animator to be called at least twice due to sandbox error loop');
  }

  if (sandboxCalls < 2) {
    throw new Error('Expected sandbox to be called at least twice due to error loop');
  }

  console.log('✓ Orchestrator LangGraph E2E passed');
}

run().catch(error => {
  console.error('❌ Orchestrator LangGraph E2E failed:', error);
  process.exitCode = 1;
});
