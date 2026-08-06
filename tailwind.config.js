/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './games/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#13131A',
          grid: '#262635',
          card: '#1E1E28',
          border: '#000000',
          inner: '#13131A', // Utilisons le fond principal pour l'intérieur
        },
        accent: {
          primary: '#FFD000', // BOUTON_FOND
          secondary: '#FF2A55', // NOTIF_ERREUR
          success: '#00FF94', // NOTIF_SUCCES
          info: '#E0E0E0', // NOTIF_INFO
        },
        tx: {
          base: '#FFFFFF',
          secondary: '#A0A0B0',
          muted: 'rgba(160,160,176,0.6)',
        },
      },
      borderRadius: {
        xl: '20px',
        lg: '12px',
        md: '8px',
        sm: '4px',
        full: '9999px',
      },
      fontFamily: {
        display: ['Nunito', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        brutal: '4px 4px 0px #000000', // CARTE_OMBRE / BOUTON_OMBRE
        'brutal-cyan': '4px 4px 0px #00FF94', // Using success for now
        'brutal-dark': '4px 4px 0px #000000',
        card: '0 4px 24px rgba(0,0,0,0.4)',
      },
      keyframes: {
        'float-up': {
          '0%': { transform: 'translateY(0) scale(0.5)', opacity: '0' },
          '10%': { transform: 'translateY(-50px) scale(1.2)', opacity: '1' },
          '100%': { transform: 'translateY(-400px) scale(1)', opacity: '0' },
        },
      },
      animation: {
        'float-up': 'float-up 2.5s ease-out forwards',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
