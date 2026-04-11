"use client";

import type { InputHTMLAttributes, ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  rightIcon?: ReactNode;
}

export function Input({
  label,
  error,
  rightIcon,
  id,
  style,
  ...props
}: InputProps) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
  const errorId = inputId ? `${inputId}-error` : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: "var(--font-size-label)",
            fontWeight: 700,
            textTransform: "uppercase" as const,
            letterSpacing: "var(--letter-spacing-label)",
            color: "var(--color-text-tertiary)",
            lineHeight: "var(--line-height-label)",
          }}
        >
          {label}
        </label>
      )}
      <div style={{ position: "relative" }}>
        <input
          id={inputId}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={!!error}
          style={{
            width: "100%",
            height: 40,
            padding: "0 var(--space-12)",
            paddingRight: rightIcon ? 40 : "var(--space-12)",
            background: "var(--color-surface-primary)",
            border: `1px solid ${error ? "var(--color-error)" : "var(--color-border-default)"}`,
            borderRadius: "var(--radius-md)",
            fontSize: "var(--font-size-body)",
            fontFamily: "var(--font-sans)",
            color: "var(--color-text-primary)",
            outline: "none",
            transition: "border-color var(--dur-instant) var(--ease-out), box-shadow var(--dur-instant) var(--ease-out)",
            ...style,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--color-brand)";
            e.currentTarget.style.boxShadow = "0 0 0 2px var(--color-brand-ring)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error
              ? "var(--color-error)"
              : "var(--color-border-default)";
            e.currentTarget.style.boxShadow = "none";
          }}
          {...props}
        />
        {rightIcon && (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              height: 40,
              width: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-text-tertiary)",
              cursor: "pointer",
            }}
          >
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <span
          id={errorId}
          role="alert"
          style={{
            fontSize: "var(--font-size-caption)",
            color: "var(--color-error)",
            lineHeight: "var(--line-height-caption)",
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
