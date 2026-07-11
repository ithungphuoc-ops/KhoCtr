// HPCons Design System V2.0 - Steel & Sky Theme
// Thay doi thuong hieu: chi sua tai day (token-rules.md)
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // --- Brand ---
        'hp-primary':       '#185fa5',
        'hp-primary-hover': '#1a6fbe',
        'hp-accent':        '#1d9e75',
        'hp-accent-light':  '#5dcaa5',
        // --- Nen Dark Mode ---
        'hp-bg':       '#0a1929',
        'hp-surface':  '#0d233a',
        'hp-card':     '#102d48',
        'hp-elevated': '#153556',
        'hp-nav':      '#0d3354',
        // --- Chu ---
        'hp-text':           '#e6f1fb',
        'hp-text-secondary': '#9dc5e0',
        'hp-text-muted':     '#5a8aad',
        'hp-text-disabled':  '#3a6280',
        // --- Trang thai ---
        'hp-danger':  '#f05252',
        'hp-warning': '#f59e0b',
        'hp-success': '#1d9e75',
        'hp-muted':   '#5a8aad',
        // --- Nghiep vu kho ---
        'hp-nk':  '#1d9e75',
        'hp-xk':  '#378add',
        'hp-ton': '#5dcaa5',
      },
      borderRadius: {
        'hp-sm': '6px',
        'hp-md': '8px',
        'hp-lg': '12px',
        'hp-xl': '16px',
      },
      height: {
        'hp-header': '60px',
        'hp-header-mobile': '56px',
      },
      width: {
        'hp-sidebar': '260px',
        'hp-sidebar-collapsed': '72px',
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
