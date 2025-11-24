This is a comprehensive technical roadmap designed to be fed into an **AI Coder** (like Cursor, Windsurf, or a custom agent). It breaks down the **MotionGen V3** architecture into executable tasks.

### Architectural Preamble for AI Coder
* **Goal:** Build a text-to-Lottie generation engine.
* **Core Logic:** LLMs generate TypeScript code using a custom SDK; this code runs in a sandbox to produce Lottie JSON.
* **Groq Model Mapping:**
    * **Logic/Coding:** `GPT OSS 120B 128k` (Used for the Director and Animator agents).
    * **Routing/Fast Parsing:** `GPT OSS 20B 128k` (Used for safety checks and simple intent extraction).
    * **Vision/QA:** `meta-llama/llama-4-scout-17b-16e-instruct` (Used for visual verification of frames).

---

## Phase 1: The Core Foundation (MotionScript SDK)
**Context:** We cannot let the LLM write raw Lottie JSON. We need a type-safe TypeScript abstraction layer (DSL) that handles the complex math.

### Task 1.1: Build the Lottie JSON Builder
* **Description:** Create a TypeScript class structure that maps to the Lottie Schema (bodymovin).
* **Technical Details:**
    * Create classes: `Animation`, `Layer` (Shape, Text, Image), `Property` (Position, Scale, Opacity).
    * Implement a `.toJSON()` method on the root class that outputs strictly valid Lottie JSON.
    * **Critical:** Do not rely on external DOM dependencies (window, document). This must run in a pure Node.js environment.
* **Groq Usage:** None (Pure Typescript).
* **Verification:** Write a unit test that instantiates a simple red rectangle, exports JSON, and validates it against the official [Lottie Schema](https://lottiefiles.github.io/lottie-docs/schema/).

### Task 1.2: Implement Physics & Easing Engine
* **Description:** Implement spring physics math to convert user-friendly configs (stiffness, damping) into keyframes.
* **Technical Details:**
    * Port a spring solver (like `wobble` or `react-spring` logic) to raw TypeScript.
    * Create a function `generateKeyframes(start, end, physicsConfig, fps)` that returns an array of time/value pairs.
    * Standardize easing curves (Cubic Bezier) support.
* **Verification:** Generate a JSON where a circle moves from X=0 to X=100 using `stiffness: 200`. Load the JSON in a Lottie player; the circle should overshoot and settle (bounce), not move linearly.

### Task 1.3: The "MotionScript" High-Level API
* **Description:** Create the actual API the LLM will use. It acts as a wrapper around 1.1 and 1.2.
* **Technical Details:**
    * **Namespace:** `import { Stage, Motion } from '@motiongen/sdk'`
    * **Methods to build:**
        * `stage.addText(content, style)`
        * `stage.addShape(type, style)`
        * `element.animate({ props, spring, delay })`: This must handle the logic of calculating start times based on delay.
        * `group.stagger(elements, config)`: Helper to apply incremental delays.
* **Verification:** Manually write a 10-line script using this SDK that creates a staggered text reveal. Compile it. Ensure the output Lottie JSON works.

---

## Phase 2: The Execution Sandbox (Backend)
**Context:** We need a safe place to run the LLM-generated code and a way to "see" it.

### Task 2.1: Secure Node.js Sandbox Service
* **Description:** Set up a secure runner that accepts a string of code and returns Lottie JSON.
* **Technical Details:**
    * Use `vm2` or `isolated-vm` in Node.js.
    * **Hard Limits:** 500ms execution timeout, 256MB RAM limit (prevents infinite loops).
    * Inject the SDK (from Phase 1) into the VM context.
    * **Input:** TypeScript string. **Output:** JSON object or Error Trace.
* **Verification:** Send a script `while(true){}` to the endpoint; it must return a 408 Timeout, not crash the server.

### Task 2.2: Headless Renderer (The "Eyes")
* **Description:** A service that takes Lottie JSON and outputs PNG buffers.
* **Technical Details:**
    * Use `skia-canvas` or `puppeteer` with `lottie-web`.
    * Endpoint: `POST /render-frames`.
    * Input: `lottie_json`, `timestamps: [0, 1.5, 3.0]`.
    * Output: Array of Base64 Images.
* **Verification:** Send a valid Lottie file. Receive 3 distinct PNGs showing the animation progression.

---

## Phase 3: The Intelligence Layer (Groq Agents)
**Context:** Building the Brains using the specific Groq models.

### Task 3.1: The Director Agent (Planner)
* **Description:** Analyzes the prompt and outputs a "Storyboard" JSON.
* **Technical Details:**
    * **Model:** `GPT OSS 120B 128k`.
    * **System Prompt:** "You are an Art Director. Output JSON defining the 'Vibe', 'Color Palette' (Hex codes), and 'Timeline' (Beat sheet)."
    * **Constraint:** Force JSON mode.
* **Verification:** Input "Spooky Halloween Sale". Check if output contains dark colors (Purples/Oranges) and a timeline mentioning "ghostly fading."

### Task 3.2: The Animator Agent (Coder)
* **Description:** Translates the Director's Storyboard into MotionScript SDK code.
* **Technical Details:**
    * **Model:** `GPT OSS 120B 128k`.
    * **Context Injection:** You must inject the *Interface Definition* (`.d.ts` file) of the Phase 1 SDK into the system prompt so the model knows available functions.
    * **Prompt Strategy:** "You are a TypeScript expert. Use the provided SDK. Do not use external libraries. Return only code."
* **Verification:** Feed the "Halloween" storyboard from 3.1. The agent should output valid TypeScript code calling `stage.addText()` and `Motion.spring()`.

### Task 3.3: The Critic Agent (Visual QA)
* **Description:** Looks at the frames from Task 2.2 and judges quality.
* **Technical Details:**
    * **Model:** `meta-llama/llama-4-scout-17b-16e-instruct` (Groq Vision).
    * **Input:** The 3 PNG snapshots + The original User Prompt.
    * **Prompt:** "Does the text contrast well with the background? Is any text cut off? Does the vibe match '[User Prompt]'? Reply JSON: { pass: boolean, critique: string }."
* **Verification:** Intentionally create a Lottie with black text on a black background. Send to Critic. It must return `pass: false` and complain about legibility.

---

## Phase 4: Orchestration (The Glue)

### Task 4.1: LangGraph State Machine
* **Description:** Connect the agents in a loop.
* **Technical Details:**
    * **State Object:** `{ prompt, storyboard, code, lottie_json, error_logs, attempt_count }`.
    * **Flow:**
        1.  `Director` -> generates storyboard.
        2.  `Animator` -> generates code.
        3.  `Sandbox` -> compiles code. (If error -> go back to Animator with error log).
        4.  `Renderer` -> makes images.
        5.  `Critic` -> reviews images. (If fail -> go back to Animator with critique).
        6.  End.
* **Verification:** Run an end-to-end request. Inspect logs to see the loop handle a syntax error (simulated) and self-correct.

### Task 4.2: Asset Processor
* **Description:** Handle user uploads (SVG/Images).
* **Technical Details:**
    * **Model:** `GPT OSS 20B` (for SVG analysis).
    * Sanitize uploaded SVGs (remove scripts).
    * Use 20B model to identify layer IDs in SVG (e.g., "Which ID is the 'wheel'?").
* **Verification:** Upload a complex SVG logo. System should identify groups and expose them to the Animator agent context.

---

## Phase 5: Frontend (The Studio)

### Task 5.1: Interactive Canvas
* **Description:** Next.js UI to display the result.
* **Technical Details:**
    * Use `lottie-react` to render the final JSON.
    * Build a "Scrubber" timeline.
    * Real-time status logs ("Director is planning...", "Critic is reviewing...").
* **Verification:** UI updates state as the backend processes the LangGraph chain.

### Task 5.2: The "Remix" Input
* **Description:** Allow users to talk to the Animator agent to make changes.
* **Technical Details:**
    * Chat interface that appends to the `LangGraph` state.
    * User: "Make it faster." -> New cycle starts at `Animator` node with instruction "Increase speed."
* **Verification:** Generate an animation. Type "Change background to blue." The system should regenerate with only that change.