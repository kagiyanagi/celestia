import Image from "next/image";
import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { AnimeDetails, CharacterCredit } from "@/types/anime";

interface DetailsCastProps {
  anime: AnimeDetails;
  mode: "preview" | "full";
  onShowMore?: () => void;
}

type RoleFilter = "all" | "MAIN" | "SUPPORTING";

const ROLE_FILTERS: Array<{ value: RoleFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "MAIN", label: "Main" },
  { value: "SUPPORTING", label: "Supporting" },
];

function characterUrl(char: CharacterCredit): string {
  return `https://anilist.co/character/${char.id}`;
}

function roleLabel(role?: string | null): string {
  if (!role) return "Character";
  return role.charAt(0) + role.slice(1).toLowerCase();
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
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [extraCharacters, setExtraCharacters] = useState<CharacterCredit[]>([]);
  const loadStartedRef = useRef(false);
  // Dub watchers care about the English cast first; everyone else, Japanese.
  const englishFirst = user?.preferences.defaultAudio === "dub";

  // The detail render ships only character page 1; once the full Cast tab is
  // shown, lazy-load the remaining pages from the API and append them. Keeps a
  // large ensemble cast off the server render path.
  useEffect(() => {
    if (
      mode !== "full" ||
      loadStartedRef.current ||
      !anime.charactersHasNextPage
    ) {
      return;
    }
    loadStartedRef.current = true;
    let cancelled = false;

    (async () => {
      const collected: CharacterCredit[] = [];
      let page = 2;
      let hasNext = true;
      while (hasNext && page <= 10) {
        try {
          const response = await fetch(
            `/api/anime/${anime.id}/characters?page=${page}`,
          );
          if (!response.ok) {
            break;
          }
          const data = (await response.json()) as {
            characters: CharacterCredit[];
            hasNextPage: boolean;
          };
          collected.push(...(data.characters ?? []));
          hasNext = Boolean(data.hasNextPage);
          page += 1;
        } catch {
          break;
        }
      }
      if (!cancelled && collected.length) {
        setExtraCharacters(collected);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mode, anime.id, anime.charactersHasNextPage]);

  // Page 1 (server) + lazily-loaded pages, deduped: AniList's RELEVANCE sort
  // can repeat a character across pages.
  const mergedCharacters = useMemo(() => {
    const seen = new Set<number>();
    const merged: CharacterCredit[] = [];
    for (const credit of [...(anime.characters ?? []), ...extraCharacters]) {
      if (seen.has(credit.id)) {
        continue;
      }
      seen.add(credit.id);
      merged.push(credit);
    }
    return merged;
  }, [anime.characters, extraCharacters]);

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
                <div className="char-img">
                  {char.image && (
                    <Image src={char.image} alt={char.name} fill sizes="96px" />
                  )}
                </div>
                <div className="cast-info">
                  <div className="char-name">
                    <strong>{char.name}</strong>
                    <span>{char.role}</span>
                  </div>
                  <div className="va-name">
                    <strong>
                      {char.voiceActors?.japanese?.name || "No JP VA"}
                    </strong>
                    <span>Japanese</span>
                  </div>
                </div>
                <div className="va-img">
                  {char.voiceActors?.japanese?.image && (
                    <Image
                      src={char.voiceActors.japanese.image}
                      alt={char.voiceActors.japanese.name}
                      fill
                      sizes="96px"
                    />
                  )}
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

  const allCharacters =
    roleFilter === "all"
      ? mergedCharacters
      : mergedCharacters.filter((char) => char.role === roleFilter);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleCharacters = normalizedQuery
    ? allCharacters.filter((char) => matchesCastQuery(char, normalizedQuery))
    : allCharacters;
  const staff = anime.staff ?? [];

  return (
    <div className="tab-characters">
      <div className="section-header-row">
        <h2>Characters</h2>
        <div className="cast-role-filter" role="tablist" aria-label="Filter by role">
          {ROLE_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={roleFilter === option.value}
              className={roleFilter === option.value ? "is-active" : undefined}
              onClick={() => setRoleFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
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
                <span>{roleLabel(char.role)}</span>
              </div>
            </div>

            <div className="voice-actor-stack">
              {(englishFirst
                ? ([
                    ["English", char.voiceActors?.english],
                    ["Japanese", char.voiceActors?.japanese],
                  ] as const)
                : ([
                    ["Japanese", char.voiceActors?.japanese],
                    ["English", char.voiceActors?.english],
                  ] as const)
              ).map(([language, actor]) => (
                <div className="voice-actor-row" key={language}>
                  <div className="voice-actor-avatar">
                    {actor?.image ? (
                      <Image src={actor.image} alt={actor.name} fill sizes="56px" />
                    ) : null}
                  </div>
                  <div className="voice-actor-copy">
                    <strong>{actor?.name || "Not listed"}</strong>
                    <span>{language} VA</span>
                  </div>
                </div>
              ))}
            </div>
          </a>
        ))}
      </div>

      {staff.length > 0 ? (
        <div className="staff-section">
          <h2>Staff</h2>
          <div className="staff-grid">
            {staff.map((member) => (
              <div className="staff-card" key={`${member.id}-${member.role}`}>
                <div className="staff-img">
                  {member.image ? (
                    <Image src={member.image} alt={member.name} fill sizes="100px" />
                  ) : null}
                </div>
                <div className="staff-info">
                  <span className="staff-role">{member.role}</span>
                  <strong className="staff-name">{member.name}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
