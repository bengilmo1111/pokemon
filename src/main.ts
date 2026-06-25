import Phaser from "phaser";
import Title from "./scenes/Title";
import Boot from "./scenes/Boot";
import Preload from "./scenes/Preload";
import Overworld from "./scenes/Overworld";
import Battle from "./scenes/Battle";
import { installTestBridge, isTestMode } from "./game/testBridge";
import { installViewportHandlers } from "./game/viewport";

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
  scene: [Title, Boot, Preload, Overworld, Battle]
};

const game = new Phaser.Game(config);

// Keep the canvas correctly sized across device rotation (see viewport.ts).
installViewportHandlers(game);

// Test-only: expose an observability/control bridge for the automated harness.
// No effect on normal play (gated behind ?test=1 / localStorage flag).
if (isTestMode()) {
  installTestBridge(game);
}
