import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <div>
          <strong className="serif">LEGACY</strong> · Movement studio, Abidjan.
        </div>
        <ul className="site-footer__links">
          <li>
            <Link href="/classes">Classes</Link>
          </li>
          <li>
            <Link href="/schedule">Schedule</Link>
          </li>
          <li>
            <Link href="/login">Log in</Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}
