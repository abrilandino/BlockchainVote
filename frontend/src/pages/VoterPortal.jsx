/**
 * VoterPortal — Portal del votante.
 *
 * - Tarjetas para seleccionar/cambiar de candidato con feedback visual.
 * - Voto directo firmado en MetaMask.
 * - Muestra solo confirmación del voto SIN hash (el hash está en el log del admin).
 * - Cambio de voto: restar al anterior, sumar al nuevo (contrato).
 */
import React, { useState, useEffect } from "react";
import ConnectWallet from "../components/ConnectWallet";
import { urlDireccion, RED } from "../hooks/useVotacion";

export default function VoterPortal({
  cuenta,
  estado,
  candidatos,
  totalVotos,
  votoActual,
  cargando,
  error,
  redOk,
  contrato,
  conectarWallet,
  cambiarRed,
  emitirVoto,
  cargarEstado,
  cargarMiVoto,
  busqueda,
}) {
  const [feedback, setFeedback] = useState(null); // { tipo: 'ok'|'error', texto }
  const [votandoId, setVotandoId] = useState(null); // id en proceso
  const votacionAbierta = estado === 1;

  // Candidato filtrado por búsqueda del header
  const filtrados = busqueda
    ? candidatos.filter((c) => c.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : candidatos;

  // Refrescar estado + mi voto cuando cambia la cuenta
  useEffect(() => {
    if (cuenta) {
      cargarEstado();
      cargarMiVoto();
    } else {
      setFeedback(null);
    }
  }, [cuenta]);

  const handleVotar = async (candidatoId) => {
    if (!votacionAbierta) return;
    setVotandoId(candidatoId);
    setFeedback(null);
    const res = await emitirVoto(candidatoId);
    setVotandoId(null);

    if (res.exito) {
      const nombre = candidatos.find((c) => c.id === candidatoId)?.nombre || `#${candidatoId}`;
      setFeedback({
        tipo: "ok",
        texto: res.cambioVoto
          ? `Voto reasignado a "${nombre}". Tu voto ha sido registrado en la blockchain.`
          : `¡Voto por "${nombre}" registrado! Tu voto ha sido registrado en la blockchain.`,
      });
    } else {
      setFeedback({ tipo: "error", texto: error || "No se pudo votar." });
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-theme font-display tracking-tight">Portal del <span className="text-gradient">Votante</span></h1>
          <p className="text-theme-muted text-sm mt-0.5">Securing Every Vote, Verifying Every Result.</p>
        </div>
        <div className="flex items-center gap-3">
          <ConnectWallet cuenta={cuenta} conectarWallet={conectarWallet} cargando={cargando} redOk={redOk} cambiarRed={cambiarRed} />
          <span className={`px-4 py-2 rounded-xl text-sm font-semibold border inline-flex items-center gap-2 ${
            votacionAbierta
              ? "bg-success-bg-light dark:bg-success-bg-dark border-success-light dark:border-success-dark text-success-light dark:text-success-dark"
              : "bg-danger-bg-light dark:bg-danger-bg-dark border-danger-light dark:border-danger-dark text-danger-light dark:text-danger-dark"
          }`}>
            <span className={`w-2 h-2 rounded-full ${votacionAbierta ? "bg-success-light dark:bg-success-dark" : "bg-danger-light dark:bg-danger-dark"}`} />
            {votacionAbierta ? "Abierta" : "Cerrada"}
          </span>
        </div>
      </div>

      {/* Aviso de red incorrecta */}
      {cuenta && !redOk && (
        <div className="p-4 rounded-xl border mb-6 bg-warning-bg-light dark:bg-warning-bg-dark border-warning-light dark:border-warning-dark text-theme flex flex-wrap items-center justify-between gap-3">
          <span>
            ⚠ Tu wallet no está en la red <strong>{RED.nombre}</strong>. Cambia de red para interactuar con la elección.
          </span>
          {cambiarRed && (
            <button onClick={cambiarRed} className="btn-primary text-sm py-2 px-4 shrink-0">
              Cambiar a {RED.nombre}
            </button>
          )}
        </div>
      )}

      {/* Feedback relámpago */}
      {feedback && (
        <div className={`p-4 rounded-xl border mb-6 transition-colors duration-200 ${
          feedback.tipo === "ok"
            ? "bg-success-bg-light dark:bg-success-bg-dark border-success-light dark:border-success-dark text-theme"
            : "bg-danger-bg-light dark:bg-danger-bg-dark border-danger-light dark:border-danger-dark text-theme"
        }`}>
          {feedback.tipo === "ok" ? "✓ " : "✕ "}
          {feedback.texto}
        </div>
      )}

      {error && !feedback && (
        <div className="bg-danger-bg-light dark:bg-danger-bg-dark border border-danger-light dark:border-danger-dark text-theme p-4 rounded-xl mb-6">
          {error}
        </div>
      )}

      {/* Resumen bento */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card-elevated p-5">
          <p className="text-xs uppercase tracking-wide text-theme-muted font-semibold">Votos emitidos</p>
          <p className="text-2xl font-bold text-brand-primary dark:text-[var(--color-brand-primary)] mt-1">{totalVotos}</p>
        </div>
        <div className="card-elevated p-5">
          <p className="text-xs uppercase tracking-wide text-theme-muted font-semibold">Candidatos</p>
          <p className="text-2xl font-bold text-theme mt-1">{candidatos.length}</p>
        </div>
        <div className="card-elevated p-5">
          <p className="text-xs uppercase tracking-wide text-theme-muted font-semibold">Tu voto</p>
          <p className="text-2xl font-bold text-brand-accent dark:text-[var(--color-brand-accent)] mt-1">
            {cuenta && votoActual > 0
              ? (candidatos.find((c) => c.id === votoActual)?.nombre || `#${votoActual}`)
              : "—"}
          </p>
        </div>
      </div>

      {/* Lista de candidatos (tarjetas para cambiar de voto) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtrados.map((c) => {
          const esMiVoto = cuenta && votoActual === c.id;
          const enProceso = votandoId === c.id;
          const deshabilitado = cargando || !votacionAbierta || !redOk || !cuenta;
          return (
            <div
              key={c.id}
              className={`card-elevated p-5 transition-all duration-200 ease-theme-switch ${
                esMiVoto ? "ring-2 ring-brand-primary dark:ring-brand-accent" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-3 gap-2">
                <h3 className="text-lg font-bold text-theme truncate">{c.nombre}</h3>
                <div className="flex items-center gap-2 shrink-0">
                  {esMiVoto && (
                    <span className="text-[10px] font-bold uppercase tracking-wide bg-brand-primary dark:bg-brand-accent text-white dark:text-text-dark px-2 py-0.5 rounded-full">
                      Tu voto
                    </span>
                  )}
                  <span className="badge-accent">#{c.id}</span>
                </div>
              </div>

              {/* Conteo + barra */}
              <div className="mb-4">
                <div className="flex justify-between text-sm text-theme-muted mb-1.5">
                  <span>Votos</span>
                  <span className="font-bold text-lg text-brand-primary dark:text-[var(--color-brand-primary)] transition-colors duration-200">
                    {c.votos}
                  </span>
                </div>
                <div className="w-full bg-border-light dark:bg-border-dark rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-brand-primary dark:bg-brand-accent h-2 rounded-full transition-all duration-500 ease-theme-switch"
                    style={{ width: `${totalVotos > 0 ? Math.round((c.votos / totalVotos) * 100) : 0}%` }}
                  ></div>
                </div>
                <p className="text-right text-xs text-theme-muted mt-1">
                  {totalVotos > 0 ? Math.round((c.votos / totalVotos) * 100) : 0}%
                </p>
              </div>

              {/* Botón de voto */}
              <button
                onClick={() => handleVotar(c.id)}
                disabled={deshabilitado}
                className={`w-full py-2.5 rounded-xl font-semibold transition-all duration-200 ease-theme-switch ${
                  esMiVoto
                    ? "bg-success-light dark:bg-success-dark text-white"
                    : votacionAbierta && redOk && cuenta
                    ? "bg-brand-primary hover:bg-brand-primary-hover dark:bg-[var(--color-brand-primary)] dark:hover:brightness-110 text-white"
                    : "bg-border-light dark:bg-border-dark text-theme-muted cursor-not-allowed"
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {enProceso
                  ? "Confirma en MetaMask..."
                  : esMiVoto
                  ? "✓ Votaste por este"
                  : !cuenta
                  ? "Conecta tu wallet para votar"
                  : votoActual > 0
                  ? "Cambiar a este"
                  : "Votar"}
              </button>
            </div>
          );
        })}
      </div>

      {candidatos.length === 0 && (
        <div className="text-center text-theme-muted py-12 card-theme">
          No hay candidatos registrados aún. Espera al administrador.
        </div>
      )}

      {busqueda && filtrados.length === 0 && (
        <div className="text-center text-theme-muted py-12 card-theme">
          No hay resultados para "{busqueda}".
        </div>
      )}

      {/* Info del contrato (siempre visible) */}
      {contrato && urlDireccion(contrato) && (
        <p className="text-center text-xs text-theme-muted mt-10">
          Contrato de la elección:{" "}
          <a
            href={urlDireccion(contrato)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono underline hover:text-brand-primary dark:hover:text-brand-accent"
          >
            {contrato}
          </a>{" "}
          · Red {RED.nombre}
        </p>
      )}
      {contrato && !urlDireccion(contrato) && (
        <p className="text-center text-xs text-theme-muted mt-10">
          Contrato de la elección: <span className="font-mono">{contrato}</span> · Red local {RED.nombre} (sin Etherscan)
        </p>
      )}
    </div>
  );
}
