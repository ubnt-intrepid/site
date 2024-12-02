import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    fontFamily: {
      sans: [
        "Helvetica Neue",
        "Segoe UI",
        "Arial",
        "Hiragino Kaku Gothic ProN",
        "Hiragino Sans",
        "Meiryo",
        "sans-serif",
        "Apple Color Emoji",
        "Segoe UI Emoji",
        "Segoe UI Symbol",
        "Noto Color Emoji",
      ],
      mono: [
        "Cascadia Mono",
        "SFMono-Regular",
        "Consolas",
        "Liberation Mono",
        "Menlo",
        "monospace",
        "Apple Color Emoji",
        "Segoe UI Emoji",
        "Segoe UI Symbol",
        "Noto Color Emoji",
      ],
    },
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
} satisfies Config;
