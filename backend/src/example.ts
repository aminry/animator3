/**
 * Simple Example - Create a Custom Lottie Animation
 * 
 * This example shows how to use the Lottie JSON Builder SDK
 * to create a custom animation from scratch.
 * 
 * Run with: npm run build && node dist/example.js
 */

import { Animation, ShapeLayer, ShapeBuilder } from './index';
import * as fs from 'fs';
import * as path from 'path';

// Create a 512x512 animation, 3 seconds long, 30 fps
const anim = Animation.create(512, 512, 3, 30);
anim.setName('Custom Animation Example');

// Create a shape layer with a bouncing circle
const layer = new ShapeLayer(0, 'Bouncing Circle', 0, anim.timeToFrame(3));

// Set initial position and animate it
layer.setPosition(100, 256);
layer.animatePosition(anim.timeToFrame(3), 412, 256, 0);

// Animate scale to create a bounce effect
layer.setScale(100, 100);
layer.animateScale(anim.timeToFrame(1.5), 120, 120, 0);
layer.animateScale(anim.timeToFrame(3), 100, 100, anim.timeToFrame(1.5));

// Add rotation for extra flair
layer.setRotation(0);
layer.animateRotation(anim.timeToFrame(3), 720, 0); // Two full rotations

// Create the circle shape with a gradient-like color
const circle = ShapeBuilder.circle('Circle', 60);
const fill = ShapeBuilder.fill('Fill', [0.3, 0.6, 1]); // Nice blue
const stroke = ShapeBuilder.stroke('Stroke', [1, 1, 1], 4); // White border
const transform = ShapeBuilder.transform();

// Add all shapes to the layer
layer.addShapes([circle, fill, stroke, transform]);

// Add the layer to the animation
anim.addLayer(layer);

// Export to JSON
const outputDir = path.join(__dirname, '..', 'output');
const outputPath = path.join(outputDir, 'custom-example.json');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Write the JSON file
fs.writeFileSync(outputPath, anim.toString(true));

console.log('✅ Custom animation created!');
console.log(`📁 Saved to: ${outputPath}`);
console.log('🌐 Open viewer.html to see it in action!');
console.log('');
console.log('Animation details:');
console.log(`  - Size: ${anim.toJSON().w}x${anim.toJSON().h}`);
console.log(`  - Duration: ${anim.getDuration()} seconds`);
console.log(`  - Frame rate: ${anim.toJSON().fr} fps`);
console.log(`  - Total frames: ${anim.toJSON().op}`);
