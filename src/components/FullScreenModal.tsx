'use client';

import { Modal, type ModalProps } from '@mantine/core';
import { useIsMobile } from '@/hooks/use-mobile';

export function FullScreenModal({ children, fullScreen, ...props }: ModalProps) {
  const isMobile = useIsMobile();
  const isFullScreen = fullScreen ?? isMobile;

  return (
    <Modal
      {...props}
      fullScreen={isFullScreen}
      transitionProps={
        isFullScreen ? { transition: 'slide-up', duration: 300 } : props.transitionProps
      }
    >
      {children}
    </Modal>
  );
}
