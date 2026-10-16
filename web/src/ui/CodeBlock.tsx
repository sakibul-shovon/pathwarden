import { useState } from "react";
import { Icon } from "./Icon";

/** Monospace block with a copy button (2 s "Copied" state, announced politely). */
export function CodeBlock({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = (): void => {
    void navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => undefined);
  };
  return (
    <div className="codeblock">
      <button type="button" className="icon-btn codeblock-copy" onClick={copy} aria-label={`Copy ${label}`}>
        <Icon name={copied ? "check" : "copy"} size={16} />
      </button>
      <pre>{text}</pre>
      <span className="sr-only" role="status">{copied ? "Copied" : ""}</span>
    </div>
  );
}
