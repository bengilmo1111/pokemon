import Phaser from "phaser";

/**
 * Shared UI design tokens + a rounded "panel" helper, so menus and HUD share a
 * single, cohesive look instead of ad-hoc flat rectangles.
 */
export const UI = {
  bg: 0x0d1626,        // panel base (deep slate)
  bgTop: 0x18263d,     // panel top (lighter, for a soft vertical gradient)
  border: 0xfbbf24,    // accent border (amber)
  borderSoft: 0x3b4a63,
  text: "#f8fafc",
  textDim: "#9fb2cc",
  accent: "#fbbf24"
} as const;

export interface PanelOptions {
  radius?: number;
  fill?: number;
  fillTop?: number;
  border?: number;
  borderWidth?: number;
  shadow?: boolean;
}

/**
 * Draw a rounded panel into a Graphics object: soft drop shadow, a two-tone
 * vertical gradient fill (faked with two stacked rounded rects), an inner top
 * highlight, and a coloured border. Coordinates are top-left based.
 */
export function drawPanel(
  g: Phaser.GameObjects.Graphics,
  x: number, y: number, w: number, h: number,
  opts: PanelOptions = {}
): void {
  const radius = opts.radius ?? 14;
  const fill = opts.fill ?? UI.bg;
  const fillTop = opts.fillTop ?? opts.fill ?? UI.bgTop;
  const border = opts.border ?? UI.border;
  const borderWidth = opts.borderWidth ?? 2;

  if (opts.shadow !== false) {
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(x - 4, y + 6, w + 8, h + 6, radius + 4);
  }

  // Base fill, then a lighter top band clipped to the same rounded silhouette.
  g.fillStyle(fill, 0.96);
  g.fillRoundedRect(x, y, w, h, radius);
  g.fillStyle(fillTop, 0.5);
  g.fillRoundedRect(x, y, w, Math.min(h, h * 0.5 + radius), radius);

  // Inner top highlight line for a touch of gloss.
  g.fillStyle(0xffffff, 0.08);
  g.fillRoundedRect(x + 3, y + 3, w - 6, Math.max(2, h * 0.16), radius * 0.6);

  // Border.
  g.lineStyle(borderWidth, border, 0.9);
  g.strokeRoundedRect(x, y, w, h, radius);
}
