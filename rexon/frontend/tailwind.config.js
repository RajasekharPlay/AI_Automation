/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#060d1a',
          800: '#0b1120',
          700: '#0d1929',
          600: '#112136',
          500: '#1a3050',
        },
        cyan: {
          400: '#22d3ee',
          500: '#06b6d4',
        }
      }
    }
  },
  plugins: []
};
