import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    backgroundColor: '#1a1a2e',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 800,
        height: 800,
    },
    render: {
        antialias: false,
        pixelArt: true,
        roundPixels: true,
    },
    scene: [BootScene, MenuScene, GameScene],
};

const game = new Phaser.Game(config);

export default game;
