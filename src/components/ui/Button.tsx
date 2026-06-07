"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-6 whitespace-nowrap rounded-md font-sans font-semibold leading-tight transition-all duration-instant ease-out disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        brand: "bg-brand [color:white] hover:bg-brand-hover active:bg-brand-active",
        neutral: "bg-surface-primary text-text-secondary border border-border hover:bg-surface-secondary active:bg-surface-tertiary",
        success: "bg-success [color:white] hover:bg-success-hover",
        ghost: "bg-transparent text-text-tertiary hover:bg-surface-secondary hover:text-text-secondary",
        destructive: "bg-error [color:white] hover:bg-error-hover",
      },
      size: {
        sm: "h-[32px] px-12 py-6 text-caption",
        md: "h-[36px] px-16 py-8 text-body",
        lg: "h-[40px] px-20 py-10 text-subhead",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "md",
    },
  },
);

type Variant = "brand" | "neutral" | "success" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  asChild?: boolean;
  children: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading = false, fullWidth = false, asChild = false, disabled, children, ...props }, ref) => {
    const isDisabled = disabled || loading;
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size }),
          fullWidth && "w-full",
          loading && "opacity-100",
          className,
        )}
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        {...props}
      >
        {/* WCAG 4.1.2: keep the label while loading so the control retains its
            accessible name; the spinner is decorative (aria-busy carries the
            "busy" semantics). Skipped for `asChild` — Slot requires a single
            child, so the spinner can't be a sibling there. */}
        {loading && !asChild && <Loader2 size={16} className="animate-spin" aria-hidden />}
        {children}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
export type { ButtonProps };
