export type TabKey =
  | "overview"
  | "characters"
  | "episodes"
  | "news"
  | "franchise"
  | "similar";

interface DetailsTabsProps {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
}

export function DetailsTabs({ activeTab, setActiveTab }: DetailsTabsProps) {
  const tabs: TabKey[] = [
    "overview",
    "characters",
    "episodes",
    "news",
    "franchise",
    "similar",
  ];

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
