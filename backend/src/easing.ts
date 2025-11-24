import { BezierEasing } from './types';

export type CubicBezierDefinition = [number, number, number, number];

export interface LottieEasing {
  i: BezierEasing;
  o: BezierEasing;
}

export type NamedEasing = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';

function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

export function cubicBezierEasing(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): LottieEasing {
  const cx1 = clamp01(x1);
  const cx2 = clamp01(x2);

  return {
    o: { x: [cx1], y: [y1] },
    i: { x: [cx2], y: [y2] }
  };
}

export const StandardEasings: Record<NamedEasing, LottieEasing> = {
  linear: cubicBezierEasing(0, 0, 1, 1),
  easeIn: cubicBezierEasing(0.42, 0, 1, 1),
  easeOut: cubicBezierEasing(0, 0, 0.58, 1),
  easeInOut: cubicBezierEasing(0.42, 0, 0.58, 1)
};

export function getCubicBezierEasing(
  easing: NamedEasing | CubicBezierDefinition
): LottieEasing {
  if (Array.isArray(easing)) {
    const [x1, y1, x2, y2] = easing;
    return cubicBezierEasing(x1, y1, x2, y2);
  }

  return StandardEasings[easing] ?? StandardEasings.linear;
}
