type Status = "CONFIRMED" | "CANCELLED" | "WAITLISTED";

const LABELS: Record<Status, string> = {
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  WAITLISTED: "Waitlisted",
};

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge badge--${status.toLowerCase()} badge--dot`}>{LABELS[status]}</span>;
}

/** "3 spots left" / "1 spot left" / "Full". */
export function SpotsBadge({ capacity, bookedCount }: { capacity: number; bookedCount: number }) {
  const left = Math.max(0, capacity - bookedCount);
  if (left === 0) return <span className="badge badge--full">Full</span>;
  const tone = left <= 2 ? "badge--warn" : "badge--success";
  return (
    <span className={`badge ${tone}`}>
      {left} {left === 1 ? "spot" : "spots"} left
    </span>
  );
}

export function PaidBadge({ isPaid }: { isPaid: boolean }) {
  return isPaid ? (
    <span className="badge badge--success">Paid</span>
  ) : (
    <span className="badge badge--muted">Not paid</span>
  );
}
