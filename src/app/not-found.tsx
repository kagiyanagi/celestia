import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-shell compact-page">
      <section className="search-hero">
        <span className="section-kicker">404</span>
        <h1>This signal is missing.</h1>
        <p>The anime could not be found. Try searching for another title.</p>
        <Link className="primary-link" href="/">
          Return home
        </Link>
      </section>
    </div>
  );
}
