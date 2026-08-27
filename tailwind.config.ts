import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#07080B',
        surface: {
          DEFAULT: '#0D0F14',
          2: '#13161D',
          3: '#1A1E27',
        },
        bnb: {
          DEFAULT: '#F0B90B',
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#F5C518',
          500: '#F0B90B',
          600: '#D4A009',
          700: '#A67C07',
          800: '#7A5B05',
          900: '#4D3A03',
        },
        cat: {
          monitoring: '#22D3EE',
          grid: '#F0B90B',
          health: '#34D399',
          yield: '#A78BFA',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(240,185,11,0.25), 0 12px 48px -12px rgba(240,185,11,0.35)',
        'glow-sm': '0 0 0 1px rgba(240,185,11,0.2), 0 6px 24px -8px rgba(240,185,11,0.3)',
        'glow-cyan': '0 0 0 1px rgba(34,211,238,0.25), 0 12px 48px -12px rgba(34,211,238,0.35)',
        'glow-emerald': '0 0 0 1px rgba(52,211,153,0.25), 0 12px 48px -12px rgba(52,211,153,0.35)',
        'glow-violet': '0 0 0 1px rgba(167,139,250,0.25), 0 12px 48px -12px rgba(167,139,250,0.35)',
        card: '0 8px 32px rgba(0,0,0,0.35)',
      },
      backgroundImage: {
        'gold-radial': 'radial-gradient(60% 50% at 50% 0%, rgba(240,185,11,0.18) 0%, rgba(240,185,11,0) 100%)',
        'hero-glow':
          'radial-gradient(50% 40% at 20% 10%, rgba(240,185,11,0.16) 0%, rgba(240,185,11,0) 100%), radial-gradient(40% 35% at 85% 20%, rgba(34,211,238,0.12) 0%, rgba(34,211,238,0) 100%), radial-gradient(45% 40% at 60% 90%, rgba(167,139,250,0.10) 0%, rgba(167,139,250,0) 100%)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.8' },
          '100%': { transform: 'scale(1.8)', opacity: '0' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        shimmer: 'shimmer 2.5s linear infinite',
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.2, 0.8, 0.2, 1) infinite',
        'fade-up': 'fade-up 0.6s ease-out both',
        marquee: 'marquee 40s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
