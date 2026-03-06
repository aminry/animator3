"use client";

import { useState, ChangeEvent } from "react";
import TestStudioStore from "../src/components/TestStudioStore";
import type { BuildLottieResponse } from "@motiongen/sdk";

const DEFAULT_CODE = `import { Motion } from "@motiongen/sdk";

const stage = Motion.Stage.create(512, 512, 3, 30);

const text = stage.addText("Hello MotionGen", {
  fontSize: 40
});

text.animate({
  props: {
    position: { to: [256, 256] },
    opacity: { from: 0, to: 1 }
  },
  delay: 0
});

export default stage.toJSON();
`;

type BuildResult = BuildLottieResponse;

export default function HomePage() {
  const [code, setCode] = useState<string>(DEFAULT_CODE);
  const [result, setResult] = useState<BuildResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleBuild() {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/build-lottie", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ code })
      });

      const data = (await response.json()) as BuildResult;
      setResult(data);
    } catch (error) {
      setResult({ ok: false, message: String(error) });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="column editor">
        <h1>MotionGen Studio</h1>
        <p className="subtitle">Build Lottie animations using the MotionGen backend.</p>
        <textarea
          value={code}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setCode(event.target.value)}
          className="code-input"
          spellCheck={false}
        />
        <button onClick={handleBuild} disabled={isLoading} className="primary-button">
          {isLoading ? "Building..." : "Build Lottie"}
        </button>
      </div>
      <div className="column output">
        <h2>Result</h2>
        {result == null && <p>No build yet. Edit the code and click Build.</p>}
        {result && result.ok && (
          <pre className="json-output">{JSON.stringify(result.lottie, null, 2)}</pre>
        )}
        {result && !result.ok && (
          <div className="error-box">
            <p>Build failed.</p>
            {result.errorType && <p>Error type: {result.errorType}</p>}
            {result.message && <p>Message: {result.message}</p>}
          </div>
        )}
        <TestStudioStore />
      </div>
    </main>
  );
}
