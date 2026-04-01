"use client";

import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "brand" | "neutral" | "success" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

const variantStyles: Record<Variant, React.CSSProperties> = {
  brand: {
    background: "var(--color-brand)",
    color: "var(--color-text-inverse)",
    border: "none",
  },
  neutral: {
    background: "var(--color-surface-primary)",
    color: "var(--color-text-secondary)",
    border: "1px solid var(--color-border-default)",
  },
  success: {
    background: "var(--color-success)",
    color: "var(--color-text-inverse)",
    border: "none",
  },
  ghost: {
    background: "transparent",
    color: "var(--color-text-tertiary)",
    border: "none",
  },
  destructive: {
    background: "var(--color-error)",
    color: "var(--color-text-inverse)",
    border: "none",
  },
};

const sizeStyles: Record<Size, React.CSSProperties & { fontSize: number }> = {
  sm: { height: 32, padding: "6px 12px", fontSize: 12 },
  md: { height: 36, padding: "8px 16px", fontSize: 13 },
  lg: { height: 40, padding: "10px 20px", fontSize: 14 },
};

export function Button({
  variant = "neutral",
  size = "md",
  loading = false,
  fullWidth = false,
  disabled,
  children,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const v = variantStyles[variant];
  const s = sizeStyles[size];

  return (
    <button
      disabled={isDisabled}
      style={{
        ...v,
        ...s,
        width: fullWidth ? "100%" : undefined,
        borderRadius: "var(--radius-md)",
        fontFamily: "var(--font-sans)",
        fontWeight: 600,
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled && !loading ? 0.4 : 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-6)",
        transition: "all var(--dur-instant) var(--ease-out)",
        lineHeight: 1.3,
        whiteSpace: "nowrap",
        ...style,
      }}
      {...props}
    >
      {loading ? (
        <Loader2
          size={16}
          style={{
            animation: "spin 1s linear infinite",
          }}
        />
      ) : (
        children
      )}
    </button>
  );
}
