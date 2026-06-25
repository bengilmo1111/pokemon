import type Phaser from "phaser";

/**
 * Orientation / viewport robustness for mobile web.
 *
 * Phaser's ScaleManager refreshes the canvas *synchronously* the moment an
 * `orientationchange` event fires. On a real phone that event arrives **before**
 * the browser has finished resizing the visual viewport, so Phaser reads stale,
 * mid-rotation dimensions and the canvas gets stuck at the wrong (often half)
 * size. Its periodic self-heal only kicks in when the *parent* element's bounds
 * change, which they don't here — so the game stays stuck until the player
 * rotates back and forth a few times.
 *
 * The remedy is to re-run `scale.refresh()` a few times *after* the viewport has
 * settled: once on the next animation frame, then again on a short cadence to
 * catch slower devices whose rotation animation lasts a few hundred ms. Each
 * refresh is idempotent and cheap, so over-scheduling is harmless.
 */
export function installViewportHandlers(game: Phaser.Game): void {
  if (typeof window === "undefined") return;

  const refresh = (): void => {
    // Guard against a refresh landing after the game has been destroyed.
    if (game.scale) game.scale.refresh();
  };

  // Re-read the viewport across several frames; mobile browsers report stale
  // dimensions during the rotation animation, so a single refresh isn't enough.
  const resettle = (): void => {
    requestAnimationFrame(refresh);
    [120, 300, 500].forEach((delay) => window.setTimeout(refresh, delay));
  };

  window.addEventListener("orientationchange", resettle);
  // Newer browsers fire screen.orientation 'change' instead of the legacy event.
  if (window.screen?.orientation?.addEventListener) {
    window.screen.orientation.addEventListener("change", resettle);
  }
  // visualViewport tracks the true on-screen size (accounting for the dynamic
  // browser chrome that animates in/out during rotation), so its resize event
  // is the most reliable "the viewport actually changed" signal on mobile.
  window.visualViewport?.addEventListener("resize", refresh);
}
