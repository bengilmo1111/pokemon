import Phaser from "phaser";
import Boot from "./scenes/Boot";
import Preload from "./scenes/Preload";
import Overworld from "./scenes/Overworld";
import Battle from "./scenes/Battle";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "app",
  backgroundColor: "#1a3a5c",
  pixelArt: true,
  roundPixels: true,
  input: {
    // Allow several simultaneous touches (joystick + action buttons + UI)
    activePointers: 4
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
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
