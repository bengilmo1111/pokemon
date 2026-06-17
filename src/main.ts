import Phaser from "phaser";
import Boot from "./scenes/Boot";
import Preload from "./scenes/Preload";
import Overworld from "./scenes/Overworld";
import Battle from "./scenes/Battle";

// Fixed portrait design resolution. FIT scales it uniformly to any device so
// the overworld and every UI panel stay consistent and never clip off-screen.
const DESIGN_WIDTH = 720;
const DESIGN_HEIGHT = 1280;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "app",
  width: DESIGN_WIDTH,
  height: DESIGN_HEIGHT,
  backgroundColor: "#0f1115",
  pixelArt: true,
  roundPixels: true,
  input: {
    // Allow several simultaneous touches (joystick + action buttons + UI)
    activePointers: 4
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  scene: [Boot, Preload, Overworld, Battle]
};

new Phaser.Game(config);
