import type { ReactNode } from "react";
import { Button } from "../../shared/components/Button";
import type { CanvasHandle } from "./LineageCanvas";

interface CanvasToolbarProps {
  canvas: React.RefObject<CanvasHandle | null>;
  fullscreen: boolean;
  onFullscreen: () => void;
  /** Extra controls (layout, filters, trace) placed before the zoom buttons. */
  children?: ReactNode;
}

/** Zoom, fit and full screen for a canvas. Every control is a real button: the canvas itself is not keyboard-operable, so the
 *  table view and the witness paths are the keyboard route to the same evidence. */
export function CanvasToolbar({ canvas, fullscreen, onFullscreen, children }: CanvasToolbarProps) {
  return (
    <div className="pw-canvasbar" role="toolbar" aria-label="Graph controls">
      {children}
      <span className="pw-canvasbar__zoom">
        <Button size="sm" onClick={() => canvas.current?.zoomOut()} aria-label="Zoom out">
          <span aria-hidden="true">−</span>
        </Button>
        <Button size="sm" onClick={() => canvas.current?.zoomIn()} aria-label="Zoom in">
          <span aria-hidden="true">+</span>
        </Button>
        <Button size="sm" onClick={() => canvas.current?.fit()}>
          Fit
        </Button>
        <Button size="sm" onClick={onFullscreen} aria-pressed={fullscreen}>
          {fullscreen ? "Exit full screen" : "Full screen"}
        </Button>
      </span>
      <span className="pw-muted pw-canvasbar__hint">Ctrl or ⌘ + scroll zooms; drag pans.</span>
    </div>
  );
}
