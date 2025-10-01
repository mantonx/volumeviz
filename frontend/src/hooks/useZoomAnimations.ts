import { useCallback, useRef, useState } from 'react';

export interface ZoomState {
  scale: number;
  offsetX: number;
  offsetY: number;
  isAnimating: boolean;
}

export interface ZoomTarget {
  scale: number;
  offsetX: number;
  offsetY: number;
  duration?: number;
}

export interface UseZoomAnimationsOptions {
  /** Initial zoom scale */
  initialScale?: number;
  /** Minimum zoom scale */
  minScale?: number;
  /** Maximum zoom scale */
  maxScale?: number;
  /** Default animation duration in milliseconds */
  defaultDuration?: number;
  /** Called when zoom animation completes */
  onZoomComplete?: (state: ZoomState) => void;
}

export interface UseZoomAnimationsReturn {
  /** Current zoom state */
  zoomState: ZoomState;
  /** Animate to a specific zoom target */
  animateToZoom: (target: ZoomTarget) => Promise<void>;
  /** Reset zoom to initial state */
  resetZoom: (duration?: number) => Promise<void>;
  /** Zoom in by a factor */
  zoomIn: (
    factor?: number,
    centerX?: number,
    centerY?: number,
  ) => Promise<void>;
  /** Zoom out by a factor */
  zoomOut: (factor?: number) => Promise<void>;
  /** Set zoom immediately without animation */
  setZoom: (target: Partial<ZoomTarget>) => void;
  /** Whether zoom is at minimum */
  isAtMinZoom: boolean;
  /** Whether zoom is at maximum */
  isAtMaxZoom: boolean;
}

/**
 * Hook for managing smooth zoom and pan animations
 * Provides utilities for animated transitions between zoom states
 */
export function useZoomAnimations({
  initialScale = 1,
  minScale = 0.1,
  maxScale = 10,
  defaultDuration = 300,
  onZoomComplete,
}: UseZoomAnimationsOptions = {}): UseZoomAnimationsReturn {
  const [zoomState, setZoomState] = useState<ZoomState>({
    scale: initialScale,
    offsetX: 0,
    offsetY: 0,
    isAnimating: false,
  });

  const animationRef = useRef<number>();
  const startTimeRef = useRef<number>();

  const clampScale = useCallback(
    (scale: number) => {
      return Math.max(minScale, Math.min(maxScale, scale));
    },
    [minScale, maxScale],
  );

  const animateToZoom = useCallback(
    (target: ZoomTarget): Promise<void> => {
      return new Promise((resolve) => {
        const startState = { ...zoomState };
        const duration = target.duration ?? defaultDuration;
        const targetScale = clampScale(target.scale);

        const animate = (currentTime: number) => {
          if (!startTimeRef.current) {
            startTimeRef.current = currentTime;
          }

          const elapsed = currentTime - startTimeRef.current;
          const progress = Math.min(elapsed / duration, 1);

          // Easing function (ease-out cubic)
          const eased = 1 - Math.pow(1 - progress, 3);

          const currentScale =
            startState.scale + (targetScale - startState.scale) * eased;
          const currentOffsetX =
            startState.offsetX + (target.offsetX - startState.offsetX) * eased;
          const currentOffsetY =
            startState.offsetY + (target.offsetY - startState.offsetY) * eased;

          const newState: ZoomState = {
            scale: currentScale,
            offsetX: currentOffsetX,
            offsetY: currentOffsetY,
            isAnimating: progress < 1,
          };

          setZoomState(newState);

          if (progress < 1) {
            animationRef.current = requestAnimationFrame(animate);
          } else {
            startTimeRef.current = undefined;
            onZoomComplete?.(newState);
            resolve();
          }
        };

        setZoomState((prev) => ({ ...prev, isAnimating: true }));
        animationRef.current = requestAnimationFrame(animate);
      });
    },
    [zoomState, defaultDuration, clampScale, onZoomComplete],
  );

  const resetZoom = useCallback(
    (duration = defaultDuration): Promise<void> => {
      return animateToZoom({
        scale: initialScale,
        offsetX: 0,
        offsetY: 0,
        duration,
      });
    },
    [animateToZoom, initialScale, defaultDuration],
  );

  const zoomIn = useCallback(
    (factor = 2, centerX = 0, centerY = 0): Promise<void> => {
      const newScale = clampScale(zoomState.scale * factor);
      const scaleChange = newScale / zoomState.scale;

      // Adjust offset to zoom towards the specified center point
      const newOffsetX = centerX - (centerX - zoomState.offsetX) * scaleChange;
      const newOffsetY = centerY - (centerY - zoomState.offsetY) * scaleChange;

      return animateToZoom({
        scale: newScale,
        offsetX: newOffsetX,
        offsetY: newOffsetY,
      });
    },
    [animateToZoom, clampScale, zoomState],
  );

  const zoomOut = useCallback(
    (factor = 2): Promise<void> => {
      const newScale = clampScale(zoomState.scale / factor);

      return animateToZoom({
        scale: newScale,
        offsetX: zoomState.offsetX,
        offsetY: zoomState.offsetY,
      });
    },
    [animateToZoom, clampScale, zoomState],
  );

  const setZoom = useCallback(
    (target: Partial<ZoomTarget>) => {
      setZoomState((prev) => ({
        ...prev,
        scale:
          target.scale !== undefined ? clampScale(target.scale) : prev.scale,
        offsetX: target.offsetX !== undefined ? target.offsetX : prev.offsetX,
        offsetY: target.offsetY !== undefined ? target.offsetY : prev.offsetY,
        isAnimating: false,
      }));
    },
    [clampScale],
  );

  // Cleanup animation on unmount
  const cleanup = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = undefined;
    }
  }, []);

  // Derived state
  const isAtMinZoom = zoomState.scale <= minScale + 0.01;
  const isAtMaxZoom = zoomState.scale >= maxScale - 0.01;

  return {
    zoomState,
    animateToZoom,
    resetZoom,
    zoomIn,
    zoomOut,
    setZoom,
    isAtMinZoom,
    isAtMaxZoom,
  };
}

/**
 * Hook for drill-down animations in hierarchical visualizations
 */
export function useDrillAnimations() {
  const [drillStack, setDrillStack] = useState<string[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const drillDown = useCallback(
    async (itemId: string, animationDuration = 500): Promise<void> => {
      setIsTransitioning(true);

      // Add to drill stack
      setDrillStack((prev) => [...prev, itemId]);

      // Simulate animation duration
      await new Promise((resolve) => setTimeout(resolve, animationDuration));

      setIsTransitioning(false);
    },
    [],
  );

  const drillUp = useCallback(
    async (animationDuration = 500): Promise<void> => {
      if (drillStack.length === 0) return;

      setIsTransitioning(true);

      // Remove from drill stack
      setDrillStack((prev) => prev.slice(0, -1));

      // Simulate animation duration
      await new Promise((resolve) => setTimeout(resolve, animationDuration));

      setIsTransitioning(false);
    },
    [drillStack.length],
  );

  const drillToRoot = useCallback(
    async (animationDuration = 500): Promise<void> => {
      if (drillStack.length === 0) return;

      setIsTransitioning(true);

      // Clear drill stack
      setDrillStack([]);

      // Simulate animation duration
      await new Promise((resolve) => setTimeout(resolve, animationDuration));

      setIsTransitioning(false);
    },
    [drillStack.length],
  );

  const currentLevel = drillStack.length;
  const currentFocus = drillStack[drillStack.length - 1] || null;
  const canDrillUp = drillStack.length > 0;

  return {
    drillStack,
    currentLevel,
    currentFocus,
    canDrillUp,
    isTransitioning,
    drillDown,
    drillUp,
    drillToRoot,
  };
}

/**
 * Hook for coordinating zoom and drill animations
 */
export function useVisualizationAnimations(
  options: UseZoomAnimationsOptions = {},
) {
  const zoomAnimations = useZoomAnimations(options);
  const drillAnimations = useDrillAnimations();

  const drillWithZoom = useCallback(
    async (
      itemId: string,
      zoomTarget?: ZoomTarget,
      animationDuration = 500,
    ): Promise<void> => {
      // Start both animations simultaneously
      const drillPromise = drillAnimations.drillDown(itemId, animationDuration);
      const zoomPromise = zoomTarget
        ? zoomAnimations.animateToZoom({
            ...zoomTarget,
            duration: animationDuration,
          })
        : Promise.resolve();

      await Promise.all([drillPromise, zoomPromise]);
    },
    [drillAnimations, zoomAnimations],
  );

  const drillUpWithZoom = useCallback(
    async (zoomTarget?: ZoomTarget, animationDuration = 500): Promise<void> => {
      // Start both animations simultaneously
      const drillPromise = drillAnimations.drillUp(animationDuration);
      const zoomPromise = zoomTarget
        ? zoomAnimations.animateToZoom({
            ...zoomTarget,
            duration: animationDuration,
          })
        : zoomAnimations.resetZoom(animationDuration);

      await Promise.all([drillPromise, zoomPromise]);
    },
    [drillAnimations, zoomAnimations],
  );

  const isAnimating =
    zoomAnimations.zoomState.isAnimating || drillAnimations.isTransitioning;

  return {
    ...zoomAnimations,
    ...drillAnimations,
    drillWithZoom,
    drillUpWithZoom,
    isAnimating,
  };
}
