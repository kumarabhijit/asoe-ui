import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
}

const sizes = {
  sm: { box: "w-8 h-8", icon: 16, title: "text-[15px]", gap: "gap-2" },
  md: { box: "w-10 h-10", icon: 20, title: "text-[20px]", gap: "gap-2.5" },
  lg: { box: "w-12 h-12", icon: 24, title: "text-[24px]", gap: "gap-3" },
};

export function Logo({ size = "md", showTagline = false }: LogoProps) {
  const s = sizes[size];

  return (
    <div className="flex flex-col items-center gap-8">
      <div className={cn("flex items-center", s.gap)}>
        <div className={cn(s.box, "rounded-md bg-brand flex items-center justify-center shrink-0")}>
          <Layers size={s.icon} className="text-text-inverse" strokeWidth={2.5} />
        </div>
        <span className={cn(s.title, "font-bold text-text-primary tracking-tight")}>
          ASOE
        </span>
      </div>
      {showTagline && (
        <span className="text-body text-text-tertiary font-normal">
          Agentic System of Engagement
        </span>
      )}
    </div>
  );
}
