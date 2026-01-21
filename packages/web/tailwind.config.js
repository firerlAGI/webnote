/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          black: '#020203',
          dark: '#0a0a0f',
          panel: '#12121a',
          cyan: 'rgb(var(--color-primary) / <alpha-value>)',
          pink: 'rgb(var(--color-pink) / <alpha-value>)',
          yellow: 'rgb(var(--color-yellow) / <alpha-value>)',
          dim: 'rgb(var(--color-primary) / 0.1)',
          grid: 'rgb(var(--color-primary) / 0.03)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
        display: ['var(--font-display)'],
      },
      backgroundImage: {
        'grid-pattern': "linear-gradient(to right, #1f29371a 1px, transparent 1px), linear-gradient(to bottom, #1f29371a 1px, transparent 1px)",
        'cyber-grid': "linear-gradient(0deg, transparent 24%, rgba(0, 243, 255, .03) 25%, rgba(0, 243, 255, .03) 26%, transparent 27%, transparent 74%, rgba(0, 243, 255, .03) 75%, rgba(0, 243, 255, .03) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0, 243, 255, .03) 25%, rgba(0, 243, 255, .03) 26%, transparent 27%, transparent 74%, rgba(0, 243, 255, .03) 75%, rgba(0, 243, 255, .03) 76%, transparent 77%, transparent)",
      },
      animation: {
        'pulse-fast': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 8s linear infinite',
        glitch: 'glitch 1s linear infinite',
        scan: 'scan 4s linear infinite',
        flicker: 'flicker 0.15s infinite',
        float: 'float 6s ease-in-out infinite',
      },
      boxShadow: {
        'neon-cyan': '0 0 5px rgb(var(--color-primary)), 0 0 20px rgb(var(--color-primary) / 0.3)',
        'neon-pink': '0 0 5px rgb(var(--color-pink)), 0 0 20px rgb(var(--color-pink) / 0.3)',
        'neon-yellow': '0 0 5px rgb(var(--color-yellow)), 0 0 20px rgb(var(--color-yellow) / 0.3)',
      },
      keyframes: {
        glitch: {
          '0%': { transform: 'translate(0)' },
          '20%': { transform: 'translate(-2px, 2px)' },
          '40%': { transform: 'translate(-2px, -2px)' },
          '60%': { transform: 'translate(2px, 2px)' },
          '80%': { transform: 'translate(2px, -2px)' },
          '100%': { transform: 'translate(0)' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        flicker: {
          '0%': { opacity: '0.9' },
          '50%': { opacity: '1.0' },
          '100%': { opacity: '0.9' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [typography],
}
