# Mode-Agnostic Architecture Redesign

This document outlines the transition from a hardcoded mode system to a fully prompt-driven, creative architecture.

## Current System Issues

### Problem: Rigid Mode Templates

The system currently forces prompts into 8 predefined modes:
- `banner`
- `game-demo`
- `product-demo`
- `explainer`
- `logo-reveal`
- `infographic`
- `character-animation`
- `abstract`

### Issues with Current Approach

1. **`promptClassifierAgent.ts`**
   - Forces every prompt into one of 8 categories
   - User's creative intent constrained by classification
   - Cannot handle hybrid or novel animation types

2. **`scenePlannerAgent.ts`**
   - 200+ lines of mode-specific rules
   - Canonical role assignments per mode (e.g., "product-demo must have product + background")
   - Prescriptive rather than creative

3. **`directorAgent.ts`**
   - Mode-specific guidance in system prompts
   - Limits creative vision to template boundaries

4. **Impact**
   - **Limited creativity**: Cannot generate animations outside predefined patterns
   - **Poor generalization**: Novel prompts forced into inappropriate modes
   - **User frustration**: System rejects or misinterprets creative requests
   - **Maintenance burden**: Adding new "modes" requires code changes

## New Approach: Prompt-Driven Creativity

### Core Principle

**Instead of**: Classify prompt → Apply template → Generate animation  
**New model**: Understand prompt → Create vision → Design freely → Generate animation

### Philosophy Shift

- **From templates to creativity**: Trust the LLM to be creative, not prescriptive
- **From rules to reasoning**: Use visual reasoning instead of hardcoded rules
- **From modes to prompts**: Every prompt is unique, handle it uniquely

## What to Remove

### 1. Delete PromptClassifierAgent

**File**: `backend/src/promptClassifierAgent.ts`

**Action**: Delete entirely

**Reason**: No longer need mode classification

### 2. Remove Mode Enums

**File**: `backend/src/types/scenePlan.ts`

**Remove**:
```typescript
export enum AnimationMode {
  BANNER = 'banner',
  GAME_DEMO = 'game-demo',
  PRODUCT_DEMO = 'product-demo',
  // ... etc
}
```

**Keep**: ScenePlan structure itself (objects, keyframes, paths)

### 3. Strip Mode-Specific Prompts

**File**: `backend/src/scenePlannerAgent.ts`

**Remove**:
- Conditional prompt sections based on mode
- Canonical role requirements per mode
- Mode-specific examples in system prompt

**Example of what to remove**:
```typescript
if (mode === 'product-demo') {
  prompt += `
  REQUIRED ROLES:
  - product: The main product being showcased
  - background: Simple backdrop
  - text: Product name and tagline
  `;
}
```

### 4. Remove Mode-Based Logic

**File**: `backend/src/orchestrator.ts`

**Remove**:
- Mode classification step
- Conditional branching based on mode
- Mode-specific validation

## What to Keep

### 1. ScenePlan Structure

**Keep the flexible schema**:
```typescript
interface ScenePlan {
  objects: AnimationObject[];
  keyframes: Keyframe[];
  paths: AnimationPath[];
  duration: number;
}
```

This is mode-agnostic - it can represent any animation type.

### 2. Storyboard Concept

**Keep**: The idea of planning before animating

**Change**: Make storyboards creative, not template-based
- Director creates open-ended vision
- ScenePlanner designs freely based on vision
- No forced structure

### 3. SDK and MotionScript

**Keep**: Universal animation primitives
- Layer creation
- Keyframe animation
- Easing functions
- Transform properties

These are not mode-specific - they're fundamental building blocks.

### 4. Quality Validation

**Keep**: Validation of animation quality

**Change**: Validate complexity and richness, not template adherence
- Check element count, motion diversity, visual variety
- Don't check "does it match mode X template"

## How to Make It Work

### 1. Director Creates Open-Ended Vision

**Before**:
```
Mode: product-demo
Vision: Show product rotating with text overlay
```

**After**:
```
Vision: Dynamic 3D product showcase with floating geometric elements, 
bold typography animating in sync with product rotation, vibrant 
gradient background pulsing subtly, modern and energetic feel
```

**System prompt change**:
```typescript
const DIRECTOR_SYSTEM_PROMPT = `
You are a creative director for animation. Given a user prompt, create 
a detailed creative vision that brings it to life.

DO NOT categorize or constrain your vision to predefined templates.
BE BOLD and CREATIVE. Think like a motion designer, not a template filler.

Consider:
- Visual style and mood
- Composition and layout
- Motion patterns and timing
- Color palette and atmosphere
- Unique creative flourishes

Output a rich, descriptive vision that inspires great animation.
`;
```

### 2. ScenePlanner Uses Visual Reasoning

**Before**: Apply mode-specific rules

**After**: Design freely using visual reasoning

**Key changes**:
- No canonical roles (create any objects needed)
- No forced composition rules (use visual judgment)
- Learn from reference examples (not templates)

**System prompt change**:
```typescript
const SCENE_PLANNER_SYSTEM_PROMPT = `
You are a scene planner for animation. Design the spatial layout and 
object composition for an animation based on the creative vision.

USE VISUAL REASONING: Consider composition, hierarchy, balance, and flow.
REFERENCE EXAMPLES: Learn from provided reference animations.
BE FLEXIBLE: Create as many or as few objects as needed.

Design choices should be driven by the creative vision, not templates.
`;
```

### 3. Reference Library Provides Inspiration

**Purpose**: Give agents visual examples without prescriptive rules

**How it works**:
1. User prompt → Find similar reference animations
2. Show reference frames to Director/ScenePlanner (via InternVL3_5)
3. Agents learn patterns from examples (composition, motion, style)
4. Agents create new animation *inspired by* (not copying) examples

**Key**: References are inspiration, not templates to fill

### 4. Quality Metrics Ensure Complexity

**Problem**: Without mode templates, how do we ensure quality?

**Solution**: Define quality metrics independent of modes

**Metrics**:
- **Element count**: 5+ animated objects (not 2-3 static ones)
- **Motion diversity**: Multiple properties animated (position, scale, rotation, opacity)
- **Timing sophistication**: Staggered animations, overlapping motion
- **Visual variety**: Multiple shapes, colors, sizes
- **Composition**: Proper layering (background, midground, foreground)

**Validation**: Pre-render checks ensure minimum quality thresholds

## Implementation Strategy

### Phase 1: Remove Classification

1. Delete `promptClassifierAgent.ts`
2. Remove mode parameter from orchestrator flow
3. Test that system still runs (may produce poor results initially)

### Phase 2: Update Prompts

1. Rewrite Director system prompt (remove mode mentions, add creativity)
2. Rewrite ScenePlanner system prompt (remove mode rules)
3. Add quality metrics to validation

### Phase 3: Integrate Vision + References

1. Add InternVL3_5 to Director and ScenePlanner
2. Provide reference animation previews in prompts
3. Let vision model learn patterns from examples

### Phase 4: Test and Refine

1. Test with diverse prompts outside old mode categories
2. Measure quality (visual appeal, complexity, prompt alignment)
3. Iterate on prompts and validation

## Success Criteria

- System handles arbitrary prompts without classification
- Animations are creative and unique (not template-based)
- Quality remains high or improves (measured by metrics)
- User prompts are interpreted flexibly and creatively

## Risk Mitigation

**Risk**: Without templates, quality might suffer

**Mitigation**:
- Quality metrics enforce minimum complexity
- Reference examples guide good patterns
- Vision model provides visual reasoning
- Validation pipeline catches issues early

**Risk**: Too much freedom leads to incoherent animations

**Mitigation**:
- Director provides coherent vision
- ScenePlanner validates layouts visually
- Pre-render validators check spatial issues
