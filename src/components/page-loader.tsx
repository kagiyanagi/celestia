export function PageLoader({ variant = "grid" }: { variant?: "grid" | "player" }) {
  return (
    <div className="loader-shell" aria-label="Loading">
      <div className={variant === "player" ? "loader-player" : "loader-hero"}>
        <span />
        <span />
        <span />
      </div>
      <div className="loader-grid">
        {Array.from({ length: variant === "player" ? 8 : 10 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
    </div>
  );
}
