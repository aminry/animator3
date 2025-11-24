# MotionGen V3 - Lottie JSON Builder SDK

## Task 1.1: Build the Lottie JSON Builder ✅

A type-safe TypeScript abstraction layer for creating Lottie animations without DOM dependencies. Runs in pure Node.js environment.

## Task 1.2: Implement Physics & Easing Engine ✅

Spring-physics-based motion and standardized easing utilities built on top of the core Lottie builder:

- Spring solver that converts configs like `stiffness`, `damping`, `mass`, and `initialVelocity` into time/value keyframes via `generateKeyframes(start, end, physicsConfig, fps)`.
- Cubic Bezier easing helpers (`linear`, `easeIn`, `easeOut`, `easeInOut`, and custom `[x1, y1, x2, y2]` definitions) mapped to Lottie `i`/`o` tangents.
- Integration with the `Property` class through `animateToWithEasing`, so high-level code can apply named or custom curves.
- Visual tests to validate behavior: a spring-driven circle (overshoot and settle) and a comparative easing demo.

## Features Implemented

### Core Classes
- ✅ **Animation**: Main animation container with frame rate, duration, and canvas size control
- ✅ **Layer Types**:
  - `ShapeLayer`: Vector shapes and graphics
  - `SolidLayer`: Solid color backgrounds
  - `TextLayer`: Text content with styling
  - `ImageLayer`: Raster image support
  - `NullLayer`: Organizational/parenting layer
- ✅ **Property**: Animatable properties with keyframe support
- ✅ **ShapeBuilder**: Helper class for creating shapes

### Shape Support
- ✅ Rectangle (with rounded corners)
- ✅ Circle
- ✅ Ellipse
- ✅ Star
- ✅ Polygon
- ✅ Fill (solid and animated colors)
- ✅ Stroke (with line cap and join options)

### Animation Properties
- ✅ Position (2D)
- ✅ Scale (2D)
- ✅ Rotation
- ✅ Opacity
- ✅ Anchor Point
- ✅ Color (for fills)

### Advanced Features
- ✅ Multiple layers with timing control
- ✅ Layer parenting (parent-child relationships)
- ✅ Shape groups and transforms
- ✅ Animated shape transforms
- ✅ Blend modes
- ✅ Markers
- ✅ Assets support

## Installation

```bash
npm install
```

## Build

```bash
npm run build
```

## Run Visual Tests

```bash
npm run test:build
```

This will generate 22 Lottie JSON files in the `output/` directory.

## Visual Verification

Start the local server and view the animations:

```bash
npm run serve
```

Then open `http://localhost:8080/viewer.html` in your browser. The viewer provides:

- **22 comprehensive test cases** covering all features
- Play/Pause/Stop controls for each animation
- Global controls to manage all animations at once
- Visual feedback on load status

### Test Cases

1. **Simple Red Rectangle** - Basic shape creation
2. **Animated Circle** - Position animation
3. **Scale Animation** - Scale property animation
4. **Rotation Animation** - Rotation property animation
5. **Opacity Animation** - Fade in/out effects
6. **Multiple Shapes** - Multiple shapes in one layer
7. **Ellipse Shape** - Non-circular ellipse
8. **Rounded Rectangle** - Rounded corners
9. **Stroke Shape** - Stroke instead of fill
10. **Fill and Stroke** - Both fill and stroke
11. **Star Shape** - Five-pointed star
12. **Polygon Shape** - Hexagon
13. **Text Layer** - Text with styling
14. **Solid Background** - Solid color layer
15. **Complex Animation** - Multiple simultaneous animations
16. **Shape Transform Animation** - Animated transforms in groups
17. **Multiple Layers** - Layers with different timing
18. **Animated Fill Color** - Color transitions
19. **Parent-Child Relationship** - Layer parenting
20. **Comprehensive Test** - All features combined
21. **Spring Physics Circle** - Spring-based motion from X=0 to X=100 with overshoot and settle
22. **Easing Curves** - Linear, ease-in, ease-out, ease-in-out, and custom cubic Bezier motion

## API Usage

```typescript
import { Animation, ShapeLayer, ShapeBuilder } from '@motiongen/sdk';

// Create animation
const anim = Animation.create(512, 512, 3, 30); // width, height, duration, fps

// Create a shape layer
const layer = new ShapeLayer(0, 'My Shape', 0, anim.timeToFrame(3));
layer.setPosition(256, 256);
layer.animatePosition(anim.timeToFrame(3), 400, 400, 0);

// Add shapes
const circle = ShapeBuilder.circle('Circle', 100);
const fill = ShapeBuilder.fill('Fill', [1, 0, 0]); // Red
const transform = ShapeBuilder.transform();

layer.addShapes([circle, fill, transform]);
anim.addLayer(layer);

// Export to JSON
const lottieJSON = anim.toJSON();
console.log(JSON.stringify(lottieJSON, null, 2));
```

## Architecture

```
src/
├── types.ts          # Lottie JSON type definitions
├── Property.ts       # Animatable property class
├── Layer.ts          # Layer base class and implementations
├── shapes.ts         # Shape builder utilities
├── physics.ts        # Spring physics engine (Task 1.2)
├── easing.ts         # Cubic Bezier easing utilities (Task 1.2)
├── Animation.ts      # Main animation class
├── index.ts          # Public API exports
└── tests/
    └── visual-tests.ts  # Comprehensive test suite
```

## Verification Against Requirements

### ✅ Technical Requirements Met

1. **Type-safe TypeScript classes** - All classes use strict typing
2. **Maps to Lottie Schema** - Follows bodymovin schema structure
3. **`.toJSON()` method** - Exports strictly valid Lottie JSON
4. **No DOM dependencies** - Pure Node.js, no window/document usage
5. **Unit tests** - 22 visual tests covering all features

### ✅ Core Classes Implemented

- `Animation` - Root animation container
- `Layer` - Base layer class with 5 implementations
- `Property` - Animatable properties with keyframes
- Shape support - All common shapes (rect, circle, ellipse, star, polygon)

### ✅ Critical Features

- Static and animated properties
- Multiple layers with timing
- Transform properties (position, scale, rotation, opacity)
- Shape fills and strokes
- Text layers
- Solid backgrounds
- Layer parenting

## Next Steps

This completes **Task 1.1: Build the Lottie JSON Builder** and **Task 1.2: Implement Physics & Easing Engine**. The next task is:

- **Task 1.3**: The "MotionScript" High-Level API

## License

MIT
