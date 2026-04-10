/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  safelist: [
    {
      pattern: /bg-primary-(50|100|200|300|400|500|600)/,
    },
    {
      pattern: /bg-neutral-(50|100|200|300|400|500|600|700|800|900)/,
    },
    {
      pattern: /shadow-elevation-(0|1|2|3)/,
    },
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EEF4FF',
          100: '#DCE8FF',
          200: '#B8D1FF',
          300: '#8AB3FF',
          400: '#5A8EFF',
          500: '#2563EB',
          600: '#1D4ED8',
        },
        neutral: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        },
        success: {
          DEFAULT: '#16A34A',
          bg: '#DCFCE7',
          fg: '#14532D',
        },
        danger: {
          DEFAULT: '#DC2626',
          bg: '#FEE2E2',
          fg: '#7F1D1D',
        },
        warning: {
          DEFAULT: '#D97706',
          bg: '#FEF3C7',
          fg: '#78350F',
        },
        info: {
          DEFAULT: '#0284C7',
          bg: '#E0F2FE',
          fg: '#0C4A6E',
        },
      },
      spacing: {
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '20px',
        6: '24px',
        7: '28px',
        8: '32px',
        9: '36px',
        10: '40px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        arabic: ['"Noto Sans Arabic"', 'Inter', 'sans-serif'],
      },
      fontSize: {
        xs: ['12px', { lineHeight: '16px' }],
        sm: ['14px', { lineHeight: '20px' }],
        base: ['16px', { lineHeight: '24px' }],
        lg: ['20px', { lineHeight: '28px' }],
        xl: ['24px', { lineHeight: '32px' }],
      },
      boxShadow: {
        'elevation-0': 'none',
        'elevation-1': '0 1px 2px 0 rgba(15, 23, 42, 0.06), 0 1px 3px 0 rgba(15, 23, 42, 0.08)',
        'elevation-2': '0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -1px rgba(15, 23, 42, 0.06)',
        'elevation-3': '0 10px 15px -3px rgba(15, 23, 42, 0.10), 0 4px 6px -2px rgba(15, 23, 42, 0.05)',
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        full: '9999px',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-500px 0' },
          '100%': { backgroundPosition: '500px 0' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateX(24px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.4s linear infinite',
        'fade-in': 'fade-in 150ms ease-out',
        'slide-up': 'slide-up 180ms ease-out',
        'toast-in': 'toast-in 200ms ease-out',
      },
    },
  },
  plugins: [],
};
