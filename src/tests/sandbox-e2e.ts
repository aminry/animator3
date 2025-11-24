import http from 'http';
import { createSandboxServer } from '../sandboxServer';

interface HttpResponse {
  status: number;
  body: string;
}

interface JsonResponse {
  status: number;
  json: any;
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

  console.log('✓ Successful execution returned Lottie JSON');
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

async function run(): Promise<void> {
  const port = 7080;
  const server = await createSandboxServer({ port });

  console.log(`\n🎬 Running Sandbox E2E tests against http://localhost:${port}/sandbox/execute`);

  try {
    await testSuccessfulExecution(port);
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
