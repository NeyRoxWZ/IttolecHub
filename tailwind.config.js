/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './games/**/*.{js,ts,jsx,tsx,mdx}',
    // Class names are also built in lib/ (patch notes, casino effects);
    // without this they were never generated.
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // Direction "Brawl", dark: indigo panels with thick black outlines on a
      // deep navy page, chunky outlined titles, bright buttons with a
      // pressed-in bottom edge. Token names are the old ones so every screen
      // switches at once:
      //  brand.bg     darkest tone (text on bright fills, deep wells)
      //  brand.card   panel
      //  brand.inner  well inside a panel
      //  brand.border black outline
      colors: {
        brand: {
          bg: '#0E1030',
          grid: '#1F2560',
          card: '#1E2358',
          border: '#05061A',
          inner: '#151942',
          page: '#161A45',
        },
        accent: {
          primary: '#FFC61A',
          secondary: '#FF4F8B',
          success: '#33D17A',
          info: '#5B8CFF',
        },
        tx: {
          base: '#FFFFFF',
          secondary: '#C2C9F0',
          muted: 'rgba(194,201,240,0.68)',
        },
      },
      // One radius scale for the whole site:
      //  md   10px  chips, small badges
      //  lg   14px  buttons, inputs, small tiles (same as xl on purpose)
      //  xl   14px
      //  2xl  18px  tiles and cards inside a panel
      //  3xl  22px  panels, modals (arbitrary 24–36px values are folded into this)
      borderRadius: {
        '3xl': '22px',
        '2xl': '18px',
        xl: '14px',
        lg: '14px',
        md: '10px',
        sm: '6px',
        full: '9999px',
      },
      fontFamily: {
        display: ['"Lilita One"', '"Arial Black"', 'sans-serif'],
        body: ['Nunito', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        brutal: '0 5px 0 #05061A',
        'brutal-cyan': '0 5px 0 #1E9A55',
        'brutal-dark': '0 5px 0 #05061A',
        card: '0 6px 0 #05061A',
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
