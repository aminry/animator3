import puppeteer from 'puppeteer';
import type { LottieJSON } from './types';
import { debugLog } from './logger';

export interface BrowserRenderFramesOptions {
  width?: number;
  height?: number;
}

export async function renderFramesWithBrowser(
  lottieJson: LottieJSON,
  timestamps: number[],
  options: BrowserRenderFramesOptions = {}
): Promise<string[]> {
  if (!Array.isArray(timestamps) || timestamps.length === 0) {
    throw new Error('timestamps must be a non-empty array');
  }

  const width =
    options.width ?? (typeof (lottieJson as any).w === 'number' ? (lottieJson as any).w : 512);
  const height =
    options.height ?? (typeof (lottieJson as any).h === 'number' ? (lottieJson as any).h : 512);

  const browser = await puppeteer.launch({
    headless: 'new',
    timeout: 60000,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });

    const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: transparent;
      }
      #container {
        width: 100%;
        height: 100%;
      }
    </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js"></script>
  </head>
  <body>
    <div id="container"></div>
  </body>
</html>`;

    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Wait for lottie-web to be available
    await page.waitForFunction('window.lottie && !!window.lottie.loadAnimation');

    // Initialize the animation in the page
    await page.evaluate((animationData: any) => {
      const anyWindow: any = (globalThis as any).window;
      const doc: any = (globalThis as any).document;
      if (!anyWindow || !doc) return;

      const container = doc.getElementById('container');
      if (!container) return;

      const anim = anyWindow.lottie.loadAnimation({
        container,
        renderer: 'svg',
        loop: false,
        autoplay: false,
        animationData,
        rendererSettings: {
          clearCanvas: true
        }
      });

      anyWindow.__lottieAnimation = anim;
      anyWindow.__lottieData = animationData;
    }, lottieJson as any);

    // Wait until the animation is fully loaded
    await page.evaluate(() => {
      const anyWindow: any = (globalThis as any).window;
      if (!anyWindow) return;
      const anim = anyWindow.__lottieAnimation;
      if (!anim) return;
      return new Promise<void>((resolve) => {
        if (anim.isLoaded) {
          resolve();
          return;
        }
        anim.addEventListener('DOMLoaded', () => resolve());
      });
    });

    const images: string[] = [];

    for (const t of timestamps) {
      if (typeof t !== 'number' || !isFinite(t) || t < 0) {
        throw new Error('Each timestamp must be a non-negative finite number');
      }

      await page.evaluate((time: number) => {
        const anyWindow: any = (globalThis as any).window;
        if (!anyWindow) return;

        const anim = anyWindow.__lottieAnimation;
        const data = anyWindow.__lottieData || {};
        const fr = typeof data.fr === 'number' ? data.fr : 30;
        const ip = typeof data.ip === 'number' ? data.ip : 0;
        const op = typeof data.op === 'number' ? data.op : ip + fr * 3;
        const maxFrame = op - 1;

        let frame = Math.round(ip + time * fr);
        if (frame > maxFrame) frame = maxFrame;

        anim.goToAndStop(frame, true);
      }, t);

      const b64 = (await page.screenshot({
        encoding: 'base64',
        clip: { x: 0, y: 0, width, height }
      })) as string;

      images.push(b64);
    }

    debugLog('renderer:browser', 'Rendered frames via headless browser', {
      count: images.length
    });

    return images;
  } finally {
    await browser.close();
  }
}
