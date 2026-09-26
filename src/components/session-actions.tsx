// The Book / Booked / Join waitlist / Log in to book control for one session.
import Link from "next/link";
import { bookAction, cancelAction, joinWaitlistAction } from "@/lib/booking-actions";
import type { ScheduleSession } from "@/lib/queries";
import { SubmitButton } from "./submit-button";
import { ConfirmForm } from "./confirm-form";
import { isCancellable } from "@/lib/booking";

type Props = { session: ScheduleSession; viewerId: string | null; returnTo: string; allowCancel?: boolean };

export function SessionActions({ session, viewerId, returnTo, allowCancel = false }: Props) {
  if (!viewerId) {
    return (
      <Link href={`/login?returnUrl=${encodeURIComponent(returnTo)}`} className="btn btn--secondary btn--small">
        Log in to book
      </Link>
    );
  }

  const mine = session.mine;
  const full = session.bookedCount >= session.capacity;

  if (mine?.status === "CONFIRMED") {
    if (allowCancel && isCancellable(session.startsAt)) {
      return (
        <div className="row">
          <span className="badge badge--confirmed badge--dot">Booked</span>
          <ConfirmForm action={cancelAction} message="Cancel this booking? Your spot will go to the next person.">
            <input type="hidden" name="bookingId" value={mine.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <SubmitButton className="btn btn--ghost btn--small" pendingLabel="Cancelling…">
              Cancel
            </SubmitButton>
          </ConfirmForm>
        </div>
      );
    }
    return (
      <Link href="/dashboard" className="btn btn--ghost btn--small" aria-label="Booked — view on your dashboard">
        Booked ✓
      </Link>
    );
  }

  if (mine?.status === "WAITLISTED") {
    return (
      <div className="row">
        <span className="badge badge--waitlisted badge--dot">On waitlist</span>
        <form action={cancelAction}>
          <input type="hidden" name="bookingId" value={mine.id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <SubmitButton className="btn btn--ghost btn--small" pendingLabel="Leaving…">
            Leave
          </SubmitButton>
        </form>
      </div>
    );
  }

  if (full) {
    return (
      <form action={joinWaitlistAction}>
        <input type="hidden" name="sessionId" value={session.id} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <SubmitButton className="btn btn--clay btn--small" pendingLabel="Joining…">
          Join waitlist{session.waitlistCount > 0 ? ` (${session.waitlistCount} waiting)` : ""}
        </SubmitButton>
      </form>
    );
  }

  return (
    <form action={bookAction}>
      <input type="hidden" name="sessionId" value={session.id} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <SubmitButton className="btn btn--small" pendingLabel="Booking…">
        Book
      </SubmitButton>
    </form>
  );
}
