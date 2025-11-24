### **Phase 3: Intelligence Layer Specification**

**Goal:** Create a deterministic, self-correcting agent loop where creativity (Director) is separated from execution (Animator) and verification (Critic).

**Groq Model Strategy:**

  * **Director (Logic/Planning):** `GPT OSS 120B` – chosen for high reasoning capability and strict JSON adherence.
  * **Animator (Coding):** `GPT OSS 120B` – chosen for robust code generation and context retention.
  * **Critic (Vision/QA):** `llama-4-scout-17b-16e-instruct` – chosen for multimodal visual reasoning.

-----

### **3.1 The Director Agent (The Planner)**

The Director does *not* write code. Its sole job is to translate vague user intent into a precise, mathematically sound **Storyboard Specification**.

#### **Context & System Prompt**

**Temperature:** `0.7` (Needs creativity, but structured output)
**Response Format:** `JSON Object` (Enforce JSON mode)

**System Prompt Structure:**

```text
You are the Creative Director of a high-end motion graphics studio.
Your goal is to break down a user's request into a frame-by-frame storyboard JSON.

# CONSTRAINTS
1. You must NOT write code. Output strict JSON only.
2. Timing is in seconds. Total duration must not exceed user request (default 5s).
3. "Vibe" must translate to specific easing curves (e.g., "Playful" = "spring(120, 10)").
4. You must define a color palette if none is provided.

# OUTPUT SCHEMA
{
  "meta": { "duration": number, "fps": 60, "bg_color": hex },
  "assets": [ { "id": string, "type": "text|shape|image", "content": string } ],
  "timeline": [
    {
      "time": number,
      "target_asset_id": string,
      "action": "enter|exit|highlight|move",
      "parameters": { "x": number, "y": number, "scale": number, "opacity": number },
      "physics": { "type": "spring|linear|bezier", "config": { ... } }
    }
  ]
}
```

#### **Engineering Implementation Note:**

  * **Input Injection:** Inject the user's prompt + analysis of uploaded assets (e.g., "User uploaded `logo.svg` with 3 groups").
  * **Prompt Chain:**
      * *User:* "Make my logo bounce in like a basketball."
      * *Director Output:* Generates a timeline where `y` position follows a decay curve (0s: y=0, 0.5s: y=200, 0.8s: y=50...) to simulate gravity *before* code is written.

-----

### **3.2 The Animator Agent (The Coder)**

The Animator is a dumb but skilled transcriber. It takes the *Director's JSON* and writes *MotionScript TypeScript* code. It must never invent new design ideas, only execute the plan.

#### **Context & System Prompt**

**Temperature:** `0.2` (Strict, low creativity, high precision)
**Stop Sequences:** `["```", "return stage"]`

**System Prompt Structure:**

```text
You are a Senior Creative Technologist. 
You will convert a JSON Storyboard into a TypeScript executable using the 'MotionScript' SDK.

# SDK INTERFACE (Strictly follow this)
type SpringConfig = { stiffness: number, damping: number };
class Stage {
  constructor(w: number, h: number);
  addText(id: string, content: string, style: TextStyle): Element;
  addShape(id: string, type: 'rect'|'circle', style: ShapeStyle): Element;
  // animate() handles the interpolation automatically
  animate(id: string, props: { x?: number[], y?: number[], scale?: number[] }, timing: { start: number, duration: number, ease?: SpringConfig });
  render(): LottieJSON;
}

# INSTRUCTIONS
1. Initialize the Stage with dimensions from the storyboard.
2. Instantiate all 'assets' defined in the storyboard.
3. Apply animations strictly matching the 'timeline' events.
4. If a 'physics' config is present, convert it to the SDK's expected format.
5. Return ONLY the TypeScript code block. No markdown, no explanations.
```

#### **How to Build This Prompt (The Context Window)**

1.  **SDK Definition (`.d.ts`):** You must include the *entire* type definition of your internal SDK in the system prompt. If the model doesn't know the `.animate()` method exists, it will hallucinate one.
2.  **Few-Shot Examples:** Provide 2 examples of `JSON Storyboard -> Valid TypeScript Code` pairs in the prompt. This "teaches" the model the mapping logic.

-----

### **3.3 The Critic Agent (Visual QA)**

This is the most novel part. We use the **Llama-4-Scout** vision capabilities to "look" at the output frames and judge them against the user's original request.

#### **Context & System Prompt**

**Temperature:** `0.4`
**Input:** `[User Prompt, Image_Frame_0.png, Image_Frame_30.png, Image_Frame_60.png]`

**System Prompt Structure:**

```text
You are a QA Visual Specialist. You are looking at three keyframes (Start, Middle, End) of an animation.
Your job is to verify if the animation meets the User's Intent and Design Standards.

# CRITERIA
1. **Legibility:** Is text contrast > 4.5:1? Is text cut off by the edge?
2. **Relevance:** Does the imagery match the prompt? (e.g., if prompt says "Halloween", is it dark/orange?)
3. **Motion Quality:** (Inferred) Does the middle frame show significant change from the start frame? (If identical, animation is broken).

# OUTPUT FORMAT (JSON ONLY)
{
  "status": "PASS" | "FAIL",
  "score": number (0-100),
  "issues": [
    { "severity": "critical|minor", "description": "Text 'Sale' overlaps with logo at t=1.5s" }
  ],
  "suggestion": "Move the 'Sale' text layer y-position up by 50px."
}
```

#### **Verification Strategy**

  * **The Loop:** If `status == FAIL`, the Orchestrator takes the `suggestion` from the Critic and feeds it back to the **Animator** (not the Director).
  * *Animator Input (Retry):* "Previous attempt failed. Critic feedback: [Move 'Sale' up 50px]. Regenerate code with this fix."

-----

### **3.4 Technical Engineering Checklist**

To ensure these prompts work in production, engineers must implement the following:

1.  **Structured Output Enforcement:**

      * Do not rely on the LLM to just "be good" at JSON. Use Groq’s strictly enforced **JSON Mode** or pass a **JSON Schema** (if supported by the specific model variant) to guarantee the output is parseable.
      * *Tools:* Use `Pydantic` (Python) or `Zod` (TS) to validate the LLM response. If validation fails, trigger an automatic retry without user intervention.

2.  **Token Budgeting:**

      * **Director:** High context. Needs full user chat history + asset metadata.
      * **Animator:** Medium context. Needs Storyboard + SDK Docs. *Drop* the user chat history to prevent "distraction" by vague user phrasing; focus only on the Storyboard.
      * **Critic:** Low text context, high visual context. Only needs the original prompt and the images.

3.  **The "Safety" Router (Pre-flight):**

      * Before hitting the Director, use a small, fast model (`GPT OSS 20B`) to classify the prompt.
      * *Prompt:* "Is this request asking for NSFW, hate speech, or complex 3D simulation (which we don't support)? Respond TRUE/FALSE."
      * This saves money and prevents the 120B model from wasting cycles on jailbreaks.

### **3.5 How to Test & Verify**

  * **Unit Test for Director:** Feed it "A red ball bounces." Assert that the output JSON contains a `timeline` array with at least 3 keyframes and a `spring` physics config.
  * **Unit Test for Animator:** Feed it a mock Storyboard. Assert that the output string starts with `import` and contains `stage.render()`. Run it in the sandbox; assert it doesn't throw `SyntaxError`.
  * **Integration Test (The "Vibe Check"):**
      * Prompt: "Make it look like a glitched cyberpunk hacker terminal."
      * *Verify:* Does the Director choose a green/black palette? Does the Animator use `step` easing (jerky motion) instead of `smooth`? Does the Critic pass the frames?