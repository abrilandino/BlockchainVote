/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      // =====================================================================
      //  PALETA SEMÁNTICA — Solana Breakpoint style
      //  #020205 bg puro, purple #9945FF, cyan #00F0FF, green #14F195
      // =====================================================================
      colors: {
        // Fondo base del dashboard
        base: {
          light: "#EEF1F8",
          dark: "#020205", // negro puro Solana
        },
        // Sidebar (más oscuro que el fondo, con gradiente en AppLayout)
        sidebar: {
          light: "#12141C",
          dark: "#06060A",
          muted: "#7E8798",
        },
        // Tarjetas / Contenedores (glass oscuro)
        surface: {
          light: "#FFFFFF",
          dark: "#0A0A10",
          "dark-elevated": "#0F1018",
        },
        // Bordes sutiles (hairline luminoso)
        border: {
          light: "rgba(10, 12, 20, 0.08)",
          dark: "rgba(255, 255, 255, 0.07)",
        },
        // Texto
        text: {
          light: "#14161F",
          dark: "#FFFFFF",
          muted: {
            light: "#5A6172",
            dark: "#8E8EA8",
          },
        },
        // Marca / Identidad — Solana purple, cyan & green
        brand: {
          primary: "#9945FF", // púrpura Solana
          "primary-hover": "#B06AFF",
          accent: "#14F195", // verde neón Solana
          "accent-hover": "#2FFFAB",
          cyan: "#00F0FF", // cyan neón
        },
        // Estados funcionales (verde neón = abierto/activo, rojo = cerrado)
        success: {
          light: "#0EB77F",
          dark: "#14F195",
          bg: {
            light: "#E7FBF3",
            dark: "rgba(20, 241, 149, 0.10)",
          },
        },
        danger: {
          light: "#E5484D",
          dark: "#FF5C7A",
          bg: {
            light: "#FEEBEC",
            dark: "rgba(255, 92, 122, 0.12)",
          },
        },
        warning: {
          light: "#D9A514",
          dark: "#FFC24B",
          bg: {
            light: "#FFF6DE",
            dark: "rgba(255, 194, 75, 0.12)",
          },
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        // Consistentes: 12px y 16px como el UI Kit
        xl: "12px",
        "2xl": "16px",
      },
      // =====================================================================
      //  TRANSICIONES GLOBALES
      // =====================================================================
      transitionDuration: {
        200: "200ms",
      },
      transitionTimingFunction: {
        "theme-switch": "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [],
};