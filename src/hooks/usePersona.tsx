/**
 * usePersona — Persona context provider and hook.
 *
 * Provides the active persona, persona switching, permission checks,
 * tab visibility filtering, and customer scope filtering.
 *
 * Runtime behavior (from prototype gap analysis §6.2):
 * - canDo(perm) checks active persona's permissions before any action
 * - scopedExceptions() filters exceptions by assigned customers
 * - visibleTabs() returns only tabs in the persona's tabs[] array
 * - Persona switcher changes active persona via setActivePersona()
 */
"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { Persona, PersonaPermissions } from "@/types/auth";
import type { ExceptionSummary } from "@/types/exceptions";
import { personasApi } from "@/lib/api";

interface PersonaContextValue {
  /** All available personas loaded from the API. */
  personas: Persona[];
  /** The currently active persona (null while loading). */
  activePersona: Persona | null;
  /** Switch to a different persona by ID. */
  setActivePersona: (personaId: string) => void;
  /** Check if the active persona has a specific permission. */
  canDo: (permission: keyof PersonaPermissions) => boolean;
  /** Filter exceptions by the active persona's customer scope. */
  scopeExceptions: (exceptions: ExceptionSummary[]) => ExceptionSummary[];
  /** Filter tab arrays to only those visible to the active persona. */
  visibleTabs: <T extends { id: string }>(allTabs: T[]) => T[];
  /** Loading state. */
  loading: boolean;
}

const PersonaContext = createContext<PersonaContextValue | null>(null);

const STORAGE_KEY = "asoe-active-persona";

export function PersonaProvider({ children }: { children: ReactNode }) {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [activePersona, setActivePersonaState] = useState<Persona | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const resp = await personasApi.list();
        if (cancelled) return;
        setPersonas(resp.data);

        // Restore from localStorage or default to first persona (Admin)
        const savedId =
          typeof window !== "undefined"
            ? localStorage.getItem(STORAGE_KEY)
            : null;
        const saved = savedId
          ? resp.data.find((p) => p.id === savedId)
          : undefined;
        setActivePersonaState(saved ?? resp.data[0] ?? null);
      } catch {
        // Personas are non-critical — fall back to no scoping
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const setActivePersona = useCallback(
    (personaId: string) => {
      const persona = personas.find((p) => p.id === personaId);
      if (persona) {
        setActivePersonaState(persona);
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, personaId);
        }
      }
    },
    [personas],
  );

  const canDo = useCallback(
    (permission: keyof PersonaPermissions): boolean => {
      if (!activePersona) return true; // permissive while loading
      return activePersona.permissions[permission] === true;
    },
    [activePersona],
  );

  const scopeExceptions = useCallback(
    (exceptions: ExceptionSummary[]): ExceptionSummary[] => {
      if (!activePersona || activePersona.customer_scope === "all") {
        return exceptions;
      }
      if (activePersona.customer_scope === "assigned") {
        const allowed = new Set(activePersona.assigned_customers);
        return exceptions.filter(
          (e) => !e.customer_name || allowed.has(e.customer_name),
        );
      }
      return exceptions;
    },
    [activePersona],
  );

  const visibleTabs = useCallback(
    <T extends { id: string }>(allTabs: T[]): T[] => {
      if (!activePersona) return allTabs;
      const allowed = new Set(activePersona.tabs);
      return allTabs.filter((t) => allowed.has(t.id));
    },
    [activePersona],
  );

  return (
    <PersonaContext.Provider
      value={{
        personas,
        activePersona,
        setActivePersona,
        canDo,
        scopeExceptions,
        visibleTabs,
        loading,
      }}
    >
      {children}
    </PersonaContext.Provider>
  );
}

export function usePersona(): PersonaContextValue {
  const ctx = useContext(PersonaContext);
  if (!ctx) {
    throw new Error("usePersona must be used within a PersonaProvider");
  }
  return ctx;
}
