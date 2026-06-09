export function ProfileStatBars({
  items,
}: {
  items: { label: string; count: number }[];
}) {
  const max = Math.max(...items.map((item) => item.count), 1);
  return (
    <div className="profile-stat-bars">
      {items.map((item) => (
        <div key={item.label} className="profile-stat-bar">
          <span className="profile-stat-bar-label">{item.label}</span>
          <span className="profile-stat-bar-track">
            <span style={{ width: `${(item.count / max) * 100}%` }} />
          </span>
          <span className="profile-stat-bar-count">{item.count}</span>
        </div>
      ))}
    </div>
  );
}
