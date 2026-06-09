import Link from "next/link";

import { buildBrowseHref, EMPTY_BROWSE_FILTERS } from "@/lib/browse-filters";

const GENRES = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Supernatural",
  "Mystery",
  "Sports",
  "Mecha",
];

export function HomeGenreChips() {
  return (
    <nav className="home-genre-chips" aria-label="Browse by genre">
      {GENRES.map((genre) => (
        <Link
          key={genre}
          className="home-genre-chip"
          href={buildBrowseHref("/trending", {
            ...EMPTY_BROWSE_FILTERS,
            genre,
          })}
        >
          {genre}
        </Link>
      ))}
    </nav>
  );
}
