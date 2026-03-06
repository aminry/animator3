import http, { IncomingMessage, ServerResponse } from "http";
import { studioGraph } from "./orchestrator";
import type { LottieJSON } from "./types";
import {
  OrchestrateRequestBody,
  OrchestrateResponse,
  StudioSummary
} from "./sharedApiTypes";
import { debugLog } from "./logger";

export interface OrchestratorServerOptions {
  port?: number;
}
function sendJson(res: ServerResponse, status: number, payload: OrchestrateResponse): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(JSON.stringify(payload));
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === "POST" && req.url === "/orchestrate") {
    let body = "";

    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        req.socket.destroy();
      }
    });

    req.on("end", async () => {
      let parsed: OrchestrateRequestBody | null = null;

      if (body) {
        try {
          parsed = JSON.parse(body) as OrchestrateRequestBody;
        } catch {
          sendJson(res, 400, {
            ok: false,
            errorType: "bad_request",
            message: "Request body must be valid JSON"
          });
          return;
        }
      }

      const prompt = parsed?.prompt;
      const assets = Array.isArray(parsed?.assets) ? parsed?.assets.map(String) : [];

      if (typeof prompt !== "string" || !prompt.trim()) {
        sendJson(res, 400, {
          ok: false,
          errorType: "bad_request",
          message: "Body must be JSON with a non-empty string 'prompt' property"
        });
        return;
      }

      try {
        debugLog("orchestrator:http", "Invoking studio graph", {
          prompt,
          assetsCount: assets.length
        });

        const result = await studioGraph.invoke(
          {
            prompt,
            assets
          },
          {
            recursionLimit: 60
          }
        );

        const studio: StudioSummary = {
          prompt: result.prompt,
          assets: result.assets ?? [],
          storyboard: result.storyboard ?? null,
          code: result.code ?? null,
          lottieJson: (result.lottieJson as LottieJSON | unknown) ?? null,
          errorLogs: Array.isArray(result.errorLogs) ? result.errorLogs : [],
          lottieMetrics: (result as any).lottieMetrics,
          critique: result.critique,
          criticResult: (result as any).criticResult,
          attemptCount:
            typeof result.attemptCount === "number" ? result.attemptCount : 0,
          mode: (result as any).mode ?? null,
          promptClassification: (result as any).promptClassification ?? null,
        };

        sendJson(res, 200, {
          ok: true,
          studio
        });
      } catch (error) {
        debugLog("orchestrator:http", "Error while invoking studio graph", {
          error: error instanceof Error ? error.message : String(error)
        });
        sendJson(res, 500, {
          ok: false,
          errorType: "internal",
          message: String(error)
        });
      }
    });

    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end();
    return;
  }

  res.writeHead(404, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(JSON.stringify({ ok: false, error: "Not Found" }));
}

export function createOrchestratorServer(
  options: OrchestratorServerOptions = {}
): Promise<http.Server> {
  const portEnv = process.env.ORCHESTRATOR_PORT;
  const port = options.port ?? (portEnv ? parseInt(portEnv, 10) : 7100);

  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      handleRequest(req, res).catch(error => {
        sendJson(res, 500, {
          ok: false,
          errorType: "internal",
          message: String(error)
        });
      });
    });

    server.listen(port, () => {
      resolve(server);
    });
  });
}

if (require.main === module) {
  createOrchestratorServer().then(server => {
    const address = server.address();
    const port =
      typeof address === "object" && address && "port" in address ? address.port : 7100;
    // eslint-disable-next-line no-console
    console.log(`Orchestrator service listening on http://localhost:${port}/orchestrate`);
  });
}
