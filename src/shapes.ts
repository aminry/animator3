import { ShapeItem, Property as PropertyJSON } from './types';
import { Property } from './Property';

/**
 * Helper class to build shape items
 */
export class ShapeBuilder {
  /**
   * Create a group to contain multiple shapes
   */
  static group(name: string, items: ShapeItem[]): ShapeItem {
    return {
      ty: 'gr',
      nm: name,
      it: items,
      np: items.length,
      cix: 2
    };
  }

  /**
   * Create a rectangle shape
   */
  static rectangle(
    name: string,
    width: number,
    height: number,
    position: [number, number] = [0, 0],
    roundness: number = 0
  ): ShapeItem {
    return {
      ty: 'rc',
      nm: name,
      s: { a: 0, k: [width, height] },
      p: { a: 0, k: position },
      r: { a: 0, k: roundness }
    };
  }

  /**
   * Create an ellipse/circle shape
   */
  static ellipse(
    name: string,
    width: number,
    height: number,
    position: [number, number] = [0, 0]
  ): ShapeItem {
    return {
      ty: 'el',
      nm: name,
      d: 1, // Direction (1 = normal)
      s: { a: 0, k: [width, height] },
      p: { a: 0, k: position }
    };
  }

  /**
   * Create a circle (convenience method)
   */
  static circle(name: string, diameter: number, position: [number, number] = [0, 0]): ShapeItem {
    return ShapeBuilder.ellipse(name, diameter, diameter, position);
  }

  /**
   * Create a fill
   */
  static fill(name: string, color: [number, number, number], opacity: number = 1): ShapeItem {
    return {
      ty: 'fl',
      nm: name,
      c: { a: 0, k: [...color, 1] }, // RGBA format
      o: { a: 0, k: opacity * 100 },
      r: 1, // Fill rule
      bm: 0 // Blend mode
    };
  }

  /**
   * Create an animated fill
   */
  static animatedFill(
    name: string,
    startColor: [number, number, number],
    endColor: [number, number, number],
    startTime: number,
    endTime: number,
    opacity: number = 1
  ): ShapeItem {
    return {
      ty: 'fl',
      nm: name,
      c: {
        a: 1,
        k: [
          { t: startTime, s: startColor, e: endColor },
          { t: endTime, s: endColor }
        ]
      },
      o: { a: 0, k: opacity * 100 }
    };
  }

  /**
   * Create a stroke
   */
  static stroke(
    name: string,
    color: [number, number, number],
    width: number,
    opacity: number = 1,
    lineCap: number = 2,
    lineJoin: number = 2
  ): ShapeItem {
    return {
      ty: 'st',
      nm: name,
      c: { a: 0, k: color },
      o: { a: 0, k: opacity * 100 },
      w: { a: 0, k: width },
      lc: lineCap,
      lj: lineJoin
    };
  }

  /**
   * Create a transform for a shape group
   */
  static transform(position: [number, number] = [0, 0]): ShapeItem {
    return {
      ty: 'tr',
      nm: 'Transform',
      p: { a: 0, k: position },
      a: { a: 0, k: [0, 0] },
      s: { a: 0, k: [100, 100] },
      r: { a: 0, k: 0 },
      o: { a: 0, k: 100 },
      sk: { a: 0, k: 0 }, // Skew
      sa: { a: 0, k: 0 }  // Skew axis
    };
  }

  /**
   * Create an animated transform
   */
  static animatedTransform(
    name: string = 'Transform',
    config: {
      position?: { start: [number, number]; end: [number, number]; startTime: number; endTime: number };
      scale?: { start: [number, number]; end: [number, number]; startTime: number; endTime: number };
      rotation?: { start: number; end: number; startTime: number; endTime: number };
      opacity?: { start: number; end: number; startTime: number; endTime: number };
      anchor?: [number, number];
    }
  ): ShapeItem {
    const transform: ShapeItem = {
      ty: 'tr',
      nm: name
    };

    if (config.position) {
      transform.p = {
        a: 1,
        k: [
          {
            t: config.position.startTime,
            s: config.position.start,
            e: config.position.end,
            i: { x: [1], y: [1] },
            o: { x: [0], y: [0] }
          },
          {
            t: config.position.endTime,
            s: config.position.end
          }
        ]
      };
    } else {
      transform.p = { a: 0, k: [0, 0] };
    }

    if (config.scale) {
      transform.s = {
        a: 1,
        k: [
          {
            t: config.scale.startTime,
            s: config.scale.start,
            e: config.scale.end,
            i: { x: [1], y: [1] },
            o: { x: [0], y: [0] }
          },
          {
            t: config.scale.endTime,
            s: config.scale.end
          }
        ]
      };
    } else {
      transform.s = { a: 0, k: [100, 100] };
    }

    if (config.rotation) {
      transform.r = {
        a: 1,
        k: [
          {
            t: config.rotation.startTime,
            s: config.rotation.start,
            e: config.rotation.end,
            i: { x: [1], y: [1] },
            o: { x: [0], y: [0] }
          },
          {
            t: config.rotation.endTime,
            s: config.rotation.end
          }
        ]
      };
    } else {
      transform.r = { a: 0, k: 0 };
    }

    if (config.opacity) {
      transform.o = {
        a: 1,
        k: [
          {
            t: config.opacity.startTime,
            s: config.opacity.start,
            e: config.opacity.end,
            i: { x: [1], y: [1] },
            o: { x: [0], y: [0] }
          },
          {
            t: config.opacity.endTime,
            s: config.opacity.end
          }
        ]
      };
    } else {
      transform.o = { a: 0, k: 100 };
    }

    transform.a = { a: 0, k: config.anchor || [0, 0] };

    // Ensure skew properties exist for compatibility with typical Lottie exports
    if (!transform.sk) {
      transform.sk = { a: 0, k: 0 } as any;
    }
    if (!transform.sa) {
      transform.sa = { a: 0, k: 0 } as any;
    }

    return transform;
  }

  /**
   * Create a star shape
   */
  static star(
    name: string,
    points: number,
    outerRadius: number,
    innerRadius: number,
    position: [number, number] = [0, 0]
  ): ShapeItem {
    return {
      ty: 'sr',
      nm: name,
      d: 1, // Direction
      p: { a: 0, k: position },
      or: { a: 0, k: outerRadius } as any,
      ir: { a: 0, k: innerRadius } as any,
      pt: { a: 0, k: points } as any,
      r: { a: 0, k: 0 } as any, // Rotation
      os: { a: 0, k: 0 } as any, // Outer roundness
      is: { a: 0, k: 0 } as any, // Inner roundness
      sy: 1 as any // Star type (1 = star, 2 = polygon)
    };
  }

  /**
   * Create a polygon shape
   */
  static polygon(
    name: string,
    points: number,
    radius: number,
    position: [number, number] = [0, 0]
  ): ShapeItem {
    return {
      ty: 'sr',
      nm: name,
      d: 1, // Direction
      p: { a: 0, k: position },
      or: { a: 0, k: radius } as any,
      pt: { a: 0, k: points } as any,
      r: { a: 0, k: 0 } as any, // Rotation
      os: { a: 0, k: 0 } as any, // Outer roundness
      sy: 2 as any // Polygon type
    };
  }

  /**
   * Helper to create a complete shape with fill and transform
   */
  static createFilledShape(
    shapeName: string,
    shape: ShapeItem,
    fillColor: [number, number, number],
    fillOpacity: number = 1
  ): ShapeItem {
    return ShapeBuilder.group(shapeName, [
      shape,
      ShapeBuilder.fill('Fill', fillColor, fillOpacity),
      ShapeBuilder.transform()
    ]);
  }

  /**
   * Helper to create a complete shape with stroke and transform
   */
  static createStrokedShape(
    shapeName: string,
    shape: ShapeItem,
    strokeColor: [number, number, number],
    strokeWidth: number,
    strokeOpacity: number = 1
  ): ShapeItem {
    return ShapeBuilder.group(shapeName, [
      shape,
      ShapeBuilder.stroke('Stroke', strokeColor, strokeWidth, strokeOpacity),
      ShapeBuilder.transform()
    ]);
  }

  /**
   * Helper to create a shape with both fill and stroke
   */
  static createFilledStrokedShape(
    shapeName: string,
    shape: ShapeItem,
    fillColor: [number, number, number],
    strokeColor: [number, number, number],
    strokeWidth: number,
    fillOpacity: number = 1,
    strokeOpacity: number = 1
  ): ShapeItem {
    return ShapeBuilder.group(shapeName, [
      shape,
      ShapeBuilder.fill('Fill', fillColor, fillOpacity),
      ShapeBuilder.stroke('Stroke', strokeColor, strokeWidth, strokeOpacity),
      ShapeBuilder.transform()
    ]);
  }
}
