/**
 * Core Lottie JSON type definitions based on the Bodymovin schema
 */

export interface LottieJSON {
  v: string; // Version
  fr: number; // Frame rate
  ip: number; // In point (start frame)
  op: number; // Out point (end frame)
  w: number; // Width
  h: number; // Height
  nm?: string; // Name
  ddd?: number; // 3D flag
  assets?: Asset[];
  layers: LayerJSON[];
  markers?: Marker[];
  fonts?: {
    list: Font[];
  };
}

export interface Font {
  fName: string;
  fFamily: string;
  fStyle: string;
  ascent: number;
  fPath?: string;
  fOrigin?: string;
}

export interface Asset {
  id: string;
  w?: number;
  h?: number;
  u?: string;
  p?: string;
  e?: number;
  layers?: LayerJSON[];
}

export interface Marker {
  tm: number; // Time
  cm: string; // Comment
  dr: number; // Duration
}

export interface LayerJSON {
  ddd?: number; // 3D flag
  ind: number; // Index
  ty: number; // Type (0=precomp, 1=solid, 2=image, 3=null, 4=shape, 5=text)
  nm: string; // Name
  sr?: number; // Time stretch
  ks: Transform; // Transform properties
  ao?: number; // Auto-orient
  ip: number; // In point
  op: number; // Out point
  st: number; // Start time
  bm?: number; // Blend mode
  parent?: number; // Parent layer index
  
  // Shape layer specific
  shapes?: ShapeItem[];
  
  // Text layer specific
  t?: TextData;
  
  // Solid layer specific
  sc?: string; // Solid color
  sw?: number; // Solid width
  sh?: number; // Solid height
  
  // Image layer specific
  refId?: string; // Reference to asset
}

export interface Transform {
  a?: Property<number[]>; // Anchor point
  p?: Property<number[]>; // Position
  s?: Property<number[]>; // Scale
  r?: Property<number>; // Rotation
  o?: Property<number>; // Opacity
  sk?: Property<number>; // Skew
  sa?: Property<number>; // Skew axis
}

export interface Property<T> {
  a: number; // Animated flag (0 = static, 1 = animated)
  k: T | Keyframe<T>[]; // Value or keyframes
  ix?: number; // Property index
}

export interface Keyframe<T> {
  t: number; // Time (frame)
  s: T; // Start value
  e?: T; // End value (for next keyframe)
  i?: BezierEasing; // In tangent
  o?: BezierEasing; // Out tangent
  h?: number; // Hold flag
}

export interface BezierEasing {
  x: number | number[]; // X coordinate(s)
  y: number | number[]; // Y coordinate(s)
}

export interface ShapeItem {
  ty: string; // Type (gr=group, rc=rect, el=ellipse, sr=star, fl=fill, st=stroke, tr=transform, etc.)
  nm?: string; // Name
  mn?: string; // Match name
  hd?: boolean; // Hidden
  bm?: number; // Blend mode
  ix?: number; // Index
  
  // Group specific
  it?: ShapeItem[]; // Items in group
  np?: number; // Number of properties
  cix?: number; // Property index
  
  // Rectangle/Ellipse specific
  d?: number; // Direction (for ellipses)
  s?: Property<number[]>; // Size
  p?: Property<number[]>; // Position
  r?: Property<number> | number; // Roundness (for rectangles) or rotation (for transforms) or fill rule
  
  // Star/Polygon specific
  or?: Property<number>; // Outer radius
  ir?: Property<number>; // Inner radius
  pt?: Property<number>; // Points
  sy?: number; // Star type (1=star, 2=polygon)
  os?: Property<number>; // Outer roundness
  is?: Property<number>; // Inner roundness
  
  // Fill specific
  c?: Property<number[]>; // Color (RGB 0-1)
  o?: Property<number>; // Opacity
  fillRule?: number; // Fill rule (avoiding 'r' conflict)
  
  // Stroke specific
  // c and o are reused
  w?: Property<number>; // Width
  lc?: number; // Line cap
  lj?: number; // Line join
  ml?: number; // Miter limit
  
  // Transform specific
  a?: Property<number[]>; // Anchor point
  // p, s, r, o are reused from above
  sk?: Property<number> | { a: number; k: number }; // Skew
  sa?: Property<number> | { a: number; k: number }; // Skew axis
}

export interface TextData {
  d: {
    k: TextDocument[];
  };
  p?: any; // More options
  m?: any; // More options
  a?: any[]; // Animators
}

export interface TextDocument {
  s: string; // Text
  f: string; // Font family
  sz: number; // Font size
  fc: number[]; // Fill color (RGB 0-1)
  sc?: number[]; // Stroke color
  sw?: number; // Stroke width
  j?: number; // Justification (0=left, 1=right, 2=center)
  tr?: number; // Tracking
  lh?: number; // Line height
  ls?: number; // Baseline shift
  t?: number; // Time
}

export type ColorRGB = [number, number, number];
export type ColorRGBA = [number, number, number, number];
export type Position2D = [number, number];
export type Position3D = [number, number, number];
export type Scale2D = [number, number];
export type Scale3D = [number, number, number];
