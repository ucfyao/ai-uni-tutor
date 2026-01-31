'use client';

import { createTheme, rem } from '@mantine/core';
import { Outfit } from 'next/font/google';

const outfit = Outfit({ subsets: ['latin'] });

export const theme = createTheme({
    fontFamily: outfit.style.fontFamily,
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
    },
    headings: {
        fontFamily: outfit.style.fontFamily,
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
                }
            }
        },
        Select: {
            defaultProps: {
                radius: 'lg',
            },
            styles: {
                input: {
                    borderWidth: '1px',
                }
            }
        },
        Modal: {
            defaultProps: {
                radius: 'lg',
            }
        },
        Menu: {
            defaultProps: {
                radius: 'lg',
                shadow: 'md',
            }
        }
    },
});
