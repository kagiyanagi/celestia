export type TabKey =
  | "overview"
  | "characters"
  | "episodes"
  | "news"
  | "discussion"
  | "franchise"
  | "similar";

export const TAB_KEYS: TabKey[] = [
  "overview",
  "characters",
  "episodes",
  "news",
  "discussion",
  "franchise",
  "similar",
];

export function isTabKey(value: string | null | undefined): value is TabKey {
  return !!value && TAB_KEYS.includes(value as TabKey);
}

interface DetailsTabsProps {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
}

export function DetailsTabs({ activeTab, setActiveTab }: DetailsTabsProps) {
  const tabs = TAB_KEYS;

  return (
    <nav className="anime-tabs-nav">
      {tabs.map((tab) => (
        <button
          key={tab}
          className={activeTab === tab ? "active" : ""}
          onClick={() => setActiveTab(tab)}
        >
          {tab === "similar"
            ? "More like this"
            : tab.charAt(0).toUpperCase() + tab.slice(1)}
        </button>
      ))}
    </nav>
  );
}
