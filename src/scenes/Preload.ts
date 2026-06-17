import Phaser from "phaser";
import { SPECIES } from "../data/species";

export default class Preload extends Phaser.Scene {
  constructor() {
    super("Preload");
  }

  preload(): void {
    // Load player sprite
    this.load.image("trainer-ash", "/trainers/ash.png");

    // Load NPC trainer sprites
    this.load.image("trainer-youngster", "/trainers/youngster.png");
    this.load.image("trainer-bugcatcher", "/trainers/bugcatcher.png");
    this.load.image("trainer-hiker", "/trainers/hiker.png");
    this.load.image("trainer-ace", "/trainers/acetrainer.png");
    this.load.image("trainer-lass", "/trainers/acetrainerf.png");
    this.load.image("trainer-swimmer", "/trainers/misty.png");
    this.load.image("trainer-fisherman", "/trainers/fisherman.png");
    this.load.image("trainer-psychic", "/trainers/psychic.png");

    // Load rival sprite
    this.load.image("trainer-rival", "/trainers/blue.png");

    // Load gym leader sprites
    this.load.image("trainer-brock", "/trainers/brock.png");
    this.load.image("trainer-misty", "/trainers/misty.png");
    this.load.image("trainer-erika", "/trainers/erika.png");
    this.load.image("trainer-sabrina", "/trainers/sabrina.png");
    this.load.image("trainer-koga", "/trainers/koga.png");
    this.load.image("trainer-giovanni", "/trainers/giovanni.png");
    this.load.image("trainer-lance", "/trainers/lance.png");

    Object.keys(SPECIES).forEach((id) => {
      this.load.image(`pokemon-${id}`, `/sprites/${id}.png`);
    });

    const gfx = this.add.graphics({ x: 0, y: 0 });
    gfx.setVisible(false);
    gfx.fillStyle(0x3b4cca, 1);
    gfx.fillRect(0, 0, 16, 24);
    gfx.fillStyle(0xffccaa, 1);
    gfx.fillCircle(8, 6, 5);
    gfx.generateTexture("player-fallback", 16, 24);
    gfx.clear();

    gfx.fillStyle(0xffd166, 1);
    gfx.fillCircle(10, 10, 10);
    gfx.generateTexture("wild-fallback", 20, 20);
    gfx.clear();

    gfx.fillStyle(0xffffff, 1);
    gfx.fillRect(0, 0, 1, 1);
    gfx.generateTexture("collider", 1, 1);
    gfx.clear();
  }

  create(): void {
    this.scene.start("Overworld");
  }
}
