/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Google Sans"', 'sans-serif'],
      },
      colors: {
        background: '#f8fafc',
        surface: '#ffffff',
        primary: '#2563eb',
        secondary: '#0f172a',
        accent: '#ef4444',
        coral: {
          50:  '#fef2f0',
          100: '#fde4e0',
          200: '#fbc9c0',
          300: '#f9a899',
          400: '#f08080',
          500: '#e86058',
          600: '#d44840',
          700: '#b23830',
          800: '#93302a',
          900: '#7a2d28',
        },
        charcoal: {
          DEFAULT: '#3C3C3C',
          light: '#4A4A4A',
          dark: '#2E2E2E',
        },
      },
      borderRadius: {
        'card': '1.25rem',
      },
      boxShadow: {
        'card': '0 8px 30px rgba(0,0,0,0.08)',
        'card-hover': '0 16px 40px rgba(0,0,0,0.14)',
        'soft': '0 4px 20px rgba(0,0,0,0.06)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out forwards',
      },
    },
  },
  plugins: [],
}
