/**
 * ThemeToggle — Selector de Tema (System / Light / Dark)
 *
 * Componente de 3 estados que se muestra en la barra de navegación.
 * Persiste la preferencia en localStorage vía ThemeContext.
 *
 * Diseño:
 * - 3 botones con icono y label
 * - El botón activo usa brand-accent (Sky Aqua) con fondo dark para contraste
 * - Transiciones suaves (duration-200)
 * - Accesibilidad: role="radiogroup", aria-label, aria-checked
 *
 * @component
 */
import React from "react";
import { useTheme } from "../context/ThemeContext";

const OPTIONS = [
  {
    value: "system",
    label: "Sistema",
    iconSystem: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M2.25 5.75a3 3 0 0 1 3-3h13.5a3 3 0 0 1 3 3V16.5a3 3 0 0 1-3 3h-13.5a3 3 0 0 1-3-3V5.75Zm3-1.5A1.5 1.5 0 0 0 .75 5.75v8.25a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V5.75a1.5 1.5 0 0 0-1.5-1.5H5.25ZM12 8.25a.75.75 0 0 1 .75.75v2.25H15a.75.75 0 0 1 0 1.5h-2.25V15a.75.75 0 0 1-1.5 0v-2.25H9a.75.75 0 0 1 0-1.5h2.25V9a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    value: "light",
    label: "Claro",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M12 2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM18.894 6.166a.75.75 0 0 0-1.06-1.06l-1.591 1.59a.75.75 0 1 0 1.06 1.061l1.591-1.59ZM21.75 12a.75.75 0 0 1-.75.75h-2.25a.75.75 0 0 1 0-1.5H21a.75.75 0 0 1 .75.75ZM17.834 18.894a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 1 0-1.061 1.06l1.59 1.591ZM12 18a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-2.25A.75.75 0 0 1 12 18ZM7.758 17.303a.75.75 0 0 0-1.061-1.06l-1.591 1.59a.75.75 0 0 0 1.06 1.061l1.591-1.59ZM6 12a.75.75 0 0 1-.75.75H3a.75.75 0 0 1 0-1.5h2.25A.75.75 0 0 1 6 12ZM6.697 7.757a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 0 0-1.061 1.06l1.59 1.591Z" />
      </svg>
    ),
  },
  {
    value: "dark",
    label: "Oscuro",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 0 1 .162.819A8.97 8.97 0 0 0 9 6a9 9 0 0 0 9 9 8.97 8.97 0 0 0 3.463-.69.75.75 0 0 1 .981.98 10.503 10.503 0 0 1-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 0 1 .818.162Z" clipRule="evenodd" />
      </svg>
    ),
  },
];

/**
 * Componente selector de tema con 3 opciones.
 * Renderiza un grupo de botones tipo radio con iconos.
 */
export default function ThemeToggle() {
  const { themeMode, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Selector de tema"
      className="flex items-center gap-0.5 bg-surface-light dark:bg-surface-dark
                 border border-border-light dark:border-border-dark
                 rounded-lg p-0.5 transition-colors duration-200 ease-theme-switch"
    >
      {OPTIONS.map((opt) => {
        const isActive = themeMode === opt.value;

        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={isActive}
            aria-label={`Tema ${opt.label}`}
            onClick={() => setTheme(opt.value)}
            className={`
              flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold
              transition-all duration-200 ease-theme-switch cursor-pointer select-none
              ${
                isActive
                  ? "bg-brand-accent text-text-light dark:text-text-dark shadow-sm"
                  : "text-text-muted-light dark:text-text-muted-dark hover:text-text-light dark:hover:text-text-dark hover:bg-border-light dark:hover:bg-border-dark"
              }
            `}
          >
            {opt.value === "system" ? opt.iconSystem : opt.icon}
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
