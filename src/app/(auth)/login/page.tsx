import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { safeReturnUrl } from "@/lib/auth/return-url";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnUrl?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");

  const { returnUrl } = await searchParams;
  // Empty string means "use the role default" (decided after login).
  const safe = returnUrl ? safeReturnUrl(returnUrl, "") : "";

  return (
    <div className="container container--narrow">
      <div className="card auth-card">
        <span className="eyebrow">Welcome back</span>
        <h1>Log in</h1>
        <p className="lede mb-6">Use the email or phone number you signed up with.</p>
        <LoginForm returnUrl={safe} />
      </div>
    </div>
  );
}
