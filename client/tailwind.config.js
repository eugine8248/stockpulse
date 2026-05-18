/** @type {import('tailwindcss').Config} */
// stockpulse — design tokens ported from framedeck. Same strategy as
// taskpulse: all colors resolve to CSS variables on [data-theme].
// Legacy stockpulse names (textMuted, textFaint, elevated, accentHover, error)
// stay as aliases so the existing component code keeps compiling.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Canonical framedeck names
        bg: 'var(--c-bg)',
        surface: 'var(--c-surface)',
        'surface-muted': 'var(--c-surface-muted)',
        'border-soft': 'var(--c-border-soft)',
        border: 'var(--c-border)',
        text: 'var(--c-text)',
        'text-2': 'var(--c-text-2)',
        'text-muted': 'var(--c-text-muted)',
        accent: 'var(--c-accent)',
        'accent-hover': 'var(--c-accent-hover)',
        'accent-soft': 'var(--c-accent-soft)',
        'accent-soft-2': 'var(--c-accent-soft-2)',
        success: 'var(--c-success)',
        warning: 'var(--c-warning)',
        error: 'var(--c-error)',

        // Legacy stockpulse names kept as theme-aware aliases.
        elevated: 'var(--c-surface-muted)',
        borderSoft: 'var(--c-border-soft)',
        textMuted: 'var(--c-text-2)',
        textFaint: 'var(--c-text-muted)',
        accentHover: 'var(--c-accent-hover)',

        // Stock-specific semantic names.
        up: 'var(--c-success)',
        down: 'var(--c-error)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'Consolas', 'monospace'],
      },
      borderRadius: {
        sm: '6px', md: '8px', lg: '12px', xl: '16px',
      },
      boxShadow: {
        xs: '0 1px 2px rgba(40, 35, 29, 0.04)',
        sm: '0 1px 2px rgba(40, 35, 29, 0.06), 0 1px 3px rgba(40, 35, 29, 0.04)',
        md: '0 4px 12px rgba(40, 35, 29, 0.06), 0 1px 3px rgba(40, 35, 29, 0.04)',
        lg: '0 12px 32px rgba(40, 35, 29, 0.10), 0 2px 6px rgba(40, 35, 29, 0.05)',
      },
    },
  },
  plugins: [],
};
