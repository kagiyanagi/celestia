import Image from "next/image";
import { AnimeDetails } from "@/types/anime";

interface DetailsCastProps {
  anime: AnimeDetails;
  mode: "preview" | "full";
  onShowMore?: () => void;
}

export function DetailsCast({ anime, mode, onShowMore }: DetailsCastProps) {
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
              <div className="cast-card" key={char.id}>
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
              </div>
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

  return (
    <div className="tab-characters">
      <div className="section-header-row">
        <h2>Characters</h2>
        <span className="characters-count">
          {(anime.characters ?? []).length} total
        </span>
      </div>

      <div className="character-tab-grid">
        {(anime.characters ?? []).map((char) => (
          <article className="character-tab-card" key={char.id}>
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
          </article>
        ))}
      </div>
    </div>
  );
}
