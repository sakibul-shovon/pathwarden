import { useId } from "react";
import { CHART, CHART_TICKS, chartHeight, chartWidth, intervalMarks, type DefenseRow } from "./evalLogic";

interface PanelProps {
  rows: DefenseRow[];
  which: "asr" | "fhr";
  title: string;
}

function Panel({ rows, which, title }: PanelProps) {
  const id = useId();
  const marks = intervalMarks(rows, which);
  const h = chartHeight(rows.length);
  const desc = `${title}: ${marks.map((m) => m.text).join("; ")}.`;
  return (
    <figure className="pw-chart__panel">
      <figcaption className="pw-chart__title">
        {title} <span className="pw-muted">(lower is better)</span>
      </figcaption>
      <svg viewBox={`0 0 ${chartWidth} ${h}`} role="img" aria-labelledby={`${id}-t ${id}-d`} className="pw-chart__svg">
        <title id={`${id}-t`}>{title} by defense, with its Wilson 95% interval</title>
        <desc id={`${id}-d`}>{desc}</desc>
        {CHART_TICKS.map((t) => (
          <g key={t.label}>
            <line x1={t.x} x2={t.x} y1={CHART.top - 6} y2={h - CHART.bottom + 2} className="pw-chart__grid" />
            <text x={t.x} y={h - 4} textAnchor="middle" className="pw-chart__tick">
              {t.label}
            </text>
          </g>
        ))}
        {marks.map((m, i) => {
          const row = rows[i];
          const isPw = row?.name === "PW";
          return (
            <g key={m.name} tabIndex={0} role="img" aria-label={m.text} className={isPw ? "pw-chart__row pw-chart__row--pw" : "pw-chart__row"}>
              <title>{m.text}</title>
              <rect x={0} y={m.y - CHART.row / 2} width={chartWidth} height={CHART.row} className="pw-chart__hit" />
              <text x={CHART.label - 8} y={m.y + 4} textAnchor="end" className="pw-chart__name">
                {m.name}
              </text>
              {m.x === null ? (
                <text x={CHART.label + 6} y={m.y + 4} className="pw-chart__notrun">
                  not run
                </text>
              ) : (
                <>
                  <line x1={m.x.lo} x2={m.x.hi} y1={m.y} y2={m.y} className="pw-chart__interval" />
                  <line x1={m.x.lo} x2={m.x.lo} y1={m.y - 4} y2={m.y + 4} className="pw-chart__interval" />
                  <line x1={m.x.hi} x2={m.x.hi} y1={m.y - 4} y2={m.y + 4} className="pw-chart__interval" />
                  {isPw ? (
                    <rect x={m.x.rate - 5} y={m.y - 5} width={10} height={10} transform={`rotate(45 ${m.x.rate} ${m.y})`} className="pw-chart__dot pw-chart__dot--pw" />
                  ) : (
                    <circle cx={m.x.rate} cy={m.y} r={5} className="pw-chart__dot" />
                  )}
                  <text x={CHART.label + CHART.plot + 8} y={m.y + 4} className="pw-chart__k">
                    {rows[i]?.[which] ? `${rows[i]?.[which]?.k}/${rows[i]?.[which]?.n}` : ""}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/** Two small multiples, ASR and FHR, one row per defense: a dot at the rate and a line over the Wilson 95% interval, on a common
 *  0-100% scale. The table below it holds the same numbers and is the primary form; the chart only makes them comparable. */
export function IntervalChart({ rows }: { rows: DefenseRow[] }) {
  return (
    <div className="pw-chart">
      <Panel rows={rows} which="asr" title="Attack success rate (ASR)" />
      <Panel rows={rows} which="fhr" title="False hold rate (FHR)" />
    </div>
  );
}
