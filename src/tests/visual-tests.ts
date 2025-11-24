/**
 * Visual Test Suite for Lottie JSON Builder
 * 
 * This file generates various Lottie JSON files that can be visually verified
 * to ensure all functionalities are implemented correctly.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Animation } from '../Animation';
import { ShapeLayer, SolidLayer, TextLayer, NullLayer } from '../Layer';
import { ShapeBuilder } from '../shapes';

// Create output and golden directories
const OUTPUT_DIR = path.join(process.cwd(), 'output');
const GOLDEN_DIR = path.join(process.cwd(), 'golden_tests');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

if (!fs.existsSync(GOLDEN_DIR)) {
  fs.mkdirSync(GOLDEN_DIR, { recursive: true });
}

const UPDATE_GOLDEN = process.env.UPDATE_GOLDEN === '1';

/**
 * Helper function to save animation to file
 */
function saveAnimation(animation: Animation, filename: string): void {
  const outputPath = path.join(OUTPUT_DIR, filename);
  const goldenPath = path.join(GOLDEN_DIR, filename);
  const json = animation.toString(true);

  // Always write the latest JSON to the output directory for visual inspection
  fs.writeFileSync(outputPath, json);

  if (!fs.existsSync(goldenPath)) {
    if (UPDATE_GOLDEN) {
      fs.writeFileSync(goldenPath, json);
      console.log(`⚠ Created new golden: ${filename}`);
    } else {
      console.error(
        `Missing golden file for ${filename} in ${GOLDEN_DIR}. Run with UPDATE_GOLDEN=1 to create or update goldens.`
      );
      throw new Error(`Golden file missing: ${filename}`);
    }
    return;
  }

  const golden = fs.readFileSync(goldenPath, 'utf8');

  if (golden !== json) {
    if (UPDATE_GOLDEN) {
      fs.writeFileSync(goldenPath, json);
      console.warn(`⚠ Updated golden file: ${filename}`);
    } else {
      console.error(
        `Generated JSON in output directory does not match golden file for ${filename}.`
      );
      throw new Error(`Golden mismatch: ${filename}`);
    }
    return;
  }

  console.log(`✓ Matched golden: ${filename}`);
}

/**
 * Test 1: Simple Red Rectangle (Static)
 * Verifies: Basic shape creation, solid fill, static properties
 */
function test1_SimpleRedRectangle(): void {
  const anim = Animation.create(512, 512, 3, 30);
  anim.setName('Simple Red Rectangle');

  const layer = new ShapeLayer(0, 'Red Rectangle', 0, anim.timeToFrame(3));
  layer.setPosition(256, 256);

  const rect = ShapeBuilder.rectangle('Rectangle', 200, 200);
  const fill = ShapeBuilder.fill('Red Fill', [1, 0, 0]); // Red in RGB 0-1
  const transform = ShapeBuilder.transform();

  layer.addShapes([rect, fill, transform]);
  anim.addLayer(layer);

  saveAnimation(anim, 'test1-red-rectangle.json');
}

/**
 * Test 2: Animated Circle (Position)
 * Verifies: Circle shape, position animation
 */
function test2_AnimatedCircle(): void {
  const anim = Animation.create(512, 512, 3, 30);
  anim.setName('Animated Circle');

  const layer = new ShapeLayer(0, 'Moving Circle', 0, anim.timeToFrame(3));
  layer.setPosition(100, 256);
  layer.animatePosition(anim.timeToFrame(3), 412, 256, 0);

  const circle = ShapeBuilder.circle('Circle', 80);
  const fill = ShapeBuilder.fill('Blue Fill', [0, 0.5, 1]); // Blue
  const transform = ShapeBuilder.transform();

  layer.addShapes([circle, fill, transform]);
  anim.addLayer(layer);

  saveAnimation(anim, 'test2-animated-circle.json');
}

/**
 * Test 3: Scale Animation
 * Verifies: Scale property animation
 */
function test3_ScaleAnimation(): void {
  const anim = Animation.create(512, 512, 2, 30);
  anim.setName('Scale Animation');

  const layer = new ShapeLayer(0, 'Scaling Square', 0, anim.timeToFrame(2));
  layer.setPosition(256, 256);
  layer.setScale(50, 50);
  layer.animateScale(anim.timeToFrame(2), 150, 150, 0);

  const rect = ShapeBuilder.rectangle('Square', 100, 100);
  const fill = ShapeBuilder.fill('Green Fill', [0, 1, 0]); // Green
  const transform = ShapeBuilder.transform();

  layer.addShapes([rect, fill, transform]);
  anim.addLayer(layer);

  saveAnimation(anim, 'test3-scale-animation.json');
}

/**
 * Test 4: Rotation Animation
 * Verifies: Rotation property animation
 */
function test4_RotationAnimation(): void {
  const anim = Animation.create(512, 512, 3, 30);
  anim.setName('Rotation Animation');

  const layer = new ShapeLayer(0, 'Rotating Rectangle', 0, anim.timeToFrame(3));
  layer.setPosition(256, 256);
  layer.setRotation(0);
  layer.animateRotation(anim.timeToFrame(3), 360, 0);

  const rect = ShapeBuilder.rectangle('Rectangle', 150, 80);
  const fill = ShapeBuilder.fill('Purple Fill', [0.8, 0, 0.8]); // Purple
  const transform = ShapeBuilder.transform();

  layer.addShapes([rect, fill, transform]);
  anim.addLayer(layer);

  saveAnimation(anim, 'test4-rotation-animation.json');
}

/**
 * Test 5: Opacity Animation
 * Verifies: Opacity property animation
 */
function test5_OpacityAnimation(): void {
  const anim = Animation.create(512, 512, 3, 30);
  anim.setName('Opacity Animation');

  const layer = new ShapeLayer(0, 'Fading Circle', 0, anim.timeToFrame(3));
  layer.setPosition(256, 256);
  layer.setOpacity(100);
  
  // Animate opacity: fade from 100% to 0% over 3 seconds
  layer.animateOpacity(anim.timeToFrame(3), 0, 0);

  const circle = ShapeBuilder.circle('Circle', 120);
  const fill = ShapeBuilder.fill('Orange Fill', [1, 0.5, 0]); // Orange
  const transform = ShapeBuilder.transform();

  layer.addShapes([circle, fill, transform]);
  anim.addLayer(layer);

  saveAnimation(anim, 'test5-opacity-animation.json');
}

/**
 * Test 6: Multiple Shapes
 * Verifies: Multiple shapes in one layer
 */
function test6_MultipleShapes(): void {
  const anim = Animation.create(512, 512, 3, 30);
  anim.setName('Multiple Shapes');

  const layer = new ShapeLayer(0, 'Multiple Shapes', 0, anim.timeToFrame(3));
  layer.setPosition(256, 256);

  // Circle
  const circle = ShapeBuilder.circle('Circle', 100);
  const circleFill = ShapeBuilder.fill('Circle Fill', [1, 0, 0]);
  const circleTransform = ShapeBuilder.transform([-100, 0]);
  const circleGroup = ShapeBuilder.group('Circle Group', [circle, circleFill, circleTransform]);

  // Square
  const square = ShapeBuilder.rectangle('Square', 100, 100);
  const squareFill = ShapeBuilder.fill('Square Fill', [0, 1, 0]);
  const squareTransform = ShapeBuilder.transform([100, 0]);
  const squareGroup = ShapeBuilder.group('Square Group', [square, squareFill, squareTransform]);

  layer.addShapes([circleGroup, squareGroup]);
  anim.addLayer(layer);

  saveAnimation(anim, 'test6-multiple-shapes.json');
}

/**
 * Test 7: Ellipse Shape
 * Verifies: Ellipse (non-circular) shape
 */
function test7_EllipseShape(): void {
  const anim = Animation.create(512, 512, 3, 30);
  anim.setName('Ellipse Shape');

  const layer = new ShapeLayer(0, 'Ellipse', 0, anim.timeToFrame(3));
  layer.setPosition(256, 256);

  const ellipse = ShapeBuilder.ellipse('Ellipse', 200, 100);
  const fill = ShapeBuilder.fill('Cyan Fill', [0, 1, 1]); // Cyan
  const transform = ShapeBuilder.transform();

  layer.addShapes([ellipse, fill, transform]);
  anim.addLayer(layer);

  saveAnimation(anim, 'test7-ellipse-shape.json');
}

/**
 * Test 8: Rounded Rectangle
 * Verifies: Rectangle with rounded corners
 */
function test8_RoundedRectangle(): void {
  const anim = Animation.create(512, 512, 3, 30);
  anim.setName('Rounded Rectangle');

  const layer = new ShapeLayer(0, 'Rounded Rect', 0, anim.timeToFrame(3));
  layer.setPosition(256, 256);

  const rect = ShapeBuilder.rectangle('Rounded Rect', 200, 150, [0, 0], 30);
  const fill = ShapeBuilder.fill('Magenta Fill', [1, 0, 1]); // Magenta
  const transform = ShapeBuilder.transform();

  layer.addShapes([rect, fill, transform]);
  anim.addLayer(layer);

  saveAnimation(anim, 'test8-rounded-rectangle.json');
}

/**
 * Test 9: Stroke Shape
 * Verifies: Stroke instead of fill
 */
function test9_StrokeShape(): void {
  const anim = Animation.create(512, 512, 3, 30);
  anim.setName('Stroke Shape');

  const layer = new ShapeLayer(0, 'Stroked Circle', 0, anim.timeToFrame(3));
  layer.setPosition(256, 256);

  const circle = ShapeBuilder.circle('Circle', 120);
  const stroke = ShapeBuilder.stroke('Stroke', [0, 0, 0], 10); // Black stroke, 10px width
  const transform = ShapeBuilder.transform();

  layer.addShapes([circle, stroke, transform]);
  anim.addLayer(layer);

  saveAnimation(anim, 'test9-stroke-shape.json');
}

/**
 * Test 10: Fill and Stroke
 * Verifies: Shape with both fill and stroke
 */
function test10_FillAndStroke(): void {
  const anim = Animation.create(512, 512, 3, 30);
  anim.setName('Fill and Stroke');

  const layer = new ShapeLayer(0, 'Filled and Stroked', 0, anim.timeToFrame(3));
  layer.setPosition(256, 256);

  const rect = ShapeBuilder.rectangle('Rectangle', 180, 180, [0, 0], 20);
  const fill = ShapeBuilder.fill('Yellow Fill', [1, 1, 0]); // Yellow
  const stroke = ShapeBuilder.stroke('Black Stroke', [0, 0, 0], 8);
  const transform = ShapeBuilder.transform();

  layer.addShapes([rect, fill, stroke, transform]);
  anim.addLayer(layer);

  saveAnimation(anim, 'test10-fill-and-stroke.json');
}

/**
 * Test 11: Star Shape
 * Verifies: Star shape creation
 */
function test11_StarShape(): void {
  const anim = Animation.create(512, 512, 3, 30);
  anim.setName('Star Shape');

  const layer = new ShapeLayer(0, 'Star', 0, anim.timeToFrame(3));
  layer.setPosition(256, 256);

  const star = ShapeBuilder.star('Star', 5, 100, 50);
  const fill = ShapeBuilder.fill('Gold Fill', [1, 0.84, 0]); // Gold
  const transform = ShapeBuilder.transform();

  layer.addShapes([star, fill, transform]);
  anim.addLayer(layer);

  saveAnimation(anim, 'test11-star-shape.json');
}

/**
 * Test 12: Polygon Shape
 * Verifies: Polygon shape creation
 */
function test12_PolygonShape(): void {
  const anim = Animation.create(512, 512, 3, 30);
  anim.setName('Polygon Shape');

  const layer = new ShapeLayer(0, 'Hexagon', 0, anim.timeToFrame(3));
  layer.setPosition(256, 256);

  const hexagon = ShapeBuilder.polygon('Hexagon', 6, 100);
  const fill = ShapeBuilder.fill('Teal Fill', [0, 0.5, 0.5]); // Teal
  const transform = ShapeBuilder.transform();

  layer.addShapes([hexagon, fill, transform]);
  anim.addLayer(layer);

  saveAnimation(anim, 'test12-polygon-shape.json');
}

/**
 * Test 13: Text Layer
 * Verifies: Text layer creation and styling
 */
function test13_TextLayer(): void {
  const anim = Animation.create(512, 512, 3, 30);
  anim.setName('Text Layer');

  const textLayer = new TextLayer(
    0,
    'Hello Motion',
    'Hello\nMotion',
    40,
    'Arial',
    0,
    anim.timeToFrame(3)
  );
  textLayer.setPosition(256, 256);
  textLayer.setColor([0, 0, 0]); // Black text
  textLayer.setJustification(2);

  anim.addLayer(textLayer);

  saveAnimation(anim, 'test13-text-layer.json');
}

/**
 * Test 14: Solid Background Layer
 * Verifies: Solid color layer
 */
function test14_SolidBackground(): void {
  const anim = Animation.create(512, 512, 3, 30);
  anim.setName('Solid Background');

  // Background
  const bgLayer = new SolidLayer(0, 'Background', '#FF6B6B', 512, 512, 0, anim.timeToFrame(3));
  bgLayer.setPosition(256, 256);

  // Foreground shape
  const shapeLayer = new ShapeLayer(1, 'Foreground Circle', 0, anim.timeToFrame(3));
  shapeLayer.setPosition(256, 256);

  const circle = ShapeBuilder.circle('Circle', 100);
  const fill = ShapeBuilder.fill('White Fill', [1, 1, 1]);
  const transform = ShapeBuilder.transform();

  shapeLayer.addShapes([circle, fill, transform]);

  anim.addLayers([bgLayer, shapeLayer]);

  saveAnimation(anim, 'test14-solid-background.json');
}

/**
 * Test 15: Complex Animation (Position + Scale + Rotation + Opacity)
 * Verifies: Multiple simultaneous animations
 */
function test15_ComplexAnimation(): void {
  const anim = Animation.create(512, 512, 3, 30);
  anim.setName('Complex Animation');

  const layer = new ShapeLayer(0, 'Complex Shape', 0, anim.timeToFrame(3));
  
  // Animate all properties
  layer.setPosition(100, 100);
  layer.animatePosition(anim.timeToFrame(3), 412, 412, 0);
  
  layer.setScale(50, 50);
  layer.animateScale(anim.timeToFrame(3), 150, 150, 0);
  
  layer.setRotation(0);
  layer.animateRotation(anim.timeToFrame(3), 720, 0); // Two full rotations
  
  layer.setOpacity(50);
  layer.animateOpacity(anim.timeToFrame(3), 100, 0);

  const rect = ShapeBuilder.rectangle('Rectangle', 80, 80, [0, 0], 10);
  const fill = ShapeBuilder.fill('Rainbow Fill', [1, 0, 0.5]);
  const transform = ShapeBuilder.transform();

  layer.addShapes([rect, fill, transform]);
  anim.addLayer(layer);

  saveAnimation(anim, 'test15-complex-animation.json');
}

/**
 * Test 16: Shape Transform Animation
 * Verifies: Animating shapes within a group using transform
 */
function test16_ShapeTransformAnimation(): void {
  const anim = Animation.create(512, 512, 3, 30);
  anim.setName('Shape Transform Animation');

  const layer = new ShapeLayer(0, 'Animated Shape Group', 0, anim.timeToFrame(3));
  layer.setPosition(256, 256);

  const circle = ShapeBuilder.circle('Circle', 80);
  const fill = ShapeBuilder.fill('Red Fill', [1, 0, 0]);
  
  // Animated transform
  const transform = ShapeBuilder.animatedTransform('Animated Transform', {
    position: {
      start: [0, 0],
      end: [100, 0],
      startTime: 0,
      endTime: anim.timeToFrame(3)
    },
    scale: {
      start: [100, 100],
      end: [150, 150],
      startTime: 0,
      endTime: anim.timeToFrame(3)
    }
  });

  layer.addShapes([circle, fill, transform]);
  anim.addLayer(layer);

  saveAnimation(anim, 'test16-shape-transform-animation.json');
}

/**
 * Test 17: Multiple Layers
 * Verifies: Multiple layers with different timing
 */
function test17_MultipleLayers(): void {
  const anim = Animation.create(512, 512, 4, 30);
  anim.setName('Multiple Layers');

  // Layer 1: Appears at start
  const layer1 = new ShapeLayer(0, 'Layer 1', 0, anim.timeToFrame(4));
  layer1.setPosition(150, 256);
  const circle1 = ShapeBuilder.circle('Circle', 60);
  const fill1 = ShapeBuilder.fill('Red', [1, 0, 0]);
  const transform1 = ShapeBuilder.transform();
  layer1.addShapes([circle1, fill1, transform1]);

  // Layer 2: Appears at 1 second
  const layer2 = new ShapeLayer(1, 'Layer 2', anim.timeToFrame(1), anim.timeToFrame(4));
  layer2.setPosition(256, 256);
  const circle2 = ShapeBuilder.circle('Circle', 60);
  const fill2 = ShapeBuilder.fill('Green', [0, 1, 0]);
  const transform2 = ShapeBuilder.transform();
  layer2.addShapes([circle2, fill2, transform2]);

  // Layer 3: Appears at 2 seconds
  const layer3 = new ShapeLayer(2, 'Layer 3', anim.timeToFrame(2), anim.timeToFrame(4));
  layer3.setPosition(362, 256);
  const circle3 = ShapeBuilder.circle('Circle', 60);
  const fill3 = ShapeBuilder.fill('Blue', [0, 0, 1]);
  const transform3 = ShapeBuilder.transform();
  layer3.addShapes([circle3, fill3, transform3]);

  anim.addLayers([layer1, layer2, layer3]);

  saveAnimation(anim, 'test17-multiple-layers.json');
}

/**
 * Test 18: Animated Fill Color
 * Verifies: Color animation
 */
function test18_AnimatedFillColor(): void {
  const anim = Animation.create(512, 512, 3, 30);
  anim.setName('Animated Fill Color');

  const layer = new ShapeLayer(0, 'Color Changing Circle', 0, anim.timeToFrame(3));
  layer.setPosition(256, 256);

  const circle = ShapeBuilder.circle('Circle', 100);
  const animatedFill = ShapeBuilder.animatedFill(
    'Animated Fill',
    [1, 0, 0], // Red
    [0, 0, 1], // Blue
    0,
    anim.timeToFrame(3)
  );
  const transform = ShapeBuilder.transform();

  layer.addShapes([circle, animatedFill, transform]);
  anim.addLayer(layer);

  saveAnimation(anim, 'test18-animated-fill-color.json');
}

/**
 * Test 19: Parent-Child Relationship
 * Verifies: Layer parenting
 */
function test19_ParentChild(): void {
  const anim = Animation.create(512, 512, 3, 30);
  anim.setName('Parent-Child Relationship');

  // Parent layer (null layer for organization)
  const parentLayer = new NullLayer(0, 'Parent', 0, anim.timeToFrame(3));
  parentLayer.setPosition(256, 256);
  parentLayer.animateRotation(anim.timeToFrame(3), 360, 0);

  // Child layer
  const childLayer = new ShapeLayer(1, 'Child', 0, anim.timeToFrame(3));
  childLayer.setPosition(100, 0); // Offset from parent
  childLayer.setParent(0); // Parent to layer 0

  const circle = ShapeBuilder.circle('Circle', 40);
  const fill = ShapeBuilder.fill('Orange Fill', [1, 0.5, 0]);
  const transform = ShapeBuilder.transform();

  childLayer.addShapes([circle, fill, transform]);

  anim.addLayers([parentLayer, childLayer]);

  saveAnimation(anim, 'test19-parent-child.json');
}

/**
 * Test 20: Comprehensive Feature Test
 * Verifies: All major features in one animation
 */
function test20_ComprehensiveTest(): void {
  const anim = Animation.create(800, 600, 5, 30);
  anim.setName('Comprehensive Feature Test');

  // Background
  const bg = new SolidLayer(0, 'Background', '#1a1a2e', 800, 600, 0, anim.timeToFrame(5));
  bg.setPosition(400, 300);

  // Title text
  const title = new TextLayer(1, 'Title', 'Lottie Builder', 48, 'Arial', 0, anim.timeToFrame(5));
  title.setPosition(400, 80);
  title.setColor([1, 1, 1]);
  title.setJustification(2);
  title.setOpacity(0);
  title.animateOpacity(anim.timeToFrame(1), 100, 0);

  // Animated circle
  const circle1 = new ShapeLayer(2, 'Circle 1', 0, anim.timeToFrame(5));
  circle1.setPosition(200, 300);
  circle1.animatePosition(anim.timeToFrame(3), 600, 300, anim.timeToFrame(1));
  const c1Shape = ShapeBuilder.circle('Circle', 50);
  const c1Fill = ShapeBuilder.fill('Fill', [0.2, 0.6, 1]);
  const c1Transform = ShapeBuilder.transform();
  circle1.addShapes([c1Shape, c1Fill, c1Transform]);

  // Rotating square
  const square = new ShapeLayer(3, 'Square', 0, anim.timeToFrame(5));
  square.setPosition(400, 300);
  square.setRotation(0);
  square.animateRotation(anim.timeToFrame(5), 360, 0);
  const sqShape = ShapeBuilder.rectangle('Square', 80, 80, [0, 0], 10);
  const sqFill = ShapeBuilder.fill('Fill', [1, 0.3, 0.5]);
  const sqTransform = ShapeBuilder.transform();
  square.addShapes([sqShape, sqFill, sqTransform]);

  // Scaling star
  const star = new ShapeLayer(4, 'Star', anim.timeToFrame(1), anim.timeToFrame(5));
  star.setPosition(600, 450);
  star.setScale(0, 0);
  star.animateScale(anim.timeToFrame(2), 100, 100, anim.timeToFrame(1));
  const starShape = ShapeBuilder.star('Star', 5, 60, 30);
  const starFill = ShapeBuilder.fill('Fill', [1, 0.84, 0]);
  const starTransform = ShapeBuilder.transform();
  star.addShapes([starShape, starFill, starTransform]);

  anim.addLayers([bg, title, circle1, square, star]);

  saveAnimation(anim, 'test20-comprehensive.json');
}

/**
 * Run all tests
 */
function runAllTests(): void {
  console.log('\n🎬 Running Lottie JSON Builder Visual Tests...\n');
  console.log('Output directory:', OUTPUT_DIR);
  console.log('');

  try {
    test1_SimpleRedRectangle();
    test2_AnimatedCircle();
    test3_ScaleAnimation();
    test4_RotationAnimation();
    test5_OpacityAnimation();
    test6_MultipleShapes();
    test7_EllipseShape();
    test8_RoundedRectangle();
    test9_StrokeShape();
    test10_FillAndStroke();
    test11_StarShape();
    test12_PolygonShape();
    test13_TextLayer();
    test14_SolidBackground();
    test15_ComplexAnimation();
    test16_ShapeTransformAnimation();
    test17_MultipleLayers();
    test18_AnimatedFillColor();
    test19_ParentChild();
    test20_ComprehensiveTest();

    console.log('\n✅ All tests completed successfully!');
    console.log(`\n📁 Generated ${fs.readdirSync(OUTPUT_DIR).length} Lottie JSON files in: ${OUTPUT_DIR}`);
    console.log('\n🌐 Open viewer.html in a browser to visually verify the animations.');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
runAllTests();
