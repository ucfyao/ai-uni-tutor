import React from 'react';
import ShellClient from './ShellClient';

export default function ShellServer({ children }: { children: React.ReactNode }) {
  return <ShellClient>{children}</ShellClient>;
}
