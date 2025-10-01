import React, { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '@/utils/class-names/cn';
import { useVisualizationAnimations } from '@/hooks/useZoomAnimations';

export interface AnimatedVisualizationProps {
  /** Child components to render with animation context */
  children: React.ReactNode;
  /** Width of the visualization container */
  width?: number;
  /** Height of the visualization container */
  height?: number;
  /** Enable zoom controls */
  enableZoom?: boolean;
  /** Enable pan controls */
  enablePan?: boolean;
  /** Enable wheel zoom */
  enableWheelZoom?: boolean;
  /** Initial zoom scale */
  initialScale?: number;
  /** Minimum zoom scale */
  minScale?: number;
  /** Maximum zoom scale */
  maxScale?: number;
  /** Called when zoom changes */
  onZoomChange?: (scale: number) => void;
  /** Called when pan changes */
  onPanChange?: (offsetX: number, offsetY: number) => void;
  /** Called when drill down occurs */
  onDrillDown?: (itemId: string) => void;
  /** Called when drill up occurs */
  onDrillUp?: () => void;
  /** Class name for the container */
  className?: string;
}

export interface AnimationContext {
  zoomState: {
    scale: number;
    offsetX: number;
    offsetY: number;
    isAnimating: boolean;
  };
  drillState: {
    currentFocus: string | null;
    currentLevel: number;
    canDrillUp: boolean;
    isTransitioning: boolean;
  };
  actions: {
    zoomIn: (
      factor?: number,
      centerX?: number,
      centerY?: number,
    ) => Promise<void>;
    zoomOut: (factor?: number) => Promise<void>;
    resetZoom: () => Promise<void>;
    drillDown: (itemId: string) => Promise<void>;
    drillUp: () => Promise<void>;
    drillToRoot: () => Promise<void>;
  };
}

const AnimationContext = React.createContext<AnimationContext | null>(null);

/**
 * Container component that provides zoom, pan, and drill animations
 * to child visualization components
 */
export const AnimatedVisualization: React.FC<AnimatedVisualizationProps> = ({
  children,
  width = 800,
  height = 600,
  enableZoom = true,
  enablePan = true,
  enableWheelZoom = true,
  initialScale = 1,
  minScale = 0.1,
  maxScale = 10,
  onZoomChange,
  onPanChange,
  onDrillDown,
  onDrillUp,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  const animations = useVisualizationAnimations({
    initialScale,
    minScale,
    maxScale,
    onZoomComplete: (state) => {
      onZoomChange?.(state.scale);
      onPanChange?.(state.offsetX, state.offsetY);
    },
  });

  // Handle mouse wheel zoom
  const handleWheel = useCallback(
    (event: React.WheelEvent) => {
      if (!enableWheelZoom || animations.isAnimating) return;

      event.preventDefault();

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const centerX = event.clientX - rect.left - width / 2;
      const centerY = event.clientY - rect.top - height / 2;

      const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;

      if (event.deltaY > 0) {
        animations.zoomOut(1 / zoomFactor);
      } else {
        animations.zoomIn(zoomFactor, centerX, centerY);
      }
    },
    [enableWheelZoom, animations, width, height],
  );

  // Handle mouse down for panning
  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (!enablePan || animations.isAnimating) return;

      isDragging.current = true;
      setIsPanning(true);
      lastMousePos.current = { x: event.clientX, y: event.clientY };

      // Prevent text selection during drag
      event.preventDefault();
    },
    [enablePan, animations.isAnimating],
  );

  // Handle mouse move for panning
  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!isDragging.current || !enablePan) return;

      const deltaX = event.clientX - lastMousePos.current.x;
      const deltaY = event.clientY - lastMousePos.current.y;

      animations.setZoom({
        offsetX: animations.zoomState.offsetX + deltaX,
        offsetY: animations.zoomState.offsetY + deltaY,
      });

      lastMousePos.current = { x: event.clientX, y: event.clientY };

      onPanChange?.(animations.zoomState.offsetX, animations.zoomState.offsetY);
    },
    [enablePan, animations],
  );

  // Handle mouse up for panning
  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    setIsPanning(false);
  }, []);

  // Set up global mouse event listeners for panning
  useEffect(() => {
    if (isPanning) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isPanning, handleMouseMove, handleMouseUp]);

  // Handle drill down with callback
  const handleDrillDown = useCallback(
    async (itemId: string) => {
      await animations.drillDown(itemId);
      onDrillDown?.(itemId);
    },
    [animations, onDrillDown],
  );

  // Handle drill up with callback
  const handleDrillUp = useCallback(async () => {
    await animations.drillUp();
    onDrillUp?.();
  }, [animations, onDrillUp]);

  // Create context value
  const contextValue: AnimationContext = {
    zoomState: animations.zoomState,
    drillState: {
      currentFocus: animations.currentFocus,
      currentLevel: animations.currentLevel,
      canDrillUp: animations.canDrillUp,
      isTransitioning: animations.isTransitioning,
    },
    actions: {
      zoomIn: animations.zoomIn,
      zoomOut: animations.zoomOut,
      resetZoom: animations.resetZoom,
      drillDown: handleDrillDown,
      drillUp: handleDrillUp,
      drillToRoot: animations.drillToRoot,
    },
  };

  // Transform styles
  const transformStyle = {
    transform: `translate(${animations.zoomState.offsetX}px, ${animations.zoomState.offsetY}px) scale(${animations.zoomState.scale})`,
    transformOrigin: 'center center',
    transition: animations.zoomState.isAnimating
      ? 'transform 0.3s ease-out'
      : 'none',
  };

  return (
    <AnimationContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        className={cn(
          'relative overflow-hidden',
          enablePan && 'cursor-grab',
          isPanning && 'cursor-grabbing',
          className,
        )}
        style={{ width, height }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
      >
        <div className="absolute inset-0 w-full h-full" style={transformStyle}>
          {children}
        </div>

        {/* Zoom controls */}
        {enableZoom && (
          <ZoomControls
            onZoomIn={() => animations.zoomIn()}
            onZoomOut={() => animations.zoomOut()}
            onReset={() => animations.resetZoom()}
            canZoomIn={!animations.isAtMaxZoom}
            canZoomOut={!animations.isAtMinZoom}
            disabled={animations.isAnimating}
          />
        )}

        {/* Drill controls */}
        {animations.canDrillUp && (
          <DrillControls
            onDrillUp={handleDrillUp}
            onDrillToRoot={() => animations.drillToRoot()}
            currentLevel={animations.currentLevel}
            disabled={animations.isTransitioning}
          />
        )}
      </div>
    </AnimationContext.Provider>
  );
};

interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
  disabled: boolean;
}

const ZoomControls: React.FC<ZoomControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onReset,
  canZoomIn,
  canZoomOut,
  disabled,
}) => {
  return (
    <div className="absolute top-4 right-4 flex flex-col gap-1 bg-background/90 backdrop-blur-sm border border-border rounded-lg p-1">
      <button
        type="button"
        onClick={onZoomIn}
        disabled={disabled || !canZoomIn}
        className={cn(
          'w-8 h-8 flex items-center justify-center rounded hover:bg-muted',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
        title="Zoom in"
      >
        +
      </button>
      <button
        type="button"
        onClick={onZoomOut}
        disabled={disabled || !canZoomOut}
        className={cn(
          'w-8 h-8 flex items-center justify-center rounded hover:bg-muted',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
        title="Zoom out"
      >
        -
      </button>
      <button
        type="button"
        onClick={onReset}
        disabled={disabled}
        className={cn(
          'w-8 h-8 flex items-center justify-center rounded hover:bg-muted text-xs',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
        title="Reset zoom"
      >
        ⌂
      </button>
    </div>
  );
};

interface DrillControlsProps {
  onDrillUp: () => void;
  onDrillToRoot: () => void;
  currentLevel: number;
  disabled: boolean;
}

const DrillControls: React.FC<DrillControlsProps> = ({
  onDrillUp,
  onDrillToRoot,
  currentLevel,
  disabled,
}) => {
  return (
    <div className="absolute top-4 left-4 flex items-center gap-2 bg-background/90 backdrop-blur-sm border border-border rounded-lg p-2">
      <button
        type="button"
        onClick={onDrillUp}
        disabled={disabled}
        className={cn(
          'px-3 py-1 text-sm rounded hover:bg-muted',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
        title="Go back one level"
      >
        ← Back
      </button>
      {currentLevel > 1 && (
        <button
          type="button"
          onClick={onDrillToRoot}
          disabled={disabled}
          className={cn(
            'px-3 py-1 text-sm rounded hover:bg-muted',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
          title="Go to root"
        >
          ⌂ Root
        </button>
      )}
      <span className="text-xs text-muted-foreground">
        Level {currentLevel}
      </span>
    </div>
  );
};

/**
 * Hook to access animation context from child components
 */
export function useAnimationContext(): AnimationContext {
  const context = React.useContext(AnimationContext);
  if (!context) {
    throw new Error(
      'useAnimationContext must be used within AnimatedVisualization',
    );
  }
  return context;
}

export default AnimatedVisualization;
