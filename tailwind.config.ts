import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#0f172a' },
        accent: { DEFAULT: '#fbbf24' },
      },
      backdropBlur: {
        glass: '12px',
      },
      transitionDuration: {
        '250': '250ms',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 300ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
