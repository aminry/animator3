import http from "http";
import https from "https";
import { URL } from "url";
import dotenv from "dotenv";
import type { LLMClient, LLMClientGenerateOptions } from "./directorAgent";
import { debugLog } from "./logger";

dotenv.config();

export interface OllamaClientOptions {
  baseUrl?: string;
  model?: string;
  /**
   * Optional fallback client used when Ollama is unavailable.
   * If provided, any network error from Ollama will be retried once
   * against this client.
   */
  fallback?: LLMClient;
}

export class OllamaClient implements LLMClient {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fallback: LLMClient | undefined;

  constructor(options: OllamaClientOptions = {}) {
    this.baseUrl =
      options.baseUrl ??
      process.env.OLLAMA_BASE_URL ??
      "http://localhost:11434";
    this.model =
      options.model ??
      process.env.OLLAMA_MODEL ??
      "blaifa/InternVL3_5:4B";
    this.fallback = options.fallback;
  }

  async generate(options: LLMClientGenerateOptions): Promise<string> {
    try {
      return await this._callOllama(options);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      debugLog("ollama:generate", "Ollama request failed", {
        error: message,
        hasFallback: Boolean(this.fallback),
      });

      if (this.fallback) {
        debugLog(
          "ollama:generate",
          "Falling back to secondary LLM client",
          {}
        );
        return this.fallback.generate(options);
      }

      throw error;
    }
  }

  private _callOllama(options: LLMClientGenerateOptions): Promise<string> {
    const endpoint = new URL("/v1/chat/completions", this.baseUrl);
    const parsedBase = new URL(this.baseUrl);
    const isHttps = parsedBase.protocol === "https:";
    const transport = isHttps ? https : http;

    const messages: unknown[] = [];

    if (options.systemPrompt && options.systemPrompt.trim()) {
      messages.push({ role: "system", content: options.systemPrompt });
    }

    // Build user content: text-only or multimodal (text + images)
    let userContent: unknown = options.userPrompt;

    if (options.imageUrls && options.imageUrls.length > 0) {
      const parts: unknown[] = [];

      if (options.userPrompt && options.userPrompt.trim()) {
        parts.push({ type: "text", text: options.userPrompt });
      }

      for (const raw of options.imageUrls) {
        const dataUrl = raw.startsWith("data:image/")
          ? raw
          : `data:image/png;base64,${raw}`;

        parts.push({
          type: "image_url",
          image_url: { url: dataUrl },
        });
      }

      userContent = parts;
    }

    messages.push({ role: "user", content: userContent });

    const payload: Record<string, unknown> = {
      model: this.model,
      messages,
      temperature: options.temperature ?? 0,
      stream: false,
    };

    if (options.jsonMode) {
      payload["response_format"] = { type: "json_object" };
    }

    if (options.stopSequences && options.stopSequences.length > 0) {
      payload["stop"] = options.stopSequences;
    }

    const body = JSON.stringify(payload);

    debugLog("ollama:generate", "Sending request to Ollama", {
      model: this.model,
      baseUrl: this.baseUrl,
      hasImages: Boolean(options.imageUrls && options.imageUrls.length > 0),
      imageCount: options.imageUrls?.length ?? 0,
    });

    return new Promise<string>((resolve, reject) => {
      const port =
        parsedBase.port
          ? parseInt(parsedBase.port, 10)
          : isHttps
          ? 443
          : 80;

      const req = transport.request(
        {
          method: "POST",
          hostname: parsedBase.hostname,
          port,
          path: endpoint.pathname + endpoint.search,
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
          },
        },
        (res) => {
          let data = "";

          res.on("data", (chunk: Buffer) => {
            data += chunk.toString();
          });

          res.on("end", () => {
            const status = res.statusCode ?? 0;

            if (status >= 400) {
              reject(
                new Error(`Ollama API error ${status}: ${data.slice(0, 200)}`)
              );
              return;
            }

            try {
              const parsed = JSON.parse(data) as {
                choices?: { message?: { content?: unknown } }[];
              };
              const content = parsed?.choices?.[0]?.message?.content;

              if (typeof content === "string") {
                resolve(content);
                return;
              }

              // Handle content-parts array (shouldn't happen with OpenAI-compat)
              if (Array.isArray(content)) {
                const text = (content as { type?: string; text?: string }[])
                  .filter((p) => p.type === "text" && typeof p.text === "string")
                  .map((p) => p.text as string)
                  .join("\n");
                if (text) {
                  resolve(text);
                  return;
                }
              }

              reject(
                new Error("Ollama API returned no usable message content")
              );
            } catch (err) {
              reject(err);
            }
          });
        }
      );

      req.on("error", (err: Error) => reject(err));
      req.write(body);
      req.end();
    });
  }
}
