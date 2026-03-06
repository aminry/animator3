# Validation Pipeline

This document outlines a comprehensive validation system to catch issues before expensive rendering, improving efficiency and quality.

## Current Problem

**Post-hoc validation only**:
- Issues discovered **after** rendering (expensive)
- Critic agent provides feedback too late
- Wasted compute on fundamentally flawed animations
- Slow iteration cycles

**Goal**: Shift validation left - catch issues during planning phase, before code execution.

## Validation Strategy

### Multi-Stage Validation

```
User Prompt
    ↓
Director Creates Vision
    ↓
ScenePlanner Creates ScenePlan
    ↓
[PRE-RENDER VALIDATORS] ← New validation layer
    ↓ Pass
Generate Code
    ↓
Execute & Render
    ↓
[Post-Render Quality Check] ← Lightweight validation
    ↓
Output Animation
```

### Validation Stages

1. **ScenePlan Validation** (before code generation)
   - Spatial validation
   - Complexity scoring
   - Completeness checking
   
2. **Code Static Analysis** (after code generation, before execution)
   - Type checking
   - API usage validation
   - Runtime error prediction

3. **Post-Render Quality Check** (lightweight, not Critic)
   - Basic quality metrics
   - Success/failure determination

## Pre-Render Validators

### 1. Spatial Validator

**Purpose**: Ensure all elements are positioned correctly and don't overlap

**Checks**:

#### On-Canvas Validation
```typescript
function validateOnCanvas(scenePlan: ScenePlan): ValidationResult {
  const issues: string[] = [];
  
  for (const obj of scenePlan.objects) {
    // Check if element is within canvas bounds
    if (obj.x < 0 || obj.y < 0) {
      issues.push(`${obj.id} positioned outside canvas (negative coordinates)`);
    }
    if (obj.x + obj.width > CANVAS_WIDTH) {
      issues.push(`${obj.id} extends beyond canvas width`);
    }
    if (obj.y + obj.height > CANVAS_HEIGHT) {
      issues.push(`${obj.id} extends beyond canvas height`);
    }
  }
  
  return { valid: issues.length === 0, issues };
}
```

#### Overlap Detection
```typescript
function validateNoOverlaps(scenePlan: ScenePlan): ValidationResult {
  const issues: string[] = [];
  
  for (let i = 0; i < scenePlan.objects.length; i++) {
    for (let j = i + 1; j < scenePlan.objects.length; j++) {
      const obj1 = scenePlan.objects[i];
      const obj2 = scenePlan.objects[j];
      
      // Check if bounding boxes overlap
      if (isOverlapping(obj1, obj2)) {
        // Allow overlaps if different layers
        if (obj1.layer === obj2.layer) {
          issues.push(`${obj1.id} and ${obj2.id} overlap on same layer`);
        }
      }
    }
  }
  
  return { valid: issues.length === 0, issues };
}

function isOverlapping(obj1: AnimationObject, obj2: AnimationObject): boolean {
  return !(
    obj1.x + obj1.width < obj2.x ||
    obj2.x + obj2.width < obj1.x ||
    obj1.y + obj1.height < obj2.y ||
    obj2.y + obj2.height < obj1.y
  );
}
```

#### Margin Validation
```typescript
function validateMargins(scenePlan: ScenePlan): ValidationResult {
  const MIN_MARGIN = CANVAS_WIDTH * 0.05; // 5% margin
  const issues: string[] = [];
  
  for (const obj of scenePlan.objects) {
    if (obj.x < MIN_MARGIN) {
      issues.push(`${obj.id} too close to left edge`);
    }
    if (obj.y < MIN_MARGIN) {
      issues.push(`${obj.id} too close to top edge`);
    }
    // Check right and bottom margins...
  }
  
  return { valid: issues.length === 0, issues };
}
```

### 2. Complexity Scorer

**Purpose**: Ensure animation is sufficiently rich and engaging

**Metrics**:

#### Element Count
```typescript
function scoreElementCount(scenePlan: ScenePlan): number {
  const count = scenePlan.objects.length;
  
  // Scoring curve
  if (count < 3) return 0;      // Too simple
  if (count >= 3 && count < 5) return 0.5;
  if (count >= 5 && count < 8) return 0.8;
  if (count >= 8) return 1.0;   // Good complexity
  
  return 0;
}
```

#### Motion Diversity
```typescript
function scoreMotionDiversity(scenePlan: ScenePlan): number {
  const animatedObjects = new Set<string>();
  const animatedProperties = new Set<string>();
  
  for (const kf of scenePlan.keyframes) {
    animatedObjects.add(kf.object);
    animatedProperties.add(kf.property);
  }
  
  // Count motion primitives and presets
  const primitiveCount = scenePlan.motionPaths?.length || 0;
  const presetCount = scenePlan.motionPresets?.length || 0;
  
  const diversityScore = 
    (animatedObjects.size / scenePlan.objects.length) * 0.4 +  // 40%: % of objects animated
    (animatedProperties.size / 5) * 0.3 +                      // 30%: property variety
    (Math.min(primitiveCount + presetCount, 5) / 5) * 0.3;     // 30%: advanced motion
  
  return Math.min(diversityScore, 1.0);
}
```

#### Timing Sophistication
```typescript
function scoreTimingSophistication(scenePlan: ScenePlan): number {
  // Check for staggered animations (not all start at time 0)
  const startTimes = scenePlan.keyframes
    .filter(kf => kf.time === 0)
    .map(kf => kf.object);
  
  const uniqueStartTimes = new Set(startTimes).size;
  const staggerScore = uniqueStartTimes > 1 ? 0.5 : 0;
  
  // Check for overlapping animations (multiple things happening simultaneously)
  const timeSlots = groupKeyframesByTime(scenePlan.keyframes);
  const overlappingSlots = timeSlots.filter(slot => slot.objects.length > 1).length;
  const overlapScore = Math.min(overlappingSlots / 3, 0.5);
  
  return staggerScore + overlapScore;
}
```

#### Visual Variety
```typescript
function scoreVisualVariety(scenePlan: ScenePlan): number {
  const shapes = new Set(scenePlan.objects.map(obj => obj.shape));
  const colors = new Set(scenePlan.objects.map(obj => obj.color));
  const sizes = scenePlan.objects.map(obj => obj.width * obj.height);
  
  const shapeVariety = Math.min(shapes.size / 4, 1.0);      // Ideally 4+ different shapes
  const colorVariety = Math.min(colors.size / 5, 1.0);      // Ideally 5+ colors
  const sizeVariety = calculateVariance(sizes) > 1000 ? 1.0 : 0.5; // Size diversity
  
  return (shapeVariety + colorVariety + sizeVariety) / 3;
}
```

#### Overall Complexity Score
```typescript
function calculateComplexityScore(scenePlan: ScenePlan): ComplexityScore {
  const scores = {
    elementCount: scoreElementCount(scenePlan),
    motionDiversity: scoreMotionDiversity(scenePlan),
    timingSophistication: scoreTimingSophistication(scenePlan),
    visualVariety: scoreVisualVariety(scenePlan)
  };
  
  const overall = Object.values(scores).reduce((a, b) => a + b) / 4;
  
  return {
    overall,
    breakdown: scores,
    passed: overall >= 0.6  // Minimum 60% complexity
  };
}
```

### 3. Completeness Checker

**Purpose**: Ensure all required data is present and valid

**Checks**:

```typescript
function validateCompleteness(scenePlan: ScenePlan): ValidationResult {
  const issues: string[] = [];
  
  // All objects have required fields
  for (const obj of scenePlan.objects) {
    if (!obj.id) issues.push('Object missing id');
    if (!obj.shape) issues.push(`${obj.id} missing shape`);
    if (obj.x === undefined || obj.y === undefined) {
      issues.push(`${obj.id} missing position`);
    }
    if (!obj.width || !obj.height) {
      issues.push(`${obj.id} missing dimensions`);
    }
    if (!obj.style) issues.push(`${obj.id} missing style`);
  }
  
  // All objects have keyframes (are animated)
  const animatedObjects = new Set(scenePlan.keyframes.map(kf => kf.object));
  for (const obj of scenePlan.objects) {
    if (!animatedObjects.has(obj.id)) {
      issues.push(`${obj.id} has no keyframes (static object)`);
    }
  }
  
  // Duration is set
  if (!scenePlan.duration || scenePlan.duration <= 0) {
    issues.push('Invalid or missing duration');
  }
  
  // All keyframes reference valid objects
  const validObjectIds = new Set(scenePlan.objects.map(obj => obj.id));
  for (const kf of scenePlan.keyframes) {
    if (!validObjectIds.has(kf.object)) {
      issues.push(`Keyframe references non-existent object: ${kf.object}`);
    }
  }
  
  return { valid: issues.length === 0, issues };
}
```

### 4. Code Static Analysis

**Purpose**: Validate generated code before execution

**Checks**:

```typescript
async function validateGeneratedCode(code: string): Promise<ValidationResult> {
  const issues: string[] = [];
  
  // TypeScript type checking
  try {
    const result = await typeCheckCode(code);
    if (!result.success) {
      issues.push(...result.errors);
    }
  } catch (err) {
    issues.push(`Type checking failed: ${err.message}`);
  }
  
  // API usage validation
  const apiIssues = validateAPIUsage(code);
  issues.push(...apiIssues);
  
  // Check for common errors
  if (code.includes('undefined')) {
    issues.push('Code contains undefined references');
  }
  
  return { valid: issues.length === 0, issues };
}

function validateAPIUsage(code: string): string[] {
  const issues: string[] = [];
  
  // Check for required SDK imports
  if (!code.includes('import') && !code.includes('require')) {
    issues.push('Missing SDK imports');
  }
  
  // Check for animation initialization
  if (!code.includes('new Animation')) {
    issues.push('Animation object not created');
  }
  
  // Check for layer creation
  if (!code.includes('createLayer')) {
    issues.push('No layers created');
  }
  
  return issues;
}
```

## Validation Flow

### Pipeline Integration

```typescript
async function generateAnimationWithValidation(
  userPrompt: string
): Promise<AnimationResult> {
  // 1. Director creates vision
  const vision = await director.createVision(userPrompt);
  
  // 2. ScenePlanner creates plan
  const scenePlan = await scenePlanner.createPlan(vision);
  
  // 3. PRE-RENDER VALIDATION
  const validation = await validateScenePlan(scenePlan);
  
  if (!validation.passed) {
    // Option A: Auto-refine
    const refinedPlan = await scenePlanner.refine(scenePlan, validation.issues);
    return generateAnimationWithValidation(userPrompt); // Retry
    
    // Option B: Return error
    // return { success: false, errors: validation.issues };
  }
  
  // 4. Generate code
  const code = await animator.generateCode(scenePlan);
  
  // 5. Code validation
  const codeValidation = await validateGeneratedCode(code);
  if (!codeValidation.valid) {
    return { success: false, errors: codeValidation.issues };
  }
  
  // 6. Execute and render
  const animation = await executeCode(code);
  
  // 7. Lightweight post-render check
  const qualityCheck = await quickQualityCheck(animation);
  
  return {
    success: qualityCheck.passed,
    animation,
    metrics: {
      complexity: validation.complexity,
      quality: qualityCheck.score
    }
  };
}

async function validateScenePlan(scenePlan: ScenePlan): Promise<ValidationSummary> {
  const results = {
    spatial: validateSpatial(scenePlan),
    complexity: calculateComplexityScore(scenePlan),
    completeness: validateCompleteness(scenePlan)
  };
  
  const issues = [
    ...results.spatial.issues,
    ...results.completeness.issues
  ];
  
  if (!results.complexity.passed) {
    issues.push('Animation complexity below minimum threshold');
  }
  
  return {
    passed: issues.length === 0 && results.complexity.passed,
    issues,
    complexity: results.complexity
  };
}
```

### Auto-Refinement Strategy

When validation fails, automatically refine:

```typescript
async function refineScenePlan(
  scenePlan: ScenePlan,
  issues: string[],
  visionModel: LLMClient
): Promise<ScenePlan> {
  const refinementPrompt = `
The following ScenePlan has validation issues:

${JSON.stringify(scenePlan, null, 2)}

Issues:
${issues.map(issue => `- ${issue}`).join('\n')}

Please revise the ScenePlan to fix these issues while maintaining the creative vision.
`;

  const response = await visionModel.chat([
    { role: 'system', content: SCENE_PLANNER_SYSTEM_PROMPT },
    { role: 'user', content: refinementPrompt }
  ]);
  
  return parseScenePlan(response);
}
```

## Quality Metrics

### Minimum Thresholds

Define minimum quality standards:

```typescript
const QUALITY_THRESHOLDS = {
  complexity: {
    overall: 0.6,           // 60% minimum complexity
    elementCount: 5,        // At least 5 elements
    animatedProperties: 3,  // At least 3 different properties animated
    motionDiversity: 0.5    // 50% motion diversity
  },
  spatial: {
    maxOverlaps: 0,         // No overlaps allowed (same layer)
    minMargin: 0.05,        // 5% minimum margin from edges
    onCanvasRate: 1.0       // 100% of elements on canvas
  },
  timing: {
    minDuration: 2.0,       // At least 2 seconds
    maxDuration: 10.0       // Max 10 seconds
  }
};
```

### Success Criteria

```typescript
function meetsQualityStandards(
  scenePlan: ScenePlan,
  validation: ValidationSummary
): boolean {
  return (
    validation.passed &&
    validation.complexity.overall >= QUALITY_THRESHOLDS.complexity.overall &&
    scenePlan.objects.length >= QUALITY_THRESHOLDS.complexity.elementCount &&
    scenePlan.duration >= QUALITY_THRESHOLDS.timing.minDuration &&
    scenePlan.duration <= QUALITY_THRESHOLDS.timing.maxDuration
  );
}
```

## Post-Render Quality Check

### Lightweight Validation

Replace heavy Critic agent with quick checks:

```typescript
async function quickQualityCheck(animation: RenderedAnimation): Promise<QualityCheck> {
  // Simple frame-based checks (no LLM needed)
  const checks = {
    // Check if animation renders without errors
    renderSuccess: animation.frames.length > 0,
    
    // Check frame consistency
    frameConsistency: checkFrameConsistency(animation.frames),
    
    // Check if visual content is present (not blank frames)
    hasVisualContent: animation.frames.every(frame => hasContent(frame)),
    
    // Optional: Vision model spot-check (1-2 frames only)
    visualQuality: await spotCheckVisualQuality(animation.frames[0], animation.frames[-1])
  };
  
  const passed = Object.values(checks).every(check => check === true);
  
  return { passed, checks };
}

function hasContent(frame: Frame): boolean {
  // Check if frame has non-background pixels
  const pixelData = frame.getImageData();
  const nonWhitePixels = countNonWhitePixels(pixelData);
  return nonWhitePixels > (frame.width * frame.height * 0.1); // At least 10% non-white
}
```

## Implementation Checklist

### Phase 1: Spatial Validation
- [ ] Implement on-canvas validator
- [ ] Implement overlap detector
- [ ] Implement margin validator
- [ ] Integrate with pipeline
- [ ] Test with edge cases

### Phase 2: Complexity Scoring
- [ ] Implement element count scorer
- [ ] Implement motion diversity scorer
- [ ] Implement timing sophistication scorer
- [ ] Implement visual variety scorer
- [ ] Define minimum thresholds
- [ ] Test scoring accuracy

### Phase 3: Completeness & Code Validation
- [ ] Implement completeness checker
- [ ] Implement code static analysis
- [ ] Add TypeScript type checking
- [ ] Test validation coverage

### Phase 4: Integration & Auto-Refinement
- [ ] Integrate all validators into pipeline
- [ ] Implement auto-refinement logic
- [ ] Add retry mechanisms with limits
- [ ] Test end-to-end validation flow

## Success Metrics

- **Pre-render catch rate**: 90%+ of issues caught before rendering
- **First-shot success**: 80%+ animations pass all validations on first attempt
- **Refinement success**: 95%+ of failed animations fixed by auto-refinement
- **Compute efficiency**: 50% reduction in wasted render time
- **Quality improvement**: Average complexity score 0.75+ (vs current 0.5)
