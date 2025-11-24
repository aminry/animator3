import { Property as PropertyJSON, Keyframe, BezierEasing } from './types';
import { NamedEasing, CubicBezierDefinition, getCubicBezierEasing } from './easing';

/**
 * Represents an animatable property in Lottie
 * Can be static or animated with keyframes
 */
export class Property<T> {
  private animated: boolean = false;
  private value: T;
  private keyframes: Keyframe<T>[] = [];
  private propertyIndex?: number;

  constructor(initialValue: T, propertyIndex?: number) {
    this.value = initialValue;
    this.propertyIndex = propertyIndex;
  }

  /**
   * Set a static value (non-animated)
   */
  setValue(value: T): this {
    this.value = value;
    this.animated = false;
    this.keyframes = [];
    return this;
  }

  /**
   * Add a keyframe for animation
   */
  addKeyframe(
    time: number,
    value: T,
    easing?: { inTangent?: BezierEasing; outTangent?: BezierEasing; hold?: boolean }
  ): this {
    this.animated = true;
    
    const keyframe: Keyframe<T> = {
      t: time,
      s: value,
    };

    if (easing?.inTangent) {
      keyframe.i = easing.inTangent;
    }
    if (easing?.outTangent) {
      keyframe.o = easing.outTangent;
    }
    if (easing?.hold) {
      keyframe.h = 1;
    }

    this.keyframes.push(keyframe);
    
    // Sort keyframes by time
    this.keyframes.sort((a, b) => a.t - b.t);
    
    // Update end values and control points for interpolation
    this.updateInterpolation();
    
    return this;
  }

  /**
   * Add multiple keyframes at once
   */
  addKeyframes(keyframes: Array<{ time: number; value: T; easing?: any }>): this {
    keyframes.forEach(kf => this.addKeyframe(kf.time, kf.value, kf.easing));
    return this;
  }

  /**
   * Create a linear animation from current value to target value
   */
  animateTo(endTime: number, endValue: T, startTime: number = 0): this {
    this.animated = true;
    
    this.keyframes = [
      { 
        t: startTime, 
        s: this.value, 
        e: endValue,
        i: { x: [1], y: [1] }, // Linear in
        o: { x: [0], y: [0] }  // Linear out
      },
      { 
        t: endTime, 
        s: endValue 
      }
    ];
    return this;
  }

  /**
   * Create an eased animation
   */
  animateToWithEasing(
    endTime: number,
    endValue: T,
    startTime: number = 0,
    easing: NamedEasing | CubicBezierDefinition = 'linear'
  ): this {
    const curve = getCubicBezierEasing(easing);
    
    this.animated = true;
    this.keyframes = [
      {
        t: startTime,
        s: this.value,
        e: endValue,
        i: curve.i,
        o: curve.o
      },
      { t: endTime, s: endValue }
    ];
    
    return this;
  }

  /**
   * Update interpolation data for all keyframes
   */
  private updateInterpolation() {
    for (let i = 0; i < this.keyframes.length - 1; i++) {
      const current = this.keyframes[i];
      const next = this.keyframes[i + 1];
      
      current.e = next.s;
      
      // If no easing specified, default to linear/default
      if (!current.i && !current.o && !current.h) {
        current.i = { x: [1], y: [1] };
        current.o = { x: [0], y: [0] };
      }
    }
  }

  /**
   * Export to Lottie JSON format
   */
  toJSON(): PropertyJSON<T> {
    if (this.animated && this.keyframes.length > 0) {
      // Deep copy keyframes to avoid modifying internal state and wrap scalars
      const exportKeyframes = this.keyframes.map(kf => {
        const copy: any = { ...kf };
        // Wrap scalar numbers in arrays for Lottie compliance
        if (typeof copy.s === 'number') copy.s = [copy.s];
        if (typeof copy.e === 'number') copy.e = [copy.e];
        return copy;
      });

      const json: PropertyJSON<T> = {
        a: 1,
        k: exportKeyframes
      };
      if (this.propertyIndex !== undefined) {
        json.ix = this.propertyIndex;
      }
      return json;
    } else {
      const json: PropertyJSON<T> = {
        a: 0,
        k: this.value
      };
      if (this.propertyIndex !== undefined) {
        json.ix = this.propertyIndex;
      }
      return json;
    }
  }

  /**
   * Get the current static value
   */
  getValue(): T {
    return this.value;
  }

  /**
   * Check if property is animated
   */
  isAnimated(): boolean {
    return this.animated;
  }
}
