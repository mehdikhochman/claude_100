// Small, dependency-free charts for the admin overview. Plain HTML + CSS so
// text stays crisp at any width. Each chart also renders its data as a table
// for screen readers and anyone who prefers numbers.
import type { AttendanceTrend, SlotStat } from "@/lib/admin/stats";

const SERIES_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];

/** Bookings per class per day, as stacked bars. */
export function AttendanceChart({ trend, todayKey }: { trend: AttendanceTrend; todayKey: string }) {
  const { classNames, points } = trend;
  const max = Math.max(1, ...points.map((p) => p.total));
  // Round the axis top up to a friendly number.
  const axisMax = Math.max(4, Math.ceil(max / 4) * 4);

  return (
    <figure className="chart" style={{ padding: 0 }}>
      <figcaption className="sr-only">Confirmed bookings per class for each day, past week and next week.</figcaption>
      <div className="stack-chart" aria-hidden="true">
        <div className="stack-chart__axis">
          <span>{axisMax}</span>
          <span>{axisMax / 2}</span>
          <span>0</span>
        </div>
        <div className="stack-chart__plot">
          {points.map((p) => (
            <div key={p.dayKey} className="stack-chart__col" title={`${p.label}: ${p.total} booking${p.total === 1 ? "" : "s"}`}>
              {classNames.map((name, ci) => {
                const value = p.perClass[name] ?? 0;
                if (value === 0) return null;
                return (
                  <span
                    key={name}
                    className="stack-chart__seg"
                    style={{ height: `${(value / axisMax) * 100}%`, background: SERIES_COLORS[ci % SERIES_COLORS.length] }}
                    title={`${p.label} · ${name}: ${value}`}
                  />
                );
              })}
              {p.total > 0 ? (
                <span className="stack-chart__total" style={{ bottom: `${(p.total / axisMax) * 100}%` }}>
                  {p.total}
                </span>
              ) : null}
            </div>
          ))}
        </div>
        <div className="stack-chart__labels">
          {points.map((p) => (
            <span key={p.dayKey} className={`stack-chart__label ${p.dayKey === todayKey ? "stack-chart__label--today" : ""}`}>
              {p.dayKey === todayKey ? "Today" : p.label}
            </span>
          ))}
        </div>
      </div>
      <div className="chart__legend">
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
