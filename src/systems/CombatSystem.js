import { COMBAT_DATA, VFX_PARAMS } from '../data/CombatData.js';
import { COMBAT_TIMING, ANIMATION } from '../config/GameConfig.js';

/**
 * CombatSystem - Handles parry combat between pieces
 * Ported and adapted from 3D version for 2D Phaser
 */
export class CombatSystem {
    constructor(scene, board) {
        this.scene = scene;
        this.board = board;

        // Combat state
        this.inCombat = false;
        this.attacker = null;
        this.defender = null;
        this.isPlayerDefending = false;
        this.currentAttackIndex = 0;
        this.combatData = null;

        // Timing
        this.combatStartTime = 0;
        this.attackStartTime = 0;
        this.parryAttempted = false;
        this.parryTime = null;

        // AI parry settings (set by difficulty)
        this.aiParryChance = 0.7;         // Chance to attempt parry
        this.aiPerfectParryChance = 0.25; // Chance for perfect when parrying

        // Callbacks
        this.onCombatEnd = null;

        // UI elements
        this.combatUI = null;
        this.telegraphIndicator = null;
        this.parryZone = null;

        // Sound manager (set by GameScene)
        this.soundManager = null;
    }

    setSoundManager(soundManager) {
        this.soundManager = soundManager;
    }

    setAIParrySettings(settings) {
        this.aiParryChance = settings.parryChance;
        this.aiPerfectParryChance = settings.perfectParryChance;
    }

    /**
     * Start combat between attacker and defender
     * @param {Object} attacker - Attacking piece
     * @param {Object} defender - Defending piece
     * @param {boolean} isPlayerDefending - True if player is defending
     * @returns {Promise} Resolves with combat result
     */
    startCombat(attacker, defender, isPlayerDefending) {
        return new Promise((resolve) => {
            this.inCombat = true;
            this.attacker = attacker;
            this.defender = defender;
            this.isPlayerDefending = isPlayerDefending;
            this.currentAttackIndex = 0;
            this.onCombatEnd = resolve;

            // Get combat data for attacker type
            this.combatData = COMBAT_DATA[attacker.type];

            // Create combat UI
            this.createCombatUI();

            // Start first attack
            this.startAttack();
        });
    }

    createCombatUI() {
        const width = this.scene.cameras.main.width;
        const height = this.scene.cameras.main.height;

        // Semi-transparent overlay
        this.combatOverlay = this.scene.add.rectangle(
            width / 2, height / 2, width, height, 0x000000, 0.3
        ).setDepth(10);

        // Combat info text
        const attackerName = this.attacker.type.charAt(0).toUpperCase() + this.attacker.type.slice(1);
        this.combatText = this.scene.add.text(width / 2, 60, `${attackerName} attacks!`, {
            font: 'bold 24px monospace',
            color: '#ff4444',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(11);

        // Attack counter
        this.attackCountText = this.scene.add.text(width / 2, 90,
            `Attack ${this.currentAttackIndex + 1}/${this.combatData.comboCount}`, {
            font: '16px monospace',
            color: '#ffffff'
        }).setOrigin(0.5).setDepth(11);

        // Parry instruction (only for player)
        if (this.isPlayerDefending) {
            this.parryHint = this.scene.add.text(width / 2, height - 60,
                'Press SPACE to parry!', {
                font: '18px monospace',
                color: '#ffff00'
            }).setOrigin(0.5).setDepth(11);
        }

        // Telegraph/timing bar
        this.createTimingBar();
    }

    createTimingBar() {
        const width = this.scene.cameras.main.width;
        const barWidth = 400;
        const barHeight = 20;
        const barY = 130;

        // Background bar
        this.timingBarBg = this.scene.add.rectangle(
            width / 2, barY, barWidth, barHeight, 0x333333
        ).setDepth(11);

        // Perfect parry zone (center) - width based on total duration
        const attack = this.combatData.attacks[this.currentAttackIndex];
        const totalDuration = attack.telegraphDuration + attack.attackDuration;
        const perfectWidth = (attack.perfectWindow / totalDuration) * barWidth;

        this.perfectZone = this.scene.add.rectangle(
            width / 2, barY, perfectWidth, barHeight, 0xFFD700, 0.5
        ).setDepth(11);

        // Normal parry zone - width based on total duration
        const normalWidth = (attack.normalWindow / totalDuration) * barWidth;
        this.normalZone = this.scene.add.rectangle(
            width / 2, barY, normalWidth, barHeight, 0xFF8800, 0.3
        ).setDepth(11);

        // Cursor (moves along bar)
        this.timingCursor = this.scene.add.rectangle(
            width / 2 - barWidth / 2, barY, 4, barHeight + 10, 0xFF0000
        ).setDepth(12);

        // Store bar info for updates
        this.timingBarInfo = {
            x: width / 2,
            width: barWidth,
            y: barY
        };
    }

    startAttack() {
        const attack = this.combatData.attacks[this.currentAttackIndex];
        this.attackStartTime = Date.now();
        this.parryAttempted = false;
        this.parryTime = null;
        this.attackResolved = false;

        // Update UI
        if (this.attackCountText) {
            this.attackCountText.setText(
                `Attack ${this.currentAttackIndex + 1}/${this.combatData.comboCount}`
            );
        }

        // Update timing bar zones for this attack
        this.updateTimingBarZones(attack);

        // Animate attacker piece (telegraph)
        this.playTelegraphAnimation(attack);

        // If AI is defending, schedule AI parry attempt
        if (!this.isPlayerDefending) {
            this.scheduleAIParry(attack);
        }

        // Start timing cursor animation
        this.animateTimingCursor(attack);
    }

    updateTimingBarZones(attack) {
        const barWidth = this.timingBarInfo.width;
        const totalDuration = attack.telegraphDuration + attack.attackDuration;

        // Update zone widths based on total duration
        const perfectWidth = (attack.perfectWindow / totalDuration) * barWidth;
        const normalWidth = (attack.normalWindow / totalDuration) * barWidth;

        if (this.perfectZone) {
            this.perfectZone.setSize(perfectWidth, 20);
        }
        if (this.normalZone) {
            this.normalZone.setSize(normalWidth, 20);
        }
    }

    animateTimingCursor(attack) {
        const totalDuration = attack.telegraphDuration + attack.attackDuration;
        const barInfo = this.timingBarInfo;

        // Reset cursor position and color
        this.timingCursor.x = barInfo.x - barInfo.width / 2;
        this.timingCursor.setFillStyle(0xFF0000);

        // Animate cursor across bar
        this.cursorTween = this.scene.tweens.add({
            targets: this.timingCursor,
            x: barInfo.x + barInfo.width / 2,
            duration: totalDuration,
            ease: 'Linear',
            onComplete: () => {
                this.resolveAttack();
            }
        });

        // Change cursor color when entering the normal parry zone (centered at totalDuration/2)
        const center = totalDuration / 2;
        const normalStart = center - attack.normalWindow / 2;
        const normalEnd = center + attack.normalWindow / 2;

        // Turn green when entering parry zone
        this.scene.time.delayedCall(normalStart, () => {
            if (this.timingCursor) {
                this.timingCursor.setFillStyle(0x00FF00);
            }
        });

        // Turn red again when exiting parry zone
        this.scene.time.delayedCall(normalEnd, () => {
            if (this.timingCursor) {
                this.timingCursor.setFillStyle(0xFF0000);
            }
        });
    }

    playTelegraphAnimation(attack) {
        if (!this.attacker.sprite) return;

        const attackerSprite = this.attacker.sprite;
        const defenderSprite = this.defender.sprite;

        // Store original positions and scale for returning after combat
        this.attackerOriginalX = attackerSprite.x;
        this.attackerOriginalY = attackerSprite.y;
        const originalScaleX = attackerSprite.scaleX;
        const originalScaleY = attackerSprite.scaleY;

        // Calculate direction toward defender
        const dx = defenderSprite.x - attackerSprite.x;
        const dy = defenderSprite.y - attackerSprite.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const dirX = dx / dist;
        const dirY = dy / dist;

        // Animation timing synced to bar:
        // - Cursor reaches center at totalDuration / 2
        // - That's when the attacker should touch the defender
        const totalDuration = attack.telegraphDuration + attack.attackDuration;
        const impactTime = totalDuration / 2;

        // Telegraph: pull back slightly during first half before impact (from GameConfig)
        const pullbackDist = ANIMATION.pullbackDistance;
        const pullbackDuration = impactTime * ANIMATION.pullbackRatio;
        const strikeDuration = impactTime * ANIMATION.strikeRatio;

        // Store tweens so we can stop them when combat ends
        this.telegraphTweens = [];

        const pullbackTween = this.scene.tweens.add({
            targets: attackerSprite,
            x: this.attackerOriginalX - dirX * pullbackDist,
            y: this.attackerOriginalY - dirY * pullbackDist,
            scaleX: originalScaleX * ANIMATION.telegraphScale,
            scaleY: originalScaleY * ANIMATION.telegraphScale,
            duration: pullbackDuration,
            ease: 'Power2',
            yoyo: false,
            onUpdate: () => this.board.sortPiecesByDepth(),
            onComplete: () => {
                // Strike forward - reach defender exactly at impact time (bar center)
                const contactDist = dist - 10; // Get very close to defender
                const strikeTween = this.scene.tweens.add({
                    targets: attackerSprite,
                    x: this.attackerOriginalX + dirX * contactDist,
                    y: this.attackerOriginalY + dirY * contactDist,
                    scaleX: originalScaleX,
                    scaleY: originalScaleY,
                    duration: strikeDuration,
                    ease: 'Power3',
                    onUpdate: () => this.board.sortPiecesByDepth(),
                    onComplete: () => {
                        // Return to position during second half of bar
                        const returnDuration = totalDuration - impactTime - 100;
                        const returnTween = this.scene.tweens.add({
                            targets: attackerSprite,
                            x: this.attackerOriginalX,
                            y: this.attackerOriginalY,
                            duration: Math.max(returnDuration, 200),
                            ease: 'Power2',
                            onUpdate: () => this.board.sortPiecesByDepth()
                        });
                        this.telegraphTweens.push(returnTween);
                    }
                });
                this.telegraphTweens.push(strikeTween);
            }
        });
        this.telegraphTweens.push(pullbackTween);

        // Make attacker flash red during telegraph
        const flashTween = this.scene.tweens.add({
            targets: attackerSprite,
            alpha: 0.7,
            duration: 100,
            yoyo: true,
            repeat: Math.floor(pullbackDuration / 200),
        });
        this.telegraphTweens.push(flashTween);
    }

    scheduleAIParry(attack) {
        // AI attempts parry based on parry chance
        const willParry = Math.random() < this.aiParryChance;

        if (willParry) {
            const totalDuration = attack.telegraphDuration + attack.attackDuration;
            const centerTime = totalDuration / 2;

            // Determine if this will be a perfect parry or normal parry
            const willBePerfect = Math.random() < this.aiPerfectParryChance;

            let actualTime;
            if (willBePerfect) {
                // Perfect parry: land within the perfect window (small variance around center)
                const perfectVariance = attack.perfectWindow * 0.3; // Small variance within perfect zone
                actualTime = centerTime + (Math.random() - 0.5) * perfectVariance;
            } else {
                // Normal parry: land in normal window but OUTSIDE perfect window
                // Randomly choose early or late side of the normal window
                const side = Math.random() < 0.5 ? -1 : 1;
                const minOffset = attack.perfectWindow / 2;  // Just outside perfect zone
                const maxOffset = attack.normalWindow / 2;   // Edge of normal zone
                const offset = minOffset + Math.random() * (maxOffset - minOffset);
                actualTime = centerTime + side * offset;
            }

            this.scene.time.delayedCall(actualTime, () => {
                if (this.inCombat && !this.parryAttempted) {
                    this.attemptParry();
                }
            });
        }
        // If AI doesn't parry, attack will land (miss)
    }

    /**
     * Called when player/AI attempts a parry
     */
    attemptParry() {
        if (!this.inCombat || this.parryAttempted) return;

        this.parryAttempted = true;
        this.parryTime = Date.now() - this.attackStartTime;

        // Stop the cursor immediately
        if (this.cursorTween) {
            this.cursorTween.stop();
        }

        // Visual feedback
        this.showParryAttempt();

        // Resolve the attack immediately
        this.resolveAttack();
    }

    showParryAttempt() {
        // Flash the defender
        if (this.defender.sprite) {
            this.scene.tweens.add({
                targets: this.defender.sprite,
                alpha: 0.5,
                duration: 50,
                yoyo: true,
            });
        }
    }

    resolveAttack() {
        // Prevent double resolution (from both parry attempt and cursor tween completion)
        if (this.attackResolved) return;
        this.attackResolved = true;

        const attack = this.combatData.attacks[this.currentAttackIndex];
        const totalDuration = attack.telegraphDuration + attack.attackDuration;

        // Parry windows are centered at the middle of the bar (totalDuration / 2)
        const center = totalDuration / 2;
        const perfectStart = center - attack.perfectWindow / 2;
        const perfectEnd = center + attack.perfectWindow / 2;
        const normalStart = center - attack.normalWindow / 2;
        const normalEnd = center + attack.normalWindow / 2;

        let result = 'miss'; // Default: parry missed, attack lands

        if (this.parryAttempted && this.parryTime !== null) {
            if (this.parryTime >= perfectStart && this.parryTime <= perfectEnd) {
                result = 'perfect';
            } else if (this.parryTime >= normalStart && this.parryTime <= normalEnd) {
                result = 'normal';
            }
        }

        // Apply result
        this.applyAttackResult(result, attack);
    }

    applyAttackResult(result, attack) {
        console.log(`Attack result: ${result}`);

        const vfx = VFX_PARAMS[result === 'miss' ? 'missedParry' : result === 'perfect' ? 'perfectParry' : 'normalParry'];

        // Play sound effect
        if (this.soundManager) {
            if (result === 'perfect') {
                this.soundManager.playPerfectParry();
            } else if (result === 'normal') {
                this.soundManager.playParry();
            } else {
                this.soundManager.playHit();
            }
        }

        // Screen shake
        this.scene.cameras.main.shake(vfx.screenShakeDuration, vfx.screenShakeIntensity / 100);

        // Flash effect
        this.scene.cameras.main.flash(vfx.flashDuration,
            (vfx.color >> 16) & 0xFF,
            (vfx.color >> 8) & 0xFF,
            vfx.color & 0xFF,
            true
        );

        // Update result text
        this.showResultText(result);

        if (result === 'perfect') {
            // Perfect parry - counter attack! Combat ends, defender wins
            this.scene.time.delayedCall(COMBAT_TIMING.perfectParryDelay, () => {
                this.endCombat('defender_wins');
            });
        } else if (result === 'normal') {
            // Normal parry - defender takes posture damage but survives
            this.defender.posture += attack.damage;

            // Check if posture broken
            if (this.defender.posture >= this.defender.maxPosture) {
                // Posture broken - next attack is guaranteed hit
                this.showPostureBroken();
                this.scene.time.delayedCall(COMBAT_TIMING.postureBreakDelay, () => {
                    this.endCombat('attacker_wins');
                });
            } else {
                // Continue to next attack or end combat
                this.currentAttackIndex++;
                if (this.currentAttackIndex < this.combatData.comboCount) {
                    this.scene.time.delayedCall(COMBAT_TIMING.comboAttackDelay, () => {
                        this.startAttack();
                    });
                } else {
                    // Survived all attacks!
                    this.scene.time.delayedCall(COMBAT_TIMING.surviveDelay, () => {
                        this.endCombat('defender_survives');
                    });
                }
            }
        } else {
            // Missed parry - attack lands, attacker wins
            this.scene.time.delayedCall(COMBAT_TIMING.missedParryDelay, () => {
                this.endCombat('attacker_wins');
            });
        }
    }

    showResultText(result) {
        const width = this.scene.cameras.main.width;
        const texts = {
            perfect: { text: 'PERFECT PARRY!', color: '#FFD700' },
            normal: { text: 'Parried!', color: '#FF8800' },
            miss: { text: 'HIT!', color: '#FF0000' }
        };

        const config = texts[result];
        const resultText = this.scene.add.text(width / 2, 200, config.text, {
            font: 'bold 32px monospace',
            color: config.color,
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(15);

        this.scene.tweens.add({
            targets: resultText,
            y: 180,
            alpha: 0,
            duration: 800,
            ease: 'Power2',
            onComplete: () => resultText.destroy()
        });
    }

    showPostureBroken() {
        const width = this.scene.cameras.main.width;
        const text = this.scene.add.text(width / 2, 240, 'POSTURE BROKEN!', {
            font: 'bold 28px monospace',
            color: '#FF4444',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(15);

        this.scene.tweens.add({
            targets: text,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 200,
            yoyo: true,
            onComplete: () => {
                this.scene.time.delayedCall(400, () => text.destroy());
            }
        });
    }

    endCombat(result) {
        this.inCombat = false;

        // Clean up UI
        this.cleanupCombatUI();

        // Stop any running tweens
        if (this.cursorTween) {
            this.cursorTween.stop();
        }

        // Stop all telegraph animation tweens
        if (this.telegraphTweens) {
            this.telegraphTweens.forEach(tween => {
                if (tween && tween.isPlaying()) {
                    tween.stop();
                }
            });
            this.telegraphTweens = [];
        }

        // Reset attacker sprite to original position if attacker didn't win
        // (If attacker wins, GameScene will move it to the target square)
        if (result !== 'attacker_wins' && this.attacker && this.attacker.sprite) {
            this.attacker.sprite.x = this.attackerOriginalX;
            this.attacker.sprite.y = this.attackerOriginalY;
            this.attacker.sprite.alpha = 1; // Reset alpha in case flash tween was interrupted
        }

        // Re-sort pieces by depth after combat animations
        this.board.sortPiecesByDepth();

        // Call completion callback
        if (this.onCombatEnd) {
            this.onCombatEnd({
                result,
                attacker: this.attacker,
                defender: this.defender,
                attackerWins: result === 'attacker_wins',
                defenderWins: result === 'defender_wins',
                defenderSurvives: result === 'defender_survives'
            });
        }
    }

    cleanupCombatUI() {
        const elements = [
            this.combatOverlay,
            this.combatText,
            this.attackCountText,
            this.parryHint,
            this.timingBarBg,
            this.perfectZone,
            this.normalZone,
            this.timingCursor
        ];

        elements.forEach(el => {
            if (el) el.destroy();
        });
    }
}
