import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';

// Detect mobile devices
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// On mobile, use window dimensions for full-width board
// On desktop, use fixed 800x800
const gameWidth = isMobile ? window.innerWidth : 800;
const gameHeight = isMobile ? window.innerHeight : 800;

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    backgroundColor: '#1a1a2e',
    scale: {
        mode: isMobile ? Phaser.Scale.RESIZE : Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: gameWidth,
        height: gameHeight,
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
