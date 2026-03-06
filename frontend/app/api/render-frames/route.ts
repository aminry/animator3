import { NextRequest, NextResponse } from "next/server";
import type {
  RenderFramesRequestBody,
  RenderFramesResponse
} from "@motiongen/sdk";

const DEFAULT_RENDERER_URL = "http://localhost:7090";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null as unknown)) as
      | RenderFramesRequestBody
      | null;

    if (!body || typeof body !== "object" || !Array.isArray(body.timestamps)) {
      return NextResponse.json(
        {
          ok: false,
          errorType: "bad_request",
          message:
            "Body must contain 'lottie_json' object and 'timestamps' array of non-negative numbers"
        } satisfies RenderFramesResponse,
        { status: 400 }
      );
    }

    const backendUrl = process.env.MOTIONGEN_RENDERER_URL || DEFAULT_RENDERER_URL;

    const response = await fetch(`${backendUrl}/render-frames`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = (await response.json()) as RenderFramesResponse;

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        errorType: "internal",
        message: String(error)
      } satisfies RenderFramesResponse,
      { status: 500 }
    );
  }
}
