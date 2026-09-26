import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container error-page">
      <span className="eyebrow eyebrow--clay">404</span>
      <h1>Nothing here but stillness.</h1>
      <p className="lede" style={{ marginInline: "auto" }}>
        The page you are looking for has moved or never existed.
      </p>
      <div className="row" style={{ justifyContent: "center", marginTop: "24px" }}>
        <Link href="/" className="btn">
          Back home
        </Link>
        <Link href="/schedule" className="btn btn--ghost">
          See the schedule
        </Link>
      </div>
    </div>
  );
}
