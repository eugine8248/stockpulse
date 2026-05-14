/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: '#0e1116',
        surface: '#161a21',
        elevated: '#1d222b',
        border: '#262c36',
        borderSoft: '#1f242d',
        text: '#e6e9ef',
        textMuted: '#8b95a5',
        textFaint: '#5a6374',
        accent: '#5b8def',
        accentHover: '#6d9bf7',
        up: '#5fcf95',
        down: '#f0716a',
        warning: '#e8a86a',
        error: '#ff7a72',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
