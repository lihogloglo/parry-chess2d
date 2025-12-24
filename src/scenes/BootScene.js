import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        // Display loading progress
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

        const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
            font: '20px monospace',
            color: '#ffffff'
        }).setOrigin(0.5, 0.5);

        this.load.on('progress', (value) => {
            progressBar.clear();
            progressBar.fillStyle(0xc9a959, 1);
            progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
        });

        this.load.on('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
        });

        // Load chess piece assets from pixelchess folder
        const pieces = ['Pawn', 'Rook', 'Knight', 'Bishop', 'Queen', 'King'];
        const colors = ['W', 'B'];

        for (const color of colors) {
            for (const piece of pieces) {
                const key = `${color}_${piece}`;
                this.load.image(key, `assets/pixelchess/16x32 pieces/${key}.png`);
            }
        }

        // Load board
        this.load.image('board', 'assets/pixelchess/boards/board_plain_01.png');

        // Load sound effects
        this.load.audio('sfx_hit', 'assets/sounds/hit.mp3');
        this.load.audio('sfx_parry', 'assets/sounds/parry.mp3');
        this.load.audio('sfx_perfect_parry', 'assets/sounds/perfect_parry.mp3');
        this.load.audio('sfx_move', 'assets/sounds/move.mp3');
        this.load.audio('sfx_capture', 'assets/sounds/capture.mp3');
        this.load.audio('sfx_check', 'assets/sounds/check.mp3');
        this.load.audio('sfx_victory', 'assets/sounds/victory.mp3');
        this.load.audio('sfx_defeat', 'assets/sounds/defeat.mp3');

        // Load character portraits (matching difficulty levels)
        this.load.image('char_kid_portrait', 'assets/characters/kid_portrait.png');
        this.load.image('char_adult_portrait', 'assets/characters/adult_portrait.png');
        this.load.image('char_warrior_portrait', 'assets/characters/warrior_portrait.png');
        this.load.image('char_expert_portrait', 'assets/characters/expert_portrait.png');
    }

    create() {
        this.scene.start('MenuScene');
    }
}
