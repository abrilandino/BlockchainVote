/**
 * AdminDashboard — Panel de administración (diseño dashboard SaaS).
 *
 * Layout:
 *  1) Fila superior de KPIs: Estado de Votación, Total de Votos, Candidatos.
 *  2) Grid principal 3 columnas:
 *     - Agregar Candidato (form)
 *     - Control de Votación (abrir/cerrar)
 *     - Resultados en Vivo (tabla tipo lista)
 *
 * Todas las acciones se firman en MetaMask y muestran el enlace a Etherscan.
 */
import React, { useState } from "react";
import ConnectWallet from "../components/ConnectWallet";
import { urlTx, urlDireccion, RED } from "../hooks/useVotacion";

// Candidatos por defecto para una nueva elección
const CANDIDATOS_NUEVA_ELECCION = [
  "Ana Martinez",
  "Carlos Rodriguez",
  "Lucia Fernandez",
  "Diego Sanchez",
  "Valentina Torres",
];

// Iconos pequeños para KPIs
function KpiIcon({ children, color }) {
  return (
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
      {children}
    </div>
  );
}

// Feedback con enlace opcional a la transacción en Etherscan
function Feedback({ feedback, onDismiss }) {
  if (!feedback) return null;
  const ok = feedback.tipo === "ok";
  return (
    <div className={`p-4 rounded-xl border mb-6 ${
      ok
        ? "bg-success-bg-light dark:bg-success-bg-dark border-success-light dark:border-success-dark text-theme"
        : "bg-danger-bg-light dark:bg-danger-bg-dark border-danger-light dark:border-danger-dark text-theme"
    }`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="font-semibold">{ok ? "✓ " : "✕ "}{feedback.texto}</p>
          {feedback.txHash && urlTx(feedback.txHash) && (
            <a
              href={urlTx(feedback.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand-primary dark:text-brand-accent underline mt-2"
            >
              Ver transacción en Etherscan →
            </a>
          )}
        </div>
        {onDismiss && (
          <button onClick={onDismiss} className="text-theme-muted hover:text-theme text-xs font-semibold shrink-0">
            Ocultar
          </button>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboard({
  cuenta,
  isAdmin,
  estado,
  candidatos,
  totalVotos,
  cargando,
  error,
  redOk,
  contrato,
  infoContrato,
  historialElecciones,
  registroVotos,
  conectarWallet,
  cambiarRed,
  agregarCandidato,
  editarCandidato,
  eliminarCandidato,
  abrirVotacion,
  cerrarVotacion,
  desplegarNuevaEleccion,
  usarContrato,
  busqueda,
}) {
  const [nombreCandidato, setNombreCandidato] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [nombreEdicion, setNombreEdicion] = useState("");
  const [candidatoEliminarId, setCandidatoEliminarId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [creandoEleccion, setCreandoEleccion] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const votacionAbierta = estado === 1;

  const copiarDireccion = async () => {
    try {
      await navigator.clipboard.writeText(contrato);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {}
  };

  const handleNuevaEleccion = async () => {
    setFeedback(null);
    setCreandoEleccion(true);
    const res = await desplegarNuevaEleccion(CANDIDATOS_NUEVA_ELECCION);
    setCreandoEleccion(false);
    if (res.exito) {
      setFeedback({
        tipo: "ok",
        texto: `Nueva elección creada: contrato ${res.direccion.slice(0, 10)}... con ${CANDIDATOS_NUEVA_ELECCION.length} candidatos y votación abierta.`,
        txHash: res.txHash,
      });
    } else {
      setFeedback({ tipo: "error", texto: error || "No se pudo crear la nueva elección." });
    }
  };

  const candidatosFiltrados = busqueda
    ? candidatos.filter((c) =>
        c.nombre.toLowerCase().includes(busqueda.toLowerCase())
      )
    : candidatos;

  const handleAgregarCandidato = async (e) => {
    e.preventDefault();
    if (!nombreCandidato.trim()) return;
    setFeedback(null);
    const res = await agregarCandidato(nombreCandidato.trim());
    if (res.exito) {
      setNombreCandidato("");
      setFeedback({ tipo: "ok", texto: "Candidato agregado a la elección.", txHash: res.txHash });
    } else {
      setFeedback({ tipo: "error", texto: error || "No se pudo agregar." });
    }
  };

  const handleEmpezarEdicion = (c) => {
    setEditandoId(c.id);
    setNombreEdicion(c.nombre);
    setCandidatoEliminarId(null);
  };

  const handleGuardarEdicion = async (e) => {
    e.preventDefault();
    if (!editandoId || !nombreEdicion.trim()) return;
    setFeedback(null);
    const res = await editarCandidato(editandoId, nombreEdicion.trim());
    if (res.exito) {
      setFeedback({ tipo: "ok", texto: `Candidato #${editandoId} renombrado.`, txHash: res.txHash });
      setEditandoId(null);
      setNombreEdicion("");
    } else {
      setFeedback({ tipo: "error", texto: error || "No se pudo editar." });
    }
  };

  const handleEliminarCandidato = async () => {
    if (candidatoEliminarId === null) return;
    setFeedback(null);
    const res = await eliminarCandidato(candidatoEliminarId);
    if (res.exito) {
      setFeedback({ tipo: "ok", texto: `Candidato #${candidatoEliminarId} eliminado.`, txHash: res.txHash });
    } else {
      setFeedback({ tipo: "error", texto: error || "No se pudo eliminar." });
    }
    setCandidatoEliminarId(null);
  };

  const handleAbrir = async () => {
    setFeedback(null);
    const res = await abrirVotacion();
    setFeedback(
      res.exito
        ? { tipo: "ok", texto: "Votación abierta. Los votantes ya pueden sufragar.", txHash: res.txHash }
        : { tipo: "error", texto: error || "No se pudo abrir." }
    );
  };

  const handleCerrar = async () => {
    setFeedback(null);
    const res = await cerrarVotacion();
    setFeedback(
      res.exito
        ? { tipo: "ok", texto: "Votación cerrada. Resultados finalizados.", txHash: res.txHash }
        : { tipo: "error", texto: error || "No se pudo cerrar." }
    );
  };

  // ─── Estado: wallet no conectada ────────────────────────────────
  if (!cuenta) {
    return (
      <div className="max-w-xl mx-auto text-center py-16">
        <h1 className="text-3xl font-bold text-theme mb-4">Panel de Administración</h1>
        <p className="text-theme-muted mb-6">Conecta la wallet del administrador para gestionar la elección.</p>
        <ConnectWallet cuenta={cuenta} conectarWallet={conectarWallet} cargando={cargando} redOk={redOk} cambiarRed={cambiarRed} />
      </div>
    );
  }

  // ─── Estado: no es admin ────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto text-center py-16">
        <h1 className="text-3xl font-bold text-theme mb-4">Panel de Administración</h1>
        <div className="bg-danger-bg-light dark:bg-danger-bg-dark border border-danger-light dark:border-danger-dark p-6 rounded-2xl">
          <p className="text-danger-light dark:text-danger-dark font-semibold">
            Esta wallet no tiene permisos de administrador.
          </p>
          <p className="text-theme-muted text-sm mt-2">
            Conecta la wallet que desplegó el contrato.
          </p>
        </div>
      </div>
    );
  }

  // ─── Dashboard principal ────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-theme">Panel de Administración</h1>
          <p className="text-theme-muted text-sm mt-0.5">Gestiona la elección y supervisa los resultados en vivo.</p>
        </div>
        <ConnectWallet cuenta={cuenta} conectarWallet={conectarWallet} cargando={cargando} redOk={redOk} cambiarRed={cambiarRed} />
      </div>

      {/* Aviso de red incorrecta */}
      {!redOk && (
        <div className="p-4 rounded-xl border mb-6 bg-warning-bg-light dark:bg-warning-bg-dark border-warning-light dark:border-warning-dark text-theme flex flex-wrap items-center justify-between gap-3">
          <span>⚠ Tu wallet no está en la red <strong>{RED.nombre}</strong>.</span>
          {cambiarRed && (
            <button onClick={cambiarRed} className="btn-primary text-sm py-2 px-4 shrink-0">
              Cambiar a {RED.nombre}
            </button>
          )}
        </div>
      )}

      {/* Feedback con enlace a Etherscan */}
      <Feedback feedback={feedback} onDismiss={() => setFeedback(null)} />

      {error && !feedback && (
        <div className="bg-danger-bg-light dark:bg-danger-bg-dark border border-danger-light dark:border-danger-dark text-theme p-4 rounded-xl mb-6">
          {error}
        </div>
      )}

      {/* ── FILA DE KPIs (3 tarjetas compactas) ────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {/* Estado de Votación */}
        <div className="card-elevated p-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-theme-muted font-semibold">Estado</p>
            <p className={`text-xl font-bold mt-1 inline-flex items-center gap-2 ${
              votacionAbierta ? "text-success-light dark:text-success-dark" : "text-danger-light dark:text-danger-dark"
            }`}>
              <span className={`w-2.5 h-2.5 rounded-full ${votacionAbierta ? "bg-success-light dark:bg-success-dark" : "bg-danger-light dark:bg-danger-dark"}`} />
              {votacionAbierta ? "Abierta" : "Cerrada"}
            </p>
          </div>
          <KpiIcon color={votacionAbierta ? "bg-success-bg-light dark:bg-success-dark/20" : "bg-danger-bg-light dark:bg-danger-dark/20"}>
            <span className={`w-3 h-3 rounded-full ${votacionAbierta ? "bg-success-light dark:bg-success-dark" : "bg-danger-light dark:bg-danger-dark"}`} />
          </KpiIcon>
        </div>

        {/* Total de Votos */}
        <div className="card-elevated p-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-theme-muted font-semibold">Total de Votos</p>
            <p className="text-2xl font-bold text-brand-primary dark:text-[var(--color-brand-primary)] mt-1">{totalVotos}</p>
          </div>
          <KpiIcon color="bg-brand-accent/15">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-brand-primary dark:text-brand-accent">
              <path d="M3 3.25c0-.414.336-.75.75-.75h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 3.25ZM3 7.25c0-.414.336-.75.75-.75h12a.75.75 0 0 1 0 1.5h-12A.75.75 0 0 1 3 7.25ZM3 11.25c0-.414.336-.75.75-.75h9.5a.75.75 0 0 1 0 1.5h-9.5a.75.75 0 0 1-.75-.75ZM3 15.25c0-.414.336-.75.75-.75h.5a.75.75 0 0 1 0 1.5h-.5a.75.75 0 0 1-.75-.75Z" />
              <path d="m13.28 16.22 1.44 1.44 3.03-3.04a.75.75 0 1 1 1.06 1.06l-3.56 3.56a.75.75 0 0 1-1.06 0l-1.97-1.97a.75.75 0 1 1 1.06-1.06Z" />
            </svg>
          </KpiIcon>
        </div>

        {/* Candidatos Registrados */}
        <div className="card-elevated p-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-theme-muted font-semibold">Candidatos</p>
            <p className="text-2xl font-bold text-theme mt-1">{candidatos.length}</p>
          </div>
          <KpiIcon color="bg-success-bg-light dark:bg-success-dark/20">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-success-light dark:text-success-dark">
              <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.006 8.562l-3.568-3.568-8.179 8.179a4.05 4.05 0 0 0-1.06 1.97l-.553 2.211a.75.75 0 0 0 .904.904l2.211-.553a4.05 4.05 0 0 0 1.97-1.06l8.275-8.275Z" />
              <path d="M5.25 3.75A2.25 2.25 0 0 0 3 6v12.75A2.25 2.25 0 0 0 5.25 21h12.75A2.25 2.25 0 0 0 20.25 18.75V12a.75.75 0 0 0-1.5 0v6.75A.75.75 0 0 1 18 19.5H5.25A.75.75 0 0 1 4.5 18.75V6a.75.75 0 0 1 .75-.75H11a.75.75 0 0 0 0-1.5H5.25Z" />
            </svg>
          </KpiIcon>
        </div>
      </div>

      {/* ── INFORMACIÓN DEL CONTRATO ───────────────────────────────── */}
      <div className="card-elevated p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-bold text-theme">Información del Contrato</h2>
          <span className="badge-accent">v{infoContrato?.version || "2.1.0"}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Dirección */}
          <div className="p-3 rounded-xl bg-surface-light dark:bg-white/[0.04] border border-border-light dark:border-white/[0.08]">
            <p className="text-[10px] uppercase tracking-wide text-theme-muted font-bold mb-1">Dirección</p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-theme truncate">
                {contrato ? `${contrato.slice(0, 12)}...${contrato.slice(-8)}` : "—"}
              </span>
              {contrato && (
                <>
                  <button
                    onClick={copiarDireccion}
                    title="Copiar dirección"
                    className="text-theme-muted hover:text-theme shrink-0"
                  >
                    {copiado ? "✓" : "⧉"}
                  </button>
                  {urlDireccion(contrato) && (
                    <a
                      href={urlDireccion(contrato)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Ver en Etherscan"
                      className="text-brand-primary dark:text-brand-accent font-bold text-xs shrink-0"
                    >
                      ↗
                    </a>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Red */}
          <div className="p-3 rounded-xl bg-surface-light dark:bg-white/[0.04] border border-border-light dark:border-white/[0.08]">
            <p className="text-[10px] uppercase tracking-wide text-theme-muted font-bold mb-1">Red</p>
            <p className="text-sm font-semibold text-theme">
              {infoContrato?.red || RED.nombre}{" "}
              <span className="text-theme-muted font-normal">(chainId {infoContrato?.chainId || RED.id})</span>
            </p>
          </div>

          {/* Administrador */}
          <div className="p-3 rounded-xl bg-surface-light dark:bg-white/[0.04] border border-border-light dark:border-white/[0.08]">
            <p className="text-[10px] uppercase tracking-wide text-theme-muted font-bold mb-1">Administrador (Owner)</p>
            <p className="font-mono text-xs text-theme truncate">
              {infoContrato?.owner
                ? `${infoContrato.owner.slice(0, 10)}...${infoContrato.owner.slice(-8)}`
                : "—"}
            </p>
          </div>

          {/* Fecha de despliegue */}
          <div className="p-3 rounded-xl bg-surface-light dark:bg-white/[0.04] border border-border-light dark:border-white/[0.08]">
            <p className="text-[10px] uppercase tracking-wide text-theme-muted font-bold mb-1">Fecha de Despliegue</p>
            <p className="text-sm font-semibold text-theme">
              {infoContrato?.fechaDespliegue
                ? new Date(infoContrato.fechaDespliegue).toLocaleString("es-MX", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "—"}
            </p>
          </div>

          {/* Tx de despliegue */}
          <div className="p-3 rounded-xl bg-surface-light dark:bg-white/[0.04] border border-border-light dark:border-white/[0.08] sm:col-span-2">
            <p className="text-[10px] uppercase tracking-wide text-theme-muted font-bold mb-1">Transacción de Despliegue</p>
            {infoContrato?.txDespliegue ? (
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-theme truncate">
                  {infoContrato.txDespliegue.slice(0, 20)}...
                </span>
                {urlTx(infoContrato.txDespliegue) && (
                  <a
                    href={urlTx(infoContrato.txDespliegue)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-brand-primary dark:text-brand-accent underline shrink-0"
                  >
                    Ver en Etherscan →
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-theme-muted">No registrada (desplegada por script)</p>
            )}
          </div>

          {/* Gas usado */}
          <div className="p-3 rounded-xl bg-surface-light dark:bg-white/[0.04] border border-border-light dark:border-white/[0.08]">
            <p className="text-[10px] uppercase tracking-wide text-theme-muted font-bold mb-1">Gas del Despliegue</p>
            <p className="text-sm font-semibold text-theme">
              {infoContrato?.gasUsado ? Number(infoContrato.gasUsado).toLocaleString("es-MX") : "—"}
            </p>
          </div>

          {/* Costo */}
          <div className="p-3 rounded-xl bg-surface-light dark:bg-white/[0.04] border border-border-light dark:border-white/[0.08]">
            <p className="text-[10px] uppercase tracking-wide text-theme-muted font-bold mb-1">Costo del Despliegue</p>
            <p className="text-sm font-semibold text-brand-primary dark:text-brand-accent">
              {infoContrato?.costoEth ? `${Number(infoContrato.costoEth).toFixed(6)} ETH` : "—"}
            </p>
          </div>

          {/* Candidatos iniciales */}
          <div className="p-3 rounded-xl bg-surface-light dark:bg-white/[0.04] border border-border-light dark:border-white/[0.08] sm:col-span-2 lg:col-span-1">
            <p className="text-[10px] uppercase tracking-wide text-theme-muted font-bold mb-1">Candidatos Iniciales</p>
            <p className="text-sm font-semibold text-theme">
              {infoContrato?.candidatosIniciales ?? candidatos.length}
            </p>
          </div>

          {/* Estado on-chain */}
          <div className="p-3 rounded-xl bg-surface-light dark:bg-white/[0.04] border border-border-light dark:border-white/[0.08]">
            <p className="text-[10px] uppercase tracking-wide text-theme-muted font-bold mb-1">Estado On-Chain</p>
            <p className={`text-sm font-bold ${votacionAbierta ? "text-success-light dark:text-success-dark" : "text-danger-light dark:text-danger-dark"}`}>
              {votacionAbierta ? "ABIERTA" : "CERRADA"}
            </p>
          </div>
        </div>
      </div>

      {/* ── NUEVA ELECCIÓN + HISTORIAL ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Crear nueva elección */}
        <div className="card-elevated p-5">
          <h2 className="text-base font-bold text-theme mb-2">Crear Nueva Elección</h2>
          <p className="text-xs text-theme-muted mb-4">
            Despliega un contrato nuevo e independiente con {CANDIDATOS_NUEVA_ELECCION.length} candidatos precargados y la votación abierta — todo en una sola transacción firmada con MetaMask.
          </p>
          <button
            onClick={handleNuevaEleccion}
            disabled={creandoEleccion || cargando || !redOk}
            className="w-full btn-primary"
          >
            {creandoEleccion ? "Desplegando contrato nuevo... confirma en MetaMask" : "+ Nueva Elección (contrato nuevo)"}
          </button>
          {!redOk && (
            <p className="text-xs text-warning-light dark:text-warning-dark mt-2">
              Conecta MetaMask a {RED.nombre} para poder desplegar.
            </p>
          )}
        </div>

        {/* Historial de elecciones */}
        <div className="card-elevated p-5">
          <h2 className="text-base font-bold text-theme mb-4">Elecciones Creadas ({historialElecciones.length})</h2>
          {historialElecciones.length === 0 ? (
            <p className="text-theme-muted text-sm py-4 text-center">
              Aún no creas elecciones desde el navegador. El contrato actual fue desplegado por script.
            </p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {historialElecciones.map((e) => (
                <div
                  key={e.address}
                  className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border ${
                    e.address === contrato
                      ? "bg-brand-primary/10 dark:bg-brand-primary/15 border-brand-primary/40"
                      : "bg-surface-light dark:bg-white/[0.04] border-border-light dark:border-white/[0.08]"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-theme truncate">
                      {e.address.slice(0, 14)}...{e.address.slice(-6)}
                    </p>
                    <p className="text-[11px] text-theme-muted">
                      {new Date(e.fecha).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
                      {" · "}
                      {e.candidatos} candidatos
                      {e.address === contrato && <span className="text-success-light dark:text-success-dark font-bold"> · ACTIVO</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {urlTx(e.txHash) && (
                      <a href={urlTx(e.txHash)} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-primary dark:text-brand-accent font-bold" title="Ver despliegue en Etherscan">
                        ↗
                      </a>
                    )}
                    {e.address !== contrato && (
                      <button
                        onClick={() => usarContrato(e.address)}
                        disabled={cargando}
                        className="text-xs font-bold text-white bg-gradient-to-r from-[#9945FF] to-[#7C40E6] rounded-lg px-3 py-1.5 hover:brightness-110 transition-all disabled:opacity-50"
                      >
                        Usar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── GRID PRINCIPAL (3 columnas) ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Col 1: Gestión de Candidatos */}
        <div className="card-elevated p-5">
          <h2 className="text-base font-bold text-theme mb-4">Gestión de Candidatos</h2>

          {/* Agregar */}
          <form onSubmit={handleAgregarCandidato}>
            <input
              type="text"
              value={nombreCandidato}
              onChange={(e) => setNombreCandidato(e.target.value)}
              placeholder="Nombre del candidato nuevo"
              disabled={votacionAbierta || cargando}
              className="input-theme"
            />
            <button
              type="submit"
              disabled={votacionAbierta || cargando || !nombreCandidato.trim() || !redOk}
              className="w-full btn-primary"
            >
              {cargando ? "Confirma en MetaMask..." : "+ Agregar"}
            </button>
          </form>

          {/* Lista editable de candidatos */}
          <div className="mt-4 space-y-2 max-h-72 overflow-y-auto pr-1">
            {candidatos.length === 0 && (
              <p className="text-theme-muted text-sm text-center py-3">Sin candidatos registrados.</p>
            )}
            {candidatosFiltrados.map((c) =>
              editandoId === c.id ? (
                /* Fila de edición */
                <form key={c.id} onSubmit={handleGuardarEdicion} className="p-2.5 rounded-xl border border-brand-primary/40 bg-brand-primary/5">
                  <p className="text-[10px] uppercase tracking-wide text-theme-muted font-bold mb-1.5">
                    Editando #{c.id} ({c.votos} votos)
                  </p>
                  <input
                    type="text"
                    value={nombreEdicion}
                    onChange={(e) => setNombreEdicion(e.target.value)}
                    disabled={votacionAbierta || cargando}
                    autoFocus
                    className="input-theme !py-1.5 text-sm mb-2"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={votacionAbierta || cargando || !nombreEdicion.trim() || !redOk}
                      className="flex-1 text-xs font-bold text-white bg-gradient-to-r from-[#9945FF] to-[#7C40E6] rounded-lg py-1.5 hover:brightness-110 transition-all disabled:opacity-50"
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditandoId(null); setNombreEdicion(""); }}
                      className="flex-1 text-xs font-semibold text-theme-muted border border-border-light dark:border-border-dark rounded-lg py-1.5 hover:text-theme transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : candidatoEliminarId === c.id ? (
                /* Confirmación de borrado */
                <div key={c.id} className="p-2.5 rounded-xl border border-danger-light/50 dark:border-danger-dark/50 bg-danger-bg-light dark:bg-danger-bg-dark">
                  <p className="text-xs font-semibold text-danger-light dark:text-danger-dark mb-2">
                    ¿Eliminar "{c.nombre}"? Esta acción no se puede deshacer.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleEliminarCandidato}
                      disabled={cargando || !redOk}
                      className="flex-1 text-xs font-bold text-white bg-danger-light dark:bg-danger-dark rounded-lg py-1.5 hover:brightness-110 transition-all disabled:opacity-50"
                    >
                      {cargando ? "Eliminando..." : "Sí, eliminar"}
                    </button>
                    <button
                      onClick={() => setCandidatoEliminarId(null)}
                      className="flex-1 text-xs font-semibold text-theme-muted border border-border-light dark:border-border-dark rounded-lg py-1.5 hover:text-theme transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                /* Fila normal */
                <div key={c.id} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-surface-light dark:bg-white/[0.04] border border-border-light dark:border-white/[0.08]">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-theme truncate">{c.nombre}</p>
                    <p className="text-[11px] text-theme-muted">#{c.id} · {c.votos} voto{c.votos === 1 ? "" : "s"}</p>
                  </div>
                  {!votacionAbierta && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleEmpezarEdicion(c)}
                        disabled={cargando || editandoId !== null || candidatoEliminarId !== null}
                        title="Editar nombre"
                        className="text-theme-muted hover:text-brand-primary dark:hover:text-brand-accent px-1.5 py-1 rounded-md transition-colors disabled:opacity-40"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => { setCandidatoEliminarId(c.id); setEditandoId(null); }}
                        disabled={cargando || editandoId !== null || candidatoEliminarId !== null || c.votos > 0}
                        title={c.votos > 0 ? "No se puede eliminar: tiene votos" : "Eliminar candidato"}
                        className="text-theme-muted hover:text-danger-light dark:hover:text-danger-dark px-1.5 py-1 rounded-md transition-colors disabled:opacity-40"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              )
            )}
          </div>

          {votacionAbierta && (
            <p className="text-xs text-warning-light dark:text-warning-dark mt-3">
              Cierra la votación para editar la lista de candidatos.
            </p>
          )}
        </div>

        {/* Col 2: Control de Votación */}
        <div className="card-elevated p-5">
          <h2 className="text-base font-bold text-theme mb-4">Control de Votación</h2>
          <div className="space-y-3">
            <button
              onClick={handleAbrir}
              disabled={votacionAbierta || cargando || candidatos.length === 0 || !redOk}
              className="w-full bg-success-light dark:bg-success-dark hover:opacity-90 text-white font-semibold py-2.5 rounded-xl transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Abrir Votación
            </button>
            <button
              onClick={handleCerrar}
              disabled={!votacionAbierta || cargando || !redOk}
              className="w-full bg-danger-light dark:bg-danger-dark hover:opacity-90 text-white font-semibold py-2.5 rounded-xl transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cerrar Votación
            </button>
          </div>
          {candidatos.length === 0 && (
            <p className="text-xs text-theme-muted mt-2">
              Agrega al menos un candidato antes de abrir.
            </p>
          )}
        </div>

        {/* Col 3: Resultados en Vivo */}
        <div className="card-elevated p-5">
          <h2 className="text-base font-bold text-theme mb-4">Resultados en Vivo</h2>
          {candidatos.length === 0 ? (
            <p className="text-theme-muted text-center py-4">Sin candidatos.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {[...candidatosFiltrados]
                .sort((a, b) => b.votos - a.votos)
                .map((c, idx) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-brand-primary dark:bg-[var(--color-brand-primary)] text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-medium text-theme text-sm truncate">{c.nombre}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-brand-primary dark:text-[var(--color-brand-primary)]">{c.votos}</span>
                      <span className="text-xs text-theme-muted ml-1">
                        ({totalVotos > 0 ? Math.round((c.votos / totalVotos) * 100) : 0}%)
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* ── REGISTRO DE VOTOS (LOG DE TRANSACCIONES) ────────────── */}
      <div className="card-elevated p-5 mb-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-bold text-theme">Registro de Votos</h2>
          <span className="text-xs text-theme-muted">{registroVotos.length} transacciones</span>
        </div>
        {registroVotos.length === 0 ? (
          <p className="text-theme-muted text-sm text-center py-6">
            Aún no se han emitido votos. Aparecerán aquí en tiempo real.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-light dark:border-white/[0.07]">
                  <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wide text-theme-muted font-bold">Votante</th>
                  <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wide text-theme-muted font-bold">Candidato</th>
                  <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wide text-theme-muted font-bold">Hash Tx</th>
                  <th className="text-right py-2 px-3 text-[10px] uppercase tracking-wide text-theme-muted font-bold">Bloque</th>
                </tr>
              </thead>
              <tbody>
                {registroVotos.map((v, i) => (
                  <tr key={`${v.txHash}-${i}`} className="border-b border-border-light dark:border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 px-3 font-mono text-xs text-theme">
                      {v.votante.slice(0, 6)}...{v.votante.slice(-4)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-brand-primary dark:text-brand-accent">
                        {v.candidatoNombre}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {v.txHash && urlTx(v.txHash) ? (
                        <a
                          href={urlTx(v.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-brand-primary dark:text-brand-cyan underline"
                        >
                          {v.txHash.slice(0, 10)}...{v.txHash.slice(-6)} ↗
                        </a>
                      ) : (
                        <span className="font-mono text-xs text-theme-muted">
                          {v.txHash ? `${v.txHash.slice(0, 10)}...` : "—"}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right text-xs text-theme-muted">
                      #{v.bloque}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
