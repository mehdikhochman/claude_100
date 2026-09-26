import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { getUpcomingSessions } from "@/lib/queries";
import { SessionList } from "@/components/session-list";

export const metadata: Metadata = { title: "Schedule" };

export default async function SchedulePage() {
  const user = await getCurrentUser();
  const sessions = await getUpcomingSessions({ viewerId: user?.id });

  return (
    <div className="container container--medium">
      <div className="page-head">
        <span className="eyebrow">Upcoming</span>
        <h1>Schedule</h1>
        <p className="lede">
          Times are studio time (Abidjan). Cancel free of charge up to 2 hours before a session. When a class is full,
          join the waitlist and the next free spot is yours automatically.
        </p>
      </div>
      <SessionList sessions={sessions} viewerId={user?.id ?? null} returnTo="/schedule" allowCancel />
    </div>
  );
}
