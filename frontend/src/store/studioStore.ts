import { create } from "zustand";

export type AgentSource = "Director" | "Animator" | "Critic";

export interface LogEntry {
  source: AgentSource;
  message: string;
  timestamp: number;
}

export interface StudioState {
  logs: LogEntry[];
  code: string;
  lottieJson: unknown | null;
  storyboard: unknown | null;
  isStreaming: boolean;
  activeAgent: AgentSource | null;
  addLog: (entry: { source: AgentSource; message: string; timestamp?: number }) => void;
  setCode: (code: string) => void;
  setLottie: (lottieJson: unknown | null) => void;
  setStoryboard: (storyboard: unknown | null) => void;
  setIsStreaming: (isStreaming: boolean) => void;
  setActiveAgent: (activeAgent: AgentSource | null) => void;
}

export const useStudioStore = create<StudioState>((
  set: (
    partial:
      | StudioState
      | Partial<StudioState>
      | ((state: StudioState) => StudioState | Partial<StudioState>),
    _replace?: boolean
  ) => void
) => ({
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
  setLottie: (lottieJson: unknown | null) => set({ lottieJson }),
  setStoryboard: (storyboard: unknown | null) => set({ storyboard }),
  setIsStreaming: (isStreaming: boolean) => set({ isStreaming }),
  setActiveAgent: (activeAgent: AgentSource | null) => set({ activeAgent })
}));
