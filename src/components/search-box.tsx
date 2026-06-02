import { Search } from "lucide-react";

type SearchBoxProps = {
  defaultValue?: string;
  label?: string;
};

export function SearchBox({ defaultValue = "", label = "Find any anime" }: SearchBoxProps) {
  return (
    <form className="search-box" action="/search">
      <label htmlFor="anime-search">{label}</label>
      <div>
        <Search size={18} aria-hidden />
        <input
          id="anime-search"
          name="q"
          defaultValue={defaultValue}
          placeholder="Search titles, franchises, hidden gems..."
          autoComplete="off"
        />
        <button type="submit">Search</button>
      </div>
    </form>
  );
}
