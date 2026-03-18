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
          bg: '#0F0F1A',
          card: '#1A1A2E',
          inner: '#22223B',
          border: 'rgba(255,255,255,0.08)',
        },
        accent: {
          primary: '#7C3AED',
          'primary-h': '#6D28D9',
          secondary: '#06B6D4',
          success: '#10B981',
          danger: '#EF4444',
        },
        tx: {
          primary: '#F8F8FF',
          secondary: '#94A3B8',
          muted: '#4B5563',
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
        card: '0 4px 24px rgba(0,0,0,0.4)',
        glow: '0 0 24px rgba(124,58,237,0.4)',
        'glow-cyan': '0 0 24px rgba(6,182,212,0.35)',
      },
    },
  },
  plugins: [],
}
