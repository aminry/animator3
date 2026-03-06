import { LayerJSON, Transform, ShapeItem, TextData, Position2D, Scale2D } from './types';
import { Property } from './Property';

/**
 * Base class for all Lottie layers
 */
export abstract class Layer {
  protected index: number;
  protected name: string;
  protected inPoint: number;
  protected outPoint: number;
  protected startTime: number;
  protected parentIndex?: number;
  protected blendMode?: number;

  // Transform properties
  protected anchorPoint: Property<number[]>;
  protected position: Property<number[]>;
  protected scale: Property<number[]>;
  protected rotation: Property<number>;
  protected opacity: Property<number>;

  constructor(index: number, name: string, inPoint: number, outPoint: number) {
    this.index = index;
    this.name = name;
    this.inPoint = inPoint;
    this.outPoint = outPoint;
    this.startTime = 0;

    // Initialize default transform properties
    this.anchorPoint = new Property<number[]>([0, 0], 1);
    this.position = new Property<number[]>([0, 0], 2);
    this.scale = new Property<number[]>([100, 100], 3);
    this.rotation = new Property<number>(0, 4);
    this.opacity = new Property<number>(100, 5);
  }

  /**
   * Set the anchor point
   */
  setAnchorPoint(x: number, y: number): this {
    this.anchorPoint.setValue([x, y]);
    return this;
  }

  /**
   * Set the position
   */
  setPosition(x: number, y: number): this {
    this.position.setValue([x, y]);
    return this;
  }

  /**
   * Animate position
   */
  animatePosition(endTime: number, x: number, y: number, startTime: number = 0): this {
    this.position.animateTo(endTime, [x, y], startTime);
    return this;
  }

  /**
   * Set the scale
   */
  setScale(x: number, y: number): this {
    this.scale.setValue([x, y]);
    return this;
  }

  /**
   * Animate scale
   */
  animateScale(endTime: number, x: number, y: number, startTime: number = 0): this {
    this.scale.animateTo(endTime, [x, y], startTime);
    return this;
  }

  /**
   * Set the rotation (in degrees)
   */
  setRotation(degrees: number): this {
    this.rotation.setValue(degrees);
    return this;
  }

  /**
   * Animate rotation
   */
  animateRotation(endTime: number, degrees: number, startTime: number = 0): this {
    this.rotation.animateTo(endTime, degrees, startTime);
    return this;
  }

  /**
   * Set the opacity (0-100)
   */
  setOpacity(opacity: number): this {
    this.opacity.setValue(opacity);
    return this;
  }

  /**
   * Animate opacity
   */
  animateOpacity(endTime: number, opacity: number, startTime: number = 0): this {
    this.opacity.animateTo(endTime, opacity, startTime);
    return this;
  }

  /**
   * Set parent layer
   */
  setParent(parentIndex: number): this {
    this.parentIndex = parentIndex;
    return this;
  }

  /**
   * Set blend mode
   */
  setBlendMode(mode: number): this {
    this.blendMode = mode;
    return this;
  }

  /**
   * Get the transform object for JSON export
   */
  protected getTransform(): Transform {
    return {
      a: this.anchorPoint.toJSON(),
      p: this.position.toJSON(),
      s: this.scale.toJSON(),
      r: this.rotation.toJSON(),
      o: this.opacity.toJSON()
    };
  }

  getIndex(): number {
    return this.index;
  }

  /**
   * Get the layer type number
   */
  protected abstract getLayerType(): number;

  /**
   * Get layer-specific data for JSON export
   */
  protected abstract getLayerData(): Partial<LayerJSON>;

  /**
   * Export to Lottie JSON format
   */
  toJSON(): LayerJSON {
    const base: LayerJSON = {
      ddd: 0, // 2D layer
      ind: this.index,
      ty: this.getLayerType(),
      nm: this.name,
      sr: 1, // Time stretch
      ks: this.getTransform(),
      ao: 0, // Auto-orient
      ip: this.inPoint,
      op: this.outPoint,
      st: this.startTime,
      bm: this.blendMode || 0 // Blend mode (0 = normal)
    };

    if (this.parentIndex !== undefined) {
      base.parent = this.parentIndex;
    }

    return { ...base, ...this.getLayerData() };
  }
}

/**
 * Shape Layer - for vector shapes
 */
export class ShapeLayer extends Layer {
  private shapes: ShapeItem[] = [];

  constructor(index: number, name: string, inPoint: number, outPoint: number) {
    super(index, name, inPoint, outPoint);
  }

  /**
   * Add a shape item to this layer
   */
  addShape(shape: ShapeItem): this {
    this.shapes.push(shape);
    return this;
  }

  /**
   * Add multiple shapes
   */
  addShapes(shapes: ShapeItem[]): this {
    this.shapes.push(...shapes);
    return this;
  }

  animateFillColor(
    from: [number, number, number] | null,
    to: [number, number, number],
    startFrame: number,
    endFrame: number,
    easing?: any
  ): this {
    const group = this.shapes.find(shape => shape.ty === 'gr' && Array.isArray((shape as any).it));
    if (!group || !(group as any).it) {
      return this;
    }

    const items = (group as any).it as ShapeItem[];
    const fill = items.find(item => item.ty === 'fl');
    if (!fill) {
      return this;
    }

    let startColor: [number, number, number];
    if (from) {
      startColor = from;
    } else if ((fill as any).c && (fill as any).c.k !== undefined) {
      const k = (fill as any).c.k;
      if (Array.isArray(k)) {
        const first = k[0];
        if (typeof first === 'number' && k.length >= 3) {
          startColor = [k[0], k[1], k[2]];
        } else if (first && Array.isArray(first.s) && first.s.length >= 3) {
          startColor = [first.s[0], first.s[1], first.s[2]];
        } else {
          startColor = to;
        }
      } else {
        startColor = to;
      }
    } else {
      startColor = to;
    }

    const startValue = [startColor[0], startColor[1], startColor[2], 1];
    const endValue = [to[0], to[1], to[2], 1];
    const property = new Property<number[]>(startValue);

    if (easing) {
      property.animateToWithEasing(endFrame, endValue, startFrame, easing);
    } else {
      property.animateTo(endFrame, endValue, startFrame);
    }

    (fill as any).c = property.toJSON() as any;
    return this;
  }

  protected getLayerType(): number {
    return 4; // Shape layer
  }

  protected getLayerData(): Partial<LayerJSON> {
    // If shapes are not in a group, wrap them
    const shapesToExport = this.shapes.length > 0 && this.shapes[0].ty !== 'gr'
      ? [{
          ty: 'gr',
          nm: 'Shape Group',
          np: this.shapes.length,
          cix: 2,
          bm: 0,
          ix: 1,
          hd: false,
          it: this.shapes
        }]
      : this.shapes;

    return {
      shapes: shapesToExport
    };
  }
}

/**
 * Solid Layer - for solid color backgrounds
 */
export class SolidLayer extends Layer {
  private color: string;
  private width: number;
  private height: number;

  constructor(
    index: number,
    name: string,
    color: string,
    width: number,
    height: number,
    inPoint: number,
    outPoint: number
  ) {
    super(index, name, inPoint, outPoint);
    this.color = color;
    this.width = width;
    this.height = height;
    this.setAnchorPoint(width / 2, height / 2);
  }

  /**
   * Set the solid color (hex format)
   */
  setColor(color: string): this {
    this.color = color;
    return this;
  }

  protected getLayerType(): number {
    return 1; // Solid layer
  }

  protected getLayerData(): Partial<LayerJSON> {
    return {
      sc: this.color,
      sw: this.width,
      sh: this.height
    };
  }
}

/**
 * Text Layer - for text content
 */
export class TextLayer extends Layer {
  private textData: any; // relaxed type for internal structure

  constructor(
    index: number,
    name: string,
    text: string,
    fontSize: number,
    fontFamily: string,
    inPoint: number,
    outPoint: number
  ) {
    super(index, name, inPoint, outPoint);
    
    this.textData = {
      d: {
        k: [
          {
            s: {
              t: text.replace(/\n/g, '\r'),
              f: fontFamily,
              s: fontSize,
              fc: [0, 0, 0], // Default black
              j: 2, // Center aligned
              tr: 0, // Tracking
              lh: fontSize * 1.2, // Line height (approx 120%)
              ls: 0 // Baseline shift
            },
            t: 0
          }
        ]
      }
    };
  }

  /**
   * Set text content
   */
  setText(text: string): this {
    this.textData.d.k[0].s.t = text.replace(/\n/g, '\r');
    return this;
  }

  /**
   * Set font size
   */
  setFontSize(size: number): this {
    this.textData.d.k[0].s.s = size;
    this.textData.d.k[0].s.lh = size * 1.2;
    return this;
  }

  /**
   * Set text color
   */
  setColor(color: [number, number, number]): this {
    this.textData.d.k[0].s.fc = color;
    return this;
  }

  /**
   * Set justification
   * 0=left, 1=right, 2=center
   */
  setJustification(justification: number): this {
    this.textData.d.k[0].s.j = justification;
    return this;
  }

  /**
   * Set stroke color and width
   */
  setStroke(r: number, g: number, b: number, width: number): this {
    this.textData.d.k[0].s.sc = [r, g, b];
    this.textData.d.k[0].s.sw = width;
    return this;
  }

  getColor(): [number, number, number] {
    const first = this.textData.d.k[0];
    const fc = first?.s?.fc;
    if (Array.isArray(fc) && fc.length >= 3) {
      return [fc[0], fc[1], fc[2]];
    }
    return [0, 0, 0];
  }

  animateColor(
    from: [number, number, number],
    to: [number, number, number],
    startFrame: number,
    endFrame: number,
    _easing?: any
  ): this {
    const base = this.textData.d.k[0];
    const baseState = base.s;

    const startState = { ...baseState, fc: from };
    const endState = { ...baseState, fc: to };

    this.textData.d.k = [
      { s: startState, t: startFrame },
      { s: endState, t: endFrame }
    ];

    return this;
  }

  protected getLayerType(): number {
    return 5; // Text layer
  }

  protected getLayerData(): Partial<LayerJSON> {
    return {
      t: {
        d: this.textData.d,
        p: {}, // Path options
        m: {
          g: 1,
          a: { a: 0, k: [0, 0] }
        }, // More options (alignment)
        a: [] // Animators
      }
    };
  }
}

/**
 * Image Layer - for raster images
 */
export class ImageLayer extends Layer {
  private assetId: string;

  constructor(
    index: number,
    name: string,
    assetId: string,
    inPoint: number,
    outPoint: number
  ) {
    super(index, name, inPoint, outPoint);
    this.assetId = assetId;
  }

  /**
   * Set the asset reference ID
   */
  setAssetId(id: string): this {
    this.assetId = id;
    return this;
  }

  protected getLayerType(): number {
    return 2; // Image layer
  }

  protected getLayerData(): Partial<LayerJSON> {
    return {
      refId: this.assetId
    };
  }
}

/**
 * Null Layer - for parenting and organization
 */
export class NullLayer extends Layer {
  constructor(index: number, name: string, inPoint: number, outPoint: number) {
    super(index, name, inPoint, outPoint);
  }

  protected getLayerType(): number {
    return 3; // Null layer
  }

  protected getLayerData(): Partial<LayerJSON> {
    return {};
  }
}
