/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Nunito reads friendly (rounded terminals) without the childishness of
        // Baloo/Comic Neue — this is a marketplace handling payments and ID documents.
        display: ["Nunito", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["'DM Sans'", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // Trust anchor — unchanged indigo so the existing brand doesn't lurch.
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
        // Warm secondary — energy and delight; carries featured/premium moments.
        sunny: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
        },
        // Transaction/success green — verified state, positive outcomes.
        grass: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
        },
        // Playful tertiaries — subject chips, category variety.
        coral: {
          50: "#fff1f2",
          100: "#ffe4e6",
          200: "#fecdd3",
          400: "#fb7185",
          500: "#f43f5e",
          600: "#e11d48",
          700: "#be123c",
        },
        sky: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
        },
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #4f46e5 0%, #7c3aed 55%, #d946ef 100%)",
        "sunny-gradient": "linear-gradient(135deg, #f59e0b 0%, #f43f5e 100%)",
        "mesh-soft":
          "radial-gradient(at 12% 12%, #e0e7ff 0px, transparent 55%), radial-gradient(at 88% 8%, #ffe4e6 0px, transparent 50%), radial-gradient(at 75% 90%, #fef3c7 0px, transparent 50%)",
      },
      boxShadow: {
        card: "0 1px 3px rgba(15,23,42,.06), 0 1px 2px rgba(15,23,42,.04)",
        lift: "0 12px 28px -8px rgba(79,70,229,.22), 0 4px 10px -4px rgba(15,23,42,.08)",
        featured: "0 16px 36px -10px rgba(245,158,11,.38), 0 4px 12px -4px rgba(15,23,42,.10)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-500px 0" },
          "100%": { backgroundPosition: "500px 0" },
        },
      },
      animation: {
        // 150–300ms band per the UX rules; reduced-motion handled in index.css.
        "fade-up": "fade-up .28s ease-out both",
        shimmer: "shimmer 2.4s linear infinite",
      },
    },
  },
  plugins: [],
};
