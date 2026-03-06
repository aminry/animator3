# Core Issues Analysis

This document identifies the six fundamental issues limiting the current Animator system's capabilities.

## Issue 1: Visual Understanding Gap

**Problem**: Text-only LLMs (GPT OSS 120B) cannot visualize compositions, spatial layouts, or motion

**Root Cause**: Director, ScenePlanner, Animator use text models without visual grounding

**Impact**:
- Simplistic animations lacking visual sophistication
- Poor spatial reasoning and layout decisions
- No ability to pre-visualize results
- Cannot learn from visual examples

**Solution**: Replace with vision-language models (InternVL3_5) for all creative agents

---

## Issue 2: Hardcoded Mode System

**Problem**: System uses rigid mode templates (banner, game-demo, product-demo, etc.) with prescriptive rules

**Root Cause**: 
- `promptClassifierAgent.ts` forces prompts into 8 predefined modes
- `scenePlannerAgent.ts` has 200+ lines of mode-specific rules and canonical roles
- `directorAgent.ts` includes mode-specific guidance

**Impact**:
- Limited creativity - cannot handle prompts outside predefined categories
- Template-driven rather than creative
- System lacks flexibility for novel animation requests
- User prompts constrained by mode limitations

**Solution**: Remove mode system entirely, make agents prompt-driven and creative

---

## Issue 3: Lack of Visual Reference Examples

**Problem**: No reference library of high-quality animations to guide generation

**Root Cause**: System generates from scratch without pattern learning or visual inspiration

**Impact**:
- Inconsistent quality across generations
- Reinventing animation patterns each time
- No learning from proven successful examples
- Limited visual vocabulary

**Solution**: Curate reference library with visual similarity search for few-shot learning

---

## Issue 4: Spatial Reasoning Limitations

**Problem**: LLMs struggle with precise positioning, overlaps, and visual hierarchy

**Root Cause**: Text-based coordinate specification without visual validation

**Impact**:
- Poor layouts with overlapping elements
- Weak composition and visual hierarchy
- Elements positioned off-canvas or inappropriately
- Difficulty achieving professional polish

**Solution**: 
- Layout constraint solver for automatic positioning
- Visual preview generation before code execution
- Constraint-based positioning instead of exact coordinates

---

## Issue 5: Motion Complexity

**Problem**: Keyframe-only representation limits complex motion patterns

**Root Cause**: No high-level motion primitives (arcs, orbits, curves, physics)

**Impact**:
- Linear, simplistic animations
- Limited motion vocabulary
- Difficulty achieving sophisticated movement
- Manual specification of complex paths is error-prone

**Solution**: 
- Motion path primitives (arc, orbit, bezier, spiral)
- Physics-based motion modeling
- Motion preset library

---

## Issue 6: Post-Hoc Validation Only

**Problem**: Issues caught after expensive rendering step

**Root Cause**: No pre-render validation pipeline - reliance on Critic agent post-render

**Impact**:
- Wasted compute on flawed animations
- Slow iteration cycles
- Late discovery of fundamental issues
- Resource inefficiency

**Solution**: 
- Multi-stage validation before code execution
- Predictive quality scoring
- Early issue detection in planning phase
- Shift validation left in the pipeline

---

## Priority Order

1. **Vision Model Integration** (Issue 1) - Foundation for other improvements
2. **Remove Mode System** (Issue 2) - Unlock creativity immediately
3. **Reference Library** (Issue 3) - Provide learning examples
4. **Spatial Reasoning** (Issue 4) - Improve layout quality
5. **Motion Complexity** (Issue 5) - Enhance animation sophistication
6. **Validation Pipeline** (Issue 6) - Improve efficiency and quality
