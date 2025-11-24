"use client";

import { useCallback } from "react";
import { type StudioState, useStudioStore } from "../store/studioStore";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export default function TestStudioStore() {
  const logs = useStudioStore((state: StudioState) => state.logs);
  const addLog = useStudioStore((state: StudioState) => state.addLog);

  const handleAddLog = useCallback(() => {
    const message = "Test log at " + new Date().toLocaleTimeString();
    addLog({ source: "Director", message });
  }, [addLog]);

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Studio Store Test</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <div>Log count: {logs.length}</div>
        <Button type="button" onClick={handleAddLog}>
          Add mock log
        </Button>
      </CardContent>
    </Card>
  );
}
