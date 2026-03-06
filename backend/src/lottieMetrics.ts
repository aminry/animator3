import type { LottieJSON, LayerJSON, ShapeItem, Property as LottieProperty } from "./types";
import type { LottieMetricsSummary } from "./sharedApiTypes";

export type LottieMetrics = LottieMetricsSummary;

function isProperty(value: any): value is LottieProperty<any> {
  return Boolean(value) && typeof value === "object" && typeof value.a === "number" && "k" in value;
}

function accumulateFromProperty(value: any, totals: { animated: number; keyframes: number }): void {
  if (!isProperty(value)) {
    return;
  }

  if (value.a !== 1 || !Array.isArray(value.k)) {
    return;
  }

  totals.animated += 1;
  totals.keyframes += value.k.length;
}

function accumulateFromShapeItem(item: ShapeItem, totals: { animated: number; keyframes: number }): void {
  if (!item || typeof item !== "object") {
    return;
  }

  const anyItem: any = item as any;

  accumulateFromProperty(anyItem.p, totals);
  accumulateFromProperty(anyItem.s, totals);
  accumulateFromProperty(anyItem.r, totals);
  accumulateFromProperty(anyItem.o, totals);
  accumulateFromProperty(anyItem.a, totals);
  accumulateFromProperty(anyItem.sk, totals);
  accumulateFromProperty(anyItem.sa, totals);
  accumulateFromProperty(anyItem.c, totals);
  accumulateFromProperty(anyItem.w, totals);

  if (Array.isArray(anyItem.it)) {
    for (const child of anyItem.it) {
      accumulateFromShapeItem(child, totals);
    }
  }
}

function accumulateFromLayer(layer: LayerJSON, totals: { animated: number; keyframes: number }): void {
  const anyLayer: any = layer as any;
  const ks: any = anyLayer.ks;

  if (ks && typeof ks === "object") {
    accumulateFromProperty(ks.a, totals);
    accumulateFromProperty(ks.p, totals);
    accumulateFromProperty(ks.s, totals);
    accumulateFromProperty(ks.r, totals);
    accumulateFromProperty(ks.o, totals);
    accumulateFromProperty(ks.sk, totals);
    accumulateFromProperty(ks.sa, totals);
  }

  if (Array.isArray(anyLayer.shapes)) {
    for (const shape of anyLayer.shapes as ShapeItem[]) {
      accumulateFromShapeItem(shape, totals);
    }
  }
}

export function computeLottieMetrics(lottie: LottieJSON): LottieMetrics {
  const layers = Array.isArray(lottie.layers) ? lottie.layers : [];

  let textLayerCount = 0;
  let shapeLayerCount = 0;
  let solidLayerCount = 0;
  let imageLayerCount = 0;

  const totals = { animated: 0, keyframes: 0 };

  for (const layer of layers) {
    if (!layer) {
      continue;
    }

    if (layer.ty === 5) {
      textLayerCount += 1;
    } else if (layer.ty === 4) {
      shapeLayerCount += 1;
    } else if (layer.ty === 1) {
      solidLayerCount += 1;
    } else if (layer.ty === 2) {
      imageLayerCount += 1;
    }

    accumulateFromLayer(layer, totals);
  }

  const animatedPropertyCount = totals.animated;
  const averageKeyframesPerAnimatedProperty = animatedPropertyCount > 0 ? totals.keyframes / animatedPropertyCount : 0;

  return {
    layerCount: layers.length,
    textLayerCount,
    shapeLayerCount,
    solidLayerCount,
    imageLayerCount,
    animatedPropertyCount,
    averageKeyframesPerAnimatedProperty,
  };
}
