import Link from "next/link";
import { Home, Compass, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="notfound-stage">
      <div className="notfound-noise" aria-hidden />
      <div className="notfound-scanlines" aria-hidden />

      <section className="notfound-content">
        <span className="notfound-kicker">
          <SearchX size={15} />
          No signal · 404
        </span>

        <div className="notfound-glitch" data-text="404" aria-label="404">
          404
        </div>

        <h1 className="notfound-title">This signal is missing.</h1>
        <p className="notfound-copy">
          The page or title you were looking for dropped off the broadcast. It
          may have been moved, removed, or never aired here at all.
        </p>

        <div className="notfound-actions">
          <Link className="notfound-btn notfound-btn-primary" href="/">
            <Home size={17} />
            Return home
          </Link>
          <Link className="notfound-btn" href="/trending">
            <Compass size={17} />
            Browse trending
          </Link>
          <Link className="notfound-btn" href="/search">
            <SearchX size={17} />
            Search titles
          </Link>
        </div>

        <p className="notfound-egg" title="Roronoa Zoro, professionally lost since 1997">
          Don&apos;t worry — even Zoro takes a few wrong turns. We&apos;ll point you back.
        </p>
      </section>
    </div>
  );
}
