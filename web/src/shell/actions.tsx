import { createContext, useContext, type ReactNode } from "react";
import { api } from "../api/client";
import type { ActionListItem } from "../api/types";
import { usePoll } from "../hooks";

interface ActionsApi {
  data: ActionListItem[] | null;
  error: string | null;
  reload: () => void;
  /** held + blocked: the cases that need a person */
  needsReview: number;
}

const ActionsContext = createContext<ActionsApi>({ data: null, error: null, reload: () => undefined, needsReview: 0 });

export const useActions = (): ActionsApi => useContext(ActionsContext);

/** One shared 3 s poll of `GET /actions`: the inbox badge in the shell and the Investigate list read the same data. */
export function ActionsProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const poll = usePoll(api.actions, 3000, enabled);
  const needsReview = (poll.data ?? []).filter((a) => a.status === "held" || a.status === "blocked").length;
  return <ActionsContext.Provider value={{ ...poll, needsReview }}>{children}</ActionsContext.Provider>;
}
