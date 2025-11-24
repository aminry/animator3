import http, { IncomingMessage, ServerResponse } from 'http';
import { runSandbox, SandboxResult } from './sandboxRunner';

export interface SandboxServerOptions {
  port?: number;
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === 'POST' && req.url === '/sandbox/execute') {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        req.socket.destroy();
      }
    });

    req.on('end', async () => {
      let code: string;

      try {
        const parsed = JSON.parse(body || '{}');
        if (typeof parsed.code !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              ok: false,
              errorType: 'bad_request',
              message: 'Body must be JSON with a string "code" property'
            })
          );
          return;
        }
        code = parsed.code;
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            ok: false,
            errorType: 'bad_request',
            message: 'Request body must be valid JSON'
          })
        );
        return;
      }

      const result: SandboxResult = await runSandbox(code);

      if (result.ok) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            ok: true,
            lottie: result.json
          })
        );
        return;
      }

      const status =
        result.errorType === 'timeout' ? 408 : result.errorType === 'compile' ? 400 : 500;

      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    });

    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'Not Found' }));
}

export function createSandboxServer(options: SandboxServerOptions = {}): Promise<http.Server> {
  const portEnv = process.env.SANDBOX_PORT;
  const port = options.port ?? (portEnv ? parseInt(portEnv, 10) : 7070);

  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      handleRequest(req, res).catch(error => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            ok: false,
            errorType: 'internal',
            message: String(error)
          })
        );
      });
    });

    server.listen(port, () => {
      resolve(server);
    });
  });
}

if (require.main === module) {
  createSandboxServer().then(server => {
    const address = server.address();
    const port = typeof address === 'object' && address && 'port' in address ? address.port : 7070;
    console.log(`Sandbox service listening on http://localhost:${port}/sandbox/execute`);
  });
}
