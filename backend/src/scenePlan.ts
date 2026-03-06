import type { ColorRGB, Position2D, Scale2D } from './types';

export type AnimationMode =
  | 'banner'
  | 'game-demo'
  | 'product-demo'
  | 'data-viz'
  | 'explainer'
  | 'loader/loop'
  | 'logo-sting'
  | 'character-moment'
  | string;

export type SceneObjectKind =
  | 'text'
  | 'shape'
  | 'character'
  | 'ui-element'
  | 'camera'
  | 'group'
  | string;

export type SceneShapeType =
  | 'rectangle'
  | 'roundedRectangle'
  | 'circle'
  | 'ellipse'
  | 'polygon'
  | 'star'
  | string;

export interface SceneKeyframe {
  t: number;
  position?: Position2D;
  scale?: Scale2D;
  rotation?: number;
  opacity?: number;
}

export interface SceneObjectStyle {
  fillColor?: ColorRGB;
  strokeColor?: ColorRGB;
  strokeWidth?: number;
  textColor?: ColorRGB;
  fontSize?: number;
}

export interface SceneObject {
  id: string;
  role: string;
  kind: SceneObjectKind;
  shapeType?: SceneShapeType;
  parentId?: string;
  followTargetId?: string;
  pathId?: string;
  initialPosition?: Position2D;
  initialScale?: Scale2D;
  initialRotation?: number;
  initialOpacity?: number;
  style?: SceneObjectStyle;
  keyframes: SceneKeyframe[];
}

export type ScenePathType = 'line' | 'arc' | 'circle' | 'bezier' | 'orbit' | string;

export interface ScenePath {
  id: string;
  type: ScenePathType;
  controlPoints: Position2D[];
}

export interface ScenePlan {
  durationSeconds: number;
  mode: AnimationMode;
  objects: SceneObject[];
  paths?: ScenePath[];
}
