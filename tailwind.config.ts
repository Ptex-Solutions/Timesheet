import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    // Seqrite holds a lock on this (unused) file; reading it hangs Tailwind.
    "!./components/shared/topbar.tsx",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Sora", "system-ui", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        brand: {
          DEFAULT: "#E85D04",
          50: "#FFF1E6",
          100: "#FFD9B8",
          200: "#FFB97A",
          300: "#FF9B45",
          400: "#F47B1F",
          500: "#E85D04",
          600: "#C44C00",
          700: "#9A3B00",
          800: "#702B00",
          900: "#451B00",
        },
        navy: {
          DEFAULT: "#0D1B2A",
          50: "#E5E9EE",
          100: "#BFC8D2",
          200: "#8E9DAE",
          300: "#5C7187",
          400: "#33495F",
          500: "#0D1B2A",
          600: "#0A1421",
          700: "#070E18",
          800: "#04080F",
          900: "#020407",
        },
        surface: {
          DEFAULT: "#F7F9FC",
          card: "#FFFFFF",
          muted: "#EDF1F7",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        "soft": "0 1px 2px rgba(13, 27, 42, 0.04), 0 4px 12px rgba(13, 27, 42, 0.06)",
        "elevated": "0 4px 20px -2px rgba(13, 27, 42, 0.10), 0 2px 6px rgba(13, 27, 42, 0.05)",
        "brand": "0 8px 24px -8px rgba(232, 93, 4, 0.40)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "slide-up": "slide-up 0.25s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
