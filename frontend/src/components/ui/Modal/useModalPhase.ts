import { useEffect, useState } from 'react';

import type { ModalAnimation } from './Modal.types';
import { defaultAnimations } from './Modal.types';

/**
 * Single state machine for the whole open/close lifecycle, replacing what
 * used to be four separately-timed booleans (isEntering, isExiting,
 * hasEntered, a wasOpenRef-derived justClosed) that each lagged the `open`
 * prop by a different amount — every fix to one of them exposed a new
 * desync with the others. Unmounting is driven by the DOM's own
 * `transitionend` event wherever possible, so it can't drift out of sync
 * with what's actually on screen; a timer is only a fallback for
 * `animation="none"` or if transitionend never fires for some reason.
 *
 *   closed  -> not rendered at all
 *   opening -> just mounted at the offscreen/hidden starting position;
 *              flips to 'open' one frame later so the browser paints that
 *              starting position before animating away from it
 *   open    -> settled at the final visible position
 *   closing -> animating back to the offscreen/hidden position; unmounts
 *              (-> 'closed') on transitionend or fallback timer
 */
export type Phase = 'closed' | 'opening' | 'open' | 'closing';

interface UseModalPhaseOptions {
  open: boolean;
  animation: ModalAnimation;
  animationDuration?: number;
  elementRef: React.RefObject<HTMLElement | null>;
  onOpen?: () => void;
  onAnimationEnd?: () => void;
}

interface UseModalPhaseResult {
  phase: Phase;
  isRendered: boolean;
  isEntering: boolean;
  isExiting: boolean;
}

export const useModalPhase = ({
  open,
  animation,
  animationDuration,
  elementRef,
  onOpen,
  onAnimationEnd,
}: UseModalPhaseOptions): UseModalPhaseResult => {
  const [phase, setPhase] = useState<Phase>(open ? 'opening' : 'closed');

  // React to `open` prop changes: start entering or start closing. This
  // never needs to know the transition duration — it only sets the
  // *target* phase; getting there is handled by the effects below.
  useEffect(() => {
    if (open) {
      setPhase((p) => (p === 'closed' ? 'opening' : p));
      onOpen?.();
    } else {
      setPhase((p) => (p === 'closed' ? 'closed' : 'closing'));
    }
  }, [open, onOpen]);

  // opening -> open, one frame later so the browser commits the
  // offscreen/hidden starting paint before this flips the target position
  // (without this, both states can collapse into the same frame and
  // there's nothing to visibly animate from).
  useEffect(() => {
    if (phase !== 'opening') return;
    const raf = requestAnimationFrame(() => setPhase('open'));
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // Drive the transition-end side effects for both the entering and closing
  // legs off the real `transitionend` event, so neither can desync from the
  // CSS transition's actual duration. Falls back to a timer for
  // animation="none" (no transition ever fires) or in case the event is
  // missed for any reason. Only the closing leg also flips the phase to
  // 'closed' — entering settles into 'open' via the effect above already,
  // this just fires the completion callback for parity.
  const isTransientPhase = phase === 'opening' || phase === 'closing';
  useEffect(() => {
    if (!isTransientPhase) return;

    const el = elementRef.current;
    const fallbackMs =
      (animationDuration || defaultAnimations[animation].duration) + 50;
    const closingWhenScheduled = phase === 'closing';

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (closingWhenScheduled) {
        setPhase('closed');
      }
      onAnimationEnd?.();
    };

    el?.addEventListener('transitionend', finish, { once: true });
    const timer = setTimeout(finish, fallbackMs);

    return () => {
      el?.removeEventListener('transitionend', finish);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTransientPhase, phase, animation, animationDuration, onAnimationEnd]);

  return {
    phase,
    isRendered: phase !== 'closed',
    isEntering: phase === 'opening',
    isExiting: phase === 'closing',
  };
};
