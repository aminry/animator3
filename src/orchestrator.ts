import { Annotation, StateGraph, END } from '@langchain/langgraph';
import type { Storyboard } from './directorAgent';

export interface StudioStateValue {
  prompt: string;
  assets: string[];
  storyboard: Storyboard | null;
  code: string | null;
  lottieJson: unknown;
  errorLogs: string[];
  critique?: string;
  attemptCount: number;
}

export const StudioState = Annotation.Root({
  prompt: Annotation(),
  assets: Annotation(),
  storyboard: Annotation(),
  code: Annotation(),
  lottieJson: Annotation(),
  errorLogs: Annotation({
    reducer: (curr: string[], next: string[]) => curr.concat(next),
    default: () => [] as string[]
  }),
  critique: Annotation(),
  attemptCount: Annotation({
    reducer: (_curr: number, next: number) => next,
    default: () => 0
  })
});

export type StudioNodeResult = Partial<StudioStateValue> | Promise<Partial<StudioStateValue>>;

export interface StudioNodes {
  director(state: StudioStateValue): StudioNodeResult;
  animator(state: StudioStateValue): StudioNodeResult;
  sandbox(state: StudioStateValue): StudioNodeResult;
  renderer(state: StudioStateValue): StudioNodeResult;
  critic(state: StudioStateValue): StudioNodeResult;
}

export interface StudioGraph {
  invoke(initialState: Partial<StudioStateValue>): Promise<StudioStateValue>;
}

export function createStudioGraph(nodes: StudioNodes): StudioGraph {
  const workflow = new StateGraph(StudioState)
    .addNode('director', (state: StudioStateValue) => nodes.director(state))
    .addNode('animator', (state: StudioStateValue) => nodes.animator(state))
    .addNode('sandbox', (state: StudioStateValue) => nodes.sandbox(state))
    .addNode('renderer', (state: StudioStateValue) => nodes.renderer(state))
    .addNode('critic', (state: StudioStateValue) => nodes.critic(state));

  // Linear edges
  workflow.addEdge('__start__', 'director');
  workflow.addEdge('director', 'animator');
  workflow.addEdge('animator', 'sandbox');
  workflow.addEdge('renderer', 'critic');

  // Conditional edge for compilation errors
  workflow.addConditionalEdges('sandbox', (state: StudioStateValue) => {
    if (Array.isArray(state.errorLogs) && state.errorLogs.length > 0 && state.attemptCount < 5) {
      return 'animator';
    }
    return 'renderer';
  });

  // Conditional edge for visual quality check
  workflow.addConditionalEdges('critic', (state: StudioStateValue) => {
    if (typeof state.critique === 'string' && state.critique.includes('REJECT') && state.attemptCount < 5) {
      return 'animator';
    }
    return END;
  });

  const graph = workflow.compile();
  return graph as StudioGraph;
}
