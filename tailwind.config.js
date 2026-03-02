/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}", "./App.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f3f8ff",
          100: "#dbeafe",
          500: "#2563eb",
          700: "#1d4ed8",
          900: "#172554",
        },
        success: "#16a34a",
        warning: "#ca8a04",
        danger: "#dc2626",
        surface: "#0b1220",
      },
    },
  },
  plugins: [],
};
