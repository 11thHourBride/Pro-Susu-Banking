// ═══════════════════════════════════════════════════════
//  FOCUS FIX — Pro Susu Banking
//  Detects whether the user is navigating by keyboard or
//  mouse and toggles the `kb-nav` class on <body> so
//  focus-fix.css can show/hide the focus ring accordingly.
// ═══════════════════════════════════════════════════════

(function () {
  'use strict';

  let usingKeyboard = false;

  // Keyboard navigation started → show focus ring
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Tab' || e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
        e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Enter' ||
        e.key === ' ') {
      if (!usingKeyboard) {
        usingKeyboard = true;
        document.body.classList.add('kb-nav');
      }
    }
  });

  // Mouse or touch → hide focus ring
  document.addEventListener('mousedown', function () {
    if (usingKeyboard) {
      usingKeyboard = false;
      document.body.classList.remove('kb-nav');
    }
  });

  document.addEventListener('touchstart', function () {
    if (usingKeyboard) {
      usingKeyboard = false;
      document.body.classList.remove('kb-nav');
    }
  }, { passive: true });

  // Also remove the focus ring visually on click
  // (handles cases where focus moves to a button after a mouse click)
  document.addEventListener('click', function () {
    if (usingKeyboard) {
      usingKeyboard = false;
      document.body.classList.remove('kb-nav');
    }
    // Blur the active element so the ring disappears immediately
    if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur();
    }
  });

})();