import { LottieJSON, Asset, Marker } from './types';
import { Layer } from './Layer';

/**
 * Main Animation class - represents a complete Lottie animation
 */
export class Animation {
  private version: string = '5.7.4';
  private frameRate: number;
  private inPoint: number;
  private outPoint: number;
  private width: number;
  private height: number;
  private name?: string;
  private layers: Layer[] = [];
  private assets: Asset[] = [];
  private markers: Marker[] = [];
  private is3D: boolean = false;

  constructor(
    width: number,
    height: number,
    frameRate: number = 30,
    duration: number = 3
  ) {
    this.width = width;
    this.height = height;
    this.frameRate = frameRate;
    this.inPoint = 0;
    this.outPoint = duration * frameRate;
  }

  /**
   * Set the animation name
   */
  setName(name: string): this {
    this.name = name;
    return this;
  }

  /**
   * Set the frame rate
   */
  setFrameRate(fps: number): this {
    this.frameRate = fps;
    // Recalculate out point based on current duration
    const duration = this.outPoint / this.frameRate;
    this.outPoint = duration * fps;
    return this;
  }

  /**
   * Set the duration in seconds
   */
  setDuration(seconds: number): this {
    this.outPoint = seconds * this.frameRate;
    return this;
  }

  /**
   * Get the duration in seconds
   */
  getDuration(): number {
    return this.outPoint / this.frameRate;
  }

  /**
   * Set the canvas size
   */
  setSize(width: number, height: number): this {
    this.width = width;
    this.height = height;
    return this;
  }

  /**
   * Enable 3D mode
   */
  set3D(enabled: boolean): this {
    this.is3D = enabled;
    return this;
  }

  /**
   * Add a layer to the animation
   */
  addLayer(layer: Layer): this {
    this.layers.push(layer);
    return this;
  }

  /**
   * Add multiple layers
   */
  addLayers(layers: Layer[]): this {
    this.layers.push(...layers);
    return this;
  }

  /**
   * Get all layers
   */
  getLayers(): Layer[] {
    return this.layers;
  }

  /**
   * Add an asset (for images, precomps, etc.)
   */
  addAsset(asset: Asset): this {
    this.assets.push(asset);
    return this;
  }

  /**
   * Add a marker
   */
  addMarker(time: number, comment: string, duration: number = 0): this {
    this.markers.push({
      tm: time,
      cm: comment,
      dr: duration
    });
    return this;
  }

  /**
   * Convert time in seconds to frame number
   */
  timeToFrame(seconds: number): number {
    return seconds * this.frameRate;
  }

  /**
   * Convert frame number to time in seconds
   */
  frameToTime(frame: number): number {
    return frame / this.frameRate;
  }

  /**
   * Export to Lottie JSON format
   */
  toJSON(): LottieJSON {
    const layersJSON = this.layers
      .slice()
      .sort((a, b) => b.getIndex() - a.getIndex())
      .map(layer => layer.toJSON());
    const hasTextLayer = layersJSON.some(l => l.ty === 5);

    const json: LottieJSON = {
      v: this.version,
      fr: this.frameRate,
      ip: this.inPoint,
      op: this.outPoint,
      w: this.width,
      h: this.height,
      layers: layersJSON
    };

    if (hasTextLayer) {
      json.fonts = {
        list: [
          {
            fName: "Arial",
            fFamily: "Arial",
            fStyle: "Regular",
            ascent: 71.6,
            fPath: "",
            fOrigin: "p"
          }
        ]
      };
    }

    if (this.name) {
      json.nm = this.name;
    }

    if (this.is3D) {
      json.ddd = 1;
    }

    if (this.assets.length > 0) {
      json.assets = this.assets;
    }

    if (this.markers.length > 0) {
      json.markers = this.markers;
    }

    return json;
  }

  /**
   * Export to JSON string
   */
  toString(pretty: boolean = false): string {
    return JSON.stringify(this.toJSON(), null, pretty ? 2 : 0);
  }

  /**
   * Create a simple animation helper
   */
  static create(
    width: number = 512,
    height: number = 512,
    duration: number = 3,
    fps: number = 30
  ): Animation {
    return new Animation(width, height, fps, duration);
  }
}
