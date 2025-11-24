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

async function testRenderFrames(port: number): Promise<void> {
  const lottiePath = path.join(process.cwd(), 'golden_tests', 'test2-animated-circle.json');

  if (!fs.existsSync(lottiePath)) {
    throw new Error(`Missing Lottie golden file at ${lottiePath}`);
  }

  const lottieJson = JSON.parse(fs.readFileSync(lottiePath, 'utf8'));

  const timestamps = [0, 1.5, 2.5];

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

  const outputDir = path.join(process.cwd(), 'output', 'renderer-e2e');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const goldenDir = path.join(process.cwd(), 'golden_tests');
  const pngSignatureHex = '89504e470d0a1a0a';

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
    if (!fs.existsSync(goldenPath)) {
      throw new Error(`Missing PNG golden file at ${goldenPath}`);
    }

    const goldenBuffer = fs.readFileSync(goldenPath);
    if (goldenBuffer.length !== buffer.length || !goldenBuffer.equals(buffer)) {
      throw new Error(`Rendered frame ${index} does not match golden PNG at ${goldenPath}`);
    }
  });

  if (images[0] === images[1] && images[1] === images[2]) {
    throw new Error('All rendered frames are identical; expected visual progression over time');
  }

  console.log('✓ Renderer PNG frames match golden files');
  console.log(`   Saved latest frames to: ${outputDir}`);
}

async function run(): Promise<void> {
  const port = 7090;
  const server = await createRendererServer({ port });

  console.log(`\n🎬 Running Renderer E2E tests against http://localhost:${port}/render-frames`);

  try {
    await testRenderFrames(port);

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
