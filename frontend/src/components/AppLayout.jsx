/**
 * AppLayout — Layout dashboard SaaS tipo "Shipping Pro".
 *
 * - Sidebar fija a la izquierda con fondo gris oscuro uniforme (ambos temas).
 * - Logo arriba + enlaces específicos del panel activo (/voter o /admin).
 * - Header superior delgado: buscador (izq), switch de tema y wallet (der).
 * - Área de contenido con fondo base del dashboard (un solo color, sin parches).
 */
import React from "react";
import { Link, useLocation } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";
import ConnectWallet from "./ConnectWallet";

// Iconos inline (limpios, estilo UI Kit)
const I = {
  ballot: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M4.5 6.75a.75.75 0 0 0-.75.75v6c0 .414.336.75.75.75h15a.75.75 0 0 0 .75-.75v-6a.75.75 0 0 0-.75-.75h-15Z" />
      <path d="M3.75 17.25a.75.75 0 0 1 .75-.75h15a.75.75 0 0 1 0 1.5h-15a.75.75 0 0 1-.75-.75Z" />
    </svg>
  ),
  shield: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12 2.25a4.5 4.5 0 0 0-4.5 4.5v1.5H6.75a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-.75V6.75a4.5 4.5 0 0 0-4.5-4.5ZM9.75 6.75a2.25 2.25 0 0 1 4.5 0v1.5H9.75v-1.5Z" />
    </svg>
  ),
  search: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" clipRule="evenodd" />
    </svg>
  ),
  home: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M11.47 3.84a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 1-1.06 1.06l-8.69-8.69a.75.75 0 0 0-1.06 0l-8.69 8.69a.75.75 0 1 1-1.06-1.06l8.69-8.69Z" />
      <path d="M12 5.432 4.5 12.932V19.5a1.5 1.5 0 0 0 1.5 1.5h3a.75.75 0 0 0 .75-.75v-4.5a1.5 1.5 0 0 1 1.5-1.5h3a1.5 1.5 0 0 1 1.5 1.5v4.5c0 .414.336.75.75.75h3a1.5 1.5 0 0 0 1.5-1.5v-6.568L12 5.432Z" />
    </svg>
  ),
  switch: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M7.5 3.75A1.5 1.5 0 0 0 6 5.25v13.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5V15a.75.75 0 0 1 1.5 0v3.75a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3V5.25a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3V9A.75.75 0 0 1 15 9V5.25a1.5 1.5 0 0 0-1.5-1.5h-6Zm10.72 4.72a.75.75 0 0 1 1.06 0l3 3a.75.75 0 0 1 0 1.06l-3 3a.75.75 0 1 1-1.06-1.06l1.72-1.72H9a.75.75 0 0 1 0-1.5h10.94l-1.72-1.72a.75.75 0 0 1 0-1.06Z" />
    </svg>
  ),
};

// Enlaces específicos por panel
const NAV = {
  voter: [{ to: "/voter", icon: I.ballot, label: "Candidatos" }],
  admin: [{ to: "/admin", icon: I.shield, label: "Panel de Control" }],
};

export default function AppLayout({
  children,
  cuenta,
  conectarWallet,
  cargando,
  estado,
  totalVotos,
  redOk,
  cambiarRed,
  busqueda,
  setBusqueda,
}) {
  const location = useLocation();
  const esAdmin = location.pathname.startsWith("/admin");
  const items = esAdmin ? NAV.admin : NAV.voter;
  const votacionAbierta = estado === 1;

  return (
    <div className="min-h-screen bg-base-light dark:bg-base-dark transition-colors duration-200 ease-theme-switch flex">
      {/* ── SIDEBAR FIJA (negro profundo con borde luminoso) ──── */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 bg-sidebar-light dark:bg-sidebar-dark dark:bg-gradient-to-b dark:from-[#0A0C14] dark:to-[#05060B] dark:border-r dark:border-white/[0.07] text-text-dark fixed inset-y-0 left-0 z-30 transition-colors duration-200 ease-theme-switch">
        {/* Logo */}
        <div className="px-6 py-6 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-lg shadow-md bg-gradient-to-br from-[#9945FF] to-[#14F195] text-white dark:shadow-[0_0_24px_-4px_rgba(153,69,255,0.7)]">
              C
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight font-display tracking-tight">ChainBallot</h1>
              <p className="text-[11px] text-sidebar-muted leading-tight">Every vote verifiable</p>
            </div>
          </div>
        </div>

        {/* Navegación del panel activo */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          <p className="text-[11px] uppercase tracking-wider text-sidebar-muted px-3 mb-3 font-semibold">
            {esAdmin ? "Administración" : "Votante"}
          </p>
          {items.map((item) => {
            const activo = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  activo
                    ? "bg-gradient-to-r from-[#9945FF]/25 to-[#14F195]/10 text-white border border-[#9945FF]/40 shadow-[0_0_20px_-6px_rgba(153,69,255,0.6)]"
                    : "text-sidebar-muted hover:text-white hover:bg-white/[0.06] border border-transparent"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}

          {/* Link cruzado + Inicio */}
          <div className="pt-4 mt-4 border-t border-white/[0.07] space-y-1">
            <Link
              to={esAdmin ? "/voter" : "/admin"}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-sidebar-muted hover:text-white hover:bg-white/[0.06] border border-transparent transition-all duration-200"
            >
              {esAdmin ? I.ballot : I.shield}
              {esAdmin ? "Ir a Votante" : "Ir a Admin"}
            </Link>
            <Link
              to="/"
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-sidebar-muted hover:text-white hover:bg-white/[0.06] border border-transparent transition-all duration-200"
            >
              {I.home}
              Inicio
            </Link>
          </div>
        </nav>

        {/* Estado en vivo en el pie */}
        <div className="px-4 py-4 border-t border-white/[0.07]">
          <div className={`p-3 rounded-xl text-xs backdrop-blur-sm ${
            votacionAbierta
              ? "bg-success-dark/10 border border-success-dark/30 shadow-[0_0_20px_-8px_rgba(20,241,149,0.5)]"
              : "bg-danger-dark/10 border border-danger-dark/30"
          }`}>
            <p className={`font-bold ${votacionAbierta ? "text-success-dark" : "text-danger-dark"}`}>
              {votacionAbierta ? "● En votación" : "● Cerrada"}
            </p>
            <p className="text-sidebar-muted mt-0.5">{totalVotos} votos emitidos</p>
          </div>
        </div>
      </aside>

      {/* ── COLUMNA PRINCIPAL (con margen para el sidebar fijo) ─────── */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-64">
        {/* Header delgado (glass) */}
        <header className="sticky top-0 z-20 bg-base-light/80 dark:bg-[#05060B]/70 border-b border-border-light dark:border-white/[0.07] backdrop-blur-xl transition-colors duration-200 ease-theme-switch">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
            {/* Buscador a la izquierda */}
            <div className="flex items-center gap-2 flex-1 max-w-sm bg-surface-light dark:bg-white/[0.04] border border-border-light dark:border-white/[0.09] rounded-xl px-3 py-1.5 focus-within:border-brand-primary/50 transition-colors">
              {I.search}
              <input
                type="search"
                value={busqueda || ""}
                onChange={(e) => setBusqueda && setBusqueda(e.target.value)}
                placeholder="Buscar candidato..."
                className="w-full bg-transparent text-sm text-theme placeholder-text-muted-light dark:placeholder-text-muted-dark focus:outline-none"
              />
            </div>

            {/* Tema + wallet */}
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <ConnectWallet cuenta={cuenta} conectarWallet={conectarWallet} cargando={cargando} redOk={redOk} cambiarRed={cambiarRed} />
            </div>
          </div>
        </header>

        {/* Contenido */}
        <main className="flex-1 px-4 sm:px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}