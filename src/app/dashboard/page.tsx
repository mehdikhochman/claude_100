import { requireUser } from "@/lib/auth/session";

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");
  return (
    <div className="container">
      <h1>Hello, {user.name.split(" ")[0]}.</h1>
    </div>
  );
}
