import { useEffect } from 'react';

export const useBodyScrollLock = (isOpen: boolean, enabled: boolean = true) => {
  useEffect(() => {
    if (!enabled || !isOpen) return;

    // Locking scroll via `overflow: hidden` removes the scrollbar, which
    // shifts all page content (and anything `position: fixed`, like a
    // right-docked drawer) sideways by the scrollbar's width — compensate
    // with padding so the page's content-box width stays constant.
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    const originalOverflow = window.getComputedStyle(document.body).overflow;
    const originalPaddingRight = window.getComputedStyle(
      document.body,
    ).paddingRight;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [isOpen, enabled]);
};
