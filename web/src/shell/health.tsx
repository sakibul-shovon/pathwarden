import { createContext, useContext, type ReactNode } from "react";
import { api } from "../api/client";
import type { HealthStatus } from "../api/types";
import { usePoll } from "../hooks";

interface HealthApi {
  data: HealthStatus | null;
  error: string | null;
  reload: () => void;
  /** live LLM mode is configured on the API (PW_LLM_MODEL and PW_LLM_API_KEY) */
  liveReady: boolean;
  /** the model name (local mode only; hosted mode never shows it) */
  model: string | null;
}

const HealthContext = createContext<HealthApi>({ data: null, error: null, reload: () => undefined, liveReady: false, model: null });

export const useHealth = (): HealthApi => useContext(HealthContext);

/** One shared 15 s poll of `GET /api/health`: the status pill and the live-mode controls read it. */
export function HealthProvider({ children }: { children: ReactNode }) {
  const poll = usePoll(api.health, 15000);
  const llm = poll.data?.llm;
  return (
    <HealthContext.Provider value={{ ...poll, liveReady: llm?.configured === true, model: llm?.model ?? null }}>
      {children}
    </HealthContext.Provider>
  );
}
