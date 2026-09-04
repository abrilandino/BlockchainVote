/**
 * ThemeContext — Proveedor de Temas para React + Vite
 *
 * Implementación nativa sin next-themes (este proyecto usa Vite, no Next.js).
 *
 * Funcionalidades:
 * - 3 modos: "system" (default), "light", "dark"
 * - Persistencia en localStorage ("theme-preference")
 * - Sincronización con prefers-color-scheme del SO
 * - Aplicación instantánea en <html> (sin FOUC)
 * - Escucha de cambios del SO en tiempo real
 *
 * @context theme      - Tema actual resuelto ("light" | "dark")
 * @context themeMode  - Modo configurado ("system" | "light" | "dark")
 * @context setTheme   - Función para cambiar el tema
 *
 * @security No almacena información sensible en localStorage.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "theme-preference";

const ThemeContext = createContext(undefined);

/**
 * Resuelve el tema efectivo a partir del modo configurado.
 * @param {"system"|"light"|"dark"} mode
 * @returns {"light"|"dark"}
 */
function resolveTheme(mode) {
  if (mode === "light" || mode === "dark") return mode;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Aplica la clase .dark / .light en el elemento <html>.
 * @param {"light"|"dark"} theme
 */
function applyThemeToDOM(theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
  } else {
    root.classList.add("light");
    root.classList.remove("dark");
  }
}

/**
 * ThemeProvider — Envuelve la aplicación y provee el estado del tema.
 */
export function ThemeProvider({ children }) {
  // Modo configurado por el usuario ("system" | "light" | "dark")
  const [themeMode, setThemeMode] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || "dark";
    } catch {
      return "system";
    }
  });

  // Tema efectivo resuelto ("light" | "dark")
  const [resolvedTheme, setResolvedTheme] = useState(() => resolveTheme(themeMode));

  // EFECTO: Aplicar tema al DOM y persistir
  useEffect(() => {
    const resolved = resolveTheme(themeMode);
    setResolvedTheme(resolved);
    applyThemeToDOM(resolved);

    try {
      localStorage.setItem(STORAGE_KEY, themeMode);
    } catch {
      // localStorage no disponible
    }
  }, [themeMode]);

  // EFECTO: Escuchar cambios del SO cuando modo es "system"
  useEffect(() => {
    if (themeMode !== "system") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");

    const handler = (e) => {
      const resolved = e.matches ? "dark" : "light";
      setResolvedTheme(resolved);
      applyThemeToDOM(resolved);
    };

    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [themeMode]);

  // FUNCIÓN: Cambiar tema
  const setTheme = useCallback((newMode) => {
    setThemeMode(newMode);
  }, []);

  const value = { theme: resolvedTheme, themeMode, setTheme };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook para consumir el contexto del tema.
 * @returns {{ theme: "light"|"dark", themeMode: "system"|"light"|"dark", setTheme: Function }}
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme debe usarse dentro de un ThemeProvider");
  }
  return context;
}
