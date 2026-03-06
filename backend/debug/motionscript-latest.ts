import { Stage } from '@motiongen/sdk';

const stage = Stage.create(800, 600, 3, 30);

const rect = stage.addShape('rectangle', {
  width: 120,
  height: 80,
  fillColor: [1, 0, 0],
});
rect.getLayer().setPosition(200, 150);

const circle = stage.addShape('circle', {
  radius: 40,
  fillColor: [0.2, 0.8, 1],
});
circle.getLayer().setPosition(500, 320);

export default stage.toJSON();