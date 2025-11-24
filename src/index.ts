/**
 * MotionGen V3 - Lottie JSON Builder SDK
 * 
 * A type-safe TypeScript abstraction layer for creating Lottie animations
 * without relying on DOM dependencies. Runs in pure Node.js environment.
 */

// Core classes
export { Animation } from './Animation';
export { Layer, ShapeLayer, SolidLayer, TextLayer, ImageLayer, NullLayer } from './Layer';
export { Property } from './Property';
export { ShapeBuilder } from './shapes';

// Type definitions
export * from './types';

// Convenience exports
export {
  Animation as default
} from './Animation';
