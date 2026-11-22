/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ios: {
          blue: '#007AFF',
          gray: '#8E8E93',
          bg: '#F2F2F7',
          card: '#FFFFFF',
          darkBg: '#000000',
          darkCard: '#1C1C1E'
        },
        m3: {
          primary: '#1A73E8',
          surface: '#F8F9FA',
          surfaceDark: '#121212',
          cardDark: '#1E1E1E',
          accent: '#7C3AED'
        }
      },
      boxShadow: {
        'ios-sheet': '0 -4px 20px rgba(0, 0, 0, 0.1)',
        'ios-glass': '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
        'm3-fab': '0 4px 14px rgba(0, 0, 0, 0.25)'
      }
    },
  },
  plugins: [],
}
