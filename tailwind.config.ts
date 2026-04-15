import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      /* ── Font Stacks ──────────────────────────────────────────────── */
      fontFamily: {
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
      },

      /* ── Font Sizes (mapped from design-tokens type scale) ────────── */
      fontSize: {
        display: ["var(--font-size-display)", { lineHeight: "var(--line-height-display)", fontWeight: "var(--font-weight-display)" }],
        title: ["var(--font-size-title)", { lineHeight: "var(--line-height-title)", fontWeight: "var(--font-weight-title)" }],
        heading: ["var(--font-size-heading)", { lineHeight: "var(--line-height-heading)", fontWeight: "var(--font-weight-heading)" }],
        subhead: ["var(--font-size-subhead)", { lineHeight: "var(--line-height-subhead)", fontWeight: "var(--font-weight-subhead)" }],
        body: ["var(--font-size-body)", { lineHeight: "var(--line-height-body)" }],
        caption: ["var(--font-size-caption)", { lineHeight: "var(--line-height-caption)" }],
        label: ["var(--font-size-label)", { lineHeight: "var(--line-height-label)", fontWeight: "var(--font-weight-label)" }],
      },

      /* ── Colors (all via CSS custom properties for dark mode) ─────── */
      colors: {
        brand: {
          DEFAULT: "var(--color-brand)",
          hover: "var(--color-brand-hover)",
          active: "var(--color-brand-active)",
          subtle: "var(--color-brand-subtle)",
          muted: "var(--color-brand-muted)",
          ring: "var(--color-brand-ring)",
        },
        surface: {
          page: "var(--color-surface-page)",
          primary: "var(--color-surface-primary)",
          secondary: "var(--color-surface-secondary)",
          tertiary: "var(--color-surface-tertiary)",
          elevated: "var(--color-surface-elevated)",
          glass: "var(--color-surface-glass)",
          "glass-hover": "var(--color-surface-glass-hover)",
          "row-hover": "var(--color-surface-row-hover)",
          "row-active": "var(--color-surface-row-active)",
          "row-stripe": "var(--color-surface-row-stripe)",
        },
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          tertiary: "var(--color-text-tertiary)",
          quaternary: "var(--color-text-quaternary)",
          inverse: "var(--color-text-inverse)",
          brand: "var(--color-text-brand)",
          "brand-hover": "var(--color-text-brand-hover)",
        },
        border: {
          DEFAULT: "var(--color-border-default)",
          subtle: "var(--color-border-subtle)",
          strong: "var(--color-border-strong)",
          brand: "var(--color-border-brand)",
          "brand-subtle": "var(--color-border-brand-subtle)",
        },
        success: {
          DEFAULT: "var(--color-success)",
          hover: "var(--color-success-hover)",
          subtle: "var(--color-success-subtle)",
          muted: "var(--color-success-muted)",
          border: "var(--color-success-border)",
        },
        warning: {
          DEFAULT: "var(--color-warning)",
          hover: "var(--color-warning-hover)",
          subtle: "var(--color-warning-subtle)",
          muted: "var(--color-warning-muted)",
          border: "var(--color-warning-border)",
        },
        error: {
          DEFAULT: "var(--color-error)",
          hover: "var(--color-error-hover)",
          subtle: "var(--color-error-subtle)",
          muted: "var(--color-error-muted)",
          border: "var(--color-error-border)",
        },
        info: {
          DEFAULT: "var(--color-info)",
          subtle: "var(--color-info-subtle)",
          muted: "var(--color-info-muted)",
          border: "var(--color-info-border)",
        },
        cat: {
          blue: { DEFAULT: "var(--color-cat-blue)", subtle: "var(--color-cat-blue-subtle)" },
          purple: { DEFAULT: "var(--color-cat-purple)", subtle: "var(--color-cat-purple-subtle)" },
          teal: { DEFAULT: "var(--color-cat-teal)", subtle: "var(--color-cat-teal-subtle)" },
          amber: { DEFAULT: "var(--color-cat-amber)", subtle: "var(--color-cat-amber-subtle)" },
          rose: { DEFAULT: "var(--color-cat-rose)", subtle: "var(--color-cat-rose-subtle)" },
          slate: { DEFAULT: "var(--color-cat-slate)", subtle: "var(--color-cat-slate-subtle)" },
        },
      },

      /* ── Spacing ──────────────────────────────────────────────────── */
      spacing: {
        "0": "var(--space-0)",
        "1": "var(--space-1)",
        "2": "var(--space-2)",
        "4": "var(--space-4)",
        "6": "var(--space-6)",
        "8": "var(--space-8)",
        "10": "var(--space-10)",
        "12": "var(--space-12)",
        "16": "var(--space-16)",
        "20": "var(--space-20)",
        "24": "var(--space-24)",
        "32": "var(--space-32)",
        "40": "var(--space-40)",
        "48": "var(--space-48)",
        "64": "var(--space-64)",
      },

      /* ── Shadows ──────────────────────────────────────────────────── */
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        brand: "var(--shadow-brand)",
        success: "var(--shadow-success)",
        warning: "var(--shadow-warning)",
        error: "var(--shadow-error)",
      },

      /* ── Border Radius ────────────────────────────────────────────── */
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        full: "var(--radius-full)",
      },

      /* ── Blur ─────────────────────────────────────────────────────── */
      blur: {
        sm: "var(--blur-sm)",
        glass: "var(--blur-glass)",
        heavy: "var(--blur-heavy)",
      },

      /* ── Transition Duration ──────────────────────────────────────── */
      transitionDuration: {
        instant: "var(--dur-instant)",
        fast: "var(--dur-fast)",
        normal: "var(--dur-normal)",
        slow: "var(--dur-slow)",
      },

      /* ── Transition Timing ────────────────────────────────────────── */
      transitionTimingFunction: {
        out: "var(--ease-out)",
        in: "var(--ease-in)",
        "in-out": "var(--ease-in-out)",
        spring: "var(--ease-spring)",
      },

      /* ── Z-Index ──────────────────────────────────────────────────── */
      zIndex: {
        base: "var(--z-base)",
        dropdown: "var(--z-dropdown)",
        sticky: "var(--z-sticky)",
        sidebar: "var(--z-sidebar)",
        modal: "var(--z-modal)",
        toast: "var(--z-toast)",
        tooltip: "var(--z-tooltip)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
