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
      fontFamily: {
        sans: ["var(--font-outfit)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        border: "rgb(var(--border) / <alpha-value>)",
        input: "rgb(var(--input) / <alpha-value>)",
        ring: "rgb(var(--ring) / <alpha-value>)",
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "rgb(var(--secondary) / <alpha-value>)",
          foreground: "rgb(var(--secondary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "rgb(var(--destructive) / <alpha-value>)",
          foreground: "rgb(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "rgb(var(--muted) / <alpha-value>)",
          foreground: "rgb(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          foreground: "rgb(var(--accent-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "rgb(var(--popover) / <alpha-value>)",
          foreground: "rgb(var(--popover-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "rgb(var(--card) / <alpha-value>)",
          foreground: "rgb(var(--card-foreground) / <alpha-value>)",
        },
        success: {
          DEFAULT: "rgb(var(--success) / <alpha-value>)",
          foreground: "rgb(var(--success-foreground) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "rgb(var(--warning) / <alpha-value>)",
          foreground: "rgb(var(--warning-foreground) / <alpha-value>)",
        },
        blue: {
          primary: "#1D4ED8",
          light: "#3B82F6",
          soft: "#EFF6FF",
          border: "#E2EAF4",
        },
      },
      borderRadius: {
        xl: "var(--radius)",
        "2xl": "calc(var(--radius) + 0.25rem)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        overlay: "var(--shadow-overlay)",
      },
      backgroundImage: {
        "glow-radial": "var(--glow-primary)",
        "conic-border": "conic-gradient(from var(--angle), transparent 0deg, rgb(59 130 246 / 0.12) 95deg, rgb(96 165 250 / 0.75) 150deg, rgb(34 211 238 / 0.55) 190deg, transparent 250deg)",
        "grid-fade": "linear-gradient(rgb(255 255 255 / 0.055) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.055) 1px, transparent 1px)",
      },
      keyframes: {
        "border-spin": {
          to: { "--angle": "360deg" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.42", transform: "scale(0.96)" },
          "50%": { opacity: "0.72", transform: "scale(1.04)" },
        },
        marquee: {
          to: { transform: "translate3d(-50%, 0, 0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "border-spin": "border-spin 8s linear infinite",
        "glow-pulse": "glow-pulse 6s ease-in-out infinite",
        marquee: "marquee 28s linear infinite",
        shimmer: "shimmer 2.4s linear infinite",
      },
      transitionTimingFunction: {
        "rive-out": "var(--ease-out)",
        "rive-drawer": "var(--ease-drawer)",
      },
    },
  },
  plugins: [],
};
