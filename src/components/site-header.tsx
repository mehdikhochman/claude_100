import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { logoutAction } from "@/app/(auth)/actions";
import { SiteNav } from "./site-nav";

export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link href="/" className="brand" aria-label="LEGACY — home">
          LEGACY
        </Link>
        <SiteNav user={user ? { name: user.name, role: user.role } : null} logoutAction={logoutAction} />
      </div>
    </header>
  );
}
