# Phase 4: Orchestration (The Glue)

This phase binds the "Brain" (Agents) to the "Body" (Sandbox/Renderer). We will use **LangGraph** (a library by LangChain) because it treats the agent workflow as a **cyclic graph** rather than a linear chain. This allows for loops (e.g., "The Critic rejected the animation, send it back to the Animator").

### 4.1 The Architecture: State Machine (LangGraph)

The orchestration logic runs on a Python server (FastAPI). It maintains a `State` object that passes between agents.

**The State Object:**

```python
from typing import TypedDict, List, Optional

class AnimationState(TypedDict):
    # Inputs
    prompt: str
    assets: List[str] # S3 paths
    
    # Internal Artifacts
    storyboard: Optional[dict]  # Output from Director
    code: Optional[str]         # Output from Animator
    lottie_json: Optional[dict] # Output from Sandbox
    
    # Feedback Loop
    error_logs: List[str]       # Compiler errors
    critique: Optional[str]     # Critic's feedback
    attempt_count: int          # To prevent infinite loops
    
    # Final Output
    status: str # "processing", "complete", "failed"
```

**The Graph Flow:**

1.  **Node: Director** (GPT-OSS 120B) → Generates `storyboard`.
2.  **Node: Animator** (GPT-OSS 120B) → Generates `code` based on storyboard + assets.
3.  **Node: Sandbox** (Code Execution) → Runs `code` → returns `lottie_json` or `error`.
      * *Conditional Edge:* If `error` exists → Loop back to **Animator** (with error context).
4.  **Node: Renderer** (Headless) → Renders PNG frames.
5.  **Node: Critic** (Llama-4-Scout) → Reviews frames.
      * *Conditional Edge:* If "Reject" → Loop back to **Animator** (with critique).
      * *Conditional Edge:* If "Approve" → Go to **End**.

### 4.2 Implementation: The Asset Processor (SVG Pipeline)

Before the agents start, we must process user assets. Raw SVGs are often too messy for an LLM to read directly.

**Goal:** Turn a user's `logo.svg` into something the Animator Agent can manipulate.

**Pipeline Steps:**

1.  **Sanitization:** Use `scour` (Python library) to remove empty tags, metadata, and scripts.
2.  **Simplification:** Use `svgelements` to parse paths.
3.  **Semantic Labeling (AI):** Use **GPT-OSS 20B** to identify groups.

**Code Logic (Python):**

```python
import svgelements

def process_svg_for_llm(svg_path):
    # 1. Load SVG
    svg = svgelements.SVG.parse(svg_path)
    
    # 2. Extract Hierarchy (Simplified for LLM context)
    structure = []
    for element in svg.elements():
        if isinstance(element, svgelements.Group):
            # We want the ID so the LLM can target it in code
            # e.g. stage.select('#wheel').animate(...)
            structure.append(f"Group ID: {element.id}, Children: {len(element)}")
            
    # 3. Call GPT-OSS 20B (The "Tagger")
    # Prompt: "Given this SVG structure, identify the ID for the 'background' 
    # and the 'icon'. Return JSON: { 'bg_id': '...', 'icon_id': '...' }"
    return call_groq_20b(prompt=str(structure))
```

-----

# Verification & Testing Strategy

You asked how to **programmatically verify** the system works without looking at every file. We will implement a 3-Tier Testing Strategy.

### Tier 1: The "Lottie Inspector" (Automated Quality Check)

We will write a Python script that loads the generated Lottie JSON and asserts specific properties. This runs automatically after every generation.

**What it checks:**

1.  **Validity:** Is it valid JSON? Does it adhere to the Lottie Schema?
2.  **Activity:** does the animation actually *move*? (Checking keyframes).
3.  **Structure:** Are there non-empty layers?

**The Inspector Script (`verify_lottie.py`):**

```python
import json
import sys

def verify_lottie(file_path):
    with open(file_path, 'r') as f:
        data = json.load(f)

    # Check 1: Schema Basics
    required_keys = ['v', 'fr', 'ip', 'op', 'layers']
    if not all(key in data for key in required_keys):
        return False, "Missing required Lottie root keys"

    # Check 2: Duration sanity
    duration_frames = data['op'] - data['ip']
    if duration_frames <= 0:
        return False, "Animation has 0 duration"

    # Check 3: "Is it moving?" (Keyframe Analysis)
    # Scan layers for animated properties (properties with 'k' as a list of keyframes)
    has_motion = False
    for layer in data['layers']:
        # Transform properties (Anchor, Position, Scale, Rotation, Opacity)
        ks = layer.get('ks', {})
        for prop in ['a', 'p', 's', 'r', 'o']:
            if prop in ks:
                val = ks[prop]
                # In Lottie, if 'a' is 1, it's animated (has keyframes)
                if val.get('a') == 1: 
                    has_motion = True
                    break
    
    if not has_motion:
        return False, "Animation is static (no keyframes found)"

    return True, "Passed"

# Usage in pipeline
success, message = verify_lottie("output.json")
if not success:
    raise Exception(f"Validation Failed: {message}")
```

### Tier 2: Visual Regression (The "Eyes")

For E2E testing, we need to ensure the rendering pipeline works.

  * **Tools:** `lottie-web` (running in a headless browser like Puppeteer) or `skia-canvas`.
  * **Test Logic:**
    1.  Render Frame 0 (`start.png`).
    2.  Render Frame 50 (`mid.png`).
    3.  **Assertion:** `assert_images_not_equal(start.png, mid.png)`
    4.  *Why?* If the images are identical, the animation is broken/frozen.

### Tier 3: End-to-End (E2E) Pipeline Test

To test the *Orchestrator* (LangGraph) deterministically, we must **Mock the LLMs**. We don't want to pay for tokens or deal with random AI variance during standard CI/CD runs.

**The Test Plan:**

1.  **Mock Director:** Returns a fixed Storyboard JSON (`{ "action": "fade_in" }`).
2.  **Mock Animator:** Returns a fixed string of TypeScript code that we *know* works.
3.  **Real Sandbox:** Compiles that code.
4.  **Real Inspector:** Verifies the output.

**Example `pytest` Test:**

```python
import pytest
from orchestration import run_pipeline

def test_full_pipeline_success(mocker):
    # 1. Mock the LLM calls to return predictable responses
    mocker.patch('agents.director.generate', return_value={"style": "bounce"})
    mocker.patch('agents.animator.generate', return_value="stage.addText('Hello');")
    
    # 2. Run the actual pipeline (LangGraph)
    result = run_pipeline(prompt="Test Prompt")
    
    # 3. Assertions
    assert result['status'] == 'complete'
    assert result['lottie_json'] is not None
    
    # 4. Run the Tier 1 Inspector on the result
    success, msg = verify_lottie_data(result['lottie_json'])
    assert success is True
```

### Summary of Tasks for "Phase 4"

| Task | Component | Description | Verification Method |
| :--- | :--- | :--- | :--- |
| **4.1** | **LangGraph Setup** | Define the State Graph, Nodes (Director/Animator/Critic), and Conditional Edges (Loops). | Run a flow that forces a loop (simulate an error) and ensure it retries 3 times before failing. |
| **4.2** | **Asset Pipeline** | Build `process_svg` function using `scour` and `gpt-oss-20b` prompt. | Upload a complex SVG; assert the system extracts the correct Group IDs. |
| **4.3** | **Lottie Inspector** | Implement `verify_lottie.py` (Tier 1). | Run against a known "broken" JSON (0 duration) and ensure it returns False. |
| **4.4** | **Sandbox Runner** | Create the Docker/VM environment to execute the LLM's TypeScript. | Send a script `while(true)` and ensure the sandbox kills it after 500ms (Security test). |