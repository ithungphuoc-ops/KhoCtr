// HPCons Design System V1.1 — token màu qua CSS var để hỗ trợ Light/Dark Mode
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Brand (cố định, không đổi theo theme)
        'hp-primary':            'rgb(var(--color-primary) / <alpha-value>)',
        'hp-accent':             'rgb(var(--color-accent) / <alpha-value>)',
        'hp-nav':                'rgb(var(--color-nav) / <alpha-value>)',
        'hp-danger':             'rgb(var(--color-danger) / <alpha-value>)',
        'hp-warning':            'rgb(var(--color-warning) / <alpha-value>)',
        'hp-muted':              'rgb(var(--color-muted) / <alpha-value>)',
        // Nền — thay đổi theo theme
        'hp-bg':                 'rgb(var(--color-bg) / <alpha-value>)',
        'hp-surface':            'rgb(var(--color-surface) / <alpha-value>)',
        'hp-card':               'rgb(var(--color-card) / <alpha-value>)',
        'hp-elevated':           'rgb(var(--color-elevated) / <alpha-value>)',
        // Viền (rgba cố định, không dùng alpha-value)
        'hp-border':             'var(--color-border)',
        'hp-divider':            'var(--color-divider)',
        // Overlay (modal backdrop)
        'hp-overlay':            'var(--hp-overlay)',
        // Chữ — thay đổi theo theme
        'hp-text':               'rgb(var(--color-text) / <alpha-value>)',
        'hp-text-secondary':     'rgb(var(--color-text-secondary) / <alpha-value>)',
        'hp-text-muted':         'rgb(var(--color-text-muted) / <alpha-value>)',
        'hp-text-disabled':      'rgb(var(--color-text-disabled) / <alpha-value>)',
        // Sidebar text (luôn sáng vì sidebar bg tối cả 2 mode)
        'hp-sidebar-text':       'rgb(var(--color-sidebar-text) / <alpha-value>)',
        'hp-sidebar-muted':      'rgb(var(--color-sidebar-muted) / <alpha-value>)',
      },
      borderRadius: {
        'hp-sm': '6px',
        'hp-md': '8px',
        'hp-lg': '12px',
        'hp-xl': '16px',
      },
      height: {
        'hp-header':        '60px',
        'hp-header-mobile': '56px',
      },
      width: {
        'hp-sidebar':           '260px',
        'hp-sidebar-collapsed': '72px',
      },
      minHeight: {
        'hp-header': '60px',
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
