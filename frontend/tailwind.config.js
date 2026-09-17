/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#F8FAFC',
        header: '#1E293B',
        accent: {
          DEFAULT: '#0EA5E9',
          hover: '#0284C7',
          light: '#E0F2FE',
        },
        status: {
          confirmed: '#DC2626', // Red - reserved for confirmed/high-severity
          pending: '#F59E0B',   // Amber - reserved for unverified/pending
          safe: '#16A34A',      // Green - reserved for safe/clear
        },
        slate: {
          850: '#172033',
          900: '#0F172A',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      maxWidth: {
        'app': '1280px',
      },
      borderRadius: {
        'card': '0.75rem',   // rounded-xl
        'element': '0.5rem', // rounded-lg
      },
      transitionDuration: {
        'smooth': '200ms',
      }
    },
  },
  plugins: [],
}
