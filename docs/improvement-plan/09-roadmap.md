# Implementation Roadmap

This document provides a detailed 8-week implementation plan for all improvements.

## Overview

**Timeline**: 8 weeks  
**Goal**: 80%+ first-shot success rate without Critic  
**Approach**: Phased implementation with testing at each stage

## Week-by-Week Breakdown

### Week 1-2: Vision Model Integration

**Objective**: Set up InternVL3_5 via Ollama and integrate with creative agents

#### Tasks

**Week 1**:
- [ ] Install Ollama on development machine
- [ ] Pull InternVL3_5 model (`ollama pull blaifa/InternVL3_5:4B`)
- [ ] Test Ollama server and API (basic chat, image inputs)
- [ ] Create `OllamaClient` class implementing `LLMClient` interface
- [ ] Add vision support (base64 image handling in messages)
- [ ] Write unit tests for OllamaClient

**Week 2**:
- [ ] Update environment variables (`.env` file)
- [ ] Modify Director agent to use OllamaClient
- [ ] Modify ScenePlanner agent to use OllamaClient
- [ ] Update Critic agent to use OllamaClient
- [ ] Test each agent with image inputs
- [ ] Document Ollama setup process

#### Deliverables

- [ ] Working OllamaClient with vision support
- [ ] Director, ScenePlanner, Critic using InternVL3_5
- [ ] Setup documentation

#### Success Metrics

- Ollama responds to requests with <5s latency (with GPU)
- Vision model processes images correctly
- Agents produce outputs with visual understanding

#### Testing

```bash
# Test Ollama installation
ollama run blaifa/InternVL3_5:4B

# Test OllamaClient
npm test -- ollamaClient.test.ts

# Test agents with vision
npm test -- directorAgent.test.ts
```

---

### Week 2-3: Remove Mode System

**Objective**: Eliminate hardcoded modes, make system prompt-driven

#### Tasks

**Week 2** (overlap with Week 1):
- [ ] Audit all files referencing `AnimationMode`
- [ ] Document what needs to be removed vs kept
- [ ] Create plan for prompt rewrites

**Week 3**:
- [ ] Delete `promptClassifierAgent.ts`
- [ ] Remove `AnimationMode` enum from `scenePlan.ts`
- [ ] Remove mode-specific logic from `scenePlannerAgent.ts`
- [ ] Remove mode references from `directorAgent.ts`
- [ ] Update orchestrator to skip classification step
- [ ] Rewrite Director system prompt (creative, not template-based)
- [ ] Rewrite ScenePlanner system prompt (no mode rules)
- [ ] Update tests to remove mode expectations

#### Deliverables

- [ ] Mode system completely removed
- [ ] Updated system prompts (creative, flexible)
- [ ] Tests passing without mode classification

#### Success Metrics

- System generates animations without mode classification
- Prompts outside old mode categories handled successfully
- No mode-related errors or references

#### Testing

```bash
# Test diverse prompts outside old modes
npm run test:e2e -- --prompts creative-prompts.txt

# Verify no mode-related code remains
grep -r "AnimationMode" backend/src/
```

---

### Week 3-5: Reference Library

**Objective**: Curate animations, build retrieval system

#### Tasks

**Week 3**:
- [ ] Set up reference library directory structure
- [ ] Research and identify animation sources
- [ ] Create metadata schema (JSON format)
- [ ] Build annotation tool/script for manual curation
- [ ] Begin manual curation (target: 20-30 animations this week)

**Week 4**:
- [ ] Continue manual curation (target: 50-70 total)
- [ ] Render preview frames for each animation
- [ ] Test Lottie JSON files in renderer
- [ ] Install CLIP model (`openai/clip-vit-base-patch32`)
- [ ] Write embedding generation script

**Week 5**:
- [ ] Generate embeddings for all curated animations
- [ ] Build retrieval system (cosine similarity search)
- [ ] Integrate retrieval into Director agent
- [ ] Integrate retrieval into ScenePlanner agent
- [ ] Test similarity search accuracy
- [ ] Document curation process

#### Deliverables

- [ ] 50-100 curated reference animations
- [ ] Metadata annotations for all animations
- [ ] Preview frames rendered
- [ ] Embedding and retrieval system working
- [ ] Agents using reference examples in prompts

#### Success Metrics

- 50+ high-quality reference animations curated
- Retrieval returns relevant examples (>0.6 similarity)
- Agents generate animations inspired by references
- Visual quality improvement observed

#### Testing

```bash
# Test retrieval
npm run test:retrieval -- --query "bouncing ball animation"

# Test reference integration
npm run test:e2e -- --with-references

# Measure quality improvement
npm run benchmark -- --with-vs-without-references
```

---

### Week 5-7: Spatial & Motion Improvements

**Objective**: Add layout solvers, motion primitives, and validation

#### Tasks

**Week 5**:
- [ ] Design grid system (12-column layout)
- [ ] Implement grid-to-pixels converter
- [ ] Update ScenePlan schema to support grid positions
- [ ] Update ScenePlanner prompt to use grid
- [ ] Test grid-based layouts

**Week 6**:
- [ ] Define motion primitive types (arc, orbit, bezier, spiral, follow)
- [ ] Implement motion primitive expansion functions
- [ ] Update ScenePlan schema to include `motionPaths`
- [ ] Define motion preset library (entrance, exit, attention, effects)
- [ ] Implement preset expansion to keyframes
- [ ] Update ScenePlan schema to include `motionPresets`
- [ ] Update ScenePlanner prompt with primitives and presets

**Week 7**:
- [ ] Implement SVG wireframe preview generator
- [ ] Add visual preview validation (vision model checks layout)
- [ ] Integrate preview into pipeline (after ScenePlan, before code)
- [ ] Implement physics validators (acceleration check)
- [ ] Add spring motion generator
- [ ] Test all spatial and motion features

#### Deliverables

- [ ] Grid-based layout system
- [ ] Motion primitive library (5+ types)
- [ ] Motion preset library (15+ presets)
- [ ] Visual preview generator
- [ ] Physics-based motion validation

#### Success Metrics

- 95%+ layouts have no overlaps or off-canvas elements
- 80%+ animations use motion primitives or presets
- Preview validation catches layout issues before rendering
- Motion feels more natural (human evaluator ratings)

#### Testing

```bash
# Test grid system
npm test -- gridSystem.test.ts

# Test motion primitives
npm test -- motionPrimitives.test.ts

# Test preview generation
npm test -- previewGenerator.test.ts

# E2E with all features
npm run test:e2e -- --spatial-motion
```

---

### Week 6-7: Validation Pipeline

**Objective**: Build comprehensive pre-render validation

#### Tasks

**Week 6** (overlap with Week 5):
- [ ] Implement spatial validator (overlaps, margins, bounds)
- [ ] Implement completeness checker (all required fields)
- [ ] Write unit tests for validators

**Week 7**:
- [ ] Implement complexity scorers (element count, motion diversity, timing, visual variety)
- [ ] Define quality thresholds
- [ ] Implement code static analysis validator
- [ ] Integrate all validators into pipeline
- [ ] Implement auto-refinement logic (vision model fixes issues)
- [ ] Add retry mechanism with limits (max 2 retries)
- [ ] Build validation reporting/logging

#### Deliverables

- [ ] Spatial validator
- [ ] Complexity scorer with multiple metrics
- [ ] Completeness checker
- [ ] Code static analysis
- [ ] Integrated validation pipeline
- [ ] Auto-refinement system

#### Success Metrics

- 90%+ of issues caught before rendering
- 80%+ first-shot pass rate (with auto-refinement)
- 95%+ of failures fixed by auto-refinement
- Validation time <2 seconds

#### Testing

```bash
# Test individual validators
npm test -- validators/

# Test validation pipeline
npm test -- validationPipeline.test.ts

# Measure catch rate
npm run benchmark -- --validation-catch-rate
```

---

### Week 7-8: Testing, Refinement & Critic Elimination

**Objective**: Comprehensive testing, remove Critic, measure success

#### Tasks

**Week 7**:
- [ ] Make Critic optional (feature flag: `ENABLE_CRITIC`)
- [ ] Create diverse test prompt set (100+ prompts)
- [ ] Run A/B test (with vs without Critic)
- [ ] Measure first-shot success rate without Critic
- [ ] Identify failure patterns
- [ ] Adjust validation thresholds based on results

**Week 8**:
- [ ] Fine-tune complexity scoring weights
- [ ] Optimize validation thresholds
- [ ] Improve vision model prompts based on learnings
- [ ] Expand reference library to 100+ animations
- [ ] Run final comprehensive tests
- [ ] If ≥80% success rate, remove Critic code
- [ ] Update documentation
- [ ] Create before/after comparison report

#### Deliverables

- [ ] Critic removed (or made optional)
- [ ] 80%+ first-shot success rate achieved
- [ ] Comprehensive test results
- [ ] Updated documentation
- [ ] Performance benchmarks

#### Success Metrics

- **First-shot quality**: 80%+ acceptance without Critic
- **Complex animations**: 8+ elements, rich motion
- **Visually coherent**: Proper hierarchy, composition
- **Prompt-aligned**: Matches user intent creatively
- **Performance**: <15 seconds generation time
- **Cost**: 70% reduction vs Critic-based system

#### Testing

```bash
# Run full benchmark suite
npm run benchmark:full

# A/B test with/without Critic
npm run test:ab -- --iterations 100

# Measure performance
npm run test:performance

# Generate comparison report
npm run report:before-after
```

---

## Parallel Work Streams

Some tasks can be done in parallel to optimize timeline:

### Stream 1: Infrastructure (Weeks 1-2)
- Vision model integration
- OllamaClient development

### Stream 2: Architecture (Weeks 2-3)
- Remove mode system
- Update prompts

### Stream 3: Content (Weeks 3-5)
- Reference library curation
- Embedding system

### Stream 4: Features (Weeks 5-7)
- Spatial improvements
- Motion improvements
- Validation pipeline

### Stream 5: Quality (Weeks 7-8)
- Testing and refinement
- Critic elimination

## Risk Management

### Risk 1: Ollama Performance Issues

**Impact**: Slow inference, poor UX  
**Probability**: Medium  
**Mitigation**:
- Test on GPU-enabled machine
- Implement caching for reference embeddings
- Add fallback to Groq API if Ollama unavailable
- Optimize batch processing

### Risk 2: First-Shot Success Rate Below 80%

**Impact**: Cannot remove Critic  
**Probability**: Medium  
**Mitigation**:
- Implement lightweight quality check instead of full Critic
- Use Critic selectively (complex prompts only)
- Extend timeline for additional tuning
- Gather more reference examples

### Risk 3: Reference Library Curation Takes Longer

**Impact**: Delayed Week 3-5 deliverables  
**Probability**: High  
**Mitigation**:
- Start curation in Week 1 (parallel work)
- Lower initial target (30 animations minimum)
- Use automated filtering to accelerate
- Prioritize quality over quantity initially

### Risk 4: Vision Model Hallucination/Errors

**Impact**: Poor layout validation, bad refinements  
**Probability**: Low-Medium  
**Mitigation**:
- Combine vision validation with automated checks
- Don't rely solely on vision model
- Add confidence thresholds
- Implement validation override mechanisms

## Resource Requirements

### Hardware

- **Development machine**: 
  - NVIDIA GPU with 12GB+ VRAM (recommended)
  - 32GB RAM
  - 100GB free disk space (model weights, reference library)

### Software

- Ollama
- Node.js 18+
- Python 3.9+ (for CLIP embeddings)
- TypeScript 5.0+

### External Dependencies

- Ollama InternVL3_5 model
- CLIP model (Hugging Face)
- Optional: LottieFiles API access (for automated curation)

### Time Commitment

- **Weeks 1-4**: 1 developer full-time
- **Weeks 5-8**: 1-2 developers full-time
- **Testing**: QA support in Weeks 7-8

## Success Criteria by Phase

### Phase 1 Success (Week 2)
- Vision model working with all agents
- Agents process image inputs correctly

### Phase 2 Success (Week 3)
- Mode system fully removed
- System handles diverse prompts creatively

### Phase 3 Success (Week 5)
- 50+ reference animations curated
- Retrieval system returns relevant examples
- Agents use references in generation

### Phase 4 Success (Week 7)
- Grid layouts work without overlaps
- Motion primitives and presets functional
- Visual preview catches layout issues
- Validation pipeline integrated

### Phase 5 Success (Week 8)
- **80%+ first-shot success rate**
- **Critic removed or optional**
- **<15 second generation time**
- **Quality maintained or improved**

## Post-Implementation Plan

### Week 9+: Monitoring & Iteration

- Monitor success rates in production
- Collect user feedback
- Expand reference library to 500+ animations
- Fine-tune validation thresholds
- Add new motion primitives/presets based on usage
- Optimize performance (caching, batching)

### Continuous Improvement

- A/B test new features before full rollout
- Regular audits of generated animations
- Update golden test suite quarterly
- Retrain/update embeddings when adding references
- Document learnings and best practices

## Expected Outcomes

### Quantitative Improvements

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| First-shot success rate | 20-30% | 80%+ | +167% |
| Generation time | 2-5 min | <15 sec | -88% |
| Cost per animation | $1-5 | $0.30-0.50 | -70-90% |
| Elements per animation | 3-5 | 8+ | +60% |
| Motion diversity score | 0.3 | 0.75+ | +150% |

### Qualitative Improvements

- **Creativity**: Handle arbitrary prompts, not just templates
- **Visual quality**: Professional composition and motion
- **Flexibility**: Adapt to any animation request
- **Consistency**: Predictable high quality
- **User experience**: Fast, reliable, impressive results

## Conclusion

This 8-week roadmap provides a structured path to:
1. Integrate vision models for visual understanding
2. Remove rigid mode system for creativity
3. Build reference library for learning
4. Improve spatial reasoning and motion
5. Add comprehensive validation
6. Eliminate the Critic for efficiency

**Final goal**: A creative, efficient, high-quality animation system that generates 80%+ acceptable animations on the first try, in under 15 seconds, at a fraction of the current cost.
