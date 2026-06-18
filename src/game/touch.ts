import Phaser from "phaser";

export interface TouchButtonConfig {
  /** unique id used with wasButtonPressed() */
  id: string;
  /** glyph/label drawn on the button */
  label: string;
  /** accent colour of the button */
  color?: number;
  /** larger primary action button */
  primary?: boolean;
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
    pressed: boolean;
  }> = [];

  private container!: Phaser.GameObjects.Container;
  private depth = 5000;

  constructor(scene: Phaser.Scene, buttons: TouchButtonConfig[]) {
    this.scene = scene;
    this.active = TouchControls.shouldEnable(scene);
    if (!this.active) return;

    this.scene.input.addPointer(3);
    this.createJoystick();
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

  private createButtons(configs: TouchButtonConfig[]): void {
    configs.forEach((cfg) => {
      const r = cfg.primary ? 42 : 32;
      const color = cfg.color ?? 0x1e293b;
      const bg = this.scene.add
        .circle(0, 0, r, color, 0.55)
        .setStrokeStyle(2, 0xffffff, 0.4)
        .setScrollFactor(0)
        .setDepth(this.depth)
        .setInteractive({ useHandCursor: true });
      const text = this.scene.add
        .text(0, 0, cfg.label, {
          fontFamily: "monospace",
          fontSize: cfg.primary ? "22px" : "16px",
          color: "#f8fafc",
          fontStyle: "bold"
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(this.depth + 1);

      const entry = { cfg, bg, text, pressed: false };
      bg.on("pointerdown", (p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        entry.pressed = true;
        bg.setScale(0.88);
        bg.setFillStyle(color, 0.85);
        // Light haptic pulse on supported devices.
        if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
        ev?.stopPropagation();
      });
      const release = () => {
        bg.setScale(1);
        bg.setFillStyle(color, 0.55);
      };
      bg.on("pointerup", release);
      bg.on("pointerout", release);
      this.buttons.push(entry);
    });
  }

  private bindPointers(): void {
    this.scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.joyPointerId !== -1) return;
      // Only the left ~55% of the screen drives the joystick.
      if (pointer.x > this.scene.scale.width * 0.55) return;
      // Ignore taps landing on a button.
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
    const margin = 30;
    const colX = w - margin - 46; // shared centre line for the right-edge column

    const primaries = this.buttons.filter((b) => b.cfg.primary);
    const secondaries = this.buttons.filter((b) => !b.cfg.primary);

    // Primary action button: bottom-right corner (within thumb reach).
    const primaryY = h - margin - 46;
    primaries.forEach((b) => {
      b.bg.setPosition(colX, primaryY);
      b.text.setPosition(colX, primaryY);
    });

    // Utility buttons: stacked vertically above the primary, on the right edge,
    // clear of the joystick (left) and the HUD text (top-left).
    let y = primaryY - 96;
    secondaries.forEach((b) => {
      b.bg.setPosition(colX, y);
      b.text.setPosition(colX, y);
      y -= 74;
    });
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
      if (!visible) {
        b.pressed = false;
        b.bg.setScale(1);
      }
    });
    if (!visible) {
      this.joyBase.setVisible(false);
      this.joyThumb.setVisible(false);
      this.joyPointerId = -1;
      this.axis.x = 0;
      this.axis.y = 0;
    }
  }
}
