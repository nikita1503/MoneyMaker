/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#fdfbf7",
        "paper-2": "#f2ede2",
        ink: "#2d2d2d",
        muted: "#e5e0d8",
        mute: "#8a8780",
        accent: "#ff4d4d",
        blue: "#2d5da1",
        sticky: "#fff9c4",
        success: "#4a8a4a",
        danger: "#ff4d4d",
        warn: "#d9a441",
      },
      fontFamily: {
        sans: ["var(--font-patrick-hand)", "Comic Sans MS", "cursive", "sans-serif"],
        display: ["var(--font-kalam)", "Comic Sans MS", "cursive", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      keyframes: {
        stepEnter: {
          "0%": { opacity: "0", transform: "translateY(8px) rotate(-0.5deg)" },
          "100%": { opacity: "1", transform: "translateY(0) rotate(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-600px 0" },
          "100%": { backgroundPosition: "600px 0" },
        },
        slideInRight: {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        popIn: {
          "0%": { opacity: "0", transform: "scale(0.96) rotate(-1deg)" },
          "100%": { opacity: "1", transform: "scale(1) rotate(0)" },
        },
        bounceY: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        wiggle: {
          "0%,100%": { transform: "rotate(-2deg)" },
          "50%": { transform: "rotate(2deg)" },
        },
        bangSpin: {
          "0%,100%": { transform: "rotate(-8deg)" },
          "50%": { transform: "rotate(8deg)" },
        },
      },
      animation: {
        "step-enter": "stepEnter 240ms cubic-bezier(0.2,0.65,0.2,1) both",
        shimmer: "shimmer 1.8s linear infinite",
        "slide-in-right": "slideInRight 240ms cubic-bezier(0.2,0.65,0.2,1) both",
        "fade-in": "fadeIn 180ms ease-out both",
        "pop-in": "popIn 220ms cubic-bezier(0.2,0.65,0.2,1) both",
        "bounce-y": "bounceY 3s ease-in-out infinite",
        wiggle: "wiggle 2.4s ease-in-out infinite",
        "bang-spin": "bangSpin 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
