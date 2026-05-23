/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#0B0F19',
          surface: '#111827',
          border: 'rgba(255, 255, 255, 0.08)',
          'card-bg': 'rgba(17, 24, 39, 0.6)',
          cyan: '#06B6D4',
          blue: '#3B82F6',
          green: '#10B981',
          red: '#EF4444',
          gold: '#F59E0B',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
        mono: ['Fira Code', 'Courier New', 'monospace'],
      },
      boxShadow: {
        'cyan-glow': '0 0 15px rgba(6, 182, 212, 0.4)',
        'blue-glow': '0 0 15px rgba(59, 130, 246, 0.4)',
        'green-glow': '0 0 15px rgba(16, 185, 129, 0.4)',
        'red-glow': '0 0 20px rgba(239, 68, 68, 0.5)',
        'gold-glow': '0 0 15px rgba(245, 158, 11, 0.4)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scan-line': 'scan 3s linear infinite',
      },
      keyframes: {
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' }
        }
      }
    },
  },
  plugins: [],
}
