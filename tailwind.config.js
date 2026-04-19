/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0a0a0f",
        card: "#141420",
        line: "#23233a",
        accent: "#7c5cff",
        accent2: "#39d0d8",
        muted: "#8a8aa8",
        success: "#22c55e",
        warn: "#f59e0b",
        danger: "#ef4444",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "-apple-system", "Inter", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        xl2: "1rem",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(124,92,255,0.35), 0 8px 30px -8px rgba(124,92,255,0.35)",
        "soft-lg": "0 20px 60px -20px rgba(0,0,0,0.6)",
      },
      keyframes: {
        stepEnter: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-600px 0" },
          "100%": { backgroundPosition: "600px 0" },
        },
        pulseRing: {
          "0%": { boxShadow: "0 0 0 0 rgba(124,92,255,0.55)" },
          "70%": { boxShadow: "0 0 0 10px rgba(124,92,255,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(124,92,255,0)" },
        },
        slideInRight: {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        popIn: {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "step-enter": "stepEnter 220ms ease-out both",
        shimmer: "shimmer 1.6s linear infinite",
        "pulse-ring": "pulseRing 1.6s ease-out infinite",
        "slide-in-right": "slideInRight 220ms ease-out both",
        "fade-in": "fadeIn 160ms ease-out both",
        "pop-in": "popIn 180ms ease-out both",
      },
    },
  },
  plugins: [],
};
