/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}", // ✅ ADDED: components folder
  ],
  theme: {
    extend: {
      // ✅ Custom animations (इन्हें जोड़ें)
      animation: {
        'fade-in': 'fade-in 0.3s ease-in-out',
        'fade-in-down': 'fade-in-down 0.3s ease-in-out',
        'card-load': 'card-load 0.5s ease-out forwards', // ✅ AnimeCard के लिए
        'scale-in': 'scale-in 0.3s ease-out',
        'bounce-soft': 'bounce-soft 2s infinite',
        'pulse-soft': 'pulse-soft 2s infinite',
        'slide-in-right': 'slide-in-right 0.5s ease-out',
        'slide-in-left': 'slide-in-left 0.5s ease-out',
        'shimmer': 'shimmer 2s infinite linear',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' }
        },
        'fade-in-down': {
          from: { opacity: '0', transform: 'translateY(-10px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        'card-load': { // ✅ AnimeCard animation
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.9)' },
          to: { opacity: '1', transform: 'scale(1)' }
        },
        'bounce-soft': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' }
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' }
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' }
        },
        'slide-in-left': {
          from: { transform: 'translateX(-100%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' }
        },
        'shimmer': {
          '0%': { backgroundPosition: '-468px 0' },
          '100%': { backgroundPosition: '468px 0' }
        }
      }
    }
  },
  plugins: [],
}