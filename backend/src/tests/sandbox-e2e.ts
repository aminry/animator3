import http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { createSandboxServer } from '../sandboxServer';
import type { ScenePlan } from '../scenePlan';
import { validateScenePlanAgainstLottie } from '../sceneValidation';

interface HttpResponse {
  status: number;
  body: string;
}

interface JsonResponse {
  status: number;
  json: any;
}

const GOLDEN_DIR = path.join(process.cwd(), 'golden_tests');
const UPDATE_GOLDEN = process.env.UPDATE_GOLDEN === '1';

function ensureDirExists(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function assertMatchesGolden(json: unknown, filename: string): void {
  ensureDirExists(GOLDEN_DIR);

  const goldenPath = path.join(GOLDEN_DIR, filename);
  const jsonString = JSON.stringify(json, null, 2);

  if (!fs.existsSync(goldenPath)) {
    if (UPDATE_GOLDEN) {
      fs.writeFileSync(goldenPath, jsonString);
      // eslint-disable-next-line no-console
      console.log(`⚠ Created new sandbox golden: ${filename}`);
      return;
    }

    throw new Error(
      `Sandbox golden file missing: ${filename}. Run with UPDATE_GOLDEN=1 to create or update sandbox goldens.`
    );
  }

  const goldenString = fs.readFileSync(goldenPath, 'utf8');

  if (goldenString !== jsonString) {
    if (UPDATE_GOLDEN) {
      fs.writeFileSync(goldenPath, jsonString);
      // eslint-disable-next-line no-console
      console.warn(`⚠ Updated sandbox golden: ${filename}`);
      return;
    }

    throw new Error(`Sandbox golden mismatch for ${filename}`);
  }

  // eslint-disable-next-line no-console
  console.log(`✓ Sandbox Lottie JSON matches golden: ${filename}`);
}

function postJson(port: number, path: string, payload: any): Promise<JsonResponse> {
  const body = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
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

async function testSuccessfulExecution(port: number): Promise<void> {
  const code = `
    import { Stage } from '@motiongen/sdk';

    const stage = new Stage(512, 512, 3, 30);
    stage.addShape('rectangle', { fillColor: [1, 0, 0], width: 100, height: 100 });

    export default stage.toJSON();
  `;

  const response = await postJson(port, '/sandbox/execute', { code });

  if (response.status !== 200) {
    throw new Error(`Expected status 200 for successful script, got ${response.status}`);
  }

  if (!response.json || !response.json.ok || typeof response.json.lottie !== 'object') {
    throw new Error('Sandbox did not return expected Lottie JSON structure');
  }

  if (!Array.isArray(response.json.lottie.layers)) {
    throw new Error('Lottie JSON is missing layers array');
  }

  assertMatchesGolden(response.json.lottie, 'sandbox-e2e-lottie.json');

  console.log('✓ Successful execution returned Lottie JSON and matched golden');
}

async function testTimeout(port: number): Promise<void> {
  const code = `
    while (true) {}
  `;

  const response = await postJson(port, '/sandbox/execute', { code });

  if (response.status !== 408) {
    throw new Error(`Expected status 408 for timeout script, got ${response.status}`);
  }

  if (!response.json || response.json.errorType !== 'timeout') {
    throw new Error('Timeout script did not return a timeout errorType');
  }

  console.log('✓ Infinite loop script returned 408 Timeout');
}

async function testCompileError(port: number): Promise<void> {
  const code = `
    const value = ;
  `;

  const response = await postJson(port, '/sandbox/execute', { code });

  if (response.status !== 400) {
    throw new Error(`Expected status 400 for compile error script, got ${response.status}`);
  }

  if (!response.json || response.json.errorType !== 'compile') {
    throw new Error('Compile error script did not return a compile errorType');
  }

  console.log('✓ Compile error script returned 400 with compile errorType');
}

async function testRuntimeError(port: number): Promise<void> {
  const code = `
    throw new Error('boom');
  `;

  const response = await postJson(port, '/sandbox/execute', { code });

  if (response.status !== 500) {
    throw new Error(`Expected status 500 for runtime error script, got ${response.status}`);
  }

  if (!response.json || response.json.errorType !== 'runtime') {
    throw new Error('Runtime error script did not return a runtime errorType');
  }

  console.log('✓ Runtime error script returned 500 with runtime errorType');
}

async function testAdditionalShapes(port: number): Promise<void> {
  const code = `
import { Stage } from '@motiongen/sdk';

const stage = Stage.create(800, 600, 3, 30);

const rect = stage.addShape('rectangle', {
  width: 120,
  height: 80,
  fillColor: [1, 0, 0]
});
rect.getLayer().setPosition(200, 150);

const rounded = stage.addShape('roundedRectangle', {
  width: 140,
  height: 90,
  cornerRadius: 24,
  fillColor: [0, 1, 0]
});
rounded.getLayer().setPosition(600, 150);

const ellipse = stage.addShape('ellipse', {
  radiusX: 80,
  radiusY: 40,
  fillColor: [0, 0.6, 1]
});
ellipse.getLayer().setPosition(200, 300);

const polygon = stage.addShape('polygon', {
  points: 6,
  radius: 60,
  fillColor: [1, 0.5, 0]
});
polygon.getLayer().setPosition(600, 300);

const star = stage.addShape('star', {
  points: 5,
  outerRadius: 70,
  innerRadius: 35,
  fillColor: [1, 0.84, 0]
});
star.getLayer().setPosition(400, 450);

const circle = stage.addShape('circle', {
  radius: 40,
  fillColor: [0.2, 0.9, 0.9]
});
circle.getLayer().setPosition(400, 300);

export default stage.toJSON();
  `;

  const response = await postJson(port, '/sandbox/execute', { code });

  if (response.status !== 200) {
    throw new Error(`Expected status 200 for successful script, got ${response.status}`);
  }

  if (!response.json || !response.json.ok || typeof response.json.lottie !== 'object') {
    throw new Error('Sandbox did not return expected Lottie JSON structure for additional shapes');
  }

  assertMatchesGolden(response.json.lottie, 'sandbox-e2e-additional-shapes.json');

  console.log('✓ Additional shapes script returned Lottie JSON and matched golden');
}

async function testScenePlanValidationOnSandboxGolden(port: number): Promise<void> {
  const goldenPath = path.join(GOLDEN_DIR, 'sandbox-e2e-lottie.json');

  if (!fs.existsSync(goldenPath)) {
    throw new Error(`Missing sandbox Lottie golden at ${goldenPath}`);
  }

  const lottieJson = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));

  const scenePlan: ScenePlan = {
    durationSeconds: 3,
    mode: 'banner',
    objects: [
      {
        id: 'rect',
        role: 'main-rectangle',
        kind: 'shape',
        keyframes: [
          { t: 0, position: [256, 256] },
          { t: 3, position: [256, 256] }
        ]
      }
    ]
  };

  const validation = validateScenePlanAgainstLottie(scenePlan, lottieJson);

  if (!validation) {
    throw new Error('Expected validation summary for sandbox Lottie and ScenePlan');
  }

  if (!validation.ok) {
    throw new Error(
      `Expected validation.ok to be true for sandbox golden; issues: ${validation.issues
        .map(issue => `${issue.type}:${issue.severity}`)
        .join(', ')}`
    );
  }

  assertMatchesGolden(validation, 'sandbox-e2e-scene-validation.json');

  console.log('✓ ScenePlan validation summary matches golden for sandbox Lottie');
}

async function run(): Promise<void> {
  const port = 7080;
  const server = await createSandboxServer({ port });

  console.log(`\n🎬 Running Sandbox E2E tests against http://localhost:${port}/sandbox/execute`);

  try {
    await testSuccessfulExecution(port);
    await testScenePlanValidationOnSandboxGolden(port);
    await testAdditionalShapes(port);
    await testTimeout(port);
    await testCompileError(port);
    await testRuntimeError(port);

    console.log('\n✅ All sandbox E2E tests passed');
  } catch (error) {
    console.error('\n❌ Sandbox E2E tests failed:', error);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

run().catch(error => {
  console.error('Unexpected error while running sandbox E2E tests:', error);
  process.exitCode = 1;
});
