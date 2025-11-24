export interface SpringPhysicsConfig {
  stiffness: number;
  damping: number;
  mass?: number;
  initialVelocity?: number;
  precision?: number;
  maxDuration?: number;
}

export interface TimeValuePair<T> {
  time: number;
  value: T;
}

function hasValidDuration(fps: number, maxDuration: number): boolean {
  return fps > 0 && maxDuration > 0;
}

function createFallbackKeyframes(start: number, end: number, fps: number): TimeValuePair<number>[] {
  const durationSeconds = 1;
  const totalFrames = fps > 0 ? Math.max(1, Math.round(durationSeconds * fps)) : 1;

  return [
    { time: 0, value: start },
    { time: totalFrames / Math.max(fps, 1), value: end }
  ];
}

export function generateKeyframes(
  start: number,
  end: number,
  physicsConfig: SpringPhysicsConfig,
  fps: number
): TimeValuePair<number>[] {
  const mass = physicsConfig.mass ?? 1;
  const stiffness = physicsConfig.stiffness;
  const damping = physicsConfig.damping;
  const initialVelocity = physicsConfig.initialVelocity ?? 0;
  const maxDuration = physicsConfig.maxDuration ?? 3;
  const precision = physicsConfig.precision ?? Math.abs(end - start) * 0.001;

  if (!hasValidDuration(fps, maxDuration) || mass <= 0 || stiffness <= 0) {
    return createFallbackKeyframes(start, end, fps);
  }

  if (Math.abs(end - start) < 1e-8 && Math.abs(initialVelocity) < 1e-8) {
    return [{ time: 0, value: end }];
  }

  const naturalFrequency = Math.sqrt(stiffness / mass);
  const dampingRatio = damping / (2 * Math.sqrt(stiffness * mass));

  const initialDisplacement = start - end;

  function positionAtTime(t: number): number {
    if (t <= 0) {
      return start;
    }

    if (dampingRatio < 1) {
      const dampedFrequency = naturalFrequency * Math.sqrt(1 - dampingRatio * dampingRatio);
      const coefficientA = initialDisplacement;
      const coefficientB = (initialVelocity + dampingRatio * naturalFrequency * initialDisplacement) / dampedFrequency;
      const envelope = Math.exp(-dampingRatio * naturalFrequency * t);
      const displacement = envelope * (coefficientA * Math.cos(dampedFrequency * t) + coefficientB * Math.sin(dampedFrequency * t));
      return end + displacement;
    }

    if (Math.abs(dampingRatio - 1) < 1e-6) {
      const coefficientA = initialDisplacement;
      const coefficientB = initialVelocity + naturalFrequency * initialDisplacement;
      const envelope = Math.exp(-naturalFrequency * t);
      const displacement = envelope * (coefficientA + coefficientB * t);
      return end + displacement;
    }

    const sqrtTerm = Math.sqrt(dampingRatio * dampingRatio - 1);
    const r1 = -naturalFrequency * (dampingRatio - sqrtTerm);
    const r2 = -naturalFrequency * (dampingRatio + sqrtTerm);
    const coefficientB = (initialVelocity - r1 * initialDisplacement) / (r2 - r1);
    const coefficientA = initialDisplacement - coefficientB;
    const displacement = coefficientA * Math.exp(r1 * t) + coefficientB * Math.exp(r2 * t);
    return end + displacement;
  }

  const keyframes: TimeValuePair<number>[] = [];
  const totalFrames = Math.max(1, Math.ceil(maxDuration * fps));

  for (let frame = 0; frame <= totalFrames; frame++) {
    const time = frame / fps;
    const value = positionAtTime(time);
    keyframes.push({ time, value });

    if (frame === 0) {
      continue;
    }

    const previous = keyframes[frame - 1];
    const velocityApprox = (value - previous.value) * fps;
    const displacement = value - end;

    if (Math.abs(displacement) <= precision && Math.abs(velocityApprox) <= precision) {
      break;
    }
  }

  const last = keyframes[keyframes.length - 1];
  keyframes[keyframes.length - 1] = { time: last.time, value: end };

  if (keyframes.length === 1 && keyframes[0].value !== end) {
    keyframes.push({ time: maxDuration, value: end });
  }

  return keyframes;
}
