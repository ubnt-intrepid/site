import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    fontFamily: {
      sans: [
        "var(--font-ibm-plex-sans)",
        "var(--font-noto-sans-jp)",
        "system-ui",
        "-apple-system",
        "BlinkMacSystemFont",
        "Segoe UI",
        "Hiragino Sans",
        "Hiragino Kaku Gothic ProN",
        "Meiryo",
        "sans-serif",
        "Apple Color Emoji",
        "Segoe UI Emoji",
        "Noto Color Emoji",
      ],
      mono: [
        "ui-monospace",
        "SFMono-Regular",
        "Cascadia Mono",
        "Consolas",
        "Liberation Mono",
        "Menlo",
        "monospace",
      ],
    },
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        'header-bg': 'var(--color-header-bg)',
        'header-text': 'var(--color-header-text)',
        'headline-bg': 'var(--color-headline-bg)',
        'headline-text': 'var(--color-headline-text)',
        'accent': 'var(--color-accent)',
        'accent-light': 'var(--color-accent-light)',
        'accent-dark': 'var(--color-accent-dark)',
        'accent-border': 'var(--color-accent-border)',
        'footer-bg': 'var(--color-footer-bg)',
        'footer-text': 'var(--color-footer-text)',
        'page-bg': 'var(--color-page-bg)',
        'body-text': 'var(--color-text)',
      },
    },
  },
  plugins: [],
} satisfies Config;
