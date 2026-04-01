import { Layers } from "lucide-react";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
}

const sizes = {
  sm: { box: 32, icon: 16, title: 15, gap: 8 },
  md: { box: 40, icon: 20, title: 20, gap: 10 },
  lg: { box: 48, icon: 24, title: 24, gap: 12 },
};

export function Logo({ size = "md", showTagline = false }: LogoProps) {
  const s = sizes[size];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-8)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: s.gap }}>
        <div
          style={{
            width: s.box,
            height: s.box,
            borderRadius: "var(--radius-md)",
            background: "var(--color-brand)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Layers size={s.icon} color="var(--color-text-inverse)" strokeWidth={2.5} />
        </div>
        <span
          style={{
            fontWeight: 700,
            fontSize: s.title,
            color: "var(--color-text-primary)",
            letterSpacing: "-0.01em",
          }}
        >
          ASOE
        </span>
      </div>
      {showTagline && (
        <span
          style={{
            fontSize: "var(--font-size-body)",
            color: "var(--color-text-tertiary)",
            fontWeight: 400,
          }}
        >
          Agentic System of Engagement
        </span>
      )}
    </div>
  );
}
