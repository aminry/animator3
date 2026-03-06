# Motion Complexity Enhancements

This document outlines strategies for creating more sophisticated and visually rich motion in animations.

## Problem Statement

Current limitations:
- **Keyframe-only representation**: LLM must specify exact frames for complex motion
- **Linear motion dominant**: Difficulty creating curves, arcs, organic movement
- **Pattern repetition**: Common motion patterns require manual specification each time
- **Physics disconnect**: Motion often feels unnatural or mechanical

**Result**: Simplistic, linear animations that lack the polish and sophistication of professional motion graphics.

## Solution 1: Motion Path Primitives

### Concept

Replace low-level keyframe specification with **high-level motion descriptors**. LLM specifies the *type* of motion, runtime computes the frames.

### Primitive Types

#### 1. Arc Motion
**Description**: Element moves along a curved arc path

**Parameters**:
- `startX`, `startY`: Starting position
- `endX`, `endY`: Ending position
- `arcHeight`: How high/low the arc peaks (positive = upward arc)
- `duration`: Motion duration in seconds

**Example**:
```typescript
{
  type: 'arc',
  object: 'ball',
  startX: 100,
  startY: 400,
  endX: 900,
  endY: 400,
  arcHeight: -200,  // Peaks 200px above
  duration: 2.0
}
```

**Implementation**: Generate parabolic curve, sample keyframes

#### 2. Orbit Motion
**Description**: Element rotates around a center point

**Parameters**:
- `centerX`, `centerY`: Orbit center
- `radius`: Distance from center
- `startAngle`, `endAngle`: Rotation range (degrees)
- `duration`: Motion duration
- `clockwise`: Direction of rotation

**Example**:
```typescript
{
  type: 'orbit',
  object: 'planet',
  centerX: 512,
  centerY: 384,
  radius: 200,
  startAngle: 0,
  endAngle: 360,
  duration: 5.0,
  clockwise: true
}
```

**Implementation**: Calculate circular path, sample keyframes

#### 3. Bezier Path
**Description**: Element follows a custom Bezier curve

**Parameters**:
- `startX`, `startY`: Starting position
- `control1X`, `control1Y`: First control point
- `control2X`, `control2Y`: Second control point
- `endX`, `endY`: Ending position
- `duration`: Motion duration

**Example**:
```typescript
{
  type: 'bezier',
  object: 'particle',
  startX: 0,
  startY: 400,
  control1X: 200,
  control1Y: 100,
  control2X: 600,
  control2Y: 700,
  endX: 1024,
  endY: 400,
  duration: 3.0
}
```

**Implementation**: Cubic Bezier interpolation, sample keyframes

#### 4. Follow Path
**Description**: Element follows another element's position with optional offset

**Parameters**:
- `targetObject`: Object to follow
- `offsetX`, `offsetY`: Position offset from target
- `lag`: Time delay (creates trailing effect)

**Example**:
```typescript
{
  type: 'follow',
  object: 'shadow',
  targetObject: 'character',
  offsetX: 10,
  offsetY: 10,
  lag: 0.1  // Slight delay for organic feel
}
```

#### 5. Spiral Motion
**Description**: Element moves in an expanding or contracting spiral

**Parameters**:
- `centerX`, `centerY`: Spiral center
- `startRadius`, `endRadius`: Radius range
- `rotations`: Number of full rotations
- `duration`: Motion duration

**Example**:
```typescript
{
  type: 'spiral',
  object: 'vortex',
  centerX: 512,
  centerY: 384,
  startRadius: 300,
  endRadius: 50,
  rotations: 3,
  duration: 4.0
}
```

### Implementation

**File**: `backend/src/motionPrimitives.ts`

```typescript
export interface MotionPrimitive {
  type: 'arc' | 'orbit' | 'bezier' | 'follow' | 'spiral';
  object: string;
  duration: number;
  // Type-specific parameters
}

export function expandMotionPrimitive(primitive: MotionPrimitive, fps: number): Keyframe[] {
  switch (primitive.type) {
    case 'arc':
      return generateArcKeyframes(primitive, fps);
    case 'orbit':
      return generateOrbitKeyframes(primitive, fps);
    case 'bezier':
      return generateBezierKeyframes(primitive, fps);
    // ... etc
  }
}

function generateArcKeyframes(arc: ArcMotion, fps: number): Keyframe[] {
  const frameCount = Math.ceil(arc.duration * fps);
  const keyframes: Keyframe[] = [];
  
  for (let i = 0; i <= frameCount; i++) {
    const t = i / frameCount;
    
    // Parabolic arc equation
    const x = arc.startX + (arc.endX - arc.startX) * t;
    const y = arc.startY + (arc.endY - arc.startY) * t + 
              arc.arcHeight * Math.sin(t * Math.PI);
    
    keyframes.push({
      object: arc.object,
      property: 'position',
      time: i / fps,
      value: [x, y]
    });
  }
  
  return keyframes;
}
```

### Benefits

- **Simpler for LLM**: Describe motion intent, not calculate frames
- **More sophisticated**: Easy to create complex paths
- **Reusable**: Common patterns standardized
- **Efficient**: Generate many keyframes from few parameters

## Solution 2: Motion Presets Library

### Concept

Predefined motion patterns that can be applied to any object, similar to CSS animation presets.

### Preset Categories

#### Entrance Animations
- `fadeIn`: Fade from transparent to opaque
- `slideInLeft`, `slideInRight`, `slideInTop`, `slideInBottom`: Slide from edge
- `zoomIn`: Scale from small to normal
- `bounceIn`: Bounce entrance effect
- `rotateIn`: Rotate while fading in

#### Exit Animations
- `fadeOut`: Fade to transparent
- `slideOutLeft`, `slideOutRight`, etc.: Slide out of canvas
- `zoomOut`: Scale to small
- `bounceOut`: Bounce exit effect

#### Attention Seekers
- `pulse`: Scale up and down repeatedly
- `shake`: Horizontal shake motion
- `swing`: Pendulum swing motion
- `wobble`: Wobble rotation
- `heartbeat`: Double pulse

#### Motion Effects
- `float`: Gentle up/down floating
- `drift`: Slow horizontal drift
- `wave`: Sine wave motion
- `typewriter`: Sequential character reveal (for text)

### Preset Definition

```typescript
interface MotionPreset {
  name: string;
  category: 'entrance' | 'exit' | 'attention' | 'effect';
  properties: AnimatedProperty[];
  duration: number;
  easing: EasingFunction;
}

const presets: MotionPreset[] = [
  {
    name: 'bounceIn',
    category: 'entrance',
    properties: [
      {
        property: 'scale',
        keyframes: [
          { time: 0, value: 0, easing: 'easeOutCubic' },
          { time: 0.5, value: 1.1, easing: 'easeOutCubic' },
          { time: 0.7, value: 0.9, easing: 'easeOutCubic' },
          { time: 1.0, value: 1.0, easing: 'easeOutCubic' }
        ]
      },
      {
        property: 'opacity',
        keyframes: [
          { time: 0, value: 0 },
          { time: 0.2, value: 1 }
        ]
      }
    ],
    duration: 0.8
  },
  // ... more presets
];
```

### Usage in ScenePlan

**Instead of manual keyframes**:
```typescript
{
  objects: [
    { id: 'logo', x: 512, y: 384, width: 200, height: 200 }
  ],
  keyframes: [
    { object: 'logo', property: 'scale', time: 0, value: 0 },
    { object: 'logo', property: 'scale', time: 0.5, value: 1.1 },
    { object: 'logo', property: 'scale', time: 0.7, value: 0.9 },
    { object: 'logo', property: 'scale', time: 1.0, value: 1.0 },
    // ... many more keyframes
  ]
}
```

**Use presets**:
```typescript
{
  objects: [
    { id: 'logo', x: 512, y: 384, width: 200, height: 200 }
  ],
  motionPresets: [
    { object: 'logo', preset: 'bounceIn', startTime: 0 }
  ]
}
```

### Preset Expansion

**At code generation time**, expand presets to keyframes:

```typescript
function expandPresets(scenePlan: ScenePlan): ScenePlan {
  const expandedKeyframes = [...scenePlan.keyframes];
  
  for (const motionPreset of scenePlan.motionPresets) {
    const preset = presets.find(p => p.name === motionPreset.preset);
    const keyframes = generateKeyframesFromPreset(
      preset, 
      motionPreset.object, 
      motionPreset.startTime
    );
    expandedKeyframes.push(...keyframes);
  }
  
  return { ...scenePlan, keyframes: expandedKeyframes };
}
```

### Benefits

- **Consistent quality**: Proven motion patterns
- **Simple specification**: One line instead of many keyframes
- **Professional feel**: Industry-standard animations
- **Extensible**: Add new presets easily

## Solution 3: Physics-Based Modeling

### Concept

Validate and enhance motion with physics principles to ensure natural feel.

### Physics Validators

#### 1. Acceleration Check
**Rule**: Motion should have smooth acceleration/deceleration, not instant speed changes

**Validation**:
```typescript
function validateAcceleration(keyframes: Keyframe[]): ValidationResult {
  for (let i = 1; i < keyframes.length - 1; i++) {
    const prevVelocity = calculateVelocity(keyframes[i - 1], keyframes[i]);
    const nextVelocity = calculateVelocity(keyframes[i], keyframes[i + 1]);
    const acceleration = (nextVelocity - prevVelocity) / deltaTime;
    
    if (Math.abs(acceleration) > MAX_ACCELERATION) {
      return { valid: false, issue: 'Unnatural acceleration spike' };
    }
  }
  return { valid: true };
}
```

#### 2. Easing Validation
**Rule**: Use appropriate easing for motion type

**Recommendations**:
- **Entrance**: `easeOut` (fast start, slow end)
- **Exit**: `easeIn` (slow start, fast end)
- **Attention**: `easeInOut` or elastic easing
- **Continuous**: `linear` for mechanical motion

#### 3. Follow-Through and Overshoot
**Rule**: Natural motion overshoots target then settles

**Auto-enhancement**:
```typescript
function addFollowThrough(keyframes: Keyframe[]): Keyframe[] {
  const lastFrame = keyframes[keyframes.length - 1];
  const secondLastFrame = keyframes[keyframes.length - 2];
  
  // Add slight overshoot
  const overshootFrame = {
    ...lastFrame,
    time: lastFrame.time - 0.1,
    value: lastFrame.value + (lastFrame.value - secondLastFrame.value) * 0.1
  };
  
  keyframes.splice(keyframes.length - 1, 0, overshootFrame);
  return keyframes;
}
```

### Spring Physics

**For organic motion**, use spring dynamics:

```typescript
interface SpringConfig {
  stiffness: number;  // How "tight" the spring is
  damping: number;    // How quickly it settles
  mass: number;       // Object mass (affects motion speed)
}

function generateSpringMotion(
  start: number,
  end: number,
  config: SpringConfig,
  duration: number,
  fps: number
): number[] {
  const frames: number[] = [];
  let position = start;
  let velocity = 0;
  const dt = 1 / fps;
  
  for (let t = 0; t < duration; t += dt) {
    const force = -config.stiffness * (position - end);
    const damping = -config.damping * velocity;
    const acceleration = (force + damping) / config.mass;
    
    velocity += acceleration * dt;
    position += velocity * dt;
    
    frames.push(position);
  }
  
  return frames;
}
```

**Preset spring configurations**:
```typescript
const springPresets = {
  gentle: { stiffness: 100, damping: 10, mass: 1 },
  bouncy: { stiffness: 300, damping: 8, mass: 1 },
  snappy: { stiffness: 500, damping: 25, mass: 1 },
  wobbly: { stiffness: 180, damping: 5, mass: 1 }
};
```

### Benefits

- **Natural feel**: Motion looks more organic and believable
- **Automatic enhancement**: System can improve basic keyframes
- **Validation**: Catch unnatural motion before rendering
- **Professional quality**: Matches industry-standard animation principles

## Integration with System

### ScenePlanner Prompt Update

```typescript
const MOTION_GUIDANCE = `
When planning motion, you have access to:

MOTION PRIMITIVES:
- arc: Curved path motion
- orbit: Circular rotation around point
- bezier: Custom curve path
- spiral: Expanding/contracting spiral
- follow: Track another object

MOTION PRESETS (apply to any object):
- Entrance: fadeIn, slideIn[Direction], zoomIn, bounceIn
- Exit: fadeOut, slideOut[Direction], zoomOut, bounceOut
- Attention: pulse, shake, swing, wobble
- Effects: float, drift, wave

PHYSICS PRESETS (for spring motion):
- gentle, bouncy, snappy, wobbly

Use these to create sophisticated motion easily. Combine multiple 
presets/primitives for rich animations.
`;
```

### Animator Expansion

**Before code generation**, expand high-level motion to keyframes:

```typescript
async function generateAnimationCode(scenePlan: ScenePlan): Promise<string> {
  // 1. Expand motion primitives to keyframes
  const expandedPrimitives = expandMotionPrimitives(scenePlan.motionPaths);
  
  // 2. Expand motion presets to keyframes
  const expandedPresets = expandMotionPresets(scenePlan.motionPresets);
  
  // 3. Apply physics enhancements
  const enhancedKeyframes = applyPhysicsEnhancements(
    [...scenePlan.keyframes, ...expandedPrimitives, ...expandedPresets]
  );
  
  // 4. Generate MotionScript code
  const code = await animator.generateCode({
    ...scenePlan,
    keyframes: enhancedKeyframes
  });
  
  return code;
}
```

## Implementation Checklist

### Phase 1: Motion Primitives
- [ ] Define primitive types and interfaces
- [ ] Implement expansion functions (arc, orbit, bezier, spiral, follow)
- [ ] Update ScenePlan schema to include `motionPaths`
- [ ] Update ScenePlanner prompt with primitive usage
- [ ] Test primitive generation

### Phase 2: Motion Presets
- [ ] Define preset library (entrance, exit, attention, effects)
- [ ] Implement preset expansion to keyframes
- [ ] Update ScenePlan schema to include `motionPresets`
- [ ] Update ScenePlanner prompt with preset catalog
- [ ] Test preset application

### Phase 3: Physics Modeling
- [ ] Implement physics validators (acceleration, easing)
- [ ] Create spring motion generator
- [ ] Add physics enhancement to pipeline
- [ ] Test motion naturalness

## Success Metrics

- **Motion complexity**: 80% of animations use 2+ motion types (primitives, presets, or manual)
- **Physics quality**: 95% of animations pass acceleration validation
- **Sophistication**: Human evaluators rate motion 7+/10 (vs current 5/10)
- **Variety**: Animations use average of 3+ different motion patterns
