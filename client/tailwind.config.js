/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        signature: ['Dancing Script', 'cursive'],
      },
      colors: {
        slate: {
          750: '#2a3347',
          850: '#192033',
          950: '#0d1117',
        },
      },
      boxShadow: {
        page: '0 4px 24px rgba(0,0,0,0.5)',
        panel: '2px 0 8px rgba(0,0,0,0.3)',
        toolbar: '0 2px 8px rgba(0,0,0,0.4)',
      },
      animation: {
        'slide-in-left': 'slideInLeft 0.2s ease-out',
        'slide-in-right': 'slideInRight 0.2s ease-out',
        'fade-in': 'fadeIn 0.15s ease-out',
        'spin-slow': 'spin 2s linear infinite',
      },
      keyframes: {
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
