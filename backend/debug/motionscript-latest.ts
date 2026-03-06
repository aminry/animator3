import { Stage, Motion } from '@motiongen/sdk';

const width = 800;
const height = 600;
const duration = 1.0; // slightly above max keyframe time
const fps = 30;

function normX(x: number) {
  return x * width;
}
function normY(y: number) {
  return y * height;
}

const stage = Stage.create(width, height, duration, fps);

// Background panel (base-background)
const bgPanel = stage.addShape('rectangle', {
  width,
  height,
  fillColor: [0.04, 0.12, 0.27] // approximates #0A1F44
});
bgPanel.animate({
  props: {
    opacity: { from: 0, to: 100 }
  },
  time: { start: 0, end: 0.8 },
  easing: 'easeIn'
});

// Title text (headline)
const titleText = stage.addText('Ping Pong Demo', {
  fontSize: 84,
  fontFamily: 'Arial',
  color: [1, 1, 1],
  strokeColor: [0, 0, 0],
  strokeWidth: 2,
  justification: 2
});
titleText.animate({
  props: {
    position: {
      from: [width / 2, -100],
      to: [width / 2, height * 0.2]
    },
    opacity: { from: 0, to: 100 }
  },
  time: { start: 0.3, end: 0.5 },
  spring: Motion.spring({ stiffness: 250, damping: 15 })
});

// Playing surface (table)
const table = stage.addShape('rectangle', {
  width: width * 0.8,
  height: height * 0.2,
  fillColor: [0.1, 0.1, 0.1],
  strokeWidth: 4
});
table.animate({
  props: {
    position: { from: [width / 2, height * 0.6], to: [width / 2, height * 0.6] },
    opacity: { from: 0, to: 100 }
  },
  time: { start: 0, end: 0 }
});

// Left paddle
const paddleLeft = stage.addShape('rectangle', {
  width: 20,
  height: 100,
  fillColor: [0, 0.76, 0.83] // approximates #00C1D4
});
paddleLeft.animate({
  props: {
    position: {
      from: [-20, height * 0.5],
      to: [width * 0.1, height * 0.5]
    },
    opacity: { from: 0, to: 100 }
  },
  time: { start: 0.8, end: 1.5 },
  spring: Motion.spring({ stiffness: 200, damping: 20 })
});

// Right paddle
const paddleRight = stage.addShape('rectangle', {
  width: 20,
  height: 100,
  fillColor: [0, 0.76, 0.83]
});
paddleRight.animate({
  props: {
    position: {
      from: [width + 20, height * 0.5],
      to: [width * 0.9, height * 0.5]
    },
    opacity: { from: 0, to: 100 }
  },
  time: { start: 0.8, end: 1.5 },
  spring: Motion.spring({ stiffness: 200, damping: 20 })
});

// Ping‑pong ball
const ball = stage.addShape('circle', {
  radius: 12,
  fillColor: [1, 0.435, 0] // approximates #FF6F00
});
ball.animate({
  props: {
    position: {
      from: [normX(0.4), normY(0.6)],
      to: [normX(0.45), normY(0.7)]
    },
    opacity: { from: 0, to: 100 },
    scale: { from: [0, 0], to: [100, 100] }
  },
  time: { start: 0.75, end: 0.825 },
  spring: Motion.spring({ stiffness: 260, damping: 12 })
});
ball.animate({
  props: {
    position: {
      from: [normX(0.45), normY(0.7)],
      to: [normX(0.5), normY(0.5)]
    }
  },
  time: { start: 0.825, end: 0.9 },
  spring: Motion.spring({ stiffness: 260, damping: 12 })
});

// Background overlay (dark blue)
const bgOverlay = stage.addShape('rectangle', {
  width,
  height,
  fillColor: [0, 0, 0.8]
});
bgOverlay.animate({
  props: {
    opacity: { from: 0, to: 100 }
  },
  time: { start: 0, end: 0.9 }
});

// "Ready to Play?" text (enhanced contrast & size)
const readyText = stage.addText('Ready to Play?', {
  fontSize: 96,
  fontFamily: 'Arial',
  color: [1, 1, 1],
  strokeColor: [0, 0, 0],
  strokeWidth: 2,
  justification: 2
});
readyText.animate({
  props: {
    position: {
      from: [width / 2, height + 100],
      to: [width / 2, height * 0.65]
    },
    opacity: { from: 0, to: 100 },
    scale: { from: [90, 90], to: [100, 100] }
  },
  time: { start: 0.85, end: 0.95 },
  spring: Motion.spring({ stiffness: 250, damping: 15 })
});

// Accent sparkle (original)
const sparkle1 = stage.addShape('circle', {
  radius: 8,
  fillColor: [1, 1, 0.5]
});
sparkle1.animate({
  props: {
    position: { from: [normX(0.45), normY(0.65)], to: [normX(0.45), normY(0.65)] },
    scale: { from: [0, 0], to: [50, 50] },
    opacity: { from: 0, to: 100 }
  },
  time: { start: 0.78, end: 0.8 }
});
sparkle1.animate({
  props: {
    scale: { from: [50, 50], to: [80, 80] },
    opacity: { from: 100, to: 0 }
  },
  time: { start: 0.8, end: 0.85 }
});

// Additional sparkles for impact (midground accent)
const sparkle2 = stage.addShape('circle', {
  radius: 6,
  fillColor: [1, 1, 0.5]
});
const sparkle3 = stage.addShape('circle', {
  radius: 6,
  fillColor: [1, 1, 0.5]
});
const sparkles = [sparkle2, sparkle3];
sparkle2.animate({
  props: {
    position: { from: [normX(0.48), normY(0.55)], to: [normX(0.48), normY(0.55)] },
    scale: { from: [0, 0], to: [60, 60] },
    opacity: { from: 0, to: 100 }
  },
  time: { start: 0.78, end: 0.8 }
});
sparkle3.animate({
  props: {
    position: { from: [normX(0.52), normY(0.45)], to: [normX(0.52), normY(0.45)] },
    scale: { from: [0, 0], to: [60, 60] },
    opacity: { from: 0, to: 100 }
  },
  time: { start: 0.78, end: 0.8 }
});
sparkle2.animate({
  props: {
    scale: { from: [60, 60], to: [0, 0] },
    opacity: { from: 100, to: 0 }
  },
  time: { start: 0.8, end: 0.85 }
});
sparkle3.animate({
  props: {
    scale: { from: [60, 60], to: [0, 0] },
    opacity: { from: 100, to: 0 }
  },
  time: { start: 0.8, end: 0.85 }
});

// Staggered group for the three sparkles (including original)
const sparkleGroup = stage.createGroup();
sparkleGroup.stagger(
  [sparkle1, sparkle2, sparkle3],
  {
    props: {
      opacity: { from: 0, to: 100 }
    },
    delay: 0
  },
  { delay: 0.02 }
);

// Net (midground accent)
const net = stage.addShape('rectangle', {
  width: width * 0.8,
  height: 4,
  fillColor: [1, 1, 1]
});
net.animate({
  props: {
    position: { from: [width / 2, height * 0.5], to: [width / 2, height * 0.5] },
    opacity: { from: 0, to: 100 }
  },
  time: { start: 0.5, end: 0.7 },
  spring: Motion.spring({ stiffness: 180, damping: 18 })
});

export default stage.toJSON();