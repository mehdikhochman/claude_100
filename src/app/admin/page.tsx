import type { Metadata } from "next";
import Link from "next/link";
import { getAttendanceTrend, getBusiestSlots, getOverviewStats } from "@/lib/admin/stats";
import { AttendanceChart, BusiestSlotsChart } from "@/components/admin/charts";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminOverviewPage() {
  const [stats, trend, slots] = await Promise.all([getOverviewStats(), getAttendanceTrend(), getBusiestSlots()]);

  return (
    <div>
      <div className="page-head">
        <span className="eyebrow">Studio</span>
        <h1>Overview</h1>
      </div>

      <div className="grid grid--4 mb-6">
        <Stat label="Members" value={stats.totalMembers} href="/admin/members" />
        <Stat label="Classes offered" value={stats.classesOffered} href="/admin/classes" />
        <Stat label="Upcoming sessions" value={stats.upcomingSessions} href="/admin/sessions" />
        <Stat label="Confirmed bookings" value={stats.confirmedBookings} href="/admin/bookings" />
      </div>

      <div className="grid grid--2 mb-6">
        <div className={`card stat ${stats.unpaidUpcoming > 0 ? "" : "card--flat"}`} style={{ borderColor: stats.unpaidUpcoming > 0 ? "var(--clay)" : undefined }}>
          <span className="eyebrow eyebrow--clay">Cash to collect</span>
          <div className="stat__value">{stats.unpaidUpcoming}</div>
          <div className="stat__label">
            unpaid, needs follow-up (confirmed bookings on upcoming sessions).{" "}
            <Link href="/admin/bookings?filter=unpaid">Review →</Link>
          </div>
        </div>
        <div className="card stat card--flat">
          <span className="eyebrow">Waitlist</span>
          <div className="stat__value">{stats.waitlisted}</div>
          <div className="stat__label">members waiting for a spot on upcoming sessions.</div>
        </div>
      </div>

      <div className="grid grid--3" style={{ alignItems: "start" }}>
        <section className="card" style={{ gridColumn: "span 2" }} aria-labelledby="trend-title">
          <span className="eyebrow">Attendance trend</span>
          <h2 id="trend-title" style={{ fontSize: "1.5rem" }}>
            Bookings per class, last 7 and next 7 days
          </h2>
          <AttendanceChart trend={trend} />
        </section>
        <section className="card" aria-labelledby="slots-title">
          <span className="eyebrow">Busiest time slots</span>
          <h2 id="slots-title" style={{ fontSize: "1.5rem" }}>
            Average fill rate
          </h2>
          <BusiestSlotsChart slots={slots} />
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="card stat card--flat" style={{ textDecoration: "none", color: "inherit" }}>
      <div className="stat__value">{value}</div>
      <div className="stat__label">{label}</div>
    </Link>
  );
}
