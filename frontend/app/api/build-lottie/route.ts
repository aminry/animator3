import { NextRequest, NextResponse } from "next/server";

const DEFAULT_BACKEND_URL = "http://localhost:7070";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null as unknown);
    const code = (body as any)?.code;

    if (typeof code !== "string") {
      return NextResponse.json(
        {
          ok: false,
          errorType: "bad_request",
          message: "Body must be JSON with a string 'code' property"
        },
        { status: 400 }
      );
    }

    const backendUrl = process.env.MOTIONGEN_SANDBOX_URL || DEFAULT_BACKEND_URL;

    const response = await fetch(`${backendUrl}/sandbox/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ code })
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        errorType: "internal",
        message: String(error)
      },
      { status: 500 }
    );
  }
}
