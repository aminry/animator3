import { create } from "zustand";
import type { AgentSource, LogEntry, LottieJSON, Storyboard } from "@motiongen/sdk";

export interface StudioState {
  logs: LogEntry[];
  code: string;
  lottieJson: LottieJSON | null;
  storyboard: Storyboard | null;
  isStreaming: boolean;
  activeAgent: AgentSource | null;
  addLog: (entry: { source: AgentSource; message: string; timestamp?: number }) => void;
  setCode: (code: string) => void;
  setLottie: (lottieJson: LottieJSON | null) => void;
  setStoryboard: (storyboard: Storyboard | null) => void;
  setIsStreaming: (isStreaming: boolean) => void;
  setActiveAgent: (activeAgent: AgentSource | null) => void;
}

export const useStudioStore = create<StudioState>((set) => ({
  logs: [],
  code: "",
  lottieJson: null,
  storyboard: null,
  isStreaming: false,
  activeAgent: null,
  addLog: (entry: { source: AgentSource; message: string; timestamp?: number }) =>
    set((state: StudioState) => ({
      logs: [
        ...state.logs,
        {
          source: entry.source,
          message: entry.message,
          timestamp: entry.timestamp ?? Date.now()
        }
      ]
    })),
  setCode: (code: string) => set({ code }),
  setLottie: (lottieJson: LottieJSON | null) => set({ lottieJson }),
  setStoryboard: (storyboard: Storyboard | null) => set({ storyboard }),
  setIsStreaming: (isStreaming: boolean) => set({ isStreaming }),
  setActiveAgent: (activeAgent: AgentSource | null) => set({ activeAgent })
}));
