import puppeteer from 'puppeteer';
import { LottieJSON } from './types';

export interface RenderFramesOptions {
  width?: number;
  height?: number;
}

export async function renderFrames(
  lottieJson: LottieJSON,
  timestamps: number[],
  options: RenderFramesOptions = {}
): Promise<string[]> {
  if (!Array.isArray(timestamps) || timestamps.length === 0) {
    throw new Error('timestamps must be a non-empty array');
  }

  const width = options.width ?? (typeof lottieJson.w === 'number' ? lottieJson.w : 512);
  const height = options.height ?? (typeof lottieJson.h === 'number' ? lottieJson.h : 512);

  const browser = await puppeteer.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    html, body {
      margin: 0;
      padding: 0;
      background: transparent;
      overflow: hidden;
    }
    #container {
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
    }
    canvas {
      width: ${width}px !important;
      height: ${height}px !important;
    }
  </style>
</head>
<body>
  <div id="container"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js"></script>
  <script>
    globalThis.__lottieState = {
      ready: false,
      error: null,
      fps: 30
    };

    globalThis.__initLottie = function(animationData) {
      try {
        var container = document.getElementById('container');
        if (!container) {
          throw new Error('Missing #container element');
        }

        globalThis.__lottieState.fps =
          animationData && typeof animationData.fr === 'number'
            ? animationData.fr
            : 30;

        var anim = lottie.loadAnimation({
          container: container,
          renderer: 'canvas',
          loop: false,
          autoplay: false,
          animationData: animationData
        });

        globalThis.__anim = anim;

        anim.addEventListener('DOMLoaded', function() {
          globalThis.__lottieState.ready = true;
        });

        anim.addEventListener('data_failed', function() {
          globalThis.__lottieState.error = 'Lottie data failed to load';
        });
      } catch (err) {
        globalThis.__lottieState.error = err && err.message ? err.message : String(err);
      }
    };

    globalThis.__seekFrame = function(timeInSeconds) {
      if (!globalThis.__anim) return;
      var fps = globalThis.__lottieState.fps || 30;
      var frame = timeInSeconds * fps;
      globalThis.__anim.goToAndStop(frame, true);
    };
  </script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'networkidle0' });

    await page.evaluate((data: any) => {
      (globalThis as any).__initLottie(data);
    }, lottieJson as any);

    await page.waitForFunction(
      'globalThis.__lottieState && (globalThis.__lottieState.ready || globalThis.__lottieState.error)',
      { timeout: 10000 }
    );

    const state = await page.evaluate(() => (globalThis as any).__lottieState);
    if (state && state.error) {
      throw new Error('Failed to initialize Lottie: ' + state.error);
    }

    const images: string[] = [];

    for (const t of timestamps) {
      if (typeof t !== 'number' || !isFinite(t) || t < 0) {
        throw new Error('Each timestamp must be a non-negative finite number');
      }

      await page.evaluate((time: number) => {
        (globalThis as any).__seekFrame(time);
      }, t);

      await new Promise(resolve => setTimeout(resolve, 50));

      const buffer = (await page.screenshot({ type: 'png' })) as Buffer;
      images.push(buffer.toString('base64'));
    }

    return images;
  } finally {
    await browser.close();
  }
}
