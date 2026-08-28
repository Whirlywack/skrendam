'use client';

/**
 * StickyCta — slim fixed-bottom CTA bar that appears after the user scrolls
 * past the first deal group (~400 px).  Scrolls to #capture or focuses the
 * hero signup input on click.  Tasteful: hides until user is well below the
 * fold; transitions in/out smoothly.
 *
 * This is the only 'use client' component in the homepage aside from
 * CaptureBand (which is also interactive).
 */
import { useEffect, useState, useCallback } from 'react';
import { S } from '@/lib/lt';

const SCROLL_THRESHOLD = 420; // px — roughly past the hero + first deal group

export function StickyCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > SCROLL_THRESHOLD);
    }

    // Passive listener for performance
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleClick = useCallback(() => {
    // Try to focus the email input inside #capture first
    const capture = document.getElementById('capture');
    if (capture) {
      const input = capture.querySelector<HTMLInputElement>('input[type="email"]');
      if (input) {
        capture.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Brief delay lets the scroll settle before focusing
        setTimeout(() => input.focus(), 350);
        return;
      }
      capture.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  return (
    <div
      className={`yip-site sticky-cta${visible ? ' visible' : ''}`}
      role="complementary"
      aria-label={S.stickyAria}
    >
      <p>
        <strong>{S.ctaBandFull}</strong> — {S.stickyTail}
      </p>
      <button
        type="button"
        className="btn-primary"
        onClick={handleClick}
        aria-label={S.stickyBtnAria}
      >
        {S.ctaSubmit}
      </button>
    </div>
  );
}
