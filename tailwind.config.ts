import type { Config } from 'tailwindcss';

/* Floorbase monochrome ramp — warm neutral, near-zero chroma.
   Every hardcoded color family below is remapped onto this single
   ramp so existing `slate-*`, `blue-*`, `emerald-*`, `red-*` … utilities
   render in monochrome without touching component markup. */
const mono = {
  50: '#f7f6f4',
  100: '#f1f0ed',
  200: '#e4e3df',
  300: '#d2d1cc',
  400: '#a8a7a2',
  500: '#76756f',
  600: '#56554f',
  700: '#3b3a36',
  800: '#232220',
  900: '#141312',
  950: '#0a0a09'
};

const monoFamilies = [
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose'
];
const monoColors = Object.fromEntries(monoFamilies.map((f) => [f, mono]));

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ...monoColors,
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        }
      },
      fontFamily: {
        sans: ['Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['Space Mono', 'ui-monospace', 'SF Mono', 'Menlo', 'monospace']
      },
      letterSpacing: {
        tightest: '-0.03em'
      },
      borderRadius: {
        none: '0px',
        DEFAULT: '0px',
        sm: '0px',
        md: '0px',
        lg: 'var(--radius)',
        xl: '0px',
        '2xl': '0px',
        '3xl': '0px',
        full: '9999px'
      }
    }
  },
  plugins: []
};

export default config;
