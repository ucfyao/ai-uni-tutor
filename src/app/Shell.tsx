'use client';

import React from 'react';
import { AppShell, Burger, Group, Text, ThemeIcon } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { GraduationCap } from 'lucide-react';



export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
        {children}
    </>
  );
}
