import http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { createRendererServer } from '../rendererServer';

interface JsonResponse {
  status: number;
  json: any;
}

function postJson(port: number, requestPath: string, payload: any): Promise<JsonResponse> {
  const body = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: requestPath,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      },
      res => {
        let data = '';
        res.on('data', chunk => {
          data += chunk;
        });
        res.on('end', () => {
          let parsed: any;
          try {
            parsed = data ? JSON.parse(data) : {};
          } catch (error) {
            reject(new Error(`Failed to parse JSON response: ${error}`));
            return;
          }

          resolve({
            status: res.statusCode || 0,
            json: parsed
          });
        });
      }
    );

    req.on('error', error => {
      reject(error);
    });

    req.write(body);
    req.end();
  });
}

async function runVisualTest(port: number, testName: string, lottieFile: string, timestamps: number[], checkProgression = true): Promise<void> {
  console.log(`\n   🧪 Testing: ${testName} (${lottieFile})`);
  
  const lottiePath = path.join(process.cwd(), 'golden_tests', lottieFile);

  if (!fs.existsSync(lottiePath)) {
    throw new Error(`Missing Lottie golden file at ${lottiePath}`);
  }

  const lottieJson = JSON.parse(fs.readFileSync(lottiePath, 'utf8'));

  const response = await postJson(port, '/render-frames', {
    lottie_json: lottieJson,
    timestamps
  });

  if (response.status !== 200) {
    throw new Error(`Expected status 200 for render-frames, got ${response.status}`);
  }

  if (!response.json || !response.json.ok || !Array.isArray(response.json.images)) {
    throw new Error('Renderer did not return expected { ok: true, images: string[] } payload');
  }

  const images: string[] = response.json.images;

  if (images.length !== timestamps.length) {
    throw new Error(`Expected ${timestamps.length} images, got ${images.length}`);
  }

  const outputDir = path.join(process.cwd(), 'output', 'renderer-e2e', testName.replace(/\s+/g, '_'));
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const goldenDir = path.join(process.cwd(), 'golden_tests', 'renderer-e2e', testName.replace(/\s+/g, '_'));
  if (!fs.existsSync(goldenDir)) {
      fs.mkdirSync(goldenDir, { recursive: true });
  }

  const pngSignatureHex = '89504e470d0a1a0a';
  const updateGolden = process.env.UPDATE_GOLDEN === '1';

  images.forEach((b64, index) => {
    if (typeof b64 !== 'string' || !b64.length) {
      throw new Error(`Image at index ${index} is not a non-empty base64 string`);
    }

    const buffer = Buffer.from(b64, 'base64');
    if (buffer.length < 8) {
      throw new Error(`Decoded PNG at index ${index} is too short`);
    }

    const signature = buffer.slice(0, 8).toString('hex');
    if (signature !== pngSignatureHex) {
      throw new Error(`Decoded image at index ${index} does not have a valid PNG signature`);
    }

    const outputPath = path.join(outputDir, `frame-${index}.png`);
    fs.writeFileSync(outputPath, buffer);

    const goldenPath = path.join(goldenDir, `frame-${index}.png`);
    
    if (updateGolden) {
      fs.writeFileSync(goldenPath, buffer);
      console.log(`      ⚠ Updated golden file: ${goldenPath}`);
    }

    if (!fs.existsSync(goldenPath)) {
      // Auto-create golden if missing and we just ran successfully (first run behavior)
      // Actually, if UPDATE_GOLDEN is not set, we should fail.
      // But for new test, let's warn.
      throw new Error(`Missing PNG golden file at ${goldenPath} (run with UPDATE_GOLDEN=1 to create)`);
    }

    const goldenBuffer = fs.readFileSync(goldenPath);
    if (goldenBuffer.length !== buffer.length || !goldenBuffer.equals(buffer)) {
      throw new Error(`Rendered frame ${index} does not match golden PNG at ${goldenPath} (run with UPDATE_GOLDEN=1 to update)`);
    }
  });

  if (checkProgression && images.length > 1) {
    // Check if all frames are identical
    const allIdentical = images.every((img, i, arr) => i === 0 || img === arr[0]);
    if (allIdentical) {
        throw new Error('All rendered frames are identical; expected visual progression over time');
    }
  }

  console.log('      ✓ Frames match golden files');
}

async function run(): Promise<void> {
  const port = 7090;
  const server = await createRendererServer({ port });

  console.log(`\n🎬 Running Renderer E2E tests against http://localhost:${port}/render-frames`);

  try {
    // Existing test (circle)
    await runVisualTest(port, 'Animated Circle', 'test2-animated-circle.json', [0, 1.5, 2.5]);
    
    // New test (text)
    await runVisualTest(port, 'Text Layer', 'test13-text-layer.json', [0]);
    await runVisualTest(port, 'MotionScript All Shapes', 'test24-motionscript-all-shapes.json', [0]);

    console.log('\n✅ Renderer E2E test passed');
  } catch (error) {
    console.error('\n❌ Renderer E2E test failed:', error);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

run().catch(error => {
  console.error('Unexpected error while running renderer E2E tests:', error);
  process.exitCode = 1;
});
