/**
 * CelebrationScreen Component
 * Animated celebration screen for onboarding completion
 */

import React, { useEffect, useState } from 'react';
import { CheckCircle, Sparkles, ArrowRight } from 'lucide-react';

export interface CelebrationScreenProps {
  mountsTracked: number;
  rulesCreated: number;
  presetName: string;
  onContinue: () => void;
}

interface Confetti {
  id: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  color: string;
  delay: number;
}

const COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
];

export const CelebrationScreen: React.FC<CelebrationScreenProps> = ({
  mountsTracked,
  rulesCreated,
  presetName,
  onContinue,
}) => {
  const [confetti, setConfetti] = useState<Confetti[]>([]);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    // Generate confetti
    const pieces: Confetti[] = [];
    for (let i = 0; i < 50; i++) {
      pieces.push({
        id: i,
        x: Math.random() * 100,
        y: -10 - Math.random() * 20,
        rotation: Math.random() * 360,
        scale: 0.5 + Math.random() * 0.5,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        delay: Math.random() * 0.5,
      });
    }
    setConfetti(pieces);

    // Show content after a brief delay
    setTimeout(() => setShowContent(true), 300);
  }, []);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900 overflow-hidden flex items-center justify-center">
      {/* Confetti */}
      {confetti.map((piece) => (
        <div
          key={piece.id}
          className="absolute w-3 h-3 rounded-sm animate-confetti-fall"
          style={{
            left: `${piece.x}%`,
            top: `${piece.y}%`,
            backgroundColor: piece.color,
            transform: `rotate(${piece.rotation}deg) scale(${piece.scale})`,
            animationDelay: `${piece.delay}s`,
          }}
        />
      ))}

      {/* Content */}
      <div
        className={`relative z-10 max-w-2xl mx-auto px-4 text-center transition-all duration-1000 ${
          showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        {/* Success Icon */}
        <div className="mb-8 relative">
          <div className="inline-block relative">
            <div className="absolute inset-0 animate-ping">
              <CheckCircle className="w-24 h-24 text-green-400 opacity-75" />
            </div>
            <CheckCircle className="w-24 h-24 text-green-500 relative" />
          </div>
          <Sparkles className="absolute top-0 right-0 w-8 h-8 text-yellow-400 animate-pulse" />
          <Sparkles className="absolute bottom-0 left-0 w-6 h-6 text-pink-400 animate-pulse delay-100" />
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-bold text-primary mb-4">
          🎉 Setup Complete!
        </h1>

        <p className="text-xl text-secondary mb-8">
          Your VolumeViz is ready to track your Docker volumes
        </p>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg p-6 shadow-lg">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
              {mountsTracked}
            </div>
            <div className="text-sm text-secondary">
              Volumes Tracked
            </div>
          </div>

          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg p-6 shadow-lg">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
              {rulesCreated}
            </div>
            <div className="text-sm text-secondary">
              Rules Created
            </div>
          </div>

          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg p-6 shadow-lg">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">
              {presetName}
            </div>
            <div className="text-sm text-secondary">
              Preset Used
            </div>
          </div>
        </div>

        {/* Features List */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg p-6 shadow-lg mb-8 text-left">
          <h3 className="text-lg font-semibold text-primary mb-4">
            What's Next?
          </h3>
          <ul className="space-y-3 text-gray-700 text-secondary">
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
              <span>
                View your volumes and their storage usage on the Dashboard
              </span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
              <span>Explore files and directories within your volumes</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
              <span>Analyze storage trends and capacity forecasts</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
              <span>Search for files across all your volumes</span>
            </li>
          </ul>
        </div>

        {/* CTA Button */}
        <button
          onClick={onContinue}
          className="inline-flex items-center px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg hover:from-blue-700 hover:to-purple-700 transform hover:scale-105 transition-all duration-200"
        >
          Go to Dashboard
          <ArrowRight className="w-5 h-5 ml-2" />
        </button>

        <p className="mt-4 text-sm text-gray-500 text-tertiary">
          You can always adjust your tracking rules in Settings
        </p>
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti-fall {
          animation: confetti-fall 3s ease-in forwards;
        }
      `}</style>
    </div>
  );
};
