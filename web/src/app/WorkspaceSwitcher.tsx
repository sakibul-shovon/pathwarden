import { useId } from "react";
import { baseWorkspace, mcpWorkspace } from "./navModel";

interface WorkspaceSwitcherProps {
  workspace: string;
  onChange: (workspace: string) => void;
}

/** A tenant has its own graphs: `pw_<ws>` for the demo runs and `pw_mcp_<ws>`, shown as `<ws>-mcp`, for the lineage that
 *  the MCP gateway wrote (D-026). Both belong to the same workspace key in hosted mode. */
export function WorkspaceSwitcher({ workspace, onChange }: WorkspaceSwitcherProps) {
  const id = useId();
  const base = baseWorkspace(workspace);
  const mcp = mcpWorkspace(workspace);
  return (
    <div className="pw-workspace">
      <label htmlFor={id} className="pw-eyebrow">
        Workspace
      </label>
      <select id={id} value={workspace} onChange={(e) => onChange(e.target.value)}>
        <option value={base}>{base}</option>
        <option value={mcp}>{mcp}</option>
      </select>
      <p className="pw-workspace__note">
        {workspace === mcp
          ? "Lineage written by the MCP gateway (make demo-mcp)."
          : "Lineage of the demo runs. Each run starts from a clean graph."}
      </p>
    </div>
  );
}
