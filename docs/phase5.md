# Phase 5: Frontend (The Studio)

## 1\. Core Philosophy: "Glass Box" AI

Standard AI tools are "Black Boxes" (Input $\rightarrow$ Magic $\rightarrow$ Output).
**The Studio** is a "Glass Box." Users see the **Storyboard** (Director), the **Code** (Animator), and the **Visual Feedback** (Critic) in real-time. This builds trust and allows for precise "Remixing" at any stage.

## 2\. Technology Stack (Modern & Robust)

  * **Framework:** **Next.js 16** (App Router) – For React Server Components (RSC) and easy streaming.
  * **UI System:** **Shadcn UI** + **Tailwind CSS** – For accessible, professional-grade components that we can easily customize.
  * **State Management:** **Zustand** – Lightweight global state (perfect for tracking the complex "Director $\rightarrow$ Animator" loop) without the boilerplate of Redux.
  * **Code Editor:** **@monaco-editor/react** – The VS Code engine embedded in the browser for the "Animator" view.
  * **Visualization:**
      * **React Flow:** To visualize the "Storyboard" as a node graph (optional advanced view).
      * **Lottie-Web:** For rendering the final artifacts.
      * **React-Diff-Viewer:** To show exactly what changed between two versions of code.

-----

## 3\. "The Studio" Implementation Details

### 3.1 The Layout (Three-Pane Workspace)

We use a **Resizable Mosaic Layout** (like Blender or VS Code) to accommodate different user personas.

  * **Left Pane: The Director (Intent & Logs)**

      * **Chat Input:** "Make it bounce higher."
      * **Thought Stream (SSE):** A scrolling terminal showing the active agent's thinking.
          * *Director:* "Analyzing user intent... detected 'High Energy'."
          * *Animator:* "Adjusting stiffness to 400..."
      * **Storyboard View:** A vertical timeline of beats (e.g., "0s: Fade In", "2s: Impact").

  * **Center Pane: The Stage (Renderer)**

      * **Canvas:** Displays the Lottie rendering.
      * **Scrubber:** Professional timeline (Play/Pause, Frame stepping).
      * **Critic Overlays:** When the Critic Agent detects an issue (e.g., low contrast), it draws a **red bounding box** directly on the canvas with a tooltip: *"Text contrast is too low (2.1:1)."*

  * **Right Pane: The Engine (Code & Controls)**

      * **Tab 1: Smart Controls:** Sliders generated dynamically by the AI (e.g., "Bounce Amount", "Speed", "Color 1").
      * **Tab 2: Code Editor (Monaco):** Read-only by default, but unlockable for "Power Users" to directly edit the TypeScript SDK code.

### 3.2 Real-Time "Thought Streaming" (Server-Sent Events)

We don't wait for the generation to finish. We stream the "Brain" to the UI to keep users engaged.

  * **Why SSE (Server-Sent Events) vs. WebSockets?**
      * We primarily need **one-way** streaming (Server $\rightarrow$ Client logs). SSE is simpler to implement in Next.js and auto-reconnects.
  * **Implementation:**
      * **Backend:** The LangGraph nodes emit "events" to a Redis Pub/Sub channel.
      * **API Route:** `/api/stream/[sessionId]` subscribes to Redis and pushes data via `TextEncoder`.
      * **Frontend:** A custom `useAgentStream` hook listens to the stream and updates the `Zustand` log store.

### 3.3 The "Remix" Workflow

This is where we beat standard tools. Users don't just "regenerate"; they **iterate**.

  * **Diff View:** When a user says "Make it faster," and the Animator changes the code, we don't just swap the animation. We show a **Diff Modal** highlighting the code change:
    ```typescript
    - const spring = Motion.spring({ stiffness: 100 });
    + const spring = Motion.spring({ stiffness: 300 }); // Changed per user request
    ```
  * **Optimistic UI:** While the new Lottie compiles (which takes \~2s), we show a "Skeleton" animation or the previous version with a "Processing..." overlay, ensuring the interface never freezes.

-----

## 4\. The UX Experiment: "Box Transparency"

To ensure we are building a *usable* pro tool, we will run an A/B test focusing on **Explainability**.

### Experiment: "The Black Box vs. The Glass Box"

  * **Hypothesis:** Showing the *intermediate* "Director Storyboard" and "Critic Feedback" will increase user trust and reduce the rate of "abandonment" (rage-quitting) during long generations.
  * **Cohort A (Black Box):** Standard "ChatGPT-style" interface. User types prompt $\rightarrow$ Spinner $\rightarrow$ Final Animation.
  * **Cohort B (Glass Box):**
    1.  **Step 1:** Shows the **Storyboard JSON** immediately (Director output).
    2.  **Step 2:** Shows the **Code** writing in real-time (Animator output).
    3.  **Step 3:** Shows the **Critic's Reject/Approve** decision.
  * **Metrics to Track:**
      * **Time-to-Export:** Does seeing the controls encourage users to tweak (longer time) or accept faster?
      * **Remix Rate:** How often do users edit the code vs. re-prompting?
      * **Perceived Latency:** Use a survey ("Did this feel slow?") to see if the "Glass Box" makes the wait feel shorter (psychological duration).

-----

## 5\. Development Checklist (Frontend)

### Phase 5.1: Foundation

  * [ ] **Scaffold Next.js 15:** Setup App Router, TypeScript, and Shadcn UI registry.
  * [ ] **State Store:** Create `useStudioStore` with Zustand for `logs`, `code`, `lottieJson`, and `activeAgent`.
  * [ ] **Monaco Setup:** Implement the `<CodeEditor />` component with the custom TypeScript definitions (`.d.ts`) of our SDK injected so users get autocomplete.

### Phase 5.2: The Real-Time Loop

  * [ ] **SSE Hook:** Build `useEventSource` to consume logs from the orchestration layer.
  * [ ] **Log Terminal:** Build a component that auto-scrolls and color-codes logs (Director=Blue, Critic=Red, Animator=Green).

### Phase 5.3: The Visual Stage

  * [ ] **Lottie Player:** Integrate `lottie-react` with a custom scrubber/timeline.
  * [ ] **Critic Overlay:** Build a canvas layer that draws rectangles over the Lottie player based on coordinates sent by the Critic Agent.

### Phase 5.4: User Testing

  * [ ] **Instrument Telemetry:** Add PostHog or Mixpanel to track "Edit Code" vs "Re-Prompt" actions for the UX experiment.

This frontend design turns a backend logic puzzle into a tangible, professional creative product. It empowers users by treating them as intelligent collaborators ("Directors") rather than just consumers.
