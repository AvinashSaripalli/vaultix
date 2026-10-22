import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

let openModalsCount = 0;

/**
 * Universal Modal Portal
 * - Portals children directly to document.body to escape layout transforms/containment
 * - Locks background scroll on document.body while any modal is open
 * - Supports closing on Escape key (configurable via closeOnEscape)
 */
export default function ModalPortal({
  children,
  open = true,
  onClose,
  closeOnEscape = true,
}) {
  useEffect(() => {
    if (!open) return;

    openModalsCount++;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && closeOnEscape && onClose) {
        if (e.defaultPrevented) return;
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
  }, [open, onClose, closeOnEscape]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(children, document.body);
}

/**
 * Safe Modal Backdrop Container
 * - Prevents accidental closing when dragging text/elements inside the modal and releasing outside
 * - Prevents accidental closing when clicking scrollbars
 * - Supports disableBackdropClick for important data-entry forms to avoid losing work
 */
export function ModalBackdrop({
  children,
  onClose,
  disableBackdropClick = false,
  className = 'fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto',
  ...rest
}) {
  const mouseDownTargetRef = useRef(null);

  const handleMouseDown = (e) => {
    mouseDownTargetRef.current = e.target;
  };

  const handleClick = (e) => {
    if (disableBackdropClick) return;
    // Only close if BOTH mousedown AND mouseup occurred directly on this backdrop element
    if (
      e.target === e.currentTarget &&
      mouseDownTargetRef.current === e.currentTarget
    ) {
      onClose?.(e);
    }
    mouseDownTargetRef.current = null;
  };

  return (
    <div
      className={className}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      {...rest}
    >
      {children}
    </div>
  );
}
