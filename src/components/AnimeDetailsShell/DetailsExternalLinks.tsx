import { ExternalLink as ExternalLinkIcon, Play } from "lucide-react";
import type { ExternalLink } from "@/types/anime";

interface DetailsExternalLinksProps {
  links: ExternalLink[];
}

export function DetailsExternalLinks({ links }: DetailsExternalLinksProps) {
  const streaming = links.filter((link) => link.type === "STREAMING");
  // Everything that isn't a streaming platform (official sites, socials, info)
  // collapses into one "Links" row - the streaming row is the one users want.
  const other = links.filter((link) => link.type !== "STREAMING");

  if (streaming.length === 0 && other.length === 0) {
    return null;
  }

  return (
    <>
      {streaming.length > 0 && (
        <div className="meta-section">
          <h2>Watch on</h2>
          <div className="external-links-row">
            {streaming.map((link) => (
              <a
                key={link.id}
                className="external-link-chip is-streaming"
                href={link.url}
                target="_blank"
                rel="noreferrer"
                style={
                  link.color
                    ? ({ "--link-color": link.color } as React.CSSProperties)
                    : undefined
                }
              >
                <Play size={14} aria-hidden />
                {link.site}
                {link.language ? (
                  <span className="external-link-lang">{link.language}</span>
                ) : null}
              </a>
            ))}
          </div>
        </div>
      )}

      {other.length > 0 && (
        <div className="meta-section">
          <h2>Links</h2>
          <div className="external-links-row">
            {other.map((link) => (
              <a
                key={link.id}
                className="external-link-chip"
                href={link.url}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLinkIcon size={13} aria-hidden />
                {link.site}
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
