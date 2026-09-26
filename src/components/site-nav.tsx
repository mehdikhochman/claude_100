"use client";
// Header navigation. Collapses behind a hamburger below 1024px.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type NavUser = { name: string; role: "MEMBER" | "ADMIN" } | null;

export function SiteNav({ user, logoutAction }: { user: NavUser; logoutAction: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the menu after navigating.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const link = (href: string, label: string, extraClass = "", divided = false) => {
    const current = pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
    return (
      <li className={divided ? "site-nav__item--divided" : undefined}>
        <Link
          href={href}
          className={`site-nav__link ${extraClass}`.trim()}
          aria-current={current ? "page" : undefined}
        >
          {label}
        </Link>
      </li>
    );
  };

  return (
    <>
      <button
        type="button"
        className="nav-toggle"
        aria-expanded={open}
        aria-controls="site-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="nav-toggle__bars" aria-hidden="true" />
      </button>

      <nav id="site-nav" className="site-nav" data-open={open} aria-label="Main">
        <ul className="site-nav__list">
          {link("/classes", "Classes")}
          {link("/schedule", "Schedule")}
          {user ? (
            <>
              {link("/dashboard", "Dashboard", "", true)}
              {link("/bookings", "My bookings")}
              {link("/profile", "Profile")}
              {user.role === "ADMIN" ? link("/admin", "Admin") : null}
              <li className="site-nav__user site-nav__item--divided">
                <span>{user.name.split(" ")[0]}</span>
              </li>
              <li>
                <form action={logoutAction}>
                  <button type="submit" className="btn btn--ghost btn--small site-nav__logout">
                    Log out
                  </button>
                </form>
              </li>
            </>
          ) : (
            <>
              {link("/login", "Log in", "", true)}
              {link("/register", "Sign up", "site-nav__link--cta")}
            </>
          )}
        </ul>
      </nav>
    </>
  );
}
