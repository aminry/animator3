import { Animation } from './Animation';
import { ShapeLayer, TextLayer } from './Layer';
import { ShapeBuilder } from './shapes';
import { ColorRGB } from './types';
import { generateKeyframes, SpringPhysicsConfig, TimeValuePair } from './physics';
import { Property } from './Property';

/**
 * High-level MotionScript API built on top of the core Lottie builder.
 *
 * This module provides the `Stage` and `Motion` abstractions that the LLM
 * (and end users) will interact with, while delegating to the lower-level
 * Animation, Layer, Property, and physics utilities.
 */

// Shared style types
export interface TextStyle {
  fontSize?: number;
  fontFamily?: string;
  color?: ColorRGB;
  justification?: 0 | 1 | 2;
}

export type ShapeType = 'circle' | 'rectangle';

export interface ShapeStyle {
  fillColor?: ColorRGB;
  strokeColor?: ColorRGB;
  strokeWidth?: number;
  width?: number;
  height?: number;
  radius?: number; // for circle convenience
}

export interface MotionProps {
  position?: { from?: [number, number]; to: [number, number] };
  opacity?: { from?: number; to: number };
  scale?: { from?: [number, number]; to: [number, number] };
  rotation?: { from?: number; to: number };
}

export interface MotionConfig {
  props: MotionProps;
  spring?: SpringPhysicsConfig;
  delay?: number; // seconds
}

export interface StaggerConfig {
  delay: number; // seconds between elements
}

/**
 * Internal wrapper to expose a unified animate() API on created elements.
 */
export class MotionElement {
  private layer: ShapeLayer | TextLayer;
  private stage: Stage;

  constructor(stage: Stage, layer: ShapeLayer | TextLayer) {
    this.stage = stage;
    this.layer = layer;
  }

  /**
   * Animate properties on this element using either simple linear keyframes
   * or spring physics generated via `generateKeyframes`.
   */
  animate(config: MotionConfig): this {
    const { props, spring, delay = 0 } = config;
    const fps = this.stage.getAnimation().getFrameRate();
    const startFrame = this.stage.getAnimation().timeToFrame(delay);

    // Position animation
    if (props.position) {
      const from = props.position.from ?? (this.layer as any).position?.getValue?.() ?? [0, 0];
      const to = props.position.to;

      if (spring) {
        // Use spring physics over normalized progress [0, 1] and map to 2D
        const progressKeyframes: TimeValuePair<number>[] = generateKeyframes(0, 1, spring, fps);
        const property = new Property<[number, number]>([from[0], from[1]]);

        progressKeyframes.forEach(kf => {
          const t = kf.value; // normalized progress (may overshoot)
          const x = from[0] + (to[0] - from[0]) * t;
          const y = from[1] + (to[1] - from[1]) * t;
          const frameTime = this.stage.getAnimation().timeToFrame(kf.time) + startFrame;
          property.addKeyframe(frameTime, [x, y]);
        });

        (this.layer as any).position = property;
      } else {
        const endFrame = this.stage.getAnimation().timeToFrame(this.stage.getDurationSeconds());
        (this.layer as any).animatePosition(endFrame, to[0], to[1], startFrame);
      }
    }

    // Opacity animation
    if (props.opacity) {
      const from = props.opacity.from ?? 0;
      const to = props.opacity.to;
      const endFrame = this.stage.getAnimation().timeToFrame(this.stage.getDurationSeconds());
      (this.layer as any).setOpacity(from);
      (this.layer as any).animateOpacity(endFrame, to, startFrame);
    }

    // Scale animation
    if (props.scale) {
      const from = props.scale.from ?? [100, 100];
      const to = props.scale.to;
      const endFrame = this.stage.getAnimation().timeToFrame(this.stage.getDurationSeconds());
      (this.layer as any).setScale(from[0], from[1]);
      (this.layer as any).animateScale(endFrame, to[0], to[1], startFrame);
    }

    // Rotation animation
    if (props.rotation) {
      const from = props.rotation.from ?? 0;
      const to = props.rotation.to;
      const endFrame = this.stage.getAnimation().timeToFrame(this.stage.getDurationSeconds());
      (this.layer as any).setRotation(from);
      (this.layer as any).animateRotation(endFrame, to, startFrame);
    }

    return this;
  }

  /**
   * Expose the underlying layer for advanced users/tests.
   */
  getLayer(): ShapeLayer | TextLayer {
    return this.layer;
  }
}

/**
 * Group helper to apply staggered animations across elements.
 */
export class MotionGroup {
  private stage: Stage;

  constructor(stage: Stage) {
    this.stage = stage;
  }

  /**
   * Apply staggered delays to a set of elements based on the provided
   * configuration. Each subsequent element receives an additional
   * `config.delay` seconds.
   */
  stagger(elements: MotionElement[], baseConfig: MotionConfig, config: StaggerConfig): void {
    elements.forEach((el, index) => {
      const delay = (baseConfig.delay ?? 0) + config.delay * index;
      el.animate({ ...baseConfig, delay });
    });
  }
}

/**
 * Stage: entry point for building animations via the MotionScript DSL.
 */
export class Stage {
  private animation: Animation;

  constructor(width: number = 800, height: number = 600, durationSeconds: number = 3, fps: number = 30) {
    this.animation = Animation.create(width, height, durationSeconds, fps);
  }

  static create(width?: number, height?: number, durationSeconds?: number, fps?: number): Stage {
    return new Stage(width, height, durationSeconds, fps);
  }

  getAnimation(): Animation {
    return this.animation;
  }

  getDurationSeconds(): number {
    return this.animation.getDuration();
  }

  /**
   * Add a text layer to the stage.
   */
  addText(content: string, style: TextStyle = {}): MotionElement {
    const layerIndex = this.animation.getLayers().length;
    const inPoint = 0;
    const outPoint = this.animation.timeToFrame(this.animation.getDuration());

    const fontSize = style.fontSize ?? 40;
    const fontFamily = style.fontFamily ?? 'Arial';

    const textLayer = new TextLayer(
      layerIndex,
      content,
      content,
      fontSize,
      fontFamily,
      inPoint,
      outPoint
    );

    if (style.color) {
      textLayer.setColor(style.color);
    }
    if (typeof style.justification === 'number') {
      textLayer.setJustification(style.justification);
    }

    // Center text by default
    textLayer.setPosition(this.animation.getWidth() / 2, this.animation.getHeight() / 2);

    this.animation.addLayer(textLayer);
    return new MotionElement(this, textLayer);
  }

  /**
   * Add a simple shape layer to the stage.
   */
  addShape(type: ShapeType, style: ShapeStyle = {}): MotionElement {
    const layerIndex = this.animation.getLayers().length;
    const inPoint = 0;
    const outPoint = this.animation.timeToFrame(this.animation.getDuration());
    const layer = new ShapeLayer(layerIndex, `${type} shape`, inPoint, outPoint);

    const fillColor = style.fillColor ?? [1, 1, 1];
    const strokeColor = style.strokeColor;
    const strokeWidth = style.strokeWidth ?? 0;

    let shape;
    if (type === 'circle') {
      const radius = style.radius ?? 50;
      shape = ShapeBuilder.circle('Circle', radius * 2);
    } else {
      const width = style.width ?? 100;
      const height = style.height ?? 100;
      shape = ShapeBuilder.rectangle('Rectangle', width, height);
    }

    const items = [] as any[];
    if (fillColor) {
      items.push(ShapeBuilder.fill('Fill', fillColor));
    }
    if (strokeColor && strokeWidth > 0) {
      items.push(ShapeBuilder.stroke('Stroke', strokeColor, strokeWidth));
    }
    items.push(ShapeBuilder.transform());

    const group = ShapeBuilder.group('Shape Group', [shape, ...items]);
    layer.addShapes([group]);

    // Center shape by default
    layer.setPosition(this.animation.getWidth() / 2, this.animation.getHeight() / 2);

    this.animation.addLayer(layer);
    return new MotionElement(this, layer);
  }

  /**
   * Create a new MotionGroup bound to this stage.
   */
  createGroup(): MotionGroup {
    return new MotionGroup(this);
  }

  /**
   * Export Lottie JSON.
   */
  toJSON() {
    return this.animation.toJSON();
  }

  toString(pretty: boolean = false): string {
    return this.animation.toString(pretty);
  }
}

/**
 * Motion namespace placeholder for future helpers (e.g., Motion.spring()).
 * For now we only expose the Stage class as the primary entry.
 */
export const Motion = {
  Stage
};
