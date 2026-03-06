# MotionGen V3 Backend - Comprehensive Design Document

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [High-Level Architecture](#high-level-architecture)
4. [Core Components](#core-components)
5. [Multi-Agent System](#multi-agent-system)
6. [Data Flow & State Management](#data-flow--state-management)
7. [SDK & Animation Engine](#sdk--animation-engine)
8. [API Endpoints](#api-endpoints)
9. [Algorithms & Implementations](#algorithms--implementations)
10. [Security & Sandboxing](#security--sandboxing)
11. [Deployment Architecture](#deployment-architecture)

---

## Executive Summary

MotionGen V3 is an AI-powered animation generation system that converts natural language prompts into professional Lottie JSON animations. The backend orchestrates multiple specialized AI agents through a state machine workflow, generates TypeScript code using a custom MotionScript DSL, executes it in a sandboxed environment, and renders preview frames for quality assessment.

**Key Capabilities:**
- Natural language to Lottie animation conversion
- Multi-agent orchestration with iterative refinement
- Physics-based spring animations and cubic bezier easing
- Sandboxed code execution for security
- Visual quality assessment with AI critic
- Support for multiple animation modes (banners, loaders, explainers, etc.)

**Technology Stack:**
- TypeScript/Node.js runtime
- LangChain StateGraph for agent orchestration
- Groq API for LLM inference
- Puppeteer for headless browser rendering
- VM2 for sandboxed code execution
- Lottie-web for animation playback

---

## System Overview

### Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    HTTP API Layer                            │
│  (OrchestratorServer, SandboxServer, RendererServer)        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  Orchestration Layer                         │
│         (LangChain StateGraph + Multi-Agent System)         │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   Code Generation Layer                      │
│              (MotionScript DSL + AnimatorAgent)             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   Execution Layer                            │
│          (Sandboxed VM2 + TypeScript Transpilation)         │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   Animation Engine Layer                     │
│    (Lottie Builder SDK + Physics Engine + Easing System)    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   Rendering Layer                            │
│         (Puppeteer + Lottie-web + Frame Capture)            │
└─────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

```
User Prompt
    ↓
┌───────────────────┐
│ Prompt Classifier │ → Determines animation mode & flags
└───────────────────┘
    ↓
┌───────────────────┐
│ Director Agent    │ → Creates high-level storyboard
└───────────────────┘
    ↓
┌───────────────────┐
│ Scene Planner     │ → Generates concrete scene plan with objects & keyframes
└───────────────────┘
    ↓
┌───────────────────┐
│ Animator Agent    │ → Writes MotionScript TypeScript code
└───────────────────┘
    ↓
┌───────────────────┐
│ Sandbox Runner    │ → Executes code safely, produces Lottie JSON
└───────────────────┘
    ↓ (if errors)
    └──────────────────┐ Retry with error logs (max 5 attempts)
                       ↓
                   Animator Agent
    ↓ (if success)
┌───────────────────┐
│ Renderer          │ → Captures frames at key timestamps
└───────────────────┘
    ↓
┌───────────────────┐
│ Critic Agent      │ → Evaluates quality, provides structured feedback
└───────────────────┘
    ↓ (if REJECT)
┌───────────────────┐
│ Scene Refinement  │ → Applies fixes to scene plan
└───────────────────┘
    ↓
    └──────────────────┐ Retry with refined plan (max 5 attempts)
                       ↓
                   Animator Agent
    ↓ (if ACCEPT)
Final Lottie JSON + Code + Frames
```

---

## High-Level Architecture

### System Components Map

The backend consists of 49 TypeScript modules organized into the following categories:

**Core Infrastructure:**
- `orchestrator.ts` - LangChain StateGraph workflow coordinator
- `orchestratorServer.ts` - HTTP server exposing `/orchestrate` endpoint
- `sandboxRunner.ts` - Isolated code execution manager
- `sandboxServer.ts` - HTTP server for `/build-lottie` endpoint
- `renderer.ts` - Frame rendering coordinator
- `rendererServer.ts` - HTTP server for `/render-frames` endpoint
- `browserRenderer.ts` - Puppeteer-based frame capture

**AI Agents (8 total):**
- `promptClassifierAgent.ts` - Classifies prompt into animation mode
- `directorAgent.ts` - Creates high-level storyboard
- `scenePlannerAgent.ts` - Generates concrete scene plans
- `sceneRefinementAgent.ts` - Applies critic feedback to scene plans
- `animatorAgent.ts` - Generates MotionScript code
- `criticAgent.ts` - Evaluates animation quality
- `assetProcessor.ts` - Analyzes SVG assets for semantic tagging
- `groqClient.ts` - LLM API client implementation

**Animation SDK:**
- `Animation.ts` - Main animation container class
- `Layer.ts` - Base layer classes (Shape, Text, Solid, Image, Null)
- `Property.ts` - Animatable property with keyframe support
- `shapes.ts` - ShapeBuilder utility for vector shapes
- `motionscript.ts` - High-level MotionScript API (Stage, MotionElement, MotionGroup)
- `sdk.ts` - TypeScript interface definition for LLM consumption
- `physics.ts` - Spring physics keyframe generator
- `easing.ts` - Cubic bezier easing functions

**Data Models & Validation:**
- `types.ts` - Core Lottie JSON type definitions
- `scenePlan.ts` - Scene plan data structures
- `storyboardTypes.ts` - Storyboard beat definitions
- `sharedApiTypes.ts` - HTTP API request/response types
- `sceneValidation.ts` - Scene plan vs Lottie validation
- `lottieMetrics.ts` - Animation metrics computation

**Utilities:**
- `logger.ts` - Debug logging system
- `debugDump.ts` - State dumping for debugging
- `sandbox-worker.ts` - Child process worker for sandboxed execution

---

## Core Components

### 1. Orchestrator (`orchestrator.ts`)

**Purpose:** Coordinates the entire multi-agent workflow using LangChain's StateGraph.

**Key Responsibilities:**
- Manages shared state across all agents
- Defines the execution graph with conditional edges
- Implements retry logic for compilation errors and quality issues
- Tracks attempt counts to prevent infinite loops

**State Definition:**

```typescript
interface StudioStateValue {
  prompt: string;                           // User's natural language input
  assets: string[];                         // SVG/image assets (base64 or URLs)
  storyboard: Storyboard | null;           // High-level creative direction
  scenePlan: ScenePlan | null;             // Concrete scene with objects & keyframes
  code: string | null;                      // Generated MotionScript code
  lottieJson: unknown;                      // Final Lottie animation JSON
  frames?: string[];                        // Rendered preview frames (base64 PNGs)
  errorLogs: string[];                      // Compilation/runtime errors
  lottieMetrics?: LottieMetricsSummary;    // Animation complexity metrics
  critique?: string;                        // Critic's textual feedback
  criticResult?: CriticResult;             // Structured critic feedback
  attemptCount: number;                     // Retry counter (max 5)
  promptClassification?: PromptClassification;
  mode?: AnimationMode;                     // e.g., "banner", "loader", "explainer"
  targetDurationSecondsHint?: number;
}
```

**Workflow Graph:**

```
START
  ↓
promptClassifier
  ↓
director
  ↓
scenePlanner
  ↓
animator
  ↓
sandbox ──→ (errors?) ──→ animator (retry)
  ↓ (success)
renderer
  ↓
critic ──→ (REJECT?) ──→ sceneRefinement ──→ animator (retry)
  ↓ (ACCEPT)
END
```

**Conditional Logic:**

1. **Sandbox Error Retry:**
   - If `errorLogs.length > 0` and `attemptCount < 5`: return to `animator`
   - Otherwise: proceed to `renderer`

2. **Critic Quality Retry:**
   - If `critique` contains "REJECT" and `attemptCount < 5`:
     - If `scenePlan` and `criticResult` exist: go to `sceneRefinement`
     - Otherwise: go directly to `animator`
   - Otherwise: END

**Implementation Highlights:**

```typescript
export function createStudioGraph(nodes: StudioNodes): StudioGraph {
  const workflow = new StateGraph(StudioState)
    .addNode("promptClassifier", (state) => nodes.promptClassifier(state))
    .addNode("director", (state) => nodes.director(state))
    .addNode("scenePlanner", (state) => nodes.scenePlanner(state))
    .addNode("sceneRefinement", (state) => nodes.sceneRefinement(state))
    .addNode("animator", (state) => nodes.animator(state))
    .addNode("sandbox", (state) => nodes.sandbox(state))
    .addNode("renderer", (state) => nodes.renderer(state))
    .addNode("critic", (state) => nodes.critic(state));

  // Linear edges
  workflow.addEdge("__start__", "promptClassifier");
  workflow.addEdge("promptClassifier", "director");
  workflow.addEdge("director", "scenePlanner");
  workflow.addEdge("scenePlanner", "animator");
  workflow.addEdge("animator", "sandbox");
  workflow.addEdge("renderer", "critic");
  workflow.addEdge("sceneRefinement", "animator");

  // Conditional edges for retry logic
  workflow.addConditionalEdges("sandbox", (state) => {
    if (state.errorLogs?.length > 0 && state.attemptCount < 5) {
      return "animator";
    }
    return "renderer";
  });

  workflow.addConditionalEdges("critic", (state) => {
    const shouldRetry = state.critique?.includes("REJECT") && state.attemptCount < 5;
    if (!shouldRetry) return END;
    
    if (state.scenePlan && state.criticResult) {
      return "sceneRefinement";
    }
    return "animator";
  });

  return workflow.compile();
}
```

---

### 2. Sandbox Runner (`sandboxRunner.ts` + `sandbox-worker.ts`)

**Purpose:** Safely execute untrusted TypeScript code generated by the AnimatorAgent.

**Security Model:**
- Runs code in a separate child process using `child_process.fork`
- Uses VM2's `NodeVM` for additional isolation
- Enforces strict timeout (500ms default)
- Blocks external requires and builtin modules
- Mocks `@motiongen/sdk` module to provide controlled API access

**Execution Flow:**

```
AnimatorAgent generates code
        ↓
sandboxRunner.runSandbox(code)
        ↓
Fork child process (sandbox-worker.js)
        ↓
TypeScript transpilation (ts.transpileModule)
        ↓ (compile errors?)
Return { ok: false, errorType: 'compile', diagnostics }
        ↓ (success)
VM2 execution with mocked SDK
        ↓ (runtime error or timeout?)
Return { ok: false, errorType: 'runtime'/'timeout', message, stack }
        ↓ (success)
Extract exported Lottie JSON
        ↓
Return { ok: true, json: lottieJson }
```

**Worker Implementation (`sandbox-worker.ts`):**

```typescript
function handleRequest(message: SandboxRequestMessage): void {
  const { code } = message;

  // Step 1: TypeScript compilation
  const transpiled = ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      strict: true,
      esModuleInterop: true
    },
    reportDiagnostics: true
  });

  if (transpiled.diagnostics?.length > 0) {
    sendResponse({
      ok: false,
      errorType: 'compile',
      message: 'TypeScript compilation failed',
      diagnostics: transpiled.diagnostics.map(d => 
        ts.flattenDiagnosticMessageText(d.messageText, '\n')
      )
    });
    return;
  }

  // Step 2: VM2 execution
  const vm = new NodeVM({
    console: 'inherit',
    sandbox: {},
    require: {
      external: false,
      builtin: [],
      root: __dirname,
      mock: {
        '@motiongen/sdk': sdk  // Controlled SDK access
      }
    },
    wrapper: 'commonjs',
    timeout: 450  // Slightly less than parent timeout
  });

  const moduleExports = vm.run(transpiled.outputText, 'user-code.js');
  
  // Extract default export if present
  let value = moduleExports;
  if (value && typeof value === 'object' && 'default' in value) {
    value = value.default;
  }

  sendResponse({ ok: true, json: value });
}
```

**Timeout Handling:**

The parent process sets a 500ms timer. If the worker doesn't respond in time:

```typescript
const timer = setTimeout(() => {
  finish({
    ok: false,
    errorType: 'timeout',
    message: `Execution timed out after ${timeoutMs}ms`
  });
}, timeoutMs);
```

**Resource Limits:**
- Memory: `--max-old-space-size=256` (256MB)
- CPU: Timeout enforced at 500ms
- Network: No external requires allowed
- File System: No access (VM2 sandbox)

---

### 3. Renderer (`renderer.ts` + `browserRenderer.ts`)

**Purpose:** Generate visual preview frames from Lottie JSON for critic evaluation.

**Architecture:**

```
Lottie JSON + Timestamps
        ↓
renderFrames(lottieJson, timestamps)
        ↓
renderFramesWithBrowser(lottieJson, timestamps)
        ↓
Launch Puppeteer headless browser
        ↓
Load HTML page with lottie-web CDN
        ↓
Initialize lottie.loadAnimation()
        ↓
For each timestamp:
  - Calculate frame number
  - anim.goToAndStop(frame)
  - page.screenshot()
        ↓
Return base64 PNG images
```

**Browser Setup:**

```typescript
const browser = await puppeteer.launch({
  headless: 'new',
  timeout: 60000,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

const page = await browser.newPage();
await page.setViewport({ 
  width: lottieJson.w || 512, 
  height: lottieJson.h || 512, 
  deviceScaleFactor: 1 
});
```

**HTML Template:**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: transparent;
      }
      #container {
        width: 100%;
        height: 100%;
      }
    </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js"></script>
  </head>
  <body>
    <div id="container"></div>
  </body>
</html>
```

**Frame Capture Logic:**

```typescript
for (const t of timestamps) {
  // Navigate to specific time
  await page.evaluate((time: number) => {
    const anim = window.__lottieAnimation;
    const data = window.__lottieData || {};
    const fr = data.fr || 30;
    const ip = data.ip || 0;
    const op = data.op || ip + fr * 3;
    const maxFrame = op - 1;

    let frame = Math.round(ip + time * fr);
    if (frame > maxFrame) frame = maxFrame;

    anim.goToAndStop(frame, true);
  }, t);

  // Capture screenshot
  const b64 = await page.screenshot({
    encoding: 'base64',
    clip: { x: 0, y: 0, width, height }
  });

  images.push(b64);
}
```

**Timestamp Selection:**

The orchestrator typically renders 3-5 frames at strategic points:
- Start (t=0)
- Mid-point (t=duration/2)
- End (t=duration)
- Optional: key moments from scene plan

---

## Multi-Agent System

### Agent Architecture Overview

Each agent follows a consistent pattern:

```typescript
interface Agent {
  // Core method that processes state and returns updates
  process(state: StudioStateValue): Promise<Partial<StudioStateValue>>;
  
  // LLM interaction
  llmClient: LLMClient;
  
  // System prompt defining agent's role
  systemPrompt: string;
}
```

### Agent Catalog

#### 1. Prompt Classifier Agent

**File:** `promptClassifierAgent.ts`  
**Model:** GPT OSS 120B  
**Input:** User prompt + assets  
**Output:** `PromptClassification` with mode, flags, and duration hint

**Purpose:** Analyzes the user's request to determine the appropriate animation mode and extract metadata.

**Classification Output:**

```typescript
interface PromptClassification {
  mode: AnimationMode;  // "banner", "loader", "explainer", etc.
  targetDurationSeconds?: number;
  flags: {
    hasText?: boolean;
    hasLogo?: boolean;
    hasCharacter?: boolean;
    isLoop?: boolean;
    needsPhysics?: boolean;
  };
}
```

**Supported Animation Modes:**
- `banner` - Marketing/promotional banners
- `game-demo` - Game UI/mechanics demonstrations
- `product-demo` - Product feature showcases
- `data-viz` - Data visualization animations
- `explainer` - Educational/tutorial content
- `loader/loop` - Loading indicators and seamless loops
- `logo-sting` - Logo reveals and brand animations
- `character-moment` - Character-based animations

**System Prompt Highlights:**
- Identifies animation intent from natural language
- Extracts duration hints (e.g., "3 second banner")
- Detects presence of text, logos, characters
- Determines if animation should loop
- Flags need for physics-based motion

---

#### 2. Director Agent

**File:** `directorAgent.ts`  
**Model:** GPT OSS 120B  
**Input:** User prompt + prompt classification + assets  
**Output:** `Storyboard` with vibe, color palette, and timeline beats

**Purpose:** Creates high-level creative direction for the animation, acting as an art director.

**Storyboard Structure:**

```typescript
interface Storyboard {
  vibe: string;              // e.g., "energetic and playful"
  colorPalette: string[];    // Hex colors or descriptive names
  timeline: StoryboardBeat[];
}

interface StoryboardBeat {
  id: string;
  start: number;             // Time in seconds
  end: number;
  layer: "background" | "midground" | "foreground";
  role: string;              // e.g., "hero text", "accent shape"
  type: string;              // e.g., "text", "circle", "rectangle"
  content: string;           // Text content or description
  layout: string;            // Positioning hints
  motion: string;            // Motion description
  physics: string;           // Physics hints (spring, bounce, etc.)
  notes?: string;
}
```

**Timeline Mini-DSL:**

The Director uses a compact DSL for timeline entries:

```
t: 0-1.5 | layer: background | role: bg-gradient | type: rectangle | 
  layout: fullscreen | motion: fade in | physics: ease-in-out

t: 0.5-3 | layer: foreground | role: hero-text | type: text | 
  content: Welcome | layout: center | motion: slide up + scale | 
  physics: spring(stiff=200, damp=20)
```

**Key Responsibilities:**
- Establishes visual hierarchy (background/midground/foreground)
- Defines color scheme aligned with brand/mood
- Plans timing and choreography
- Specifies motion characteristics (spring, ease, bounce)
- Ensures animator has clear creative direction

**System Prompt Excerpt:**

```
You are the Director, responsible for planning storyboards.
Given a user prompt, create a JSON storyboard for the Animator.

The Animator can:
- Create shapes: rectangle, circle, ellipse, star, polygon
- Animate properties: position, scale, rotation, opacity, color
- Use easing: linear, easeIn, easeOut, easeInOut, or custom cubic-bezier
- Use physics: spring animations with stiffness/damping
- Layer elements: background, midground, foreground
- Parent objects for hierarchical motion

Output strict JSON with:
{
  "vibe": "string describing mood/energy",
  "colorPalette": ["color1", "color2", ...],
  "timeline": [...]
}
```

---

#### 3. Scene Planner Agent

**File:** `scenePlannerAgent.ts`  
**Model:** GPT OSS 120B  
**Input:** Storyboard + prompt classification  
**Output:** `ScenePlan` with concrete objects and keyframes

**Purpose:** Converts the abstract storyboard into a concrete scene plan with precise object definitions and motion keyframes.

**Scene Plan Structure:**

```typescript
interface ScenePlan {
  durationSeconds: number;
  mode: AnimationMode;
  objects: SceneObject[];
  paths?: ScenePath[];
}

interface SceneObject {
  id: string;                    // Stable identifier
  role: string;                  // From storyboard beat
  kind: SceneObjectKind;         // "text", "shape", "ui-element", etc.
  shapeType?: SceneShapeType;    // "circle", "rectangle", etc.
  parentId?: string;             // For hierarchical motion
  followTargetId?: string;       // For follow behaviors
  pathId?: string;               // Reference to motion path
  initialPosition?: [number, number];
  initialScale?: [number, number];
  initialRotation?: number;
  initialOpacity?: number;
  style?: {
    fillColor?: [number, number, number];
    strokeColor?: [number, number, number];
    strokeWidth?: number;
    textColor?: [number, number, number];
    fontSize?: number;
  };
  keyframes: SceneKeyframe[];
}

interface SceneKeyframe {
  t: number;                     // Time in seconds
  position?: [number, number];
  scale?: [number, number];
  rotation?: number;
  opacity?: number;
}
```

**Mode-Specific Guidelines:**

The Scene Planner has detailed rules for each animation mode:

**Banner Mode:**
- 2-4 text objects (headline, subtext, CTA)
- 1-3 accent shapes for visual interest
- Staggered entrance animations
- Clear visual hierarchy

**Loader/Loop Mode:**
- 3-8 repeating elements
- Continuous motion with seamless loops
- Rotations, orbits, or wave patterns
- No abrupt stops

**Explainer Mode:**
- Sequential reveal of concepts
- 4-8 visual elements
- Clear progression through stages
- Text + supporting graphics

**Logo Sting Mode:**
- Logo as central element
- 1-3 accent shapes
- Build-up and settle motion
- Typically 2-3 seconds

**Key Responsibilities:**
- Maps storyboard roles to concrete objects
- Assigns stable IDs for tracking
- Defines initial states (position, scale, opacity)
- Creates keyframe sequences for motion
- Handles object relationships (parenting, following)

---

#### 4. Animator Agent

**File:** `animatorAgent.ts`  
**Model:** GPT OSS 120B  
**Input:** Storyboard + scene plan + SDK interface + error logs (on retry) + critic feedback (on retry)  
**Output:** TypeScript MotionScript code

**Purpose:** Generates executable TypeScript code using the MotionScript API to produce the final Lottie animation.

**Code Generation Process:**

```
Storyboard + ScenePlan
        ↓
Analyze requirements
        ↓
Determine stage dimensions, duration, FPS
        ↓
Generate MotionScript code:
  - Create Stage
  - Add text/shape elements
  - Apply animations with timing
  - Use spring physics or easing
  - Implement stagger effects
        ↓
Return TypeScript code as string
```

**Example Generated Code:**

```typescript
import { Stage } from '@motiongen/sdk';

const stage = Stage.create(800, 600, 3, 30);

// Create elements
const bg = stage.addShape('rectangle', {
  width: 800,
  height: 600,
  fillColor: [0.1, 0.1, 0.2]
});

const title = stage.addText('Welcome', {
  fontSize: 60,
  color: [1, 1, 1]
});

// Animate background
bg.animate({
  props: { opacity: { from: 0, to: 100 } },
  easing: 'easeInOut',
  duration: 1
});

// Animate title with spring physics
title.animate({
  props: {
    position: { from: [400, 700], to: [400, 300] },
    scale: { from: [50, 50], to: [100, 100] }
  },
  spring: { stiffness: 200, damping: 20 },
  delay: 0.5
});

export default stage.toJSON();
```

**Minimum Complexity Requirements:**

The Animator enforces quality standards:
- **Element count:** Minimum 3 elements (not counting background)
- **Motion richness:** 
  - Stagger effects for groups
  - Continuous motion (not just fade in/out)
  - Spring-based animations for organic feel
  - Ease-in-out for smooth transitions
- **Background parallax:** Multi-layer depth when appropriate

**Retry Handling:**

On compilation/runtime errors:
- Receives error logs with diagnostics
- Adjusts code to fix type errors
- Simplifies complex logic if timeout occurred

On critic rejection:
- Receives structured feedback with issues and fixes
- Applies specific improvements (timing, motion, composition)
- May regenerate entire animation or patch specific elements

**System Prompt Structure:**

```
You are the Animator. Convert storyboard + scene plan into MotionScript code.

SDK Interface:
[Full TypeScript interface definition]

Rules:
1. Determine stage duration from scene plan or storyboard
2. Use 800x600 default dimensions (adjust for banners)
3. Use 30 FPS
4. Interpret timing from keyframes
5. Use spring physics for organic motion
6. Apply stagger for grouped elements
7. Ensure minimum complexity bar

Output only valid TypeScript code, no markdown fences.
```

---

#### 5. Critic Agent

**File:** `criticAgent.ts`  
**Model:** meta-llama/llama-4-scout-17b-16e-instruct
**Input:** User prompt + rendered frames (images) + Lottie metrics  
**Output:** `CriticResult` with score, verdict, issues, and fixes

**Purpose:** Evaluates animation quality by analyzing rendered frames, acting as a Motion Graphics QA and Art Director.

**Evaluation Criteria:**

1. **Goal & Vibe Alignment (30%)**
   - Does animation match user's intent?
   - Is the mood/energy appropriate?

2. **Visual Hierarchy & Composition (25%)**
   - Clear focal points
   - Balanced layout
   - Effective use of space

3. **Legibility & Contrast (20%)**
   - Text readable at all times
   - Sufficient color contrast
   - No visual clutter

4. **Motion & Physics Quality (15%)**
   - Smooth, natural motion
   - Appropriate timing
   - Good use of easing/spring physics

5. **Visual Richness & Creativity (10%)**
   - Engaging visual elements
   - Creative use of motion
   - Polish and refinement

**Scoring System:**

- **90-100:** ACCEPT - Excellent quality
- **75-89:** ACCEPT - Good quality, minor improvements possible
- **60-74:** REJECT - Needs improvement
- **Below 60:** REJECT - Significant issues

**Critic Result Structure:**

```typescript
interface CriticResult {
  score: number;              // 0-100
  verdict: "ACCEPT" | "REJECT";
  issues: CriticIssue[];
  fixes?: CriticFix[];
}

interface CriticIssue {
  category: string;           // e.g., "timing", "composition", "legibility"
  severity: "minor" | "moderate" | "major";
  description: string;
}

interface CriticFix {
  objectId?: string;          // Target object from scene plan
  property: string;           // "timing", "position", "scale", etc.
  suggestion: string;         // Actionable fix description
  value?: any;                // Specific value if applicable
}
```

**Example Critique:**

```json
{
  "score": 68,
  "verdict": "REJECT",
  "issues": [
    {
      "category": "timing",
      "severity": "moderate",
      "description": "Title animation completes too quickly, feels rushed"
    },
    {
      "category": "composition",
      "severity": "minor",
      "description": "Background shapes compete with foreground text"
    }
  ],
  "fixes": [
    {
      "objectId": "hero-text",
      "property": "duration",
      "suggestion": "Increase animation duration from 0.8s to 1.5s",
      "value": 1.5
    },
    {
      "objectId": "bg-shape-1",
      "property": "opacity",
      "suggestion": "Reduce opacity to 30% to avoid competing with text",
      "value": 30
    }
  ]
}
```

**Multimodal Analysis:**

The Critic receives base64-encoded PNG frames and analyzes:
- Visual composition across time
- Motion smoothness and timing
- Color relationships and contrast
- Text legibility
- Overall aesthetic quality

---

#### 6. Scene Refinement Agent

**File:** `sceneRefinementAgent.ts`  
**Model:** GPT OSS 120B  
**Input:** Scene plan + critic result  
**Output:** Refined scene plan with fixes applied

**Purpose:** Applies structured feedback from the Critic to the scene plan before regenerating MotionScript code.

**Refinement Process:**

```
CriticResult with fixes
        ↓
Build refinement prompt
        ↓
LLM generates JSON patch
        ↓
Apply patch to ScenePlan
        ↓
Return refined ScenePlan
```

**Patch Application:**

The agent can modify:
- Object keyframe timings
- Position/scale/rotation values
- Opacity levels
- Animation durations
- Object styles (colors, sizes)

**Example Refinement:**

Original keyframe:
```json
{ "t": 0.5, "position": [400, 300], "scale": [100, 100] }
```

After critic feedback "move text higher and make entrance slower":
```json
{ "t": 0.8, "position": [400, 250], "scale": [100, 100] }
```

**System Prompt:**

```
You are the Scene Refinement Agent.
Apply critic feedback to improve the scene plan.

Input:
- Current ScenePlan
- CriticResult with issues and fixes

Output:
- Refined ScenePlan (complete JSON)

Focus on:
- Timing adjustments
- Position/scale corrections
- Opacity/color improvements
- Motion path refinements
```

---

#### 7. Asset Processor Agent

**File:** `assetProcessor.ts`  
**Model:** GPT OSS 120B  
**Input:** SVG string + user prompt (optional)  
**Output:** Sanitized SVG + semantic tags for groups

**Purpose:** Analyzes SVG assets to extract semantic meaning for use in animations.

**Processing Pipeline:**

```
Raw SVG
        ↓
Sanitize (remove scripts, event handlers)
        ↓
Extract group structure
        ↓
LLM semantic tagging
        ↓
Return safe SVG + tags
```

**SVG Sanitization:**

```typescript
function sanitizeSvg(svgString: string): string {
  // Optimize with SVGO
  const optimized = optimize(svgString, { plugins: [] });
  
  // Parse with cheerio
  const $ = cheerio.load(optimized.data, { xmlMode: true });
  
  // Remove script tags
  $('script').remove();
  
  // Remove event handlers (onclick, onload, etc.)
  $('*').each((_, element) => {
    Object.keys(element.attribs || {}).forEach(name => {
      if (name.toLowerCase().startsWith('on')) {
        $(element).removeAttr(name);
      }
    });
  });
  
  return $.root().html();
}
```

**Semantic Tagging:**

Input to LLM:
```
Group ID: "layer-1", Children: 5
Group ID: "logo-mark", Children: 3
Group ID: "text-container", Children: 2
```

Output:
```json
{
  "groups": [
    {
      "id": "layer-1",
      "labels": ["background", "decoration"],
      "description": "Background decorative elements"
    },
    {
      "id": "logo-mark",
      "labels": ["logo", "icon", "foreground"],
      "description": "Main logo symbol"
    },
    {
      "id": "text-container",
      "labels": ["text", "foreground"],
      "description": "Text content area"
    }
  ]
}
```

**Use Cases:**
- Identifying which SVG groups to animate
- Understanding visual hierarchy
- Mapping SVG elements to animation roles
- Preserving semantic meaning during animation

---

#### 8. Groq LLM Client

**File:** `groqClient.ts`  
**Purpose:** HTTP client for Groq API with multimodal support

**Features:**
- OpenAI-compatible chat completions API
- JSON mode support
- Image input support (base64 data URLs)
- Model resolution via environment variables
- Temperature control

**Model Configuration:**

Environment variables:
```bash
GROQ_API_KEY=your_key_here
MOTIONGEN_GROQ_DEFAULT_MODEL=openai/gpt-oss-120b
MOTIONGEN_GROQ_MODEL_TEXT_MODEL=openai/gpt-oss-120b
MOTIONGEN_GROQ_MODEL_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
```

**Multimodal Request:**

```typescript
await client.generate({
  model: 'meta-llama/llama-4-scout-17b-16e-instruct',
  systemPrompt: 'You are a critic...',
  userPrompt: 'Evaluate this animation',
  imageUrls: ['data:image/png;base64,...', ...],
  jsonMode: true,
  temperature: 0
});
```

**Request Structure:**

```json
{
  "model": "meta-llama/llama-4-scout-17b-16e-instruct",
  "messages": [
    {
      "role": "system",
      "content": "System prompt..."
    },
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "User prompt..." },
        { "type": "image_url", "image_url": { "url": "data:image/png;base64,..." } },
        { "type": "image_url", "image_url": { "url": "data:image/png;base64,..." } }
      ]
    }
  ],
  "temperature": 0,
  "response_format": { "type": "json_object" }
}
```

---

## Data Flow & State Management

### State Transitions

The `StudioStateValue` object flows through the agent graph, with each agent reading and updating specific fields:

```
Initial State:
{
  prompt: "Create a 3 second banner...",
  assets: [],
  storyboard: null,
  scenePlan: null,
  code: null,
  lottieJson: null,
  frames: undefined,
  errorLogs: [],
  critique: undefined,
  criticResult: undefined,
  attemptCount: 0
}

After PromptClassifier:
{
  ...previous,
  promptClassification: { mode: "banner", targetDurationSeconds: 3, flags: {...} },
  mode: "banner",
  targetDurationSecondsHint: 3
}

After Director:
{
  ...previous,
  storyboard: { vibe: "...", colorPalette: [...], timeline: [...] }
}

After ScenePlanner:
{
  ...previous,
  scenePlan: { durationSeconds: 3, mode: "banner", objects: [...] }
}

After Animator:
{
  ...previous,
  code: "import { Stage } from '@motiongen/sdk'...",
  attemptCount: 1
}

After Sandbox (success):
{
  ...previous,
  lottieJson: { v: "5.7.4", fr: 30, ... },
  errorLogs: []
}

After Sandbox (error):
{
  ...previous,
  lottieJson: null,
  errorLogs: ["TypeError: Cannot read property 'animate' of undefined"]
}

After Renderer:
{
  ...previous,
  frames: ["base64png1", "base64png2", "base64png3"],
  lottieMetrics: { layerCount: 5, animatedPropertyCount: 12, ... }
}

After Critic (ACCEPT):
{
  ...previous,
  critique: "ACCEPT - Score: 85/100...",
  criticResult: { score: 85, verdict: "ACCEPT", issues: [], fixes: [] }
}

After Critic (REJECT):
{
  ...previous,
  critique: "REJECT - Score: 68/100...",
  criticResult: { score: 68, verdict: "REJECT", issues: [...], fixes: [...] }
}

After SceneRefinement:
{
  ...previous,
  scenePlan: { ...refined with fixes applied... },
  attemptCount: 2
}
```

### Retry Loop Mechanics

**Compilation Error Loop:**

```
Attempt 1: Animator → Sandbox → Error (type mismatch)
  State: attemptCount = 1, errorLogs = ["Type error..."]
  
Attempt 2: Animator (with error logs) → Sandbox → Error (undefined property)
  State: attemptCount = 2, errorLogs = ["Cannot read property..."]
  
Attempt 3: Animator (with error logs) → Sandbox → Success
  State: attemptCount = 3, errorLogs = [], lottieJson = {...}
  → Proceed to Renderer
```

**Quality Refinement Loop:**

```
Attempt 1: Animator → Sandbox → Renderer → Critic → REJECT (score: 68)
  State: attemptCount = 1, criticResult = { issues: [...], fixes: [...] }
  
SceneRefinement: Apply fixes to scenePlan
  State: scenePlan = {...refined...}, attemptCount = 2
  
Attempt 2: Animator (with refined plan) → Sandbox → Renderer → Critic → ACCEPT (score: 82)
  State: attemptCount = 2, criticResult = { score: 82, verdict: "ACCEPT" }
  → END
```

**Max Attempts Protection:**

Both loops enforce `attemptCount < 5` to prevent infinite retries. After 5 attempts, the system returns the best result achieved, even if quality is suboptimal.

---

## SDK & Animation Engine

### Architecture Overview

The SDK has three layers:

```
┌─────────────────────────────────────┐
│   MotionScript High-Level API       │
│   (Stage, MotionElement, MotionGroup)│
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│   Core Lottie Builder Classes       │
│   (Animation, Layer, Property)      │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│   Lottie JSON Specification         │
│   (Bodymovin/Lottie format)         │
└─────────────────────────────────────┘
```

### Layer 1: MotionScript API (`motionscript.ts`)

**Design Philosophy:**
- Simple, declarative API for LLM code generation
- Hides Lottie JSON complexity
- Supports common animation patterns
- Type-safe with TypeScript

**Core Classes:**

#### Stage

Entry point for creating animations. Manages the underlying `Animation` instance.

```typescript
class Stage {
  constructor(width?: number, height?: number, durationSeconds?: number, fps?: number);
  
  static create(width?: number, height?: number, durationSeconds?: number, fps?: number): Stage;
  
  addText(content: string, style?: TextStyle): MotionElement;
  addShape(type: ShapeType, style?: ShapeStyle): MotionElement;
  createGroup(): MotionGroup;
  
  toJSON(): LottieJSON;
  toString(pretty?: boolean): string;
  
  getAnimation(): Animation;
  getDurationSeconds(): number;
}
```

**Default Values:**
- Width: 800px
- Height: 600px
- Duration: 3 seconds
- FPS: 30

**Usage Example:**

```typescript
const stage = Stage.create(800, 600, 3, 30);
```

#### MotionElement

Represents an animatable element (text or shape). Provides fluent API for chaining animations.

```typescript
class MotionElement {
  animate(config: MotionConfig): MotionElement;
}

interface MotionConfig {
  props: MotionProps;
  spring?: SpringConfig;
  easing?: Easing;
  delay?: number;
  duration?: number;
  time?: MotionTiming;
}
```

**Animation Properties:**

```typescript
interface MotionProps {
  position?: MotionVector2;      // [x, y] in pixels
  opacity?: MotionScalar;         // 0-100
  scale?: MotionVector2;          // [x%, y%] (100 = 100%)
  rotation?: MotionScalar;        // Degrees
  fillColor?: MotionColor;        // For shapes
  color?: MotionColor;            // For text
}
```

**Usage Example:**

```typescript
const circle = stage.addShape('circle', {
  radius: 50,
  fillColor: [1, 0, 0]
});

circle
  .animate({
    props: {
      position: { from: [100, 100], to: [700, 500] },
      scale: { from: [50, 50], to: [150, 150] }
    },
    spring: { stiffness: 200, damping: 20 },
    delay: 0.5
  })
  .animate({
    props: {
      rotation: { from: 0, to: 360 }
    },
    easing: 'easeInOut',
    duration: 2,
    time: { start: 1, end: 3 }
  });
```

#### MotionGroup

Enables staggered animations across multiple elements.

```typescript
class MotionGroup {
  stagger(
    elements: MotionElement[],
    baseConfig: MotionConfig,
    options: StaggerOptions
  ): void;
}

interface StaggerOptions {
  delay: number;  // Per-element delay offset in seconds
}
```

**Usage Example:**

```typescript
const group = stage.createGroup();
const circles = [
  stage.addShape('circle', { radius: 30, fillColor: [1, 0, 0] }),
  stage.addShape('circle', { radius: 30, fillColor: [0, 1, 0] }),
  stage.addShape('circle', { radius: 30, fillColor: [0, 0, 1] })
];

group.stagger(circles, {
  props: {
    position: { from: [400, 600], to: [400, 300] },
    opacity: { from: 0, to: 100 }
  },
  spring: { stiffness: 180, damping: 18 }
}, { delay: 0.1 });  // Each element starts 0.1s after the previous
```

---

### Layer 2: Core Lottie Builder (`Animation.ts`, `Layer.ts`, `Property.ts`)

#### Animation Class

Main container for a Lottie animation. Manages layers, assets, and global settings.

```typescript
class Animation {
  constructor(width: number, height: number, frameRate: number, duration: number);
  
  static create(width?: number, height?: number, duration?: number, fps?: number): Animation;
  
  setName(name: string): this;
  setFrameRate(fps: number): this;
  setDuration(seconds: number): this;
  getDuration(): number;
  getFrameRate(): number;
  
  setSize(width: number, height: number): this;
  getWidth(): number;
  getHeight(): number;
  
  set3D(enabled: boolean): this;
  
  addLayer(layer: Layer): this;
  addLayers(layers: Layer[]): this;
  getLayers(): Layer[];
  
  addAsset(asset: Asset): this;
  addMarker(time: number, comment: string, duration?: number): this;
  
  timeToFrame(seconds: number): number;
  frameToTime(frame: number): number;
  
  toJSON(): LottieJSON;
  toString(pretty?: boolean): string;
}
```

**Key Methods:**

- `timeToFrame()` / `frameToTime()`: Convert between seconds and frame numbers
- `toJSON()`: Export to Lottie JSON format
- Layer management with automatic indexing

#### Layer Classes

Base `Layer` class with specialized subclasses:

**ShapeLayer:**
```typescript
class ShapeLayer extends Layer {
  addShape(shape: ShapeItem): this;
  addShapes(shapes: ShapeItem[]): this;
  animateFillColor(from: ColorRGB, to: ColorRGB, startFrame: number, endFrame: number, easing?: any): this;
}
```

**TextLayer:**
```typescript
class TextLayer extends Layer {
  setText(text: string): this;
  setFontSize(size: number): this;
  setColor(color: ColorRGB): this;
  setJustification(justification: 0 | 1 | 2): this;  // 0=left, 1=right, 2=center
  setStroke(r: number, g: number, b: number, width: number): this;
  animateColor(from: ColorRGB, to: ColorRGB, startFrame: number, endFrame: number): this;
}
```

**SolidLayer:**
```typescript
class SolidLayer extends Layer {
  setColor(color: string): this;  // Hex format
}
```

**Common Transform Methods (all layers):**

```typescript
setPosition(x: number, y: number): this;
animatePosition(endTime: number, x: number, y: number, startTime?: number): this;

setScale(x: number, y: number): this;
animateScale(endTime: number, x: number, y: number, startTime?: number): this;

setRotation(degrees: number): this;
animateRotation(endTime: number, degrees: number, startTime?: number): this;

setOpacity(opacity: number): this;  // 0-100
animateOpacity(endTime: number, opacity: number, startTime?: number): this;

setParent(parentIndex: number): this;
setBlendMode(mode: number): this;
```

#### Property Class

Generic animatable property with keyframe support.

```typescript
class Property<T> {
  constructor(initialValue: T, propertyIndex?: number);
  
  setValue(value: T): this;
  
  addKeyframe(time: number, value: T, easing?: EasingConfig): this;
  addKeyframes(keyframes: Array<{time: number; value: T; easing?: any}>): this;
  
  animateTo(endTime: number, endValue: T, startTime?: number): this;
  animateToWithEasing(endTime: number, endValue: T, startTime?: number, easing?: Easing): this;
  
  toJSON(): PropertyJSON<T>;
  getValue(): T;
  isAnimated(): boolean;
}
```

**Keyframe Structure:**

```typescript
interface Keyframe<T> {
  t: number;              // Time (frame number)
  s: T;                   // Start value
  e?: T;                  // End value (for interpolation)
  i?: BezierEasing;       // In tangent
  o?: BezierEasing;       // Out tangent
  h?: 1;                  // Hold (no interpolation)
}
```

**Easing Interpolation:**

The Property class automatically manages Bezier easing curves for smooth interpolation:

```typescript
interface BezierEasing {
  x: number[];  // X control points
  y: number[];  // Y control points
}

// Linear: { x: [1], y: [1] } → { x: [0], y: [0] }
// EaseIn: { x: [0.42], y: [0] } → { x: [1], y: [1] }
// EaseOut: { x: [0], y: [0] } → { x: [0.58], y: [1] }
// EaseInOut: { x: [0.42], y: [0] } → { x: [0.58], y: [1] }
```

---

### Layer 3: Shape Builder (`shapes.ts`)

Utility class for creating Lottie shape items.

**Available Shapes:**

```typescript
ShapeBuilder.rectangle(name, width, height, position?, roundness?)
ShapeBuilder.ellipse(name, width, height, position?)
ShapeBuilder.circle(name, diameter, position?)
ShapeBuilder.star(name, points, outerRadius, innerRadius, position?)
ShapeBuilder.polygon(name, points, radius, position?)
```

**Style Elements:**

```typescript
ShapeBuilder.fill(name, color: ColorRGB, opacity?)
ShapeBuilder.stroke(name, color: ColorRGB, width, opacity?, lineCap?, lineJoin?)
ShapeBuilder.transform(position?)
ShapeBuilder.animatedTransform(name, config)
```

**Grouping:**

```typescript
ShapeBuilder.group(name, items: ShapeItem[])
ShapeBuilder.createFilledShape(shapeName, shape, fillColor, fillOpacity?)
ShapeBuilder.createStrokedShape(shapeName, shape, strokeColor, strokeWidth, strokeOpacity?)
```

**Example Usage:**

```typescript
const circle = ShapeBuilder.circle('MyCircle', 100);
const fill = ShapeBuilder.fill('Fill', [1, 0, 0], 1);
const transform = ShapeBuilder.transform([400, 300]);

const group = ShapeBuilder.group('CircleGroup', [circle, fill, transform]);

layer.addShapes([group]);
```

---

## Algorithms & Implementations

### 1. Spring Physics Engine (`physics.ts`)

**Purpose:** Generate natural, physics-based motion keyframes using spring dynamics.

**Mathematical Model:**

The system uses a damped harmonic oscillator:

```
m * a = -k * x - c * v

Where:
  m = mass
  k = stiffness (spring constant)
  c = damping coefficient
  x = displacement from equilibrium
  v = velocity
  a = acceleration
```

**Damping Regimes:**

1. **Underdamped (ζ < 1):** Oscillates before settling
2. **Critically Damped (ζ = 1):** Fastest return without oscillation
3. **Overdamped (ζ > 1):** Slow return without oscillation

**Damping Ratio Calculation:**

```typescript
const naturalFrequency = Math.sqrt(stiffness / mass);
const dampingRatio = damping / (2 * Math.sqrt(stiffness * mass));
```

**Position Function (Underdamped):**

```typescript
function positionAtTime(t: number): number {
  if (dampingRatio < 1) {
    const dampedFrequency = naturalFrequency * Math.sqrt(1 - dampingRatio * dampingRatio);
    const coefficientA = initialDisplacement;
    const coefficientB = (initialVelocity + dampingRatio * naturalFrequency * initialDisplacement) / dampedFrequency;
    const envelope = Math.exp(-dampingRatio * naturalFrequency * t);
    const displacement = envelope * (coefficientA * Math.cos(dampedFrequency * t) + coefficientB * Math.sin(dampedFrequency * t));
    return end + displacement;
  }
  // ... other regimes
}
```

**Keyframe Generation Algorithm:**

```typescript
function generateKeyframes(
  start: number,
  end: number,
  physicsConfig: SpringPhysicsConfig,
  fps: number
): TimeValuePair<number>[] {
  const keyframes: TimeValuePair<number>[] = [];
  const totalFrames = Math.ceil(maxDuration * fps);
  
  for (let frame = 0; frame <= totalFrames; frame++) {
    const time = frame / fps;
    const value = positionAtTime(time);
    keyframes.push({ time, value });
    
    // Early termination when settled
    if (frame > 0) {
      const velocity = (value - keyframes[frame - 1].value) * fps;
      const displacement = value - end;
      
      if (Math.abs(displacement) <= precision && Math.abs(velocity) <= precision) {
        break;
      }
    }
  }
  
  // Ensure final value is exact
  keyframes[keyframes.length - 1].value = end;
  
  return keyframes;
}
```

**Parameters:**

```typescript
interface SpringPhysicsConfig {
  stiffness: number;      // Spring constant (higher = stiffer)
  damping: number;        // Damping coefficient (higher = less oscillation)
  mass?: number;          // Default: 1
  initialVelocity?: number;  // Default: 0
  precision?: number;     // Settling threshold
  maxDuration?: number;   // Maximum animation time (default: 3s)
}
```

**Common Presets:**

- **Gentle:** `{ stiffness: 120, damping: 14 }` - Soft, smooth motion
- **Bouncy:** `{ stiffness: 180, damping: 12 }` - Noticeable bounce
- **Stiff:** `{ stiffness: 300, damping: 30 }` - Quick, minimal overshoot
- **Wobbly:** `{ stiffness: 180, damping: 8 }` - Pronounced oscillation

---

### 2. Easing System (`easing.ts`)

**Purpose:** Provide cubic Bezier easing curves for smooth, non-physics-based animations.

**Cubic Bezier Definition:**

A cubic Bezier curve is defined by 4 control points. For easing, P0=(0,0) and P3=(1,1) are fixed, leaving P1 and P2 as parameters:

```
B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
```

**Lottie Easing Format:**

Lottie uses separate in/out tangents:

```typescript
interface LottieEasing {
  i: BezierEasing;  // In tangent (end of previous segment)
  o: BezierEasing;  // Out tangent (start of this segment)
}

interface BezierEasing {
  x: number[];  // X control point(s)
  y: number[];  // Y control point(s)
}
```

**Standard Easings:**

```typescript
const StandardEasings = {
  linear: cubicBezierEasing(0, 0, 1, 1),
  easeIn: cubicBezierEasing(0.42, 0, 1, 1),
  easeOut: cubicBezierEasing(0, 0, 0.58, 1),
  easeInOut: cubicBezierEasing(0.42, 0, 0.58, 1)
};
```

**Custom Easing:**

```typescript
// Custom bounce easing
const bounceEasing = getCubicBezierEasing([0.68, -0.55, 0.265, 1.55]);
```

**Clamping:**

X values are clamped to [0, 1] to ensure valid timing:

```typescript
function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
```

---

### 3. Scene Validation (`sceneValidation.ts`)

**Purpose:** Validate that generated Lottie JSON matches the scene plan specifications.

**Validation Checks:**

1. **Layer Count Mismatch:**
   - Error: Scene plan has objects but Lottie has no layers
   - Warning: Lottie has fewer layers than scene objects

2. **Duration Mismatch:**
   - Warning: Lottie duration differs significantly from scene plan (>25% or >0.5s)

3. **Keyframe Count Mismatch:**
   - Warning: Scene plan defines keyframes but Lottie appears static
   - Warning: Lottie has far fewer keyframes than scene plan

4. **Keyframe Timing Mismatch:**
   - Warning: Latest keyframe time differs significantly from scene plan

**Validation Result:**

```typescript
interface SceneValidationSummary {
  ok: boolean;                           // No errors
  objectCount: number;                   // Scene plan objects
  lottieLayerCount: number;             // Lottie layers
  sceneKeyframeCount: number;           // Total scene keyframes
  lottieKeyframeCount: number;          // Total Lottie keyframes
  sceneDurationSeconds: number;
  lottieDurationSeconds: number;
  sceneMaxKeyframeTimeSeconds: number;
  lottieMaxKeyframeTimeSeconds: number;
  issues: SceneValidationIssue[];
}
```

**Usage:**

This validation helps detect when the Animator agent fails to properly implement the scene plan, triggering retries if needed.

---

### 4. Lottie Metrics Computation (`lottieMetrics.ts`)

**Purpose:** Analyze Lottie JSON to extract complexity metrics.

**Metrics Collected:**

```typescript
interface LottieMetricsSummary {
  layerCount: number;
  textLayerCount: number;
  shapeLayerCount: number;
  solidLayerCount: number;
  imageLayerCount: number;
  animatedPropertyCount: number;
  averageKeyframesPerAnimatedProperty: number;
}
```

**Algorithm:**

```typescript
function computeLottieMetrics(lottie: LottieJSON): LottieMetrics {
  let animatedPropertyCount = 0;
  let totalKeyframes = 0;
  
  for (const layer of lottie.layers) {
    // Check transform properties
    if (layer.ks.p.a === 1) {  // Position is animated
      animatedPropertyCount++;
      totalKeyframes += layer.ks.p.k.length;
    }
    // ... check s, r, o, etc.
    
    // Check shape properties (for shape layers)
    if (layer.shapes) {
      for (const shape of layer.shapes) {
        accumulateFromShapeItem(shape, totals);
      }
    }
  }
  
  return {
    layerCount: lottie.layers.length,
    animatedPropertyCount,
    averageKeyframesPerAnimatedProperty: animatedPropertyCount > 0 
      ? totalKeyframes / animatedPropertyCount 
      : 0
  };
}
```

**Use Cases:**
- Quality assessment (more animated properties = richer animation)
- Performance estimation (more keyframes = more computation)
- Debugging (detect static animations that should be animated)

---

## API Endpoints

### 1. Orchestrator Server (`orchestratorServer.ts`)

**Base URL:** `http://localhost:3003`

#### POST `/orchestrate`

**Purpose:** Main endpoint for generating animations from natural language prompts.

**Request:**

```typescript
interface OrchestrateRequestBody {
  prompt: string;
  assets?: string[];  // Base64-encoded SVG/images or URLs
}
```

**Example:**

```json
{
  "prompt": "Create a 3 second banner animation with the text 'Welcome' that slides in from the bottom",
  "assets": []
}
```

**Response (Success):**

```typescript
interface OrchestrateSuccessResponse {
  ok: true;
  studio: StudioSummary;
}

interface StudioSummary {
  prompt: string;
  assets: string[];
  storyboard: Storyboard | null;
  code: string | null;
  lottieJson: LottieJSON | null;
  errorLogs: string[];
  lottieMetrics?: LottieMetricsSummary;
  critique?: string;
  criticResult?: CriticResult;
  attemptCount: number;
  mode?: AnimationMode;
  promptClassification?: PromptClassification;
}
```

**Response (Error):**

```typescript
interface OrchestrateErrorResponse {
  ok: false;
  errorType: string;
  message: string;
}
```

**Status Codes:**
- `200 OK`: Animation generated successfully
- `400 Bad Request`: Invalid request body
- `500 Internal Server Error`: Orchestration failed

**Processing Time:**
- Typical: 10-30 seconds
- With retries: Up to 60 seconds
- Timeout: 120 seconds

---

### 2. Sandbox Server (`sandboxServer.ts`)

**Base URL:** `http://localhost:3001`

#### POST `/build-lottie`

**Purpose:** Execute MotionScript code and return Lottie JSON (standalone sandbox access).

**Request:**

```typescript
interface BuildLottieRequestBody {
  code: string;  // TypeScript MotionScript code
}
```

**Example:**

```json
{
  "code": "import { Stage } from '@motiongen/sdk';\nconst stage = Stage.create();\nconst text = stage.addText('Hello');\nexport default stage.toJSON();"
}
```

**Response (Success):**

```typescript
interface BuildLottieSuccessResponse {
  ok: true;
  lottie: LottieJSON;
}
```

**Response (Error):**

```typescript
interface BuildLottieErrorResponse {
  ok: false;
  errorType: 'compile' | 'runtime' | 'timeout' | 'internal';
  message: string;
  stack?: string;
  diagnostics?: string[];  // TypeScript compilation errors
}
```

**Error Types:**

- `compile`: TypeScript compilation failed
- `runtime`: Code executed but threw an error
- `timeout`: Execution exceeded 500ms
- `internal`: Sandbox infrastructure error

**Status Codes:**
- `200 OK`: Code executed (check `ok` field for success/failure)
- `400 Bad Request`: Missing or invalid code
- `500 Internal Server Error`: Server error

---

### 3. Renderer Server (`rendererServer.ts`)

**Base URL:** `http://localhost:3002`

#### POST `/render-frames`

**Purpose:** Render preview frames from Lottie JSON at specific timestamps.

**Request:**

```typescript
interface RenderFramesRequestBody {
  lottie_json: LottieJSON;
  timestamps: number[];  // Times in seconds
}
```

**Example:**

```json
{
  "lottie_json": { "v": "5.7.4", "fr": 30, ... },
  "timestamps": [0, 1.5, 3]
}
```

**Response (Success):**

```typescript
interface RenderFramesSuccessResponse {
  ok: true;
  images: string[];  // Base64-encoded PNG images
}
```

**Response (Error):**

```typescript
interface RenderFramesErrorResponse {
  ok: false;
  errorType: string;
  message: string;
}
```

**Status Codes:**
- `200 OK`: Frames rendered (check `ok` field)
- `400 Bad Request`: Invalid Lottie JSON or timestamps
- `500 Internal Server Error`: Rendering failed

**Constraints:**
- Maximum 10 timestamps per request
- Each timestamp must be within animation duration
- Rendering timeout: 60 seconds

---

## Security & Sandboxing

### Threat Model

**Threats Mitigated:**

1. **Arbitrary Code Execution:** LLM-generated code could contain malicious logic
2. **Resource Exhaustion:** Infinite loops, memory leaks, CPU hogging
3. **File System Access:** Reading/writing sensitive files
4. **Network Access:** Making external HTTP requests
5. **Process Manipulation:** Spawning child processes, accessing system APIs

### Defense Layers

#### Layer 1: Process Isolation

```typescript
const child = fork(workerPath, {
  execArgv: ['--max-old-space-size=256'],  // 256MB memory limit
  stdio: ['inherit', 'inherit', 'inherit', 'ipc']
});
```

- Separate process with IPC communication
- Parent can kill child on timeout
- Child crash doesn't affect parent

#### Layer 2: VM2 Sandbox

```typescript
const vm = new NodeVM({
  console: 'inherit',
  sandbox: {},
  require: {
    external: false,      // No npm packages
    builtin: [],          // No Node.js builtins (fs, http, etc.)
    root: __dirname,
    mock: {
      '@motiongen/sdk': sdk  // Only allowed import
    }
  },
  wrapper: 'commonjs',
  timeout: 450  // 450ms execution limit
});
```

- No access to `require()` except mocked SDK
- No access to `fs`, `http`, `child_process`, etc.
- No access to global objects like `process`, `Buffer`
- Timeout enforced at VM level

#### Layer 3: Timeout Protection

```typescript
// Parent process timeout
const timer = setTimeout(() => {
  child.kill('SIGKILL');
  resolve({ ok: false, errorType: 'timeout', message: '...' });
}, 500);

// VM timeout (slightly shorter)
const vm = new NodeVM({ timeout: 450 });
```

- Dual timeout: VM (450ms) + parent (500ms)
- SIGKILL ensures process termination
- No zombie processes

#### Layer 4: TypeScript Compilation

```typescript
const transpiled = ts.transpileModule(code, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    strict: true,
    esModuleInterop: true
  },
  reportDiagnostics: true
});
```

- Type checking catches many errors before execution
- Strict mode enforces safer JavaScript
- Diagnostics provide detailed error messages

### SVG Asset Sanitization

```typescript
function sanitizeSvg(svgString: string): string {
  const optimized = optimize(svgString, { plugins: [] });
  const $ = cheerio.load(optimized.data, { xmlMode: true });
  
  // Remove script tags
  $('script').remove();
  
  // Remove event handlers
  $('*').each((_, element) => {
    Object.keys(element.attribs || {}).forEach(name => {
      if (name.toLowerCase().startsWith('on')) {
        $(element).removeAttr(name);
      }
    });
  });
  
  return $.root().html();
}
```

**Protections:**
- Removes `<script>` tags
- Removes event handlers (`onclick`, `onload`, etc.)
- SVGO optimization removes unnecessary data
- Cheerio parsing validates XML structure

### API Rate Limiting

**Current Implementation:** None (local development)

**Production Recommendations:**
- Rate limit `/orchestrate` endpoint (e.g., 10 requests/minute per IP)
- Timeout long-running requests (120s max)
- Queue system for high load
- Authentication/API keys for access control

---

## Deployment Architecture

### Development Setup

```
┌─────────────────────────────────────┐
│   Developer Machine (localhost)     │
│                                     │
│  ┌──────────────────────────────┐  │
│  │  Orchestrator Server :3003   │  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌──────────────────────────────┐  │
│  │  Sandbox Server :3001        │  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌──────────────────────────────┐  │
│  │  Renderer Server :3002       │  │
│  └──────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

**Start Commands:**

```bash
# Orchestrator
npm run start:orchestrator

# Sandbox
npm run start:sandbox

# Renderer
npm run start:renderer
```

### Production Architecture (Recommended)

```
                    ┌──────────────┐
                    │  Load        │
                    │  Balancer    │
                    └──────┬───────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
    ┌───────▼──────┐ ┌────▼─────┐ ┌─────▼──────┐
    │ Orchestrator │ │Orchestrator│ │Orchestrator│
    │  Instance 1  │ │ Instance 2 │ │ Instance 3 │
    └───────┬──────┘ └────┬─────┘ └─────┬──────┘
            │              │              │
            └──────────────┼──────────────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
    ┌───────▼──────┐ ┌────▼─────┐ ┌─────▼──────┐
    │   Sandbox    │ │  Sandbox   │ │  Sandbox   │
    │   Pool 1     │ │   Pool 2   │ │   Pool 3   │
    └──────────────┘ └────────────┘ └────────────┘
            │              │              │
            └──────────────┼──────────────┘
                           │
                    ┌──────▼───────┐
                    │   Renderer   │
                    │   Service    │
                    │  (Shared)    │
                    └──────────────┘
```

**Scaling Considerations:**

1. **Orchestrator:** Stateless, can scale horizontally
2. **Sandbox:** CPU-intensive, needs process isolation
3. **Renderer:** Memory-intensive (Puppeteer), shared pool

### Environment Variables

```bash
# Groq API
GROQ_API_KEY=your_api_key_here
GROQ_API_BASE_URL=https://api.groq.com

# Model Configuration
MOTIONGEN_GROQ_DEFAULT_MODEL=openai/gpt-oss-120b
MOTIONGEN_GROQ_MODEL_TEXT_MODEL=openai/gpt-oss-120b
MOTIONGEN_GROQ_MODEL_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct

# Server Ports
ORCHESTRATOR_PORT=3003
SANDBOX_PORT=3001
RENDERER_PORT=3002

# Timeouts
SANDBOX_TIMEOUT_MS=500
RENDERER_TIMEOUT_MS=60000
ORCHESTRATOR_TIMEOUT_MS=120000

# Debug
DEBUG=motiongen:*
```

### Docker Deployment (Future)

```dockerfile
# Orchestrator Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist ./dist
EXPOSE 3003
CMD ["node", "dist/orchestratorServer.js"]
```

```dockerfile
# Renderer Dockerfile
FROM node:20
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist ./dist
EXPOSE 3002
CMD ["node", "dist/rendererServer.js"]
```

---

## Appendix

### File Structure

```
backend/
├── src/
│   ├── orchestrator.ts              # LangChain StateGraph workflow
│   ├── orchestratorServer.ts        # HTTP server for /orchestrate
│   ├── sandboxRunner.ts             # Sandbox execution manager
│   ├── sandboxServer.ts             # HTTP server for /build-lottie
│   ├── sandbox-worker.ts            # Child process worker
│   ├── renderer.ts                  # Frame rendering coordinator
│   ├── rendererServer.ts            # HTTP server for /render-frames
│   ├── browserRenderer.ts           # Puppeteer implementation
│   │
│   ├── promptClassifierAgent.ts     # Prompt classification
│   ├── directorAgent.ts             # Storyboard creation
│   ├── scenePlannerAgent.ts         # Scene plan generation
│   ├── sceneRefinementAgent.ts      # Scene plan refinement
│   ├── animatorAgent.ts             # MotionScript code generation
│   ├── criticAgent.ts               # Quality evaluation
│   ├── assetProcessor.ts            # SVG analysis
│   ├── groqClient.ts                # LLM API client
│   │
│   ├── Animation.ts                 # Animation container
│   ├── Layer.ts                     # Layer classes
│   ├── Property.ts                  # Animatable property
│   ├── shapes.ts                    # ShapeBuilder utility
│   ├── motionscript.ts              # MotionScript API
│   ├── sdk.ts                       # SDK interface definition
│   ├── physics.ts                   # Spring physics engine
│   ├── easing.ts                    # Easing functions
│   │
│   ├── types.ts                     # Lottie JSON types
│   ├── scenePlan.ts                 # Scene plan types
│   ├── storyboardTypes.ts           # Storyboard types
│   ├── sharedApiTypes.ts            # HTTP API types
│   ├── sceneValidation.ts           # Validation logic
│   ├── lottieMetrics.ts             # Metrics computation
│   │
│   ├── logger.ts                    # Debug logging
│   ├── debugDump.ts                 # State dumping
│   ├── index.ts                     # SDK exports
│   │
│   ├── prompts/
│   │   └── animatorExamples.ts      # Example animations
│   │
│   └── tests/
│       ├── animator-e2e.ts
│       ├── critic-e2e.ts
│       ├── director-e2e.ts
│       ├── orchestrator-e2e.ts
│       ├── render-e2e.ts
│       ├── sandbox-e2e.ts
│       └── ...
│
├── package.json
├── tsconfig.json
├── README.md
├── QUICKSTART.md
└── docs/
    └── main_design.md               # This document
```

### Key Dependencies

```json
{
  "dependencies": {
    "@langchain/langgraph": "^0.2.26",
    "typescript": "^5.7.2",
    "vm2": "^3.9.19",
    "puppeteer": "^23.11.1",
    "dotenv": "^16.4.7",
    "cheerio": "^1.0.0",
    "svgo": "^3.3.2"
  }
}
```

### Testing

**Test Suites:**

- `animator-e2e.ts`: AnimatorAgent code generation
- `critic-e2e.ts`: CriticAgent evaluation
- `director-e2e.ts`: DirectorAgent storyboarding
- `orchestrator-e2e.ts`: Full workflow integration
- `render-e2e.ts`: Frame rendering
- `sandbox-e2e.ts`: Sandbox execution
- `visual-tests.ts`: Visual regression tests

**Run Tests:**

```bash
npm test                          # All tests
npm run test:animator             # Animator agent
npm run test:critic               # Critic agent
npm run test:orchestrator         # Full orchestration
```

---

## Summary

MotionGen V3 is a sophisticated multi-agent system that transforms natural language into professional Lottie animations. The architecture combines:

1. **8 Specialized AI Agents** orchestrated through LangChain StateGraph
2. **Sandboxed Code Execution** with VM2 and process isolation
3. **Physics-Based Animation Engine** with spring dynamics and easing
4. **Visual Quality Assessment** using multimodal LLM vision
5. **Iterative Refinement** with automatic retry logic
6. **Type-Safe MotionScript DSL** for LLM code generation

The system handles the complete pipeline from prompt to production-ready animation, with robust error handling, security measures, and quality controls at every stage.

