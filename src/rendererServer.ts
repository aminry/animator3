import http, { IncomingMessage, ServerResponse } from 'http';
import { renderFrames } from './renderer';
import { LottieJSON } from './types';

export interface RendererServerOptions {
  port?: number;
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === 'POST' && req.url === '/render-frames') {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) {
        req.socket.destroy();
      }
    });

    req.on('end', async () => {
      let parsed: any;

      try {
        parsed = JSON.parse(body || '{}');
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

      const lottieJson = parsed.lottie_json;
      const timestamps = parsed.timestamps;

      if (!lottieJson || typeof lottieJson !== 'object' || !Array.isArray(timestamps)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            ok: false,
            errorType: 'bad_request',
            message: 'Body must contain "lottie_json" object and "timestamps" array'
          })
        );
        return;
      }

      if (!timestamps.every((t: any) => typeof t === 'number' && isFinite(t) && t >= 0)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            ok: false,
            errorType: 'bad_request',
            message: 'All timestamps must be non-negative numbers'
          })
        );
        return;
      }

      try {
        const images = await renderFrames(lottieJson as LottieJSON, timestamps);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            ok: true,
            images
          })
        );
      } catch (error: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            ok: false,
            errorType: 'render',
            message: error && typeof error.message === 'string' ? error.message : String(error)
          })
        );
      }
    });

    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'Not Found' }));
}

export function createRendererServer(options: RendererServerOptions = {}): Promise<http.Server> {
  const portEnv = process.env.RENDERER_PORT;
  const port = options.port ?? (portEnv ? parseInt(portEnv, 10) : 7090);

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
  createRendererServer().then(server => {
    const address = server.address();
    const port = typeof address === 'object' && address && 'port' in address ? address.port : 7090;
    console.log(`Renderer service listening on http://localhost:${port}/render-frames`);
  });
}
