import { useRef } from "react";
import { Icon } from "../icons/Icon";
import { useCopy } from "../lib/clipboard";
import { useScrolls } from "../lib/useScrolls";

/** Cypher, commands: real text with a copy button, never fake prompts or decorative output. */
export function CodeBlock({ code, label }: { code: string; label?: string }) {
  const { copied, failed, copy } = useCopy();
  const pre = useRef<HTMLPreElement>(null);
  // a code block wider than the screen scrolls sideways: then a keyboard can reach it
  const scrolls = useScrolls(pre);
  return (
    <div className="pw-code">
      <button type="button" className="pw-code__copy" onClick={() => copy(code)} aria-label={label ? `Copy ${label}` : "Copy"}>
        <Icon name={copied ? "check" : "copy"} size={14} />
        <span>{copied ? "Copied" : failed ? "Copy failed: select the text" : "Copy"}</span>
      </button>
      <pre ref={pre} {...(scrolls ? { tabIndex: 0, role: "group", "aria-label": `${label ?? "Code"} (scrolls sideways)` } : {})}>
        <code>{code}</code>
      </pre>
      <span role="status" className="pw-visually-hidden">
        {copied ? "Copied to the clipboard" : failed ? "Copy failed: select the text and copy it by hand" : ""}
      </span>
    </div>
  );
}
