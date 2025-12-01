import Phaser from 'phaser';

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Title
        this.add.text(width / 2, height / 3, 'PARRY CHESS', {
            font: 'bold 48px monospace',
            color: '#c9a959',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        // Subtitle
        this.add.text(width / 2, height / 3 + 50, 'Chess meets Sekiro', {
            font: '18px monospace',
            color: '#888888'
        }).setOrigin(0.5);

        // Play button
        const playButton = this.add.text(width / 2, height / 2 + 50, '[ PLAY ]', {
            font: '28px monospace',
            color: '#ffffff',
            backgroundColor: '#333333',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        playButton.on('pointerover', () => {
            playButton.setStyle({ color: '#c9a959' });
        });

        playButton.on('pointerout', () => {
            playButton.setStyle({ color: '#ffffff' });
        });

        playButton.on('pointerdown', () => {
            const difficultyKeys = ['easy', 'medium', 'hard', 'sekiro'];
            this.scene.start('GameScene', { difficulty: difficultyKeys[this.selectedDifficulty] });
        });

        // Difficulty buttons
        const difficulties = ['Easy', 'Medium', 'Hard', 'Sekiro'];
        this.selectedDifficulty = 1; // Medium by default

        this.difficultyTexts = difficulties.map((diff, i) => {
            const text = this.add.text(width / 2 - 150 + i * 100, height / 2 + 130, diff, {
                font: '14px monospace',
                color: i === this.selectedDifficulty ? '#c9a959' : '#666666'
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });

            text.on('pointerdown', () => {
                this.selectedDifficulty = i;
                this.difficultyTexts.forEach((t, j) => {
                    t.setStyle({ color: j === i ? '#c9a959' : '#666666' });
                });
            });

            return text;
        });

        // Instructions
        this.add.text(width / 2, height - 80, 'Click piece to select, click square to move', {
            font: '12px monospace',
            color: '#555555'
        }).setOrigin(0.5);

        this.add.text(width / 2, height - 60, 'Press SPACE to parry when attacked!', {
            font: '12px monospace',
            color: '#555555'
        }).setOrigin(0.5);
    }
}
