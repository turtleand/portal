/** @type {import('tailwindcss').Config} */
const config = {
  content: ['src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        deepBlue: 'var(--color-deep-blue)',
        teal: 'var(--color-teal)',
        offWhite: 'var(--color-off-white)',
        muted: 'var(--color-muted)',
        accent: 'var(--color-accent)',
        card: {
          ai: 'var(--card-ai)',
          growth: 'var(--card-growth)',
          build: 'var(--card-build)',
          blockchain: 'var(--card-blockchain)',
        },
      },
      fontFamily: {
        heading: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['Inter', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        xl: '1rem',
      },
      boxShadow: {
        'glow': '0 8px 24px rgba(0, 0, 0, 0.25)',
      },
      keyframes: {
        heroWave: {
          '0%': { backgroundPosition: '0% 0%' },
          '100%': { backgroundPosition: '100% 100%' },
        },
        scrollPulse: {
          '0%, 100%': { opacity: '0', transform: 'translateY(-8px)' },
          '50%': { opacity: '1', transform: 'translateY(4px)' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        heroWave: 'heroWave 40s ease-in-out infinite alternate',
        scrollPulse: 'scrollPulse 2s ease-in-out infinite',
        fadeUp: 'fadeUp 0.6s ease-out forwards',
      },
    },
  },
  plugins: [],
};

export default config;
