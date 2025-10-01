import { useEffect, useRef } from 'react';

export interface ResizeObserverEntry {
  contentRect: {
    width: number;
    height: number;
    top: number;
    left: number;
    bottom: number;
    right: number;
  };
  target: Element;
}

export const useResizeObserver = (
  target: React.RefObject<Element>,
  callback: (entry: ResizeObserverEntry) => void,
) => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const element = target.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        callbackRef.current({
          contentRect: {
            width: entry.contentRect.width,
            height: entry.contentRect.height,
            top: entry.contentRect.top,
            left: entry.contentRect.left,
            bottom: entry.contentRect.bottom,
            right: entry.contentRect.right,
          },
          target: entry.target,
        });
      }
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [target]);
};
