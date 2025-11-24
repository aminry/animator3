# Phase 4: Orchestration (The Glue) — Node.js Edition

This phase uses **LangGraph.js** to manage the circular workflow between the Director, Animator, and Critic agents. We leverage Node.js's native strength in handling JSON-heavy animation logic and headless browser rendering.

### 4.1 The Architecture: State Machine (LangGraph.js)

Instead of a linear chain, we define a cyclic graph where the state acts as a shared "blackboard" for all agents.

**The State Definition (TypeScript):**

```typescript
import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

// Define the Shared State Schema
export const StudioState = Annotation.Root({
  // Inputs
  prompt: Annotation<string>(),
  assets: Annotation<string[]>(), // S3 Paths
  
  // Artifacts (The "Work in Progress")
  storyboard: Annotation<any>(),  // JSON from Director
  code: Annotation<string>(),     // TypeScript from Animator
  lottieJson: Annotation<any>(),  // Compiled Output
  
  // Feedback & Control Flow
  errorLogs: Annotation<string[]>({
    reducer: (curr, next) => curr.concat(next), // Append errors
    default: () => [],
  }),
  critique: Annotation<string>(), // Visual feedback
  attemptCount: Annotation<number>({
    reducer: (curr, next) => next, // Overwrite
    default: () => 0,
  }),
});
```

**The Graph Flow (LangGraph.js):**

```typescript
import { StateGraph, END } from "@langchain/langgraph";
import { directorNode, animatorNode, sandboxNode, rendererNode, criticNode } from "./nodes";

// 1. Initialize Graph
const workflow = new StateGraph(StudioState)
  .addNode("director", directorNode)
  .addNode("animator", animatorNode)
  .addNode("sandbox", sandboxNode)   // Compiles TS -> Lottie
  .addNode("renderer", rendererNode) // Lottie -> PNG
  .addNode("critic", criticNode);    // Vision Model Review

// 2. Define Edges (The Logic)
workflow.addEdge("__start__", "director");
workflow.addEdge("director", "animator");
workflow.addEdge("animator", "sandbox");

// 3. Conditional Edge: Compilation Check
workflow.addConditionalEdges("sandbox", (state) => {
  // If sandbox returned errors, send back to Animator to fix syntax
  if (state.errorLogs.length > 0 && state.attemptCount < 5) {
    return "animator";
  }
  return "renderer";
});

// 4. Conditional Edge: Visual Quality Check
workflow.addConditionalEdges("critic", (state) => {
  // If critic rejects visual quality, send back to Animator to fix styling
  if (state.critique.includes("REJECT") && state.attemptCount < 5) {
    return "animator";
  }
  return END;
});

export const graph = workflow.compile();
```

### 4.2 Implementation: The Asset Processor (Node.js)

We replace Python's `scour` with the Node ecosystem standard: **SVGO** (optimization) and **Cheerio** (parsing).

**Pipeline Steps:**

1.  **Sanitize:** Use `svgo` to strip scripts and unsafe attributes.
2.  **Parse:** Use `cheerio` to traverse the DOM server-side.
3.  **Tag:** Use `GPT-OSS 20B` to semantically label the groups.

**Code Logic:**

```typescript
import { optimize } from "svgo";
import * as cheerio from "cheerio";

async function processSvgForLlm(svgString: string) {
  // 1. Sanitize (Security)
  const safeSvg = optimize(svgString, {
    plugins: ['removeScriptElement', 'removeOnEventHandlers']
  }).data;

  // 2. Extract Hierarchy
  const $ = cheerio.load(safeSvg, { xmlMode: true });
  const structure: string[] = [];
  
  $('g').each((i, el) => {
    const id = $(el).attr('id');
    const childCount = $(el).children().length;
    if (id) structure.push(`Group ID: "${id}", Children: ${childCount}`);
  });

  // 3. Call Groq 20B
  // "Given this structure, which ID is the 'wheel'?"
  return await groq.extractSemanticTags(structure); 
}
```

-----

# Verification & Testing Strategy (Jest + Puppeteer)

We implement a 3-Tier Testing Strategy using **Jest** as the test runner.

### Tier 1: The "Lottie Inspector" (Structure Test)

A pure logic test that validates the JSON structure without rendering.

**`tests/inspector.test.ts`**

```typescript
import { validateLottie } from "../src/inspector";

test('Lottie Inspector rejects static animation', () => {
  const badJson = {
    v: "5.5.7",
    op: 60,
    ip: 0,
    layers: [{ ks: { a: 0, p: [0,0,0] } }] // No keyframes (a=0)
  };
  
  const result = validateLottie(badJson);
  expect(result.isValid).toBe(false);
  expect(result.error).toContain("Animation is static");
});
```

### Tier 2: Visual Regression (The "Eyes")

This is where Node.js shines. We use **Puppeteer** to verify the animation actually draws pixels.

**`tests/visual.test.ts`**

```typescript
import puppeteer from 'puppeteer';

test('Animation actually moves', async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Inject lottie-web
  await page.addScriptTag({ path: require.resolve('lottie-web') });
  
  const getPixelHash = async (frame: number) => {
    return page.evaluate((f) => {
      /* logic to seek to frame and return canvas base64 */
    }, frame);
  };

  const frame0 = await getPixelHash(0);
  const frame50 = await getPixelHash(50);
  
  // If frame 0 and frame 50 are identical, animation is broken
  expect(frame0).not.toEqual(frame50);
  
  await browser.close();
});
```

### Tier 3: End-to-End (E2E) Pipeline Mocking

We test the `LangGraph` flow by mocking the Groq API calls to avoid token costs and nondeterminism.

**`tests/e2e.test.ts`**

```typescript
import { graph } from "../src/graph";
import { jest } from '@jest/globals';

// Mock the Agent Nodes
jest.mock('../src/nodes/director', () => ({
  directorNode: async (state) => ({ storyboard: { style: "bounce" } })
}));

jest.mock('../src/nodes/animator', () => ({
  animatorNode: async (state) => ({ code: "stage.addText('Hello')" })
}));

test('Full Graph execution succeeds', async () => {
  const result = await graph.invoke({
    prompt: "Make a bouncing logo",
    assets: []
  });

  expect(result.status).toBe("complete");
  expect(result.lottieJson).toBeDefined();
  expect(result.attemptCount).toBeLessThan(2); // Should succeed on first try
});
```

### Summary of Tasks for "Phase 4" (Node.js)

| Task | Component | Implementation Detail | Verification Method |
| :--- | :--- | :--- | :--- |
| **4.1** | **LangGraph Setup** | `StateGraph` with `StudioState` Annotation. Defined in `src/orchestrator.ts`. | Run E2E test with mocks. Ensure graph loops back on "error" state. |
| **4.2** | **Asset Pipeline** | `svgo` for cleaning, `cheerio` for parsing. | Unit test: Upload an SVG with `<script>` tags, assert they are removed. |
| **4.3** | **Visual Critic** | `puppeteer` + `lottie-web`. Renders frames to Buffers for the Llama model. | `tests/visual.test.ts`: Render a known Lottie file and check output PNG size \> 0. |
| **4.4** | **Sandbox** | `vm2` or `isolated-vm`. Runs compiled TS code in isolation. | Pass `while(true)` script; assert it throws a generic Timeout Error (not server crash). |