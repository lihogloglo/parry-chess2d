import { SOUNDS } from '../config/GameConfig.js';

/**
 * SoundManager - Handles all game sound effects
 */
export class SoundManager {
    constructor(scene) {
        this.scene = scene;
        this.sounds = {};
        this.enabled = true;
        this.masterVolume = 1.0;
    }

    /**
     * Initialize all sound effects (call after assets are loaded)
     */
    init() {
        for (const [name, config] of Object.entries(SOUNDS)) {
            if (this.scene.cache.audio.exists(config.key)) {
                this.sounds[name] = this.scene.sound.add(config.key, {
                    volume: config.volume * this.masterVolume
                });
            } else {
                console.warn(`Sound asset '${config.key}' not found`);
            }
        }
    }

    /**
     * Play a sound effect
     * @param {string} name - Sound name (hit, parry, perfectParry, move)
     */
    play(name) {
        if (!this.enabled) return;

        const sound = this.sounds[name];
        if (sound) {
            sound.play();
        }
    }

    /**
     * Play hit sound (when attack lands)
     */
    playHit() {
        this.play('hit');
    }

    /**
     * Play normal parry sound
     */
    playParry() {
        this.play('parry');
    }

    /**
     * Play perfect parry sound
     */
    playPerfectParry() {
        this.play('perfectParry');
    }

    /**
     * Play piece move sound
     */
    playMove() {
        this.play('move');
    }

    /**
     * Play capture sound (piece takes another)
     */
    playCapture() {
        this.play('capture');
    }

    /**
     * Play check sound
     */
    playCheck() {
        this.play('check');
    }

    /**
     * Play victory sound
     */
    playVictory() {
        this.play('victory');
    }

    /**
     * Play defeat sound
     */
    playDefeat() {
        this.play('defeat');
    }

    /**
     * Set master volume
     * @param {number} volume - Volume level (0.0 - 1.0)
     */
    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));

        // Update all sound volumes
        for (const [name, config] of Object.entries(SOUNDS)) {
            if (this.sounds[name]) {
                this.sounds[name].setVolume(config.volume * this.masterVolume);
            }
        }
    }

    /**
     * Enable/disable sounds
     * @param {boolean} enabled
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }

    /**
     * Toggle sounds on/off
     */
    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}
