import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';
import { AutomatedGameTest } from './test/AutomatedGameTest.js';

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

// Expose game globally for testing
window.game = game;
window.AutomatedGameTest = AutomatedGameTest;

// Helper function to run automated tests from console
window.runAutoTest = async (gamesCount = 5, options = {}) => {
    const scene = game.scene.getScene('GameScene');
    if (!scene) {
        console.error('GameScene not found. Start a game from the menu first, then run this command.');
        return null;
    }
    if (!scene.gameState) {
        console.error('Game not initialized. Make sure you are in an active game (not the menu).');
        return null;
    }
    if (!scene.board || !scene.ai) {
        console.error('Game components not ready. Wait for the game to fully load.');
        return null;
    }
    const tester = new AutomatedGameTest(scene, { gamesCount, ...options });
    window.currentTest = tester;
    console.log('Test started. Call window.currentTest.stop() to abort.');
    return await tester.run();
};

export default game;
