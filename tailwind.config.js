/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        blue: {
          primary: "#1D4ED8",
          light: "#3B82F6",
          soft: "#EFF6FF",
          border: "#E2EAF4",
        }
      }
    },
  },
  plugins: [],
};
