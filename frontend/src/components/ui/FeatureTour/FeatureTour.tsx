/**
 * FeatureTour - Interactive guided tour component
 *
 * Features:
 * - Step-by-step feature highlights
 * - Spotlight effect on target elements
 * - Skip/restart functionality
 * - Progress tracking
 * - Persistent state (don't show again)
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { Button } from '../Button';

export interface TourStep {
  target: string; // CSS selector for element to highlight
  title: string;
  description: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface FeatureTourProps {
  steps: TourStep[];
  onComplete?: () => void;
  onSkip?: () => void;
  isOpen: boolean;
  tourId: string; // Unique ID for tour (for persistence)
  className?: string;
}

export const FeatureTour: React.FC<FeatureTourProps> = ({
  steps,
  onComplete,
  onSkip,
  isOpen,
  tourId,
  className = '',
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  // Update target element position
  useEffect(() => {
    if (!isOpen || !currentStepData) return;

    const updatePosition = () => {
      const targetElement = document.querySelector(currentStepData.target);
      if (targetElement) {
        const rect = targetElement.getBoundingClientRect();
        setTargetRect(rect);
      } else {
        setTargetRect(null);
      }
    };

    updatePosition();

    // Update on scroll/resize
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, currentStep, currentStepData]);

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem(`volumeviz_tour_${tourId}_skipped`, 'true');
    onSkip?.();
  };

  const handleComplete = () => {
    localStorage.setItem(`volumeviz_tour_${tourId}_completed`, 'true');
    onComplete?.();
  };

  const getTooltipPosition = () => {
    if (!targetRect) return {};

    const placement = currentStepData.placement || 'bottom';
    const padding = 20;
    const tooltipWidth = 320;

    switch (placement) {
      case 'top':
        return {
          left: targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
          top: targetRect.top - padding,
          transform: 'translateY(-100%)',
        };
      case 'bottom':
        return {
          left: targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
          top: targetRect.bottom + padding,
        };
      case 'left':
        return {
          left: targetRect.left - padding,
          top: targetRect.top + targetRect.height / 2,
          transform: 'translate(-100%, -50%)',
        };
      case 'right':
        return {
          left: targetRect.right + padding,
          top: targetRect.top + targetRect.height / 2,
          transform: 'translateY(-50%)',
        };
      default:
        return {
          left: targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
          top: targetRect.bottom + padding,
        };
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className={`fixed inset-0 z-50 pointer-events-none ${className}`}
    >
      {/* Dark overlay with cutout for target */}
      <div className="absolute inset-0 pointer-events-auto">
        <svg className="w-full h-full">
          <defs>
            <mask id="tour-spotlight">
              <rect width="100%" height="100%" fill="white" />
              {targetRect && (
                <rect
                  x={targetRect.left - 8}
                  y={targetRect.top - 8}
                  width={targetRect.width + 16}
                  height={targetRect.height + 16}
                  rx="8"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.7)"
            mask="url(#tour-spotlight)"
          />
        </svg>
      </div>

      {/* Highlight ring around target */}
      {targetRect && (
        <div
          className="absolute border-4 border-blue-500 rounded-lg pointer-events-none animate-pulse"
          style={{
            left: targetRect.left - 8,
            top: targetRect.top - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
          }}
        />
      )}

      {/* Tooltip card */}
      {currentStepData && (
        <div
          className="absolute pointer-events-auto bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 max-w-sm"
          style={getTooltipPosition()}
        >
          {/* Close button */}
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Progress indicator */}
          <div className="flex items-center gap-1 mb-4">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`h-1 flex-1 rounded-full ${
                  index <= currentStep
                    ? 'bg-blue-600'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              />
            ))}
          </div>

          {/* Content */}
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {currentStepData.title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {currentStepData.description}
          </p>

          {/* Optional action button */}
          {currentStepData.action && (
            <button
              onClick={currentStepData.action.onClick}
              className="w-full mb-4 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 text-sm font-medium"
            >
              {currentStepData.action.label}
            </button>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Step {currentStep + 1} of {steps.length}
            </div>

            <div className="flex gap-2">
              {!isFirstStep && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevious}
                  className="flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
              )}

              <Button
                variant="primary"
                size="sm"
                onClick={handleNext}
                className="flex items-center gap-1"
              >
                {isLastStep ? (
                  <>
                    <Check className="w-4 h-4" />
                    Finish
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Skip link */}
          <button
            onClick={handleSkip}
            className="w-full mt-4 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            Skip tour
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Hook to check if a tour should be shown
 */
export const useShouldShowTour = (tourId: string): boolean => {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(
      `volumeviz_tour_${tourId}_completed`,
    );
    const skipped = localStorage.getItem(`volumeviz_tour_${tourId}_skipped`);
    setShouldShow(!completed && !skipped);
  }, [tourId]);

  return shouldShow;
};

export default FeatureTour;
