import https from "https";
import { URL } from "url";
import dotenv from "dotenv";
import type { LLMClient, LLMClientGenerateOptions } from "./directorAgent";

dotenv.config();

export interface GroqClientOptions {
  apiKey?: string;
  baseUrl?: string;
}

export class GroqLLMClient implements LLMClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: GroqClientOptions = {}) {
    const key = options.apiKey ?? process.env.GROQ_API_KEY;
    if (!key) {
      throw new Error(
        "GROQ_API_KEY environment variable is not set. Please configure your Groq API key before using the orchestrator."
      );
    }

    this.apiKey = key;
    this.baseUrl =
      options.baseUrl ??
      process.env.GROQ_API_BASE_URL ??
      "https://api.groq.com";
  }

  private resolveModel(logicalModel: string): string {
    const envSafe = logicalModel.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
    const specific = process.env[`MOTIONGEN_GROQ_MODEL_${envSafe}`];
    if (specific && specific.trim()) {
      return specific.trim();
    }

    const fallback = process.env.MOTIONGEN_GROQ_DEFAULT_MODEL;
    if (fallback && fallback.trim()) {
      return fallback.trim();
    }

    return logicalModel;
  }

  async generate(options: LLMClientGenerateOptions): Promise<string> {
    const model = this.resolveModel(options.model);
    const url = new URL("/openai/v1/chat/completions", this.baseUrl);

    const messages: any[] = [];

    if (options.systemPrompt && options.systemPrompt.trim()) {
      messages.push({
        role: "system",
        content: options.systemPrompt,
      });
    }

    // Build user content: either plain text or text + images
    let userContent: any = options.userPrompt;

    if (options.imageUrls && options.imageUrls.length > 0) {
      const contentParts: any[] = [];

      if (options.userPrompt && options.userPrompt.trim()) {
        contentParts.push({
          type: "text",
          text: options.userPrompt,
        });
      }

      for (const raw of options.imageUrls) {
        // If renderer already gave us data URLs, keep them; otherwise prefix.
        const urlOrData = raw.startsWith("data:image/")
          ? raw
          : `data:image/png;base64,${raw}`;

        contentParts.push({
          type: "image_url",
          image_url: {
            url: urlOrData,
          },
        });
      }

      userContent = contentParts;
    }

    messages.push({
      role: "user",
      content: userContent,
    });

    const payload: any = {
      model,
      messages,
      temperature: options.temperature ?? 0,
    };

    if (options.jsonMode) {
      payload.response_format = { type: "json_object" };
    }

    if (options.stopSequences && options.stopSequences.length > 0) {
      payload.stop = options.stopSequences;
    }

    const body = JSON.stringify(payload);

    return new Promise<string>((resolve, reject) => {
      if (options.imageUrls && options.imageUrls.length > 0) {
        console.log(
          "[GroqLLMClient] Sending multimodal request with",
          options.imageUrls.length,
          "images"
        );
      }
      const req = https.request(
        {
          method: "POST",
          hostname: url.hostname,
          port: url.port || 443,
          path: url.pathname + url.search,
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
            Authorization: `Bearer ${this.apiKey}`,
          },
        },
        (res) => {
          let data = "";

          res.on("data", (chunk) => {
            data += chunk;
          });

          res.on("end", () => {
            if (!res.statusCode || res.statusCode >= 400) {
              const status = res.statusCode ?? 0;
              reject(new Error(`Groq API error ${status}: ${data}`));
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed?.choices?.[0]?.message?.content;

              if (typeof content === "string") {
                resolve(content);
                return;
              }

              // If Groq ever returns content as parts array
              if (Array.isArray(content)) {
                const text = content
                  .filter(
                    (p: any) =>
                      p && p.type === "text" && typeof p.text === "string"
                  )
                  .map((p: any) => p.text)
                  .join("\n");
                if (text) {
                  resolve(text);
                  return;
                }
              }

              reject(new Error("Groq API returned no usable message content"));
            } catch (err) {
              reject(err);
            }
          });
        }
      );

      req.on("error", (err) => reject(err));
      req.write(body);
      req.end();
    });
  }
}
