import { useCallback, useEffect, useRef, useState } from "react";

/** Copy text to the clipboard; resolves false when the browser refuses (insecure context, no permission). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fall through to the legacy path
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/** `copied` is true for two seconds after a successful copy, so a button can say "Copied" in text; `failed` likewise after a refusal, so the person is told to copy by hand. */
export function useCopy(): { copied: boolean; failed: boolean; copy: (text: string) => void } {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = useCallback((text: string) => {
    void copyText(text).then((ok) => {
      setCopied(ok);
      setFailed(!ok);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        setCopied(false);
        setFailed(false);
      }, 2000);
    });
  }, []);
  return { copied, failed, copy };
}
