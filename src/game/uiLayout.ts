import Phaser from "phaser";

/**
 * Read a CSS `env(safe-area-inset-*)` value in pixels (0 when unsupported).
 * Used to keep on-screen UI clear of notches, rounded corners and gesture bars.
 */
export function safeAreaInset(side: "right" | "bottom" | "left" | "top"): number {
  if (typeof document === "undefined") return 0;
  const probe = document.createElement("div");
  probe.style.cssText =
    `position:fixed;${side}:0;width:0;height:0;padding-${side}:env(safe-area-inset-${side},0px);`;
  document.body.appendChild(probe);
  const prop = `padding-${side}` as const;
  const val = parseFloat(getComputedStyle(probe).getPropertyValue(prop)) || 0;
  probe.remove();
  return val;
}

/**
 * Uniformly scale a full-screen menu container so it always fits the current
 * viewport (minus a margin and the device's safe-area insets), centred about
 * the screen middle. Never upscales — at desktop widths the menu is unchanged
 * (scale 1). Generalises the touch-control "hug the edge" approach to modal
 * overlays so they fit every phone regardless of their fixed design size.
 *
 * @returns the applied scale factor (0 < s <= 1).
 */
export function fitMenu(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  designW: number,
  designH: number,
  margin = 16
): number {
  const availW = scene.scale.width - 2 * margin - safeAreaInset("left") - safeAreaInset("right");
  const availH = scene.scale.height - 2 * margin - safeAreaInset("top") - safeAreaInset("bottom");
  const s = Math.min(1, availW / designW, availH / designH);
  const cx = scene.scale.width / 2;
  const cy = scene.scale.height / 2;
  container.setScrollFactor(0);
  container.setPosition(cx * (1 - s), cy * (1 - s));
  container.setScale(s);
  return s;
}
