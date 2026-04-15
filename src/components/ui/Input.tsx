"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  rightIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, rightIcon, id, type, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
    const errorId = inputId ? `${inputId}-error` : undefined;

    return (
      <div className="flex flex-col gap-6">
        {label && (
          <label
            htmlFor={inputId}
            className="text-label font-bold uppercase tracking-wider text-text-tertiary"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            id={inputId}
            type={type}
            ref={ref}
            aria-describedby={error ? errorId : undefined}
            aria-invalid={!!error}
            className={cn(
              "flex h-10 w-full rounded-md border bg-surface-primary px-12 font-sans text-body text-text-primary outline-none",
              "transition-[border-color,box-shadow] duration-instant ease-out",
              "placeholder:text-text-quaternary",
              "focus:border-border-brand focus:ring-2 focus:ring-brand-ring",
              "disabled:cursor-not-allowed disabled:opacity-50",
              error ? "border-error" : "border-border",
              rightIcon && "pr-10",
              className,
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-text-tertiary">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <span id={errorId} role="alert" className="text-caption text-error">
            {error}
          </span>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
export type { InputProps };
