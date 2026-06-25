import Phaser from "phaser";
import { safeAreaInset } from "./uiLayout";

export interface TouchButtonConfig {
  /** unique id used with wasButtonPressed() */
  id: string;
  /** glyph/label drawn on the button */
  label: string;
  /** accent colour of the button */
  color?: number;
  /** larger primary action button */
  primary?: boolean;
  /** place in top-right corner instead of the right-side stack */
  corner?: boolean;
  /**
   * Fired synchronously inside the pointerdown handler. Use this (instead of the
   * deferred {@link TouchControls.wasButtonPressed} poll) for actions that must
   * run within the originating user gesture — e.g. requesting fullscreen, which
   * the browser rejects outside of a user activation.
   */
  onPress?: () => void;
}

/**
 * On-screen controls for touch / coarse-pointer devices: a floating virtual
 * joystick on the left and a stack of action buttons on the right.
 *
 * Movement is read continuously via getAxis(); button taps are edge-triggered
 * and consumed once per frame via wasButtonPressed().
 */
export class TouchControls {
  private scene: Phaser.Scene;
  readonly active: boolean;

  // Joystick state
  private joyBase!: Phaser.GameObjects.Arc;
  private joyThumb!: Phaser.GameObjects.Arc;
  private joyPointerId = -1;
  private joyOriginX = 0;
  private joyOriginY = 0;
  private axis = { x: 0, y: 0 };
  private readonly joyRadius = 64;
  private readonly deadZone = 0.18;

  // Buttons
  private buttons: Array<{
    cfg: TouchButtonConfig;
    bg: Phaser.GameObjects.Arc;
    text: Phaser.GameObjects.Text;
    label: Phaser.GameObjects.Text;
    pressed: boolean;
  }> = [];

  // Ghost joystick hint — a faint ring in the drag zone so players know where to swipe
  private joyGhost!: Phaser.GameObjects.Arc;

  private container!: Phaser.GameObjects.Container;
  private depth = 5000;

  constructor(scene: Phaser.Scene, buttons: TouchButtonConfig[]) {
    this.scene = scene;
    this.active = TouchControls.shouldEnable(scene);
    if (!this.active) return;

    this.scene.input.addPointer(3);
    this.createJoystick();
    this.createGhost();
    this.createButtons(buttons);
    this.bindPointers();

    this.scene.scale.on("resize", this.layout, this);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scene.scale.off("resize", this.layout, this);
    });
    this.layout();
  }

  static shouldEnable(scene: Phaser.Scene): boolean {
    const hasTouch = scene.sys.game.device.input.touch;
    const coarse = typeof window !== "undefined" &&
      window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    return Boolean(hasTouch || coarse);
  }

  private createJoystick(): void {
    this.joyBase = this.scene.add
      .circle(0, 0, this.joyRadius, 0x0f172a, 0.35)
      .setStrokeStyle(3, 0x38bdf8, 0.6)
      .setScrollFactor(0)
      .setDepth(this.depth)
      .setVisible(false);
    this.joyThumb = this.scene.add
      .circle(0, 0, this.joyRadius * 0.45, 0x38bdf8, 0.55)
      .setStrokeStyle(2, 0xffffff, 0.7)
      .setScrollFactor(0)
      .setDepth(this.depth + 1)
      .setVisible(false);
  }

  private createGhost(): void {
    // Faint ring at rest position so players know where to drag
    this.joyGhost = this.scene.add
      .circle(0, 0, this.joyRadius, 0x38bdf8, 0.06)
      .setStrokeStyle(2, 0x38bdf8, 0.2)
      .setScrollFactor(0)
      .setDepth(this.depth - 1);
  }

  private createButtons(configs: TouchButtonConfig[]): void {
    configs.forEach((cfg) => {
      const r = cfg.primary ? 44 : cfg.corner ? 28 : 34;
      const color = cfg.color ?? 0x1e293b;
      const bg = this.scene.add
        .circle(0, 0, r, color, 0.72)
        .setStrokeStyle(2, 0xffffff, 0.55)
        .setScrollFactor(0)
        .setDepth(this.depth)
        .setInteractive({ useHandCursor: true });

      // Button icon / short name centred in circle
      const text = this.scene.add
        .text(0, cfg.primary ? -4 : -3, cfg.label, {
          fontFamily: "monospace",
          fontSize: cfg.primary ? "16px" : "13px",
          color: "#f8fafc",
          fontStyle: "bold",
          align: "center"
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(this.depth + 1);

      // Word label rendered below the circle
      const label = this.scene.add
        .text(0, r + 10, cfg.label, {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#cbd5e1",
          align: "center"
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(this.depth + 1);

      const entry = { cfg, bg, text, label, pressed: false };
      bg.on("pointerdown", (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        entry.pressed = true;
        bg.setScale(0.88);
        bg.setFillStyle(color, 0.92);
        if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
        // Run within the user gesture (fullscreen etc. must not be deferred).
        cfg.onPress?.();
        ev?.stopPropagation();
      });
      const release = () => {
        bg.setScale(1);
        bg.setFillStyle(color, 0.72);
      };
      bg.on("pointerup", release);
      bg.on("pointerout", release);
      this.buttons.push(entry);
    });
  }

  private bindPointers(): void {
    this.scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.joyPointerId !== -1) return;
      // Ignore taps landing on a button — anything else drives the joystick.
      if (this.buttons.some((b) => b.bg.getBounds().contains(pointer.x, pointer.y))) return;
      this.joyPointerId = pointer.id;
      this.joyOriginX = pointer.x;
      this.joyOriginY = pointer.y;
      this.joyBase.setPosition(pointer.x, pointer.y).setVisible(true);
      this.joyThumb.setPosition(pointer.x, pointer.y).setVisible(true);
    });

    this.scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (pointer.id !== this.joyPointerId) return;
      const dx = pointer.x - this.joyOriginX;
      const dy = pointer.y - this.joyOriginY;
      const dist = Math.hypot(dx, dy);
      const clamped = Math.min(dist, this.joyRadius);
      const nx = dist > 0 ? dx / dist : 0;
      const ny = dist > 0 ? dy / dist : 0;
      this.joyThumb.setPosition(
        this.joyOriginX + nx * clamped,
        this.joyOriginY + ny * clamped
      );
      const mag = clamped / this.joyRadius;
      this.axis.x = mag > this.deadZone ? nx * mag : 0;
      this.axis.y = mag > this.deadZone ? ny * mag : 0;
    });

    const end = (pointer: Phaser.Input.Pointer) => {
      if (pointer.id !== this.joyPointerId) return;
      this.joyPointerId = -1;
      this.axis.x = 0;
      this.axis.y = 0;
      this.joyBase.setVisible(false);
      this.joyThumb.setVisible(false);
    };
    this.scene.input.on("pointerup", end);
    this.scene.input.on("pointerupoutside", end);
  }

  private layout(): void {
    if (!this.active) return;
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    const gap = 12;
    const insetR = gap + safeAreaInset("right");
    const insetB = gap + safeAreaInset("bottom");
    const insetT = safeAreaInset("top") + gap;

    const primaries = this.buttons.filter((b) => b.cfg.primary && !b.cfg.corner);
    const secondaries = this.buttons.filter((b) => !b.cfg.primary && !b.cfg.corner);
    const corners = this.buttons.filter((b) => b.cfg.corner);
    const rOf = (b: { cfg: TouchButtonConfig }) => (b.cfg.primary ? 44 : b.cfg.corner ? 28 : 34);

    // Primary action button: bottom-right corner
    let primaryY = h - insetB - 44;
    primaries.forEach((b) => {
      const r = rOf(b);
      const x = w - insetR - r;
      primaryY = h - insetB - r;
      b.bg.setPosition(x, primaryY);
      b.text.setPosition(x, primaryY);
      b.label.setPosition(x, primaryY + r + 10);
    });

    // Utility buttons stack upward along the right edge
    let y = primaryY - 44 - 34 - 18;
    secondaries.forEach((b) => {
      const r = rOf(b);
      const x = w - insetR - r;
      b.bg.setPosition(x, y);
      b.text.setPosition(x, y);
      b.label.setPosition(x, y + r + 10);
      y -= r * 2 + 18;
    });

    // Corner buttons: fixed top-right area (pause/menu type controls)
    let cornerY = insetT + 28;
    corners.forEach((b) => {
      const r = 28;
      const x = w - insetR - r;
      b.bg.setPosition(x, cornerY);
      b.text.setPosition(x, cornerY);
      b.label.setPosition(x, cornerY + r + 8);
      cornerY += r * 2 + 14;
    });

    // Ghost joystick rests at bottom-left of the play area
    const ghostX = safeAreaInset("left") + gap + this.joyRadius;
    const ghostY = h - safeAreaInset("bottom") - gap - this.joyRadius;
    this.joyGhost.setPosition(ghostX, ghostY);
  }

  /** Normalised movement vector, components in [-1, 1]. */
  getAxis(): { x: number; y: number } {
    return this.axis;
  }

  /** True once for the frame in which the button was tapped. */
  wasButtonPressed(id: string): boolean {
    const entry = this.buttons.find((b) => b.cfg.id === id);
    if (entry && entry.pressed) {
      entry.pressed = false;
      return true;
    }
    return false;
  }

  setVisible(visible: boolean): void {
    if (!this.active) return;
    this.buttons.forEach((b) => {
      b.bg.setVisible(visible);
      b.text.setVisible(visible);
      b.label.setVisible(visible);
      if (!visible) {
        b.pressed = false;
        b.bg.setScale(1);
      }
    });
    this.joyGhost.setVisible(visible);
    if (!visible) {
      this.joyBase.setVisible(false);
      this.joyThumb.setVisible(false);
      this.joyPointerId = -1;
      this.axis.x = 0;
      this.axis.y = 0;
    }
  }
}
