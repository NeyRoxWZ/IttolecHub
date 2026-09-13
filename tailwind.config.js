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
      // Direction "Brawl": white panels with thick ink outlines on a blue
      // page, chunky outlined titles, buttons with a pressed-in bottom edge.
      // The token names are the old ones so every screen switches at once:
      //  brand.bg     ink, the dark tone (text on bright fills, dark wells)
      //  brand.card   white panel
      //  brand.inner  pale blue well inside a panel
      //  brand.border ink outline
      colors: {
        brand: {
          bg: '#14142B',
          grid: '#3D74F5',
          card: '#FFFFFF',
          border: '#14142B',
          inner: '#EAF0FF',
          page: '#4C82FF',
        },
        accent: {
          primary: '#FFC61A',
          secondary: '#FF4F8B',
          success: '#33D17A',
          info: '#2F6BFF',
        },
        // Secondary and muted text also sit straight on the blue page (section
        // labels, subtitles): dark enough to stay readable there too.
        tx: {
          base: '#14142B',
          secondary: '#3A3A5A',
          muted: 'rgba(20,20,43,0.7)',
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
        display: ['"Lilita One"', '"Arial Black"', 'sans-serif'],
        body: ['Nunito', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        brutal: '0 5px 0 #14142B',
        'brutal-cyan': '0 5px 0 #1E9A55',
        'brutal-dark': '0 5px 0 #14142B',
        card: '0 6px 0 #14142B',
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
