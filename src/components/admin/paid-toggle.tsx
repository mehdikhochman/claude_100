// The Paid / Not paid switch admins use to validate cash at the studio.
import { setPaidAction } from "@/app/admin/actions";
import { SubmitButton } from "@/components/submit-button";

export function PaidToggle({ bookingId, isPaid, returnTo }: { bookingId: string; isPaid: boolean; returnTo: string }) {
  return (
    <form action={setPaidAction} className="toggle-form">
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="isPaid" value={isPaid ? "false" : "true"} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <SubmitButton
        className={`btn btn--small ${isPaid ? "btn--ghost" : "btn--secondary"}`}
        pendingLabel="Saving…"
      >
        {isPaid ? "Paid ✓ — mark unpaid" : "Mark as paid"}
      </SubmitButton>
    </form>
  );
}
