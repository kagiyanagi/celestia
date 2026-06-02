import type { ReactNode } from "react";

type SectionShellProps = {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
};

export function SectionShell({ eyebrow, title, description, children }: SectionShellProps) {
  return (
    <section className="section-shell">
      <div className="section-heading">
        <span>{eyebrow}</span>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
