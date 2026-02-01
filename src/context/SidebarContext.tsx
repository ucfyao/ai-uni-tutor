'use client';

import React, { createContext, ReactNode, useContext, useState } from 'react';

interface SidebarContextType {
  mobileOpened: boolean;
  toggleMobile: () => void;
  closeMobile: () => void;
  openMobile: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [mobileOpened, setMobileOpened] = useState(false);

  const toggleMobile = () => setMobileOpened((o) => !o);
  const closeMobile = () => setMobileOpened(false);
  const openMobile = () => setMobileOpened(true);

  return (
    <SidebarContext.Provider value={{ mobileOpened, toggleMobile, closeMobile, openMobile }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
