import { createTheme, rem } from '@mantine/core';

/** Font loaded via next/font (layout.tsx) with <link rel="preload"> — zero FOUT. */
const fontFamily =
  'var(--font-outfit), "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

export const theme = createTheme({
  fontFamily,
  primaryShade: { light: 6, dark: 7 },
  colors: {
    slate: [
      '#f8fafc',
      '#f1f5f9',
      '#e2e8f0',
      '#cbd5e1',
      '#94a3b8',
      '#64748b',
      '#475569',
      '#334155',
      '#1e293b',
      '#0f172a',
    ],
    indigo: [
      '#EEF2FF',
      '#E0E7FF',
      '#C7D2FE',
      '#A5B4FC',
      '#818CF8',
      '#6366F1',
      '#4F46E5',
      '#4338CA',
      '#3730A3',
      '#312E81',
    ],
    purple: [
      '#faf5ff',
      '#f3e8ff',
      '#e9d5ff',
      '#d8b4fe',
      '#c084fc',
      '#a855f7',
      '#9333ea',
      '#7e22ce',
      '#6b21a8',
      '#581c87',
    ],
    emerald: [
      '#ecfdf5',
      '#d1fae5',
      '#a7f3d0',
      '#6ee7b7',
      '#34d399',
      '#10b981',
      '#059669',
      '#047857',
      '#065f46',
      '#064e3b',
    ],
  },
  headings: {
    fontFamily,
    sizes: {
      h1: { fontSize: rem(32), fontWeight: '700', lineHeight: '1.2' },
      h2: { fontSize: rem(26), fontWeight: '600', lineHeight: '1.3' },
      h3: { fontSize: rem(22), fontWeight: '600', lineHeight: '1.35' },
      h4: { fontSize: rem(18), fontWeight: '600', lineHeight: '1.4' },
      h5: { fontSize: rem(16), fontWeight: '600', lineHeight: '1.5' },
    },
  },
  primaryColor: 'indigo',
  defaultRadius: 'lg',
  cursorType: 'pointer',
  components: {
    Button: {
      defaultProps: {
        radius: 'xl',
        h: 'auto',
        py: 'xs',
      },
    },
    Card: {
      defaultProps: {
        withBorder: true,
        shadow: 'sm',
        radius: 'lg',
        p: 'md',
      },
    },
    TextInput: {
      defaultProps: {
        radius: 'lg',
      },
      styles: {
        input: {
          borderWidth: '1px',
        },
      },
    },
    Select: {
      defaultProps: {
        radius: 'lg',
      },
      styles: {
        input: {
          borderWidth: '1px',
        },
      },
    },
    Modal: {
      defaultProps: {
        radius: 'lg',
      },
    },
    Menu: {
      defaultProps: {
        radius: 'lg',
        shadow: 'md',
      },
    },
    Paper: {
      defaultProps: {
        shadow: 'sm',
        radius: 'lg',
      },
      styles: {
        root: {
          transition: 'box-shadow 0.15s ease, transform 0.15s ease',
        },
      },
    },
    ActionIcon: {
      defaultProps: {
        radius: 'md',
      },
      styles: {
        root: {
          transition: 'all 0.15s ease',
        },
      },
    },
    Badge: {
      defaultProps: {
        radius: 'md',
      },
    },
    Loader: {
      defaultProps: {
        type: 'dots',
      },
    },
    ScrollArea: {
      defaultProps: {
        scrollbarSize: 6,
      },
    },
    Tooltip: {
      defaultProps: {
        withArrow: true,
        arrowSize: 6,
      },
    },
  },
});
