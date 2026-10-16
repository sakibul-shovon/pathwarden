import { Icon } from "../icons/Icon";
import { useCopy } from "../lib/clipboard";

/** Cypher, commands: real text with a copy button, never fake prompts or decorative output. */
export function CodeBlock({ code, label }: { code: string; label?: string }) {
  const { copied, copy } = useCopy();
  return (
    <div className="pw-code">
      <button type="button" className="pw-code__copy" onClick={() => copy(code)} aria-label={label ? `Copy ${label}` : "Copy"}>
        <Icon name={copied ? "check" : "copy"} size={14} />
        <span>{copied ? "Copied" : "Copy"}</span>
      </button>
      <pre>
        <code>{code}</code>
      </pre>
      <span role="status" className="pw-visually-hidden">
        {copied ? "Copied to the clipboard" : ""}
      </span>
    </div>
  );
}
