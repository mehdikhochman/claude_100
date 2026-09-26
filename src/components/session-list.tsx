// Upcoming sessions grouped by studio day, with the booking control.
import { SpotsBadge } from "./status-badge";
import { SessionActions } from "./session-actions";
import type { ScheduleSession } from "@/lib/queries";
import { formatTime, relativeDayLabel, studioDayKey } from "@/lib/time";

type Props = { sessions: ScheduleSession[]; viewerId: string | null; returnTo: string; allowCancel?: boolean };

export function SessionList({ sessions, viewerId, returnTo, allowCancel }: Props) {
  if (sessions.length === 0) {
    return <div className="empty">No upcoming sessions yet. Check back soon.</div>;
  }

  // Group by day, preserving order (sessions arrive sorted by start time).
  const groups = new Map<string, ScheduleSession[]>();
  for (const s of sessions) {
    const key = studioDayKey(s.startsAt);
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }

  return (
    <div>
      {[...groups.entries()].map(([key, daySessions]) => (
        <section key={key} className="day-group" aria-labelledby={`day-${key}`}>
          <h2 id={`day-${key}`} className="day-group__title">
            {relativeDayLabel(daySessions[0].startsAt)}
          </h2>
          <ul className="list">
            {daySessions.map((s) => (
              <li key={s.id} className="item">
                <div className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
                  <time className="time-pill" dateTime={s.startsAt.toISOString()}>
                    {formatTime(s.startsAt)}
                  </time>
                  <div className="item__main">
                    <h3 className="item__title">{s.class.name}</h3>
                    <div className="item__meta">
                      with {s.coachName} · {s.class.durationMinutes} min · {s.class.level}
                    </div>
                  </div>
                </div>
                <div className="item__aside">
                  <SpotsBadge capacity={s.capacity} bookedCount={s.bookedCount} />
                  <SessionActions session={s} viewerId={viewerId} returnTo={returnTo} allowCancel={allowCancel} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
