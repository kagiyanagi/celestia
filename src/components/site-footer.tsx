import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <blockquote className="site-footer-quote">
          To defeat evil, I shall become a greater evil. If streaming is a sin,
          we will happily bear the world&apos;s hatred.
        </blockquote>
        <div className="site-footer-meta">
          <Link className="brand-mark site-footer-brand" href="/">
            MIRUCAST
          </Link>
          <span className="site-footer-note">
            Watch &amp; track anime. Metadata via AniList.
          </span>
        </div>
      </div>
    </footer>
  );
}
