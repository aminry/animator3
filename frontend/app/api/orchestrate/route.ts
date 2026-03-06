import { NextRequest, NextResponse } from "next/server";
import type {
  OrchestrateRequestBody,
  OrchestrateResponse,
} from "@motiongen/sdk";

const DEFAULT_ORCHESTRATOR_URL = "http://localhost:7100";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null as unknown)) as
      | OrchestrateRequestBody
      | null;

    const prompt = body?.prompt;
    const assets = Array.isArray(body?.assets)
      ? (body!.assets ?? []).map(String)
      : [];

    if (typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json(
        {
          ok: false,
          errorType: "bad_request",
          message:
            "Body must be JSON with a non-empty string 'prompt' property (and optional 'assets' array)",
        },
        { status: 400 }
      );
    }

    const backendUrl =
      process.env.MOTIONGEN_ORCHESTRATOR_URL || DEFAULT_ORCHESTRATOR_URL;

    const response = await fetch(`${backendUrl}/orchestrate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt, assets }),
    });

    const data = (await response.json()) as OrchestrateResponse;

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        errorType: "internal",
        message: String(error),
      },
      { status: 500 }
    );
  }
}
