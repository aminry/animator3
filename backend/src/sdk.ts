const SDK_INTERFACE_DEFINITION = `
declare module '@motiongen/sdk' {
  //
  // Basic types
  //
  export type ColorRGB = [number, number, number];

  // Easing names map to your internal easing presets; tuple is cubic-bezier.
  export type EasingName = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
  export type Easing = EasingName | [number, number, number, number];

  //
  // Text
  //
  export interface TextStyle {
    fontSize?: number;
    fontFamily?: string;
    color?: ColorRGB;
    // 0 = left, 1 = right, 2 = center (matches your TextLayer)
    justification?: 0 | 1 | 2;
  }

  //
  // Shapes
  //
  export type ShapeType =
    | 'rectangle'
    | 'roundedRectangle'
    | 'circle'
    | 'ellipse'
    | 'polygon'
    | 'star';

  export interface ShapeStyle {
    // Common
    fillColor?: ColorRGB;
    strokeColor?: ColorRGB;
    strokeWidth?: number;

    // Rectangle / roundedRectangle
    width?: number;
    height?: number;
    // For roundedRectangle; radius in pixels
    cornerRadius?: number;

    // Circle / ellipse
    // For circle (if radiusX/radiusY omitted)
    radius?: number;
    // For ellipse
    radiusX?: number;
    radiusY?: number;

    // Polygon / star
    points?: number;        // e.g. 5 for pentagon/star
    innerRadius?: number;   // star inner radius
    outerRadius?: number;   // star/polygon outer radius
  }

  //
  // Motion primitives
  //
  export interface MotionScalar {
    from?: number;
    to: number;
  }

  export interface MotionVector2 {
    from?: [number, number];
    to: [number, number];
  }

  export interface MotionColor {
    from?: ColorRGB;
    to: ColorRGB;
  }

  export interface MotionTiming {
    start?: number;
    end?: number;
  }

  export interface MotionProps {
    // Position in pixels (Stage coordinates)
    position?: MotionVector2;
    // Opacity 0–100
    opacity?: MotionScalar;
    // Scale in percent, e.g. [100, 100] = 100%
    scale?: MotionVector2;
    // Rotation in degrees
    rotation?: MotionScalar;
    // Color animation for shapes (maps to fill)
    fillColor?: MotionColor;
    // Color animation for text (maps to text color)
    color?: MotionColor;
  }

  export interface SpringConfig {
    stiffness: number;
    damping: number;
  }

  export interface MotionConfig {
    props: MotionProps;
    // Use spring when you want physically-based motion with overshoot/settle.
    spring?: SpringConfig;
    // Use easing when you want standard cubic-bezier behavior without spring.
    easing?: Easing;
    // Delay from the start of the animation (seconds).
    delay?: number;
    // Explicit duration in seconds for this motion phase.
    duration?: number;
    // Optional absolute start/end time on the Stage timeline.
    time?: MotionTiming;
  }

  //
  // Elements & grouping
  //
  export class MotionElement {
    /**
     * Apply an animation to this element.
     * Can be called multiple times to create multiple motion phases.
     */
    animate(config: MotionConfig): MotionElement;
  }

  export interface StaggerOptions {
    // Per-element offset in seconds for staggered sequences.
    delay: number;
  }

  export class MotionGroup {
    /**
     * Apply the same MotionConfig to a list of elements with staggered delays.
     */
    stagger(
      elements: MotionElement[],
      baseConfig: MotionConfig,
      options: StaggerOptions
    ): void;
  }

  //
  // Stage
  //
  export class Stage {
    constructor(
      width?: number,
      height?: number,
      durationSeconds?: number,
      fps?: number
    );

    static create(
      width?: number,
      height?: number,
      durationSeconds?: number,
      fps?: number
    ): Stage;

    /**
     * Create a text element.
     */
    addText(content: string, style?: TextStyle): MotionElement;

    /**
     * Create a shape element.
     * The ShapeType plus ShapeStyle determine the geometry.
     */
    addShape(type: ShapeType, style?: ShapeStyle): MotionElement;

    /**
     * Create a group for staggered animations across multiple elements.
     */
    createGroup(): MotionGroup;

    /**
     * Export the underlying Lottie representation.
     */
    toJSON(pretty?: boolean): unknown;
  }

  //
  // Root Motion namespace (factory helpers)
  //
  export const Motion: {
    Stage: typeof Stage;
    spring(config: SpringConfig): SpringConfig;
  };
}
`.trim();

export default SDK_INTERFACE_DEFINITION;