import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");

  return (
    <div className="container container--narrow">
      <div className="card auth-card">
        <span className="eyebrow">Join the studio</span>
        <h1>Create your account</h1>
        <p className="lede mb-6">Book Pilates, Hot Mat and Run Club sessions in a few taps. Pay in cash at the studio.</p>
        <RegisterForm />
      </div>
    </div>
  );
}
