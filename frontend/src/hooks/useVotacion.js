import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import VotacionABI from "../abis/Votacion.json";
import VotacionArtifact from "../abis/VotacionArtifact.json";
import direccionContrato from "../contractAddress.json";

// ─── Redes soportadas (según dónde se desplegó el contrato) ─────────
const REDES = {
  sepolia: {
    id: 11155111,
    hex: "0xaa36a7",
    nombre: "Sepolia",
    rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
    explorer: "https://sepolia.etherscan.io",
    moneda: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
  },
  localhost: {
    id: 31337,
    hex: "0x7a69",
    nombre: "Hardhat Local",
    rpcUrls: ["http://127.0.0.1:8545"],
    explorer: null, // red local: no hay explorador público
    moneda: { name: "ETH", symbol: "ETH", decimals: 18 },
  },
};

// La red activa la define el campo "network" que escribe scripts/deploy.js
export const RED = REDES[direccionContrato.network] || REDES.sepolia;
export const EXPLORER = RED.explorer;

export const urlTx = (hash) => (EXPLORER ? `${EXPLORER}/tx/${hash}` : null);
export const urlDireccion = (addr) =>
  EXPLORER ? `${EXPLORER}/address/${addr}` : null;

const CONTRATO_JSON = direccionContrato.address;

// ─── Persistencia local: contrato activo e historial de elecciones ──
// v3: invalida direcciones en caché de elecciones creadas con el ABI
// anterior (sin editarCandidato/eliminarCandidato).
const ACTIVA_KEY = "chainballot-contrato-activo-v3";
const HIST_KEY = "chainballot-elecciones";

const leerHistorial = () => {
  try {
    return JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
  } catch {
    return [];
  }
};

// ─── Obtener provider de wallet (prioriza MetaMask sobre Phantom) ──
function obtenerEthereum() {
  if (!window.ethereum) return null;
  // Si hay múltiples wallets (Phantom + MetaMask), buscar MetaMask primero
  if (Array.isArray(window.ethereum.providers)) {
    const mm = window.ethereum.providers.find((p) => p.isMetaMask);
    if (mm) return mm;
    return window.ethereum.providers[0];
  }
  return window.ethereum;
}

/**
 * Hook de interacción con el contrato Votacion en red pública (Sepolia).
 *
 * - Conexión de wallet MetaMask con validación/cambio automático de red.
 * - Lectura de estado del contrato (candidatos, resultados, estado).
 * - Voto directo firmado por el usuario en MetaMask → devuelve el txHash
 *   verificable en Etherscan.
 * - Acciones de administrador también firmadas con MetaMask.
 */
export function useVotacion() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [readContract, setReadContract] = useState(null);
  const [cuenta, setCuenta] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [estado, setEstado] = useState(null);
  const [candidatos, setCandidatos] = useState([]);
  const [totalVotos, setTotalVotos] = useState(0);
  const [votoActual, setVotoActual] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [redOk, setRedOk] = useState(false);
  // Dirección del contrato activo (localStorage > JSON del despliegue)
  const [direccionActiva, setDireccionActiva] = useState(
    () => localStorage.getItem(ACTIVA_KEY) || CONTRATO_JSON
  );
  // Información completa del contrato activo (para el panel admin)
  const [infoContrato, setInfoContrato] = useState(null);
  // Historial de elecciones creadas desde el navegador
  const [historialElecciones, setHistorialElecciones] = useState(leerHistorial);
  // Registro de votos (evento VotoEmitido) — solo visible en admin
  const [registroVotos, setRegistroVotos] = useState([]);

  // ─── Cambiar/agregar la red activa en MetaMask ────────────────────
  const cambiarRed = useCallback(async () => {
    const eth = obtenerEthereum();
    if (!eth) return false;
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: RED.hex }],
      });
      return true;
    } catch (err) {
      // 4902 = la red no está agregada en MetaMask
      if (err.code === 4902 || (err.data && err.data.originalError && err.data.originalError.code === 4902)) {
        try {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: RED.hex,
                chainName: RED.nombre,
                nativeCurrency: RED.moneda,
                rpcUrls: RED.rpcUrls,
                ...(RED.explorer ? { blockExplorerUrls: [RED.explorer] } : {}),
              },
            ],
          });
          return true;
        } catch (addErr) {
          setError(`No se pudo agregar la red ${RED.nombre} a MetaMask.`);
          return false;
        }
      }
      if (err.code === 4001) setError("Cambiaste de red: cancelaste en MetaMask.");
      else setError(`No se pudo cambiar a la red ${RED.nombre}.`);
      return false;
    }
  }, []);

  // ─── Cargar estado del contrato ───────────────────────────────────
  const cargarEstado = useCallback(async (_contract) => {
    try {
      const c = _contract || readContract;
      if (!c) return;
      const _estado = await c.estado();
      setEstado(Number(_estado));
      const _totalCandidatos = await c.totalCandidates();
      const _totalVotos = await c.totalVotos();
      setTotalVotos(Number(_totalVotos));
      if (Number(_totalCandidatos) > 0) {
        const [ids, nombres, votos] = await c.obtenerResultados();
        setCandidatos(
          ids.map((id, i) => ({
            id: Number(id),
            nombre: nombres[i],
            votos: Number(votos[i]),
          }))
        );
      } else {
        setCandidatos([]);
      }
    } catch (err) {
      console.error("cargarEstado:", err.message);
    }
  }, [readContract]);

  // ─── Cargar el voto de la cuenta conectada ────────────────────────
  const cargarMiVoto = useCallback(async (_contract, _cuenta) => {
    try {
      const c = _contract || readContract;
      const addr = _cuenta || cuenta;
      if (!c || !addr) return;
      const voto = await c.obtenerVotoDe(addr);
      setVotoActual(Number(voto));
    } catch {
      setVotoActual(0);
    }
  }, [readContract, cuenta]);

  // ─── Conectar wallet MetaMask ─────────────────────────────────────
  const conectarWallet = useCallback(async () => {
    try {
      setError(null);
      const eth = obtenerEthereum();
      if (!eth) {
        throw new Error("MetaMask no está instalado. Instálalo desde https://metamask.io");
      }
      if (!direccionActiva || direccionActiva === "0x0000000000000000000000000000000000000000") {
        throw new Error("El contrato no está desplegado. Ejecuta: npm run deploy:sepolia");
      }

      // Conectar con MetaMask (Phantom no responderá a eth_requestAccounts)
      let _provider = new ethers.BrowserProvider(eth);
      const cuentas = await _provider.send("eth_requestAccounts", []);
      const cuenta = cuentas[0];
      const red = await _provider.getNetwork();
      const chainOk = Number(red.chainId) === RED.id;
      setRedOk(chainOk);

      if (!chainOk) {
        const cambiada = await cambiarRed();
        if (!cambiada) {
          throw new Error(`Conecta MetaMask a la red ${RED.nombre} para continuar.`);
        }
        // Recrear provider después del cambio de red para asegurar estado correcto
        _provider = new ethers.BrowserProvider(eth);
      }

      // Verificar que el contrato existe en esta red
      const _readProvider = new ethers.JsonRpcProvider(RED.rpcUrls[0], undefined, {
        staticNetwork: true,
      });
      const codigoContrato = await _readProvider.getCode(direccionActiva);
      if (!codigoContrato || codigoContrato === "0x") {
        // Contrato no existe → limpiar localStorage y usar dirección del script
        localStorage.removeItem(ACTIVA_KEY);
        setDireccionActiva(CONTRATO_JSON);
        throw new Error(
          "El contrato no existe en esta red. Se restauró la dirección del despliegue. Recarga la página."
        );
      }

      const _signer = await _provider.getSigner();
      const _readContract = new ethers.Contract(direccionActiva, VotacionABI, _readProvider);
      const _contract = new ethers.Contract(direccionActiva, VotacionABI, _signer);

      // Verificar owner on-chain
      let ownerAddr;
      try {
        ownerAddr = await _readContract.owner();
      } catch {
        throw new Error("No se pudo leer el owner del contrato. Verifica que la dirección sea correcta.");
      }

      const esAdmin = cuenta.toLowerCase() === ownerAddr.toLowerCase();

      setProvider(_provider);
      setSigner(_signer);
      setContract(_contract);
      setReadContract(_readContract);
      setCuenta(cuenta);
      setIsAdmin(esAdmin);

      await cargarEstado(_readContract);
      await cargarMiVoto(_readContract, cuenta);

      if (!esAdmin) {
        setError(
          `Wallet conectada (${cuenta.slice(0, 6)}...${cuenta.slice(-4)}) no es admin. ` +
          `Owner del contrato: ${ownerAddr.slice(0, 6)}...${ownerAddr.slice(-4)}. ` +
          `Usa la wallet que desplegó el contrato.`
        );
      }
    } catch (err) {
      if (err.code === "ACTION_REJECTED" || err.code === 4001) {
        setError("Conexión cancelada en MetaMask.");
      } else {
        setError(err.message);
      }
    }
  }, [direccionActiva, cambiarRed, cargarEstado, cargarMiVoto]);

  // ─── Extraer mensaje legible de errores de transacción ────────────
  const ERRORES_CONTRATO = {
    NoSePuedeEditarEnVotacionAbierta: "No se puede editar con la votación abierta. Ciérrala primero.",
    NoSePuedeEliminarEnVotacionAbierta: "No se puede eliminar con la votación abierta. Ciérrala primero.",
    NoSePuedeAgregarEnVotacionAbierta: "No se puede agregar con la votación abierta. Ciérrala primero.",
    CandidatoConVotos: "Ese candidato ya recibió votos y no puede eliminarse.",
    CandidatoNoValido: "El ID de candidato no existe (¿fue eliminado? recarga la página).",
    NombreVacio: "El nombre no puede estar vacío.",
    SoloCuerpoElectoral: "Solo el administrador (owner) puede hacer esto.",
    VotacionNoAbierta: "La votación no está abierta.",
    LimiteCandidatosAlcanzado: "Se alcanzó el límite de 100 candidatos.",
  };

  const msgErrorTx = (err) => {
    if (err.code === "ACTION_REJECTED" || err.code === 4001) {
      return "Transacción rechazada en MetaMask.";
    }
    // Custom errors del contrato (ethers v6: err.revert / err.data)
    const nombreCustom =
      err?.revert?.name ||
      err?.info?.error?.data?.message?.match(/reverted with custom error '(\w+)'/)?.[1] ||
      err?.data?.message?.match(/(\w+)\(/)?.[1] ||
      String(err?.shortMessage || "").match(/reverted with custom error '(\w+)'/)?.[1];
    if (nombreCustom && ERRORES_CONTRATO[nombreCustom]) {
      return ERRORES_CONTRATO[nombreCustom];
    }
    if (err.message && err.message.includes("is not a function")) {
      return "El contrato activo no soporta esta acción. Usa el botón 'Usar' en el historial o recarga la página.";
    }
    if (err.info && err.info.error && err.info.error.message) {
      return err.info.error.message;
    }
    if (err.reason) return `Contrato: ${err.reason}`;
    if (err.shortMessage) return err.shortMessage;
    return err.message || "Error desconocido.";
  };

  // ─── EMITIR VOTO (firmado por el usuario en MetaMask) ─────────────
  const emitirVoto = async (candidatoId) => {
    try {
      setCargando(true);
      setError(null);
      if (!contract || !cuenta) throw new Error("Conecta tu wallet primero");

      const tx = await contract.emitirVoto(candidatoId);
      const recibo = await tx.wait(1); // esperar 1 confirmación

      const yaHabiaVotado = votoActual > 0;
      await cargarEstado(readContract);
      await cargarMiVoto(readContract, cuenta);

      return {
        exito: true,
        cambioVoto: yaHabiaVotado,
        txHash: recibo.hash || tx.hash,
      };
    } catch (err) {
      setError(msgErrorTx(err));
      return { exito: false, cambioVoto: false, txHash: null };
    } finally {
      setCargando(false);
    }
  };

  // ─── ADMIN: agregar candidato ─────────────────────────────────────
  const agregarCandidato = async (nombre) => {
    try {
      setCargando(true);
      setError(null);
      if (!contract) throw new Error("Conecta tu wallet primero");
      if (Number(estado) === 1) throw new Error("No se pueden agregar candidatos con la votación abierta");
      const tx = await contract.agregarCandidato(nombre);
      const recibo = await tx.wait(1);
      await cargarEstado(readContract);
      await cargarMiVoto(readContract, cuenta);
      return { exito: true, txHash: recibo.hash || tx.hash };
    } catch (err) {
      setError(msgErrorTx(err));
      return { exito: false, txHash: null };
    } finally {
      setCargando(false);
    }
  };

  // ─── ADMIN: editar candidato ─────────────────────────────────────
  const editarCandidato = async (id, nuevoNombre) => {
    try {
      setCargando(true);
      setError(null);
      if (!contract) throw new Error("Conecta tu wallet primero");
      if (Number(estado) === 1) throw new Error("No se pueden editar candidatos con la votación abierta");
      if (!nuevoNombre || nuevoNombre.trim() === "") throw new Error("El nombre no puede estar vacío");
      const tx = await contract.editarCandidato(id, nuevoNombre);
      const recibo = await tx.wait(1);
      await cargarEstado(readContract);
      await cargarMiVoto(readContract, cuenta);
      return { exito: true, txHash: recibo.hash || tx.hash };
    } catch (err) {
      setError(msgErrorTx(err));
      return { exito: false, txHash: null };
    } finally {
      setCargando(false);
    }
  };

  // ─── ADMIN: eliminar candidato ─────────────────────────────────────
  const eliminarCandidato = async (id) => {
    try {
      setCargando(true);
      setError(null);
      if (!contract) throw new Error("Conecta tu wallet primero");
      if (Number(estado) === 1) throw new Error("No se pueden eliminar candidatos con la votación abierta");
      const tx = await contract.eliminarCandidato(id);
      const recibo = await tx.wait(1);
      await cargarEstado(readContract);
      await cargarMiVoto(readContract, cuenta);
      return { exito: true, txHash: recibo.hash || tx.hash };
    } catch (err) {
      setError(msgErrorTx(err));
      return { exito: false, txHash: null };
    } finally {
      setCargando(false);
    }
  };

  // ─── ADMIN: abrir votación ────────────────────────────────────────
  const abrirVotacion = async () => {
    try {
      setCargando(true);
      setError(null);
      if (!contract) throw new Error("Conecta tu wallet primero");
      const tx = await contract.abrirVotacion();
      const recibo = await tx.wait(1);
      await cargarEstado(readContract);
      return { exito: true, txHash: recibo.hash || tx.hash };
    } catch (err) {
      setError(msgErrorTx(err));
      return { exito: false, txHash: null };
    } finally {
      setCargando(false);
    }
  };

  // ─── ADMIN: cerrar votación ───────────────────────────────────────
  const cerrarVotacion = async () => {
    try {
      setCargando(true);
      setError(null);
      if (!contract) throw new Error("Conecta tu wallet primero");
      const tx = await contract.cerrarVotacion();
      const recibo = await tx.wait(1);
      await cargarEstado(readContract);
      return { exito: true, txHash: recibo.hash || tx.hash };
    } catch (err) {
      setError(msgErrorTx(err));
      return { exito: false, txHash: null };
    } finally {
      setCargando(false);
    }
  };

  // ─── ADMIN: crear una NUEVA ELECCIÓN (despliega contrato nuevo) ───
  // Despliega Votacion.sol desde el navegador con MetaMask: candidatos
  // precargados + votación abierta en UNA sola transacción.
  const desplegarNuevaEleccion = async (nombresCandidatos) => {
    try {
      setCargando(true);
      setError(null);
      if (!signer) throw new Error("Conecta tu wallet de administrador primero");
      if (!redOk) throw new Error(`Conecta MetaMask a la red ${RED.nombre} primero`);

      const factory = new ethers.ContractFactory(
        VotacionArtifact.abi,
        VotacionArtifact.bytecode,
        signer
      );
      const nuevo = await factory.deploy(nombresCandidatos);
      const tx = nuevo.deploymentTransaction();
      const recibo = await tx.wait(1);
      const addr = await nuevo.getAddress();

      const costoWei =
        BigInt(recibo.gasUsed.toString()) *
        BigInt(recibo.gasPrice ? recibo.gasPrice.toString() : "0");

      const registro = {
        address: addr,
        network: RED.id === 11155111 ? "sepolia" : "localhost",
        fecha: new Date().toISOString(),
        txHash: recibo.hash,
        gasUsado: recibo.gasUsed.toString(),
        costoEth: ethers.formatEther(costoWei),
        candidatos: nombresCandidatos.length,
      };

      // Persistir historial y contrato activo
      const hist = [registro, ...leerHistorial().filter((h) => h.address !== addr)];
      setHistorialElecciones(hist);
      localStorage.setItem(HIST_KEY, JSON.stringify(hist));
      localStorage.setItem(ACTIVA_KEY, addr);

      // Reconstruir instancias sobre el contrato nuevo
      setDireccionActiva(addr);
      const _readContract = new ethers.Contract(
        addr,
        VotacionABI,
        provider || new ethers.JsonRpcProvider(RED.rpcUrls[0])
      );
      setReadContract(_readContract);
      if (signer) {
        setContract(new ethers.Contract(addr, VotacionABI, signer));
      }
      await cargarEstado(_readContract);

      let owner = null;
      try {
        owner = await _readContract.owner();
      } catch {}
      setInfoContrato({
        direccion: addr,
        red: RED.nombre,
        chainId: RED.id,
        owner,
        fechaDespliegue: registro.fecha,
        txDespliegue: registro.txHash,
        gasUsado: registro.gasUsado,
        costoEth: registro.costoEth,
        candidatosIniciales: registro.candidatos,
        version: "2.1.0",
      });

      return { exito: true, txHash: recibo.hash, direccion: addr };
    } catch (err) {
      setError(msgErrorTx(err));
      return { exito: false, txHash: null, direccion: null };
    } finally {
      setCargando(false);
    }
  };

  // ─── Cambiar el contrato activo (elegir otra elección del historial)
  const usarContrato = async (addr) => {
    try {
      setCargando(true);
      setError(null);
      localStorage.setItem(ACTIVA_KEY, addr);
      setDireccionActiva(addr);

      const _readContract = new ethers.Contract(
        addr,
        VotacionABI,
        provider || new ethers.JsonRpcProvider(RED.rpcUrls[0])
      );
      setReadContract(_readContract);
      if (signer) {
        setContract(new ethers.Contract(addr, VotacionABI, signer));
      }
      await cargarEstado(_readContract);
      await cargarMiVoto(_readContract, cuenta);

      let owner = null;
      try {
        owner = await _readContract.owner();
      } catch {}
      const reg = leerHistorial().find((h) => h.address === addr);
      setInfoContrato({
        direccion: addr,
        red: RED.nombre,
        chainId: RED.id,
        owner,
        fechaDespliegue: reg?.fecha || null,
        txDespliegue: reg?.txHash || null,
        gasUsado: reg?.gasUsado || null,
        costoEth: reg?.costoEth || null,
        candidatosIniciales: reg?.candidatos ?? null,
        version: "2.1.0",
      });
      setIsAdmin(
        cuenta && owner ? cuenta.toLowerCase() === owner.toLowerCase() : false
      );
      return { exito: true };
    } catch (err) {
      setError(msgErrorTx(err));
      return { exito: false };
    } finally {
      setCargando(false);
    }
  };

  // ─── Verificar si una dirección ya votó ───────────────────────────
  const verificarVoto = async (direccion) => {
    try {
      if (!readContract) return false;
      return Boolean(await readContract.verificarVoto(direccion));
    } catch {
      return false;
    }
  };

  // ─── Carga inicial SIN wallet: lectura pública del contrato ───────
  // Permite ver candidatos, resultados y estado sin conectar MetaMask.
  // También carga el registro de votos (eventos VotoEmitido pasados).
  useEffect(() => {
    if (!direccionActiva) return;
    let cancelado = false;
    try {
      const ro = new ethers.JsonRpcProvider(RED.rpcUrls[0], undefined, {
        staticNetwork: true,
      });
      const rc = new ethers.Contract(direccionActiva, VotacionABI, ro);
      setReadContract(rc);
      (async () => {
        try {
          const _estado = await rc.estado();
          const _totalVotos = await rc.totalVotos();
          const [ids, nombres, votos] = await rc.obtenerResultados();
          if (cancelado) return;
          setEstado(Number(_estado));
          setTotalVotos(Number(_totalVotos));
          const candidatosMap = {};
          ids.forEach((id, i) => {
            candidatosMap[Number(id)] = nombres[i];
          });
          setCandidatos(
            ids.map((id, i) => ({
              id: Number(id),
              nombre: nombres[i],
              votos: Number(votos[i]),
            }))
          );
          // Información del contrato (owner on-chain + registro local)
          let owner = null;
          try {
            owner = await rc.owner();
          } catch {}
          const reg = leerHistorial().find((h) => h.address === direccionActiva);
          if (!cancelado) {
            setInfoContrato({
              direccion: direccionActiva,
              red: RED.nombre,
              chainId: RED.id,
              owner,
              fechaDespliegue: reg?.fecha || null,
              txDespliegue: reg?.txHash || null,
              gasUsado: reg?.gasUsado || null,
              costoEth: reg?.costoEth || null,
              candidatosIniciales: reg?.candidatos ?? null,
              version: "2.1.0",
            });
          }
          // Cargar eventos VotoEmitido pasados
          try {
            const filtros = rc.filters.VotoEmitido();
            const eventos = await rc.queryFilter(filtros, 0, "latest");
            if (!cancelado) {
              setRegistroVotos(
                eventos.map((ev) => ({
                  votante: ev.args[0],
                  candidatoId: Number(ev.args[1]),
                  candidatoNombre: candidatosMap[Number(ev.args[1])] || `#${ev.args[1]}`,
                  txHash: ev.transactionHash,
                  bloque: Number(ev.blockNumber),
                }))
              );
            }
          } catch (evErr) {
            console.error("Error cargando eventos:", evErr.message);
          }
        } catch (err) {
          console.error("Lectura inicial:", err.message);
        }
      })();
    } catch (err) {
      console.error("Provider de solo lectura:", err.message);
    }
    return () => {
      cancelado = true;
    };
  }, [direccionActiva]);

  // ─── Eventos de MetaMask: cambio de cuenta o de red ───────────────
  useEffect(() => {
    const eth = obtenerEthereum();
    if (!eth) return;
    const onCuentas = (cuentas) => {
      if (cuentas.length === 0) {
        setCuenta(null);
        setIsAdmin(false);
        setVotoActual(0);
      } else {
        window.location.reload();
      }
    };
    const onCadena = () => {
      window.location.reload();
    };
    eth.on("accountsChanged", onCuentas);
    eth.on("chainChanged", onCadena);
    return () => {
      eth.removeListener("accountsChanged", onCuentas);
      eth.removeListener("chainChanged", onCadena);
    };
  }, []);

  // ─── Eventos del contrato en tiempo real ──────────────────────────
  useEffect(() => {
    if (!readContract) return;
    const onActualizar = () => cargarEstado();
    const onVoto = (votante, candidatoId, evento) => {
      // Agregar voto al registro en tiempo real
      setRegistroVotos((prev) => [
        {
          votante,
          candidatoId: Number(candidatoId),
          candidatoNombre: candidatos.find((c) => c.id === Number(candidatoId))?.nombre || `#${candidatoId}`,
          txHash: evento.log?.transactionHash || evento.transactionHash || "",
          bloque: Number(evento.log?.blockNumber || evento.blockNumber || 0),
        },
        ...prev,
      ]);
      cargarEstado();
    };
    readContract.on("VotoEmitido", onVoto);
    readContract.on("CandidatoAgregado", onActualizar);
    readContract.on("VotacionAbierta", onActualizar);
    readContract.on("VotacionCerrada", onActualizar);
    return () => {
      readContract.removeAllListeners();
    };
  }, [readContract, cargarEstado, candidatos]);

  return {
    cuenta,
    isAdmin,
    estado,
    candidatos,
    totalVotos,
    votoActual,
    cargando,
    error,
    redOk,
    contrato: direccionActiva,
    infoContrato,
    historialElecciones,
    registroVotos,
    conectarWallet,
    cambiarRed,
    emitirVoto,
    agregarCandidato,
    editarCandidato,
    eliminarCandidato,
    abrirVotacion,
    cerrarVotacion,
    desplegarNuevaEleccion,
    usarContrato,
    verificarVoto,
    cargarEstado,
    cargarMiVoto,
  };
}
