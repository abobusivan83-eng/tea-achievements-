/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        steam: {
          bg: "#0b121a",
          panel: "#121c27",
          panel2: "#0f1822",
          border: "rgba(255,255,255,0.08)",
          text: "#c7d5e0",
          muted: "rgba(199,213,224,0.7)",
          accent: "#66c0f4",
          green: "#5cdb95"
        }
      },
      boxShadow: {
        steam: "0 8px 30px rgba(0,0,0,0.55)"
      }
    }
  },
  plugins: []
};

