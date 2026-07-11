import { clsx } from 'clsx';

import type {
  ModalSize,
  ModalVariant,
  DrawerPosition,
  ModalAnimation,
} from './Modal.types';
import { defaultModalSizes, defaultDrawerSizes, defaultAnimations } from './Modal.types';
import type { Phase } from './useModalPhase';

export const getModalSizeClasses = (
  size: ModalSize,
  variant: ModalVariant,
): string => {
  const sizeMap = variant === 'drawer' ? defaultDrawerSizes : defaultModalSizes;
  return sizeMap[size];
};

export const getDrawerPositionClasses = (position: DrawerPosition): string => {
  switch (position) {
    case 'left':
      return 'left-0 top-0 h-full';
    case 'right':
      return 'right-0 top-0 h-full';
    case 'top':
      return 'top-0 left-0 w-full';
    case 'bottom':
      return 'bottom-0 left-0 w-full';
    default:
      return 'right-0 top-0 h-full';
  }
};

export const getAnimationClasses = (
  animation: ModalAnimation,
  isOpen: boolean,
  isEntering: boolean,
  isExiting: boolean,
): string => {
  const config = defaultAnimations[animation];

  if (isExiting) {
    return clsx(config.exit, config.exitActive);
  }

  if (isEntering && isOpen) {
    return clsx(config.enter, config.enterActive);
  }

  if (isOpen) {
    return config.enterActive.replace(/transition-\S+/g, '').trim();
  }

  return config.enter;
};

/**
 * Drawer-specific enter/exit transform, keyed on edge position. The shared
 * `defaultAnimations` config (fade/scale/slide-up) has no notion of
 * position, so none of those variants actually move a drawer off-screen —
 * without this it only fades in place at its final docked position instead
 * of sliding in from the edge.
 *
 * Returns an inline `style` object rather than Tailwind utility classes:
 * translate-x-full / translate-x-0 computed to `transform: none` in this
 * project's Tailwind v4 build (root cause not fully diagnosed — possibly a
 * JIT-scanning or `@theme` interaction specific to this app's config), so
 * the class-based version silently never animated. A literal `transform`
 * CSS value sidesteps that entirely.
 *
 * Keyed directly on the modal's phase state machine rather than a set of
 * derived booleans — 'open' is the only phase that renders docked; every
 * other phase (opening's first paint, closing, closed-but-still-mounted)
 * renders offscreen with the transition present, since all of those are
 * moments where something needs to visibly animate.
 */
export const getDrawerTransformStyle = (
  position: DrawerPosition,
  phase: Phase,
): React.CSSProperties => {
  const offscreen: Record<DrawerPosition, string> = {
    left: 'translateX(-100%)',
    right: 'translateX(100%)',
    top: 'translateY(-100%)',
    bottom: 'translateY(100%)',
  };
  const docked = 'translateX(0) translateY(0)';
  const transition = 'transform 300ms ease-out';

  if (phase === 'open') {
    return { transform: docked, transition };
  }
  return { transform: offscreen[position], transition };
};

/**
 * Container classes. Drawers position themselves via `fixed` + edge offsets
 * on getModalClasses below, so the container must not also flex-center them
 * (which fights that positioning and centers a sized panel in the viewport
 * instead of pinning it to an edge).
 */
export const getContainerClasses = (
  variant: ModalVariant,
  zIndex: number,
): string =>
  clsx(
    'fixed inset-0 z-50',
    variant === 'drawer' ? 'p-0' : 'flex items-center justify-center p-4',
    `z-${zIndex}`,
  );

/**
 * Backdrop classes. Opacity is applied via inline style, not a
 * dynamically-interpolated `bg-opacity-*`/`bg-black/*` class — Tailwind can
 * only generate utilities it finds as literal strings at scan time, so a
 * template-string class name here would silently never match any generated
 * CSS (this is also no longer how opacity works in Tailwind v4 regardless —
 * `bg-opacity-*` was replaced by the `bg-black/50` slash syntax, which has
 * the same literal-string requirement).
 */
export const getBackdropClasses = (
  show: boolean | undefined,
  blur: number | undefined,
  backdropClassName: string | undefined,
): string =>
  clsx(
    'fixed inset-0',
    show && 'bg-black',
    blur && 'backdrop-blur-sm',
    backdropClassName,
  );

/**
 * Modal/Drawer classes. `relative` only applies to the modal variant — for
 * drawers it competes with `fixed` for the `position` property and
 * (depending on Tailwind's generated rule order) can win, pinning the
 * drawer to a `relative` box instead of the viewport edge.
 */
export const getModalClasses = (params: {
  variant: ModalVariant;
  size: ModalSize;
  position: DrawerPosition;
  animation: ModalAnimation;
  open: boolean;
  isEntering: boolean;
  isExiting: boolean;
  scrollable: boolean;
  className: string | undefined;
}): string => {
  const {
    variant,
    size,
    position,
    animation,
    open,
    isEntering,
    isExiting,
    scrollable,
    className,
  } = params;

  return clsx(
    'bg-white shadow-xl',
    variant === 'modal' && [
      'relative',
      'rounded-lg',
      'max-h-full',
      getModalSizeClasses(size, variant),
      'mx-auto',
    ],
    variant === 'drawer' && [
      'fixed',
      getDrawerPositionClasses(position),
      getModalSizeClasses(size, variant),
      position === 'left' || position === 'right' ? 'max-h-full' : 'max-w-full',
    ],
    variant === 'modal' && getAnimationClasses(animation, open, isEntering, isExiting),
    scrollable && 'overflow-hidden',
    className,
  );
};

// NOTE: the `max-h-[...]` class below is dynamically interpolated, same
// class of bug as the old `bg-opacity-${x}` issue documented above (Tailwind
// only generates utilities it finds as literal strings at scan time) — this
// one is pre-existing and not exercised by any current caller (`maxHeight`
// prop is unused across the app today), so it's left as-is rather than
// fixed as an unrelated drive-by change during this refactor.
export const getContentClasses = (
  scrollable: boolean,
  maxHeight: string | number | undefined,
): string =>
  clsx(
    'flex flex-col',
    scrollable ? 'overflow-hidden' : 'overflow-visible',
    maxHeight &&
      `max-h-[${typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight}]`,
  );
