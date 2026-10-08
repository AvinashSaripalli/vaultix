import { useEffect } from 'react';
import { createPortal } from 'react-dom';

let openModalsCount = 0;

/**
 * Universal Modal Portal
 * - Portals children directly to document.body to escape layout transforms/containment
 * - Locks background scroll on document.body while any modal is open
 * - Supports closing on Escape key
 */
export default function ModalPortal({ children, open = true, onClose }) {
  useEffect(() => {
    if (!open) return;

    openModalsCount++;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      openModalsCount = Math.max(0, openModalsCount - 1);
      if (openModalsCount === 0) {
        document.body.style.overflow = prevOverflow || '';
      }
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(children, document.body);
}
