/**
 * App.jsx — Componente raíz con routing por vistas independientes.
 *
 * Rutas:
 *  - /         → Landing page (hero Solana-style, sin sidebar)
 *  - /voter    → Portal del Votante (con sidebar)
 *  - /admin    → Panel de Administración (con sidebar)
 *
 * La búsqueda del header se comparte con el contenido vía state local.
 */
import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useVotacion } from "./hooks/useVotacion";
import AppLayout from "./components/AppLayout";
import Landing from "./pages/Landing";
import VoterPortal from "./pages/VoterPortal";
import AdminDashboard from "./pages/AdminDashboard";

function RequireAdmin({ cuenta, isAdmin, children }) {
  if (!cuenta) return <Navigate to="/" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

function Shell() {
  const votacion = useVotacion();
  const [busqueda, setBusqueda] = useState("");

  const layoutProps = {
    cuenta: votacion.cuenta,
    conectarWallet: votacion.conectarWallet,
    cargando: votacion.cargando,
    estado: votacion.estado,
    totalVotos: votacion.totalVotos,
    redOk: votacion.redOk,
    cambiarRed: votacion.cambiarRed,
    busqueda,
    setBusqueda,
  };

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Landing
            cuenta={votacion.cuenta}
            conectarWallet={votacion.conectarWallet}
            cargando={votacion.cargando}
            redOk={votacion.redOk}
            cambiarRed={votacion.cambiarRed}
            totalVotos={votacion.totalVotos}
            candidatos={votacion.candidatos}
          />
        }
      />

      <Route path="/voter" element={<AppLayout {...layoutProps}><VoterPortal {...votacion} busqueda={busqueda} /></AppLayout>} />
      <Route
        path="/admin"
        element={
          <RequireAdmin cuenta={votacion.cuenta} isAdmin={votacion.isAdmin}>
            <AppLayout {...layoutProps}><AdminDashboard {...votacion} busqueda={busqueda} /></AppLayout>
          </RequireAdmin>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
