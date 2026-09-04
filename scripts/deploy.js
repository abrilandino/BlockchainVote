const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// ─── Candidatos precargados en la elección ──────────────────────────
const CANDIDATOS = [
  "Ana Martinez",
  "Carlos Rodriguez",
  "Lucia Fernandez",
  "Diego Sanchez",
  "Valentina Torres",
];

// Abrir la votación automáticamente al desplegar (poner "0" para dejarla cerrada)
const ABRIR_AUTOMATICO = process.env.AUTO_ABRIR !== "0";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const red = hre.network.name;
  const explorers = {
    sepolia: "https://sepolia.etherscan.io",
    localhost: null,
    hardhat: null,
  };
  const explorer = explorers[red] || null;

  console.log(`\nRed: ${red}`);
  console.log(`Desplegando con la cuenta: ${deployer.address}`);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${hre.ethers.formatEther(balance)} ETH\n`);

  if (red === "sepolia" && balance === 0n) {
    throw new Error(
      "No tienes ETH de prueba. Consigue Sepolia ETH en un faucet: https://sepoliafaucet.com/ o https://faucets.chain.link/sepolia"
    );
  }

  // ─── 1. Desplegar contrato (candidatos + apertura en una sola tx) ─
  const Votacion = await hre.ethers.getContractFactory("Votacion");
  const votacion = await Votacion.deploy(ABRIR_AUTOMATICO ? CANDIDATOS : []);
  await votacion.waitForDeployment();
  const direccion = await votacion.getAddress();
  console.log(`Votacion desplegado en: ${direccion}`);
  if (explorer) {
    console.log(`Contrato en Etherscan: ${explorer}/address/${direccion}`);
  }
  const txDespliegue = votacion.deploymentTransaction();
  const recibo = await txDespliegue.wait();
  console.log(`Tx de despliegue: ${recibo.hash}`);
  console.log(`Gas usado: ${recibo.gasUsed.toString()} | Costo: ${hre.ethers.formatEther(recibo.gasUsed * recibo.gasPrice)} ETH`);
  console.log(`Candidatos registrados: ${CANDIDATOS.length}`);

  // ─── 4. Guardar dirección para frontend y backend ────────────────
  const frontendPath = path.join(__dirname, "..", "frontend", "src", "contractAddress.json");
  const backendPath = path.join(__dirname, "..", "backend", "src", "contractAddress.json");
  fs.writeFileSync(frontendPath, JSON.stringify({ address: direccion, network: red }, null, 2));
  fs.writeFileSync(backendPath, JSON.stringify({ address: direccion, network: red }, null, 2));
  console.log(`Direccion guardada en: ${frontendPath}`);
  console.log(`Direccion guardada en: ${backendPath}`);

  // Actualizar .env del backend si existe
  const backendEnvPath = path.join(__dirname, "..", "backend", ".env");
  if (fs.existsSync(backendEnvPath)) {
    let env = fs.readFileSync(backendEnvPath, "utf8");
    if (env.includes("CONTRACT_ADDRESS=")) {
      env = env.replace(/CONTRACT_ADDRESS=.*/, `CONTRACT_ADDRESS=${direccion}`);
    } else {
      env += `\nCONTRACT_ADDRESS=${direccion}\n`;
    }
    fs.writeFileSync(backendEnvPath, env);
  }

  // ─── Resumen final ────────────────────────────────────────────────
  console.log("\n========== RESUMEN ==========");
  console.log(`Contrato : ${direccion}`);
  console.log(`Owner    : ${deployer.address}`);
  console.log(`Candidatos: ${CANDIDATOS.length}`);
  console.log(`Estado   : ${ABRIR_AUTOMATICO ? "ABIERTA" : "CERRADA"}`);
  if (explorer) {
    console.log(`Etherscan: ${explorer}/address/${direccion}`);
    console.log("\nVerifica el contrato (opcional):");
    console.log(`  npx hardhat verify --network sepolia ${direccion}`);
  }
  console.log("=============================\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
