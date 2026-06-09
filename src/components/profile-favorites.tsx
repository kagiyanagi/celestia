import Image from "next/image";
import Link from "next/link";
import type { FavoriteItem, FavoriteKind } from "@/types/account";

const GROUPS: { kind: FavoriteKind; title: string }[] = [
  { kind: "anime", title: "Anime" },
  { kind: "character", title: "Characters" },
  { kind: "voice_actor", title: "Voice actors" },
];

function hrefFor(item: FavoriteItem): string {
  if (item.kind === "anime") {
    return `/anime/${item.id}`;
  }
  if (item.kind === "character") {
    return `https://anilist.co/character/${item.id}`;
  }
  return `https://anilist.co/staff/${item.id}`;
}

export function ProfileFavorites({ favorites }: { favorites: FavoriteItem[] }) {
  const groups = GROUPS.map((group) => ({
    ...group,
    items: favorites.filter((item) => item.kind === group.kind),
  })).filter((group) => group.items.length > 0);

  if (!groups.length) {
    return null;
  }

  return (
    <section className="profile-section">
      <h2>Favourites</h2>
      {groups.map((group) => (
        <div className="profile-fav-group" key={group.kind}>
          <h3>{group.title}</h3>
          <div className="profile-fav-grid">
            {group.items.map((item) => {
              const external = item.kind !== "anime";
              const body = (
                <>
                  <span
                    className={`profile-fav-poster ${
                      external ? "is-round" : ""
                    }`}
                  >
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt=""
                        fill
                        sizes="90px"
                        className="poster-image"
                      />
                    ) : null}
                  </span>
                  <span className="profile-fav-name">{item.name}</span>
                </>
              );
              const key = `${item.kind}-${item.id}`;
              return external ? (
                <a
                  key={key}
                  href={hrefFor(item)}
                  target="_blank"
                  rel="noreferrer"
                  className="profile-fav-card"
                >
                  {body}
                </a>
              ) : (
                <Link key={key} href={hrefFor(item)} className="profile-fav-card">
                  {body}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
