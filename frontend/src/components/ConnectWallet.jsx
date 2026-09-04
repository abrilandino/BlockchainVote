/**
 * ConnectWallet — Conexión de MetaMask con indicador de red (Sepolia).
 *
 * - Desconectado: botón primario "Conectar MetaMask".
 * - Conectado en Sepolia: badge verde con la dirección truncada.
 * - Conectado en otra red: badge ámbar con botón para cambiar a Sepolia.
 */
import React from "react";
import { urlDireccion, RED } from "../hooks/useVotacion";

export default function ConnectWallet({
  cuenta,
  conectarWallet,
  cargando,
  redOk,
  cambiarRed,
}) {
  if (cuenta && !redOk) {
    return (
      <div className="flex items-center gap-2 bg-warning-bg-light dark:bg-warning-bg-dark border border-warning-light dark:border-warning-dark rounded-lg px-3 py-2 transition-colors duration-200">
        <span className="w-3 h-3 bg-warning-light dark:bg-warning-dark rounded-full animate-pulse shrink-0"></span>
        <span className="text-sm font-mono text-theme hidden sm:inline">
          {cuenta.slice(0, 6)}...{cuenta.slice(-4)}
        </span>
        <span className="text-xs font-semibold text-warning-light dark:text-warning-dark">
          Red incorrecta
        </span>
        {cambiarRed && (
          <button
            onClick={cambiarRed}
            className="text-xs font-bold text-white bg-warning-light dark:bg-warning-dark rounded-md px-2 py-1 hover:opacity-90 transition-opacity"
          >
            Ir a {RED.nombre}
          </button>
        )}
      </div>
    );
  }

  if (cuenta) {
    const enlace = urlDireccion(cuenta);
    return (
      <div
        title={enlace ? "Ver wallet en Etherscan" : undefined}
        className="flex items-center gap-2 bg-success-bg-light dark:bg-success-bg-dark border border-success-light dark:border-success-dark rounded-lg px-4 py-2 transition-colors duration-200 hover:opacity-90"
      >
        <span className="w-3 h-3 bg-success-light dark:bg-success-dark rounded-full animate-pulse"></span>
        <span className="text-sm font-mono text-theme">
          {cuenta.slice(0, 6)}...{cuenta.slice(-4)}
        </span>
      </div>
    );
  }

  return (
    <button onClick={conectarWallet} disabled={cargando} className="btn-primary">
      {cargando ? "Conectando..." : "Conectar MetaMask"}
    </button>
  );
}
