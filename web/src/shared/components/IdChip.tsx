import { Icon } from "../icons/Icon";
import { useCopy } from "../lib/clipboard";

interface IdChipProps {
  id: string;
  /** Show a copy button (ids are what people paste into the FalkorDB Browser and the docs). */
  copyable?: boolean;
}

export function IdChip({ id, copyable }: IdChipProps) {
  const { copied, copy } = useCopy();
  return (
    <span className="pw-chip">
      <code>{id}</code>
      {copyable && (
        <button type="button" className="pw-chip__copy" onClick={() => copy(id)} aria-label={`Copy ${id}`}>
          <Icon name={copied ? "check" : "copy"} size={12} />
        </button>
      )}
      {copyable && (
        <span role="status" className="pw-visually-hidden">
          {copied ? `Copied ${id}` : ""}
        </span>
      )}
    </span>
  );
}
