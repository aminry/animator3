import type { ColorRGB, Position2D, Scale2D } from './types';

/**
 * Free-form string describing the animation's style or purpose.
 * No longer restricted to a fixed set of categories — any descriptive
 * string is valid (e.g. "abstract loop", "product reveal", "data story").
 */
export type AnimationMode = string;

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
  /** Optional free-form style hint from the LLM. Not used for routing. */
  mode?: AnimationMode;
  objects: SceneObject[];
  paths?: ScenePath[];
}
