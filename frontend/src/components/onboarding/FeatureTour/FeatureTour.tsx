/**
 * FeatureTour Component
 * Interactive tour overlay for guiding users through features
 */

import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export interface TourStep {
  target?: string;
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  image?: string;
}

export interface FeatureTourProps {
  steps: TourStep[];
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
  showSkip?: boolean;
}

export const FeatureTour: React.FC<FeatureTourProps> = ({
  steps,
  isOpen,
  onComplete,
  onSkip,
  showSkip = true,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  useEffect(() => {
    if (isOpen && step?.target) {
      const element = document.querySelector(step.target);
      if (element) {
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);
        // Scroll element into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      setTargetRect(null);
    }
  }, [isOpen, currentStep, step]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirst) {
      setCurrentStep(currentStep - 1);
    }
  };

  const getTooltipPosition = () => {
    if (!targetRect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

    const placement = step.placement || 'bottom';
    const padding = 16;

    switch (placement) {
      case 'top':
        return {
          top: `${targetRect.top - padding}px`,
          left: `${targetRect.left + targetRect.width / 2}px`,
          transform: 'translate(-50%, -100%)',
        };
      case 'bottom':
        return {
          top: `${targetRect.bottom + padding}px`,
          left: `${targetRect.left + targetRect.width / 2}px`,
          transform: 'translate(-50%, 0)',
        };
      case 'left':
        return {
          top: `${targetRect.top + targetRect.height / 2}px`,
          left: `${targetRect.left - padding}px`,
          transform: 'translate(-100%, -50%)',
        };
      case 'right':
        return {
          top: `${targetRect.top + targetRect.height / 2}px`,
          left: `${targetRect.right + padding}px`,
          transform: 'translate(0, -50%)',
        };
      case 'center':
      default:
        return {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        };
    }
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={onSkip} />

      {/* Spotlight */}
      {targetRect && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
            borderRadius: '8px',
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className="fixed z-50 max-w-md w-full"
        style={getTooltipPosition()}
      >
        <div className="bg-white rounded-lg shadow-2xl p-6 relative">
          {/* Close button */}
          {showSkip && (
            <button
              onClick={onSkip}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {/* Image */}
          {step.image && (
            <img
              src={step.image}
              alt={step.title}
              className="w-full h-48 object-cover rounded-md mb-4"
            />
          )}

          {/* Content */}
          <h3 className="text-lg font-semibold text-gray-900 mb-2 pr-8">
            {step.title}
          </h3>
          <p className="text-gray-600 mb-6">{step.content}</p>

          {/* Progress dots */}
          <div className="flex items-center justify-center space-x-2 mb-4">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentStep
                    ? 'bg-blue-600'
                    : index < currentStep
                      ? 'bg-blue-300'
                      : 'bg-gray-300'
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrevious}
              disabled={isFirst}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </button>

            <span className="text-sm text-gray-500">
              {currentStep + 1} / {steps.length}
            </span>

            <button
              onClick={handleNext}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              {isLast ? (
                'Finish'
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
