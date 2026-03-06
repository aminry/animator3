"use client";

import { useCallback, useState } from "react";
import { type StudioState, useStudioStore } from "../store/studioStore";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import type { OrchestrateResponse } from "@motiongen/sdk";

export default function TestStudioStore() {
  const logs = useStudioStore((state: StudioState) => state.logs);
  const addLog = useStudioStore((state: StudioState) => state.addLog);
  const storyboard = useStudioStore((state: StudioState) => state.storyboard);
  const setStoryboard = useStudioStore(
    (state: StudioState) => state.setStoryboard
  );

  const [prompt, setPrompt] = useState<string>("ping pong game demonstration");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddLog = useCallback(() => {
    const message = "Test log at " + new Date().toLocaleTimeString();
    addLog({ source: "Director", message });
  }, [addLog]);

  const handleOrchestrate = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/orchestrate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      const data = (await response.json()) as OrchestrateResponse;

      if (!data.ok) {
        setError(data.message ?? "Orchestrator error");
        setStoryboard(null);
        return;
      }

      setStoryboard(data.studio.storyboard ?? null);
    } catch (err) {
      setError(String(err));
      setStoryboard(null);
    } finally {
      setIsLoading(false);
    }
  }, [prompt, setStoryboard]);

  const beatsCount = storyboard?.beats ? storyboard.beats.length : 0;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Studio Store Test</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>Log count: {logs.length}</div>
          <Button type="button" onClick={handleAddLog}>
            Add mock log
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="orchestrate-prompt">
            Orchestrator prompt (for storyboard + beats)
          </label>
          <textarea
            id="orchestrate-prompt"
            className="w-full resize-y rounded border px-2 py-1 text-sm"
            rows={3}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={handleOrchestrate}
              disabled={isLoading}
            >
              {isLoading ? "Loading storyboard..." : "Run Orchestrator"}
            </Button>
            {error && (
              <span className="text-xs text-red-500">{error}</span>
            )}
          </div>
        </div>

        <div className="text-sm">
          {storyboard ? (
            <div className="space-y-1">
              <div>
                <span className="font-semibold">Vibe:</span> {storyboard.vibe}
              </div>
              <div>
                <span className="font-semibold">Timeline entries:</span>{" "}
                {storyboard.timeline.length}
              </div>
              <div>
                <span className="font-semibold">Beats:</span> {beatsCount}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              No storyboard loaded yet.
            </div>
          )}
        </div>

        {storyboard?.beats && storyboard.beats.length > 0 && (
          <pre className="max-h-64 overflow-auto rounded bg-muted p-2 text-xs">
            {JSON.stringify(storyboard.beats, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
