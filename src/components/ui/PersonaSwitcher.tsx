/**
 * PersonaSwitcher — Dropdown persona selector for the NavBar.
 *
 * Displays the active persona as a tinted pill in the NavBar,
 * with a dropdown to switch between personas. Shows persona name,
 * title, customer scope badge, and a green "LIVE" indicator on the active.
 *
 * Gap analysis §6.2: "Persona switcher dropdown from topbar pill"
 */
"use client";

import { usePersona } from "@/hooks/usePersona";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "./DropdownMenu";
import { Badge } from "./Badge";
import { cn } from "@/lib/utils";
import { ChevronDown, Check, Users, Shield, Headphones, UserCog } from "lucide-react";

/** Map persona role to an icon */
function roleIcon(role: string) {
  switch (role) {
    case "admin":
      return <Shield className="h-3.5 w-3.5" />;
    case "manager":
      return <UserCog className="h-3.5 w-3.5" />;
    default:
      return <Headphones className="h-3.5 w-3.5" />;
  }
}

export function PersonaSwitcher() {
  const { personas, activePersona, setActivePersona, loading } = usePersona();

  if (loading || !activePersona) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-6 px-10 py-4 rounded-full",
            "bg-brand-subtle text-brand text-caption font-medium",
            "border border-brand-subtle cursor-pointer",
            "hover:bg-brand/10 transition-colors duration-fast",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
          )}
          aria-label={`Active persona: ${activePersona.name} (${activePersona.title}). Click to switch.`}
        >
          <span className="w-[22px] h-[22px] rounded-full bg-brand text-white flex items-center justify-center text-[10px] font-bold">
            {activePersona.avatar_initials}
          </span>
          <span className="max-w-[120px] truncate">{activePersona.name}</span>
          <span className="text-text-tertiary font-normal hidden sm:inline">
            {activePersona.title}
          </span>
          <ChevronDown className="h-3 w-3 text-text-tertiary" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="w-[280px]">
        <DropdownMenuLabel className="flex items-center gap-6">
          <Users className="h-3.5 w-3.5" />
          Switch Persona
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {personas.map((persona) => {
          const isActive = persona.id === activePersona.id;
          return (
            <DropdownMenuItem
              key={persona.id}
              onClick={() => setActivePersona(persona.id)}
              className={cn(
                "flex items-center gap-8 py-6 cursor-pointer",
                isActive && "bg-brand-subtle",
              )}
            >
              {/* Avatar circle */}
              <span
                className={cn(
                  "w-[28px] h-[28px] rounded-full flex items-center justify-center text-[11px] font-bold shrink-0",
                  isActive
                    ? "bg-brand text-white"
                    : "bg-surface-tertiary text-text-secondary",
                )}
              >
                {persona.avatar_initials}
              </span>

              {/* Name + title */}
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-caption font-semibold text-text-primary truncate">
                  {persona.name}
                </span>
                <span className="text-[11px] text-text-tertiary flex items-center gap-4">
                  {roleIcon(persona.role)}
                  {persona.title}
                  {persona.customer_scope === "assigned" && (
                    <Badge variant="neutral" className="ml-4 text-[9px] py-0 px-4">
                      {persona.assigned_customers.join(", ")}
                    </Badge>
                  )}
                </span>
              </div>

              {/* Active indicator */}
              {isActive && (
                <div className="flex items-center gap-4 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  <span className="text-[9px] font-semibold text-success uppercase tracking-wider">
                    Live
                  </span>
                  <Check className="h-3.5 w-3.5 text-brand" />
                </div>
              )}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <div className="px-8 py-4">
          <p className="text-[10px] text-text-quaternary">
            {activePersona.tabs.length} tab{activePersona.tabs.length !== 1 ? "s" : ""} visible
            {activePersona.customer_scope === "assigned"
              ? ` · ${activePersona.assigned_customers.length} customer${activePersona.assigned_customers.length !== 1 ? "s" : ""}`
              : " · All customers"}
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
