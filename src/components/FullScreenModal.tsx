'use client';

import { Modal, type ModalProps } from '@mantine/core';
import { useIsMobile } from '@/hooks/use-mobile';

export function FullScreenModal({ children, ...props }: ModalProps) {
  const isMobile = useIsMobile();

  return (
    <Modal
      {...props}
      fullScreen={isMobile}
      transitionProps={
        isMobile ? { transition: 'slide-up', duration: 300 } : props.transitionProps
      }
    >
      {children}
    </Modal>
  );
}
