import { Icon } from "../shared/icons/Icon";
import { SegmentedControl } from "../shared/components/SegmentedControl";
import type { ThemePreference } from "../shared/lib/theme";
import type { HealthState } from "./useHealth";

interface StatusFooterProps {
  health: HealthState;
  theme: ThemePreference;
  onTheme: (theme: ThemePreference) => void;
  /** A key is in use for this tab (hosted mode): offer to forget it. */
  signedIn: boolean;
  onSignOut: () => void;
}

/** What the system can do right now: API, live agents, access mode. Text and an icon, never colour alone. */
export function StatusFooter({ health, theme, onTheme, signedIn, onSignOut }: StatusFooterProps) {
  const api =
    health.status === "ok"
      ? { icon: "check" as const, text: "API connected" }
      : health.status === "connecting"
        ? { icon: "clock" as const, text: "Connecting to the API…" }
        : health.status === "db_down"
          ? { icon: "warning" as const, text: "FalkorDB is not answering" }
          : { icon: "warning" as const, text: "API unreachable" };
  const info = health.status === "ok" ? health.info : null;
  // hosted mode never lists graph (= tenant) names, so their absence tells the two modes apart
  const access = info === null ? null : info.graphs ? "Access: open (local mode)" : "Access: workspace key (hosted mode)";
  return (
    <div className="pw-status-footer">
      <ul>
        <li>
          <Icon name={api.icon} size={14} /> {api.text}
        </li>
        {info && (
          <li>
            <Icon name={info.llm.configured ? "check" : "info"} size={14} />{" "}
            {info.llm.configured ? `Live agents available (${info.llm.model})` : "Scripted agents only"}
          </li>
        )}
        {access && (
          <li>
            <Icon name="key" size={14} /> {access}
            {info && !info.graphs && signedIn && (
              <>
                {" "}
                <button type="button" className="pw-linkbutton" onClick={onSignOut}>
                  Sign out
                </button>
              </>
            )}
          </li>
        )}
      </ul>
      <SegmentedControl
        legend="Theme"
        value={theme}
        onChange={onTheme}
        options={[
          { value: "system", label: "System" },
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ]}
      />
    </div>
  );
}
