import Phaser from 'phaser';

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        this.width = this.cameras.main.width;
        this.height = this.cameras.main.height;
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // State management
        this.selectedColor = 'white';
        this.selectedDifficulty = 1; // Medium by default

        // Difficulty config with character portraits
        this.difficulties = [
            { name: 'Easy', key: 'easy', char: 'char_kid_portrait', portrait: 'char_kid_portrait' },
            { name: 'Medium', key: 'medium', char: 'char_adult_portrait', portrait: 'char_adult_portrait' },
            { name: 'Hard', key: 'hard', char: 'char_warrior_portrait', portrait: 'char_warrior_portrait' },
            { name: 'Expert', key: 'expert', char: 'char_expert_portrait', portrait: 'char_expert_portrait' }
        ];

        // Show color selection first
        this.showColorSelection();
    }

    showColorSelection() {
        // Clear any existing elements
        this.children.removeAll();

        // Title
        this.add.text(this.width / 2, this.height / 4, 'PARRY CHESS', {
            font: 'bold 48px monospace',
            color: '#c9a959',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        // Subtitle
        this.add.text(this.width / 2, this.height / 4 + 50, 'Chess meets Sekiro', {
            font: '18px monospace',
            color: '#888888'
        }).setOrigin(0.5);

        // Color selection prompt
        this.add.text(this.width / 2, this.height / 2 - 60, 'Choose your side', {
            font: '20px monospace',
            color: '#ffffff'
        }).setOrigin(0.5);

        // Color buttons
        const buttonWidth = 120;
        const buttonHeight = 50;
        const spacing = 40;

        // White button
        this.createColorButton(
            this.width / 2 - buttonWidth / 2 - spacing,
            this.height / 2,
            buttonWidth,
            buttonHeight,
            'WHITE',
            0xF0D9B5,
            '#000000',
            'white'
        );

        // Black button
        this.createColorButton(
            this.width / 2 + buttonWidth / 2 + spacing,
            this.height / 2,
            buttonWidth,
            buttonHeight,
            'BLACK',
            0x333333,
            '#ffffff',
            'black'
        );

        // Instructions
        this.add.text(this.width / 2, this.height - 80, this.isMobile ? 'Tap piece to select, tap square to move' : 'Click piece to select, click square to move', {
            font: '12px monospace',
            color: '#555555'
        }).setOrigin(0.5);

        this.add.text(this.width / 2, this.height - 60, this.isMobile ? 'TAP ANYWHERE to parry when attacked!' : 'Press SPACE to parry when attacked!', {
            font: '12px monospace',
            color: '#555555'
        }).setOrigin(0.5);
    }

    createColorButton(x, y, width, height, text, bgColor, textColor, colorValue) {
        const container = this.add.container(x, y);

        // Button background
        const bg = this.add.rectangle(0, 0, width, height, bgColor);
        bg.setStrokeStyle(3, 0xc9a959);
        bg.setInteractive({ useHandCursor: true });
        container.add(bg);

        // Button text
        const label = this.add.text(0, 0, text, {
            font: 'bold 18px monospace',
            color: textColor
        }).setOrigin(0.5);
        container.add(label);

        // Hover effects
        bg.on('pointerover', () => {
            bg.setStrokeStyle(4, 0xffffff);
            this.tweens.add({
                targets: container,
                scale: 1.05,
                duration: 100
            });
        });

        bg.on('pointerout', () => {
            bg.setStrokeStyle(3, 0xc9a959);
            this.tweens.add({
                targets: container,
                scale: 1,
                duration: 100
            });
        });

        bg.on('pointerdown', () => {
            this.selectedColor = colorValue;
            this.showDifficultySelection();
        });

        return container;
    }

    showDifficultySelection() {
        // Clear screen
        this.children.removeAll();

        // Title
        this.add.text(this.width / 2, 30, 'PARRY CHESS', {
            font: 'bold 28px monospace',
            color: '#c9a959',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        // Show selected color
        const colorText = this.selectedColor === 'white' ? 'Playing as WHITE' : 'Playing as BLACK';
        this.add.text(this.width / 2, 60, colorText, {
            font: '12px monospace',
            color: '#888888'
        }).setOrigin(0.5);

        // Difficulty selection prompt
        this.add.text(this.width / 2, 90, 'Select Opponent', {
            font: '16px monospace',
            color: '#ffffff'
        }).setOrigin(0.5);

        // Calculate card dimensions based on screen size
        const padding = 10;
        const cardGap = this.isMobile ? 8 : 20;
        const numCards = this.difficulties.length;

        // On mobile, fit all cards horizontally with minimal padding
        const availableWidth = this.width - (padding * 2);
        const cardWidth = Math.min(140, (availableWidth - (cardGap * (numCards - 1))) / numCards);
        const cardHeight = this.isMobile ? Math.min(160, this.height * 0.35) : 200;

        const totalWidth = numCards * cardWidth + (numCards - 1) * cardGap;
        const startX = (this.width - totalWidth) / 2 + cardWidth / 2;
        const cardY = this.isMobile ? this.height * 0.42 : this.height / 2 + 20;

        this.difficultyCards = this.difficulties.map((diff, i) => {
            const x = startX + i * (cardWidth + cardGap);
            return this.createDifficultyCard(x, cardY, cardWidth, cardHeight, diff, i);
        });

        // Update selection visuals
        this.updateDifficultySelection();

        // Play button
        const playButton = this.add.text(this.width / 2, this.height - (this.isMobile ? 70 : 100), '[ PLAY ]', {
            font: `${this.isMobile ? 22 : 28}px monospace`,
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
            const diff = this.difficulties[this.selectedDifficulty];
            this.scene.start('GameScene', {
                difficulty: diff.key,
                playerColor: this.selectedColor,
                opponentCharacter: diff.char,
                opponentPortrait: diff.portrait
            });
        });

        // Back button
        const backBtn = this.add.text(20, 15, '< Back', {
            font: '14px monospace',
            color: '#666666'
        }).setInteractive({ useHandCursor: true });

        backBtn.on('pointerover', () => backBtn.setColor('#ffffff'));
        backBtn.on('pointerout', () => backBtn.setColor('#666666'));
        backBtn.on('pointerdown', () => {
            this.showColorSelection();
        });

        // Instructions (only on desktop, skip on mobile to save space)
        if (!this.isMobile) {
            this.add.text(this.width / 2, this.height - 50, 'Press SPACE to parry when attacked!', {
                font: '12px monospace',
                color: '#555555'
            }).setOrigin(0.5);
        }
    }

    createDifficultyCard(x, y, width, height, diff, index) {
        const container = this.add.container(x, y);

        // Card background
        const bg = this.add.rectangle(0, 0, width, height, 0x222222);
        bg.setStrokeStyle(2, 0x444444);
        bg.setInteractive({ useHandCursor: true });
        container.add(bg);

        // Character portrait - use portrait version for mobile, full body for desktop
        const charKey = this.isMobile ? diff.portrait : diff.char;
        const portrait = this.add.image(0, -15, charKey);

        // Scale portrait to fit card
        const maxPortraitWidth = width - 10;
        const maxPortraitHeight = height - 45;
        const scaleX = maxPortraitWidth / portrait.width;
        const scaleY = maxPortraitHeight / portrait.height;
        const scale = Math.min(scaleX, scaleY, this.isMobile ? 3 : 2);
        portrait.setScale(scale);
        container.add(portrait);

        // Difficulty name
        const fontSize = this.isMobile ? 11 : 14;
        const label = this.add.text(0, height / 2 - 18, diff.name, {
            font: `bold ${fontSize}px monospace`,
            color: '#ffffff'
        }).setOrigin(0.5);
        container.add(label);

        // Store reference to bg for selection highlighting
        container.bg = bg;
        container.diffIndex = index;

        // Click handler
        bg.on('pointerdown', () => {
            this.selectedDifficulty = index;
            this.updateDifficultySelection();
        });

        // Hover effects
        bg.on('pointerover', () => {
            if (this.selectedDifficulty !== index) {
                bg.setFillStyle(0x333333);
            }
        });

        bg.on('pointerout', () => {
            if (this.selectedDifficulty !== index) {
                bg.setFillStyle(0x222222);
            }
        });

        return container;
    }

    updateDifficultySelection() {
        this.difficultyCards.forEach((card, i) => {
            if (i === this.selectedDifficulty) {
                card.bg.setFillStyle(0x3a3a3a);
                card.bg.setStrokeStyle(3, 0xc9a959);
            } else {
                card.bg.setFillStyle(0x222222);
                card.bg.setStrokeStyle(2, 0x444444);
            }
        });
    }
}
