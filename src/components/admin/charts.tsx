// Small, dependency-free charts for the admin overview (inline SVG, rendered
// on the server). Each chart also renders its data as a table for screen
// readers and anyone who prefers numbers.
import type { AttendanceTrend, SlotStat } from "@/lib/admin/stats";

const SERIES_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];

/** Bookings per class per day, as stacked bars. */
export function AttendanceChart({ trend }: { trend: AttendanceTrend }) {
  const { classNames, points } = trend;
  const width = 640;
  const height = 220;
  const pad = { top: 16, right: 8, bottom: 28, left: 28 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(1, ...points.map((p) => p.total));
  const step = innerW / points.length;
  const barW = Math.min(28, step * 0.62);
  const gridLines = [0, 0.5, 1].map((f) => Math.round(max * f));
  const todayIndex = points.findIndex((p) => p.dayKey === points[Math.floor(points.length / 2)]?.dayKey);

  return (
    <figure className="chart" aria-describedby="attendance-desc">
      <figcaption className="sr-only" id="attendance-desc">
        Confirmed bookings per class for each day, past week and next week.
      </figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Bookings per class per day">
        {gridLines.map((v) => {
          const y = pad.top + innerH - (v / max) * innerH;
          return (
            <g key={v}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="var(--chart-grid)" strokeWidth={1} />
              <text x={pad.left - 6} y={y + 4} textAnchor="end" fontSize={11} fill="var(--slate-text)">
                {v}
              </text>
            </g>
          );
        })}
        {points.map((p, i) => {
          const x = pad.left + i * step + (step - barW) / 2;
          let yCursor = pad.top + innerH;
          const isToday = i === todayIndex;
          return (
            <g key={p.dayKey}>
              {classNames.map((name, ci) => {
                const value = p.perClass[name] ?? 0;
                if (value === 0) return null;
                const h = (value / max) * innerH;
                yCursor -= h;
                const y = yCursor;
                return (
                  <rect
                    key={name}
                    x={x}
                    y={y + 1}
                    width={barW}
                    height={Math.max(0, h - 2)}
                    rx={2}
                    fill={SERIES_COLORS[ci % SERIES_COLORS.length]}
                  >
                    <title>{`${p.label}: ${name} — ${value} booking${value === 1 ? "" : "s"}`}</title>
                  </rect>
                );
              })}
              {p.total > 0 ? (
                <text x={x + barW / 2} y={yCursor - 4} textAnchor="middle" fontSize={11} fill="var(--ink)">
                  {p.total}
                </text>
              ) : null}
              <text
                x={x + barW / 2}
                y={height - 8}
                textAnchor="middle"
                fontSize={11}
                fill={isToday ? "var(--ink)" : "var(--slate-text)"}
                fontWeight={isToday ? 600 : 400}
              >
                {i % 2 === 0 || isToday ? p.label : ""}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="chart__legend" aria-hidden="true">
        {classNames.map((name, ci) => (
          <span key={name} style={{ ["--swatch" as string]: SERIES_COLORS[ci % SERIES_COLORS.length] }}>
            {name}
          </span>
        ))}
      </div>
      <details className="mt-2">
        <summary className="small muted" style={{ cursor: "pointer" }}>
          Show as table
        </summary>
        <div className="table-wrap mt-2">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Day</th>
                {classNames.map((n) => (
                  <th key={n} scope="col" className="num">
                    {n}
                  </th>
                ))}
                <th scope="col" className="num">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.dayKey}>
                  <td>{p.label}</td>
                  {classNames.map((n) => (
                    <td key={n} className="num">
                      {p.perClass[n] ?? 0}
                    </td>
                  ))}
                  <td className="num">{p.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/** Fill rate per start time, as horizontal bars. */
export function BusiestSlotsChart({ slots }: { slots: SlotStat[] }) {
  if (slots.length === 0) return <p className="muted small mb-0">No sessions yet.</p>;
  const busiest = Math.max(...slots.map((s) => s.fillRate));
  return (
    <div className="bars" role="list" aria-label="Average fill rate per start time">
      {slots.map((s) => {
        const percent = Math.round(s.fillRate * 100);
        return (
          <div key={s.hour} className="bars__row" role="listitem">
            <span className="tabular">{s.label}</span>
            <div className="bars__track" aria-hidden="true">
              <div
                className="bars__fill"
                style={{ width: `${percent}%`, background: s.fillRate === busiest ? "var(--chart-2)" : "var(--chart-1)" }}
                title={`${s.label}: ${percent}% full on average across ${s.sessions} session${s.sessions === 1 ? "" : "s"}`}
              />
            </div>
            <span className="bars__value">
              {percent}%<span className="sr-only"> full on average across {s.sessions} sessions</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
