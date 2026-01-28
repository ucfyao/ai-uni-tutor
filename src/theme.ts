'use client';

import { createTheme, rem } from '@mantine/core';
import { Outfit } from 'next/font/google';

const outfit = Outfit({ subsets: ['latin'] });

export const theme = createTheme({
    fontFamily: outfit.style.fontFamily,
    headings: {
        fontFamily: outfit.style.fontFamily,
        sizes: {
            h1: { fontSize: rem(36), fontWeight: '700' },
            h2: { fontSize: rem(30), fontWeight: '600' },
            h3: { fontSize: rem(24), fontWeight: '600' },
        },
    },
    primaryColor: 'indigo',
    defaultRadius: 'md',
    cursorType: 'pointer',
    components: {
        Button: {
            defaultProps: {
                radius: 'xl',
            },
        },
        Card: {
            defaultProps: {
                withBorder: true,
                shadow: 'sm',
                radius: 'md',
            },
        },
        TextInput: {
            defaultProps: {
                radius: 'md',
            },
        },
        Select: {
            defaultProps: {
                radius: 'md',
            },
        },
    },
});
