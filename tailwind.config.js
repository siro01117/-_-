/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // CSS 변수 기반 - .dark 토글만으로 전체 테마 전환
      colors: {
        "sc-bg":      "var(--sc-bg)",
        "sc-surface": "var(--sc-surface)",
        "sc-raised":  "var(--sc-raised)",
        "sc-border":  "var(--sc-border)",
        "sc-white":   "var(--sc-white)",
        "sc-gray":    "var(--sc-gray)",
        "sc-dim":     "var(--sc-dim)",
        "sc-green":   "var(--sc-green)",
        "sc-green-d": "var(--sc-green-d)",
      },
      keyframes: {
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(18px) scale(0.96)" },
          "60%":  { opacity: "1" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%":   { opacity: "0", transform: "translate(-50%,-50%) scale(0.92)" },
          "100%": { opacity: "1", transform: "translate(-50%,-50%) scale(1)" },
        },
      },
      animation: {
        "fade-up":  "fade-up 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "fade-in":  "fade-in 0.3s ease both",
        "scale-in": "scale-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both",
      },
    },
  },
  plugins: [],
};
