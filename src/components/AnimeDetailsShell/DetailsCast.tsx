import Image from "next/image";
import { Search } from "lucide-react";
import { useState } from "react";
import { AnimeDetails, CharacterCredit } from "@/types/anime";

interface DetailsCastProps {
  anime: AnimeDetails;
  mode: "preview" | "full";
  onShowMore?: () => void;
}

function characterUrl(char: CharacterCredit): string {
  return `https://anilist.co/character/${char.id}`;
}

function matchesCastQuery(char: CharacterCredit, query: string): boolean {
  return [
    char.name,
    char.nativeName,
    char.voiceActors?.japanese?.name,
    char.voiceActors?.english?.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
}

export function DetailsCast({ anime, mode, onShowMore }: DetailsCastProps) {
  const [query, setQuery] = useState("");

  if (mode === "preview") {
    return (
      <>
        <div className="cast-section">
          <div className="section-header-row">
            <h2>Characters</h2>
            <button className="show-more" type="button" onClick={onShowMore}>
              Show more
            </button>
          </div>
          <div className="cast-grid">
            {(anime.characters ?? []).slice(0, 12).map((char) => (
              <a
                className="cast-card"
                key={char.id}
                href={characterUrl(char)}
                target="_blank"
                rel="noreferrer"
              >
                <div className="cast-image-pair">
                  <div className="char-img">
                    {char.image && (
                      <Image
                        src={char.image}
                        alt={char.name}
                        fill
                        sizes="60px"
                      />
                    )}
                  </div>
                  <div className="va-img">
                    {char.voiceActors?.japanese?.image && (
                      <Image
                        src={char.voiceActors.japanese.image}
                        alt={char.voiceActors.japanese.name}
                        fill
                        sizes="60px"
                      />
                    )}
                  </div>
                </div>
                <div className="cast-info">
                  <div className="cast-main">
                    <div className="char-name">
                      <strong>{char.name}</strong>
                      <span>{char.role}</span>
                    </div>
                  </div>
                  <div className="va-name">
                    <strong>
                      {char.voiceActors?.japanese?.name || "No JP VA"}
                    </strong>
                    <span>Japanese</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>

        <div className="staff-section">
          <h2>Staff</h2>
          <div className="staff-grid">
            {(anime.staff ?? []).map((s) => (
              <div className="staff-card" key={`${s.id}-${s.role}`}>
                <div className="staff-img">
                  {s.image && (
                    <Image src={s.image} alt={s.name} fill sizes="100px" />
                  )}
                </div>
                <div className="staff-info">
                  <span className="staff-role">{s.role}</span>
                  <strong className="staff-name">{s.name}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  const allCharacters = anime.characters ?? [];
  const normalizedQuery = query.trim().toLowerCase();
  const visibleCharacters = normalizedQuery
    ? allCharacters.filter((char) => matchesCastQuery(char, normalizedQuery))
    : allCharacters;

  return (
    <div className="tab-characters">
      <div className="section-header-row">
        <h2>Characters</h2>
        <label className="ep-search cast-search">
          <Search size={16} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search character or voice actor..."
            aria-label="Search characters"
          />
        </label>
        <span className="characters-count">
          {normalizedQuery
            ? `${visibleCharacters.length} of ${allCharacters.length}`
            : `${allCharacters.length} total`}
        </span>
      </div>

      {!visibleCharacters.length ? (
        <div className="empty-panel">
          No characters match &quot;{query.trim()}&quot;.
        </div>
      ) : null}

      <div className="character-tab-grid">
        {visibleCharacters.map((char) => (
          <a
            className="character-tab-card"
            key={char.id}
            href={characterUrl(char)}
            target="_blank"
            rel="noreferrer"
          >
            <div className="character-tab-top">
              <div className="character-tab-image">
                {char.image ? (
                  <Image src={char.image} alt={char.name} fill sizes="96px" />
                ) : null}
              </div>

              <div className="character-tab-copy">
                <h3>{char.name}</h3>
                {char.nativeName ? <p>{char.nativeName}</p> : null}
                <span>{char.role || "Character"}</span>
              </div>
            </div>

            <div className="voice-actor-stack">
              <div className="voice-actor-row">
                <div className="voice-actor-avatar">
                  {char.voiceActors?.japanese?.image ? (
                    <Image
                      src={char.voiceActors.japanese.image}
                      alt={char.voiceActors.japanese.name}
                      fill
                      sizes="56px"
                    />
                  ) : null}
                </div>
                <div className="voice-actor-copy">
                  <strong>
                    {char.voiceActors?.japanese?.name || "Not listed"}
                  </strong>
                  <span>Japanese VA</span>
                </div>
              </div>

              <div className="voice-actor-row">
                <div className="voice-actor-avatar">
                  {char.voiceActors?.english?.image ? (
                    <Image
                      src={char.voiceActors.english.image}
                      alt={char.voiceActors.english.name}
                      fill
                      sizes="56px"
                    />
                  ) : null}
                </div>
                <div className="voice-actor-copy">
                  <strong>
                    {char.voiceActors?.english?.name || "Not listed"}
                  </strong>
                  <span>English VA</span>
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
