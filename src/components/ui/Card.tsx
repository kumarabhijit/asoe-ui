import type { ReactNode } from "react";

interface CardProps {
  elevated?: boolean;
  children: ReactNode;
  style?: React.CSSProperties;
}

export function Card({ elevated = false, children, style }: CardProps) {
  return (
    <div
      style={{
        background: "var(--color-surface-primary)",
        borderRadius: elevated ? "var(--radius-lg)" : "var(--radius-md)",
        boxShadow: elevated ? "var(--shadow-lg)" : "var(--shadow-sm)",
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
