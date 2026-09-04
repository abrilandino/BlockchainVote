import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";
import ConnectWallet from "../components/ConnectWallet";

const FEATURES = [
  {
    icon: "ZK",
    title: "Votos en la Blockchain",
    desc: "Cada voto se registra on-chain con un hash único verificable en Etherscan. Transparencia total e immutable.",
  },
  {
    icon: "⚡",
    title: "Instantáneo",
    desc: "Confirmación del voto en segundos con MetaMask. Sin servidores intermediarios, sin punto único de fallo.",
  },
  {
    icon: "🛡️",
    title: "Verificación Pública",
    desc: "Cualquier persona puede auditar los resultados en tiempo real directamente desde la blockchain.",
  },
];

export default function Landing({
  cuenta,
  conectarWallet,
  cargando,
  redOk,
  cambiarRed,
  totalVotos,
  candidatos,
}) {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="min-h-screen">
      {/* ── NAVBAR ─────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 flex justify-between items-center px-6 md:px-[8%] py-4 backdrop-blur-xl border-b border-white/[0.07]">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-3 h-3 bg-[#00F0FF] rounded-full shadow-[0_0_10px_#00F0FF]" />
          <span className="font-display text-lg font-bold tracking-wider">CHAINBALLOT</span>
        </Link>
        <div className="flex items-center gap-6">
          <Link to="/voter" className="text-[#8E8EA8] hover:text-white transition-colors text-sm">
            Votar
          </Link>
          <Link to="/admin" className="text-[#8E8EA8] hover:text-white transition-colors text-sm">
            Admin
          </Link>
          <ThemeToggle />
          <ConnectWallet
            cuenta={cuenta}
            conectarWallet={conectarWallet}
            cargando={cargando}
            redOk={redOk}
            cambiarRed={cambiarRed}
          />
        </div>
      </nav>

      <main>
        {/* ── HERO ─────────────────────────────────────────────────── */}
        <section className="py-24 md:py-32 px-6 text-center max-w-[1000px] mx-auto">
          <h1
            className={`font-display text-5xl md:text-7xl lg:text-[5.5rem] leading-[1.05] tracking-tight font-bold mb-6 transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            El Futuro de las
            <br />
            <span className="text-gradient">Elecciones.</span>
          </h1>
          <p
            className={`text-[#8E8EA8] text-lg md:text-xl max-w-[680px] mx-auto mb-10 font-light leading-relaxed transition-all duration-700 delay-150 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            Sistema electoral transparente y descentralizado. Cada voto se registra en
            la blockchain con un hash verificable en Etherscan.
          </p>
          <div
            className={`flex gap-5 justify-center flex-wrap transition-all duration-700 delay-300 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <Link to="/voter" className="btn-primary text-base px-8 py-3.5">
              Emitir Voto
            </Link>
            <Link to="/admin" className="btn-outline text-base px-8 py-3.5">
              Panel Admin
            </Link>
          </div>
        </section>

        {/* ── ECOSYSTEM TICKER ─────────────────────────────────────── */}
        <section className="mx-[8%] border-y border-white/[0.07] py-5 text-center">
          <p className="text-xs uppercase tracking-[2px] text-[#8E8EA8] mb-4">
            Construido con Infraestructura Blockchain
          </p>
          <div className="flex justify-center gap-8 opacity-50 font-bold tracking-wider text-sm flex-wrap">
            <span>ETHEREUM</span>
            <span>HARDHAT</span>
            <span>METAMASK</span>
            <span>ETHERSCAN</span>
            <span>OPENZEPPELIN</span>
          </div>
        </section>

        {/* ── STATS ────────────────────────────────────────────────── */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-[1100px] mx-auto my-16 px-5">
          <div className="card-elevated p-10 text-center">
            <div className="font-display text-5xl font-bold mb-2 text-[#9945FF]">
              {totalVotos || 0}
            </div>
            <div className="text-xs uppercase tracking-[1px] text-[#8E8EA8]">
              Votos Emitidos
            </div>
          </div>
          <div className="card-elevated p-10 text-center">
            <div className="font-display text-5xl font-bold mb-2 text-[#00F0FF]">
              {candidatos?.length || 0}
            </div>
            <div className="text-xs uppercase tracking-[1px] text-[#8E8EA8]">
              Candidatos
            </div>
          </div>
          <div className="card-elevated p-10 text-center">
            <div className="font-display text-5xl font-bold mb-2 text-[#14F195]">
              100%
            </div>
            <div className="text-xs uppercase tracking-[1px] text-[#8E8EA8]">
              Verificable en Etherscan
            </div>
          </div>
        </section>

        {/* ── FEATURES ─────────────────────────────────────────────── */}
        <section className="max-w-[1100px] mx-auto mb-24 px-5">
          <div className="mb-14">
            <h2 className="font-display text-3xl md:text-4xl tracking-tight font-bold mb-3">
              Diseñado para Transparencia Total
            </h2>
            <p className="text-[#8E8EA8]">
              Eliminando el fraude electoral con garantías matemáticas.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="card-elevated p-9 transition-all duration-300 hover:-translate-y-1.5 hover:border-[rgba(0,240,255,0.4)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.8)]"
              >
                <div className="w-12 h-12 rounded-xl bg-[rgba(153,69,255,0.1)] border border-[#9945FF] flex items-center justify-center text-[#00F0FF] font-bold mb-6">
                  {f.icon}
                </div>
                <h3 className="font-display text-xl font-bold mb-3">{f.title}</h3>
                <p className="text-[#8E8EA8] text-[0.95rem] leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA FINAL ────────────────────────────────────────────── */}
        <section className="text-center py-20 px-6">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            <span className="text-gradient">Únete a la Revolución Electoral</span>
          </h2>
          <p className="text-[#8E8EA8] mb-8 max-w-md mx-auto">
            Votos transparentes, resultados verificables, democracia descentralizada.
          </p>
          <Link to="/voter" className="btn-primary text-base px-10 py-4">
            Emitir Mi Voto
          </Link>
        </section>
      </main>

      {/* ── FOOTER ─────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.07] px-[8%] py-12 flex justify-between items-center flex-wrap gap-5">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 bg-[#00F0FF] rounded-full shadow-[0_0_8px_#00F0FF]" />
          <span className="font-display text-sm font-bold tracking-wider">CHAINBALLOT</span>
        </div>
        <p className="text-[#8E8EA8] text-xs">
          © 2026 ChainBallot Protocol. Construido para democracias soberanas.
        </p>
      </footer>
    </div>
  );
}
