/**
 * GAME CONFIGURATION
 * ====================
 * All gameplay balance values in one place for easy tweaking.
 *
 * Modify these values to adjust game difficulty, timing windows,
 * visual effects, and more without digging through the codebase.
 */

// =============================================================================
// DIFFICULTY SETTINGS
// =============================================================================

/**
 * AI parry accuracy by difficulty level
 *
 * aiParryChance: Chance AI attempts to parry at all (0.0 - 1.0)
 * aiPerfectParryChance: When parrying, chance to hit perfect window (0.0 - 1.0)
 *                       If not perfect, AI lands in normal parry window
 */
export const DIFFICULTY_SETTINGS = {
    easy: {
        aiParryChance: 0.50,         // 50% chance AI attempts parry
        aiPerfectParryChance: 0.10,  // 10% of parries are perfect
        description: 'Forgiving timing, AI rarely parries perfectly'
    },
    medium: {
        aiParryChance: 0.70,         // 70% chance
        aiPerfectParryChance: 0.25,  // 25% of parries are perfect
        description: 'Balanced challenge'
    },
    hard: {
        aiParryChance: 0.85,         // 85% chance
        aiPerfectParryChance: 0.50,  // 50% of parries are perfect
        description: 'Tight timing, skilled AI'
    },
    expert: {
        aiParryChance: 0.95,         // 95% chance
        aiPerfectParryChance: 0.80,  // 80% of parries are perfect
        description: 'Hesitation is defeat'
    }
};

// =============================================================================
// POSTURE SYSTEM
// =============================================================================

/**
 * Maximum posture for each piece type
 * When posture reaches max, piece is vulnerable to deathblow
 * Higher = more hits required to break posture
 */
export const POSTURE_LIMITS = {
    pawn: 2,
    knight: 3,
    bishop: 3,
    rook: 5,
    queen: 6,
    king: 999   // King cannot be posture-broken (checkmate wins instead)
};

// =============================================================================
// TIMING WINDOWS (in milliseconds)
// =============================================================================

/**
 * Base timing multiplier - adjust to make ALL parry windows easier/harder
 * 1.0 = default, 1.5 = 50% more forgiving, 0.75 = 25% tighter
 */
export const TIMING_MULTIPLIER = 1.0;

/**
 * Combat timing delays (ms)
 */
export const COMBAT_TIMING = {
    // Delay after perfect parry before combat ends
    perfectParryDelay: 500,

    // Delay after posture break before attacker wins
    postureBreakDelay: 800,

    // Delay between attacks in a combo
    comboAttackDelay: 600,

    // Delay after surviving all attacks
    surviveDelay: 500,

    // Delay after missed parry (attack lands)
    missedParryDelay: 300,

    // AI thinking delay before move
    aiThinkDelay: 500
};

// =============================================================================
// PIECE COMBAT DATA
// =============================================================================

/**
 * Combat data for each piece type
 *
 * Each attack has:
 * - telegraphDuration: Wind-up time before attack (warning phase)
 * - attackDuration: How long the strike takes
 * - perfectWindow: Window for perfect parry (gold, counters)
 * - normalWindow: Window for normal parry (orange, blocks)
 * - damage: Posture damage dealt on normal parry
 *
 * Total attack time = telegraphDuration + attackDuration
 * Parry windows are centered at the middle of total time
 */
export const PIECE_COMBAT = {
    pawn: {
        difficulty: 'easy',
        comboCount: 1,
        attacks: [
            {
                name: 'Strike',
                telegraphDuration: 800,
                attackDuration: 1000,
                perfectWindow: 120,
                normalWindow: 240,
                damage: 1
            }
        ]
    },

    knight: {
        difficulty: 'medium',
        comboCount: 2,
        attacks: [
            {
                name: 'Leap Strike',
                telegraphDuration: 600,
                attackDuration: 1300,
                perfectWindow: 110,
                normalWindow: 220,
                damage: 1
            },
            {
                name: 'Follow-up Slash',
                telegraphDuration: 1200,
                attackDuration: 700,
                perfectWindow: 100,
                normalWindow: 200,
                damage: 1
            }
        ]
    },

    bishop: {
        difficulty: 'medium',
        comboCount: 2,
        attacks: [
            {
                name: 'Diagonal Slash',
                telegraphDuration: 800,
                attackDuration: 950,
                perfectWindow: 105,
                normalWindow: 210,
                damage: 1
            },
            {
                name: 'Cross Slash',
                telegraphDuration: 850,
                attackDuration: 900,
                perfectWindow: 105,
                normalWindow: 210,
                damage: 1
            }
        ]
    },

    rook: {
        difficulty: 'hard',
        comboCount: 3,
        attacks: [
            {
                name: 'Heavy Overhead',
                telegraphDuration: 1100,
                attackDuration: 1100,
                perfectWindow: 140,
                normalWindow: 280,
                damage: 2
            },
            {
                name: 'Horizontal Sweep',
                telegraphDuration: 950,
                attackDuration: 1000,
                perfectWindow: 130,
                normalWindow: 260,
                damage: 1
            },
            {
                name: 'Crushing Blow',
                telegraphDuration: 1000,
                attackDuration: 1050,
                perfectWindow: 135,
                normalWindow: 270,
                damage: 2
            }
        ]
    },

    queen: {
        difficulty: 'very_hard',
        comboCount: 4,
        attacks: [
            {
                name: 'Swift Thrust',
                telegraphDuration: 500,
                attackDuration: 1100,
                perfectWindow: 90,
                normalWindow: 180,
                damage: 1
            },
            {
                name: 'Spinning Slash',
                telegraphDuration: 1300,
                attackDuration: 650,
                perfectWindow: 85,
                normalWindow: 170,
                damage: 1
            },
            {
                name: 'Feint Strike',
                telegraphDuration: 700,
                attackDuration: 1000,
                perfectWindow: 80,
                normalWindow: 160,
                damage: 1
            },
            {
                name: 'Final Judgement',
                telegraphDuration: 900,
                attackDuration: 1100,
                perfectWindow: 100,
                normalWindow: 200,
                damage: 2
            }
        ]
    },

    king: {
        difficulty: 'medium-hard',
        comboCount: 2,
        attacks: [
            {
                name: 'Royal Strike',
                telegraphDuration: 850,
                attackDuration: 1000,
                perfectWindow: 110,
                normalWindow: 220,
                damage: 2
            },
            {
                name: 'Sovereign Slash',
                telegraphDuration: 900,
                attackDuration: 950,
                perfectWindow: 105,
                normalWindow: 210,
                damage: 2
            }
        ]
    }
};

// =============================================================================
// VISUAL EFFECTS (VFX)
// =============================================================================

export const VFX = {
    perfectParry: {
        color: 0xFFD700,            // Bright gold
        particleCount: 20,
        flashDuration: 150,         // ms
        screenShakeIntensity: 8,    // pixels
        screenShakeDuration: 200,   // ms
        slowMotionFactor: 0.3,      // 30% speed
        slowMotionDuration: 300     // ms
    },

    normalParry: {
        color: 0xFF8800,            // Orange
        particleCount: 10,
        flashDuration: 100,
        screenShakeIntensity: 4,
        screenShakeDuration: 150,
        slowMotionFactor: 0.7,      // 70% speed
        slowMotionDuration: 150
    },

    missedParry: {
        color: 0xFF0000,            // Red
        particleCount: 5,
        flashDuration: 80,
        screenShakeIntensity: 2,
        screenShakeDuration: 100,
        slowMotionFactor: 1.0,      // No slow motion
        slowMotionDuration: 0
    },

    telegraph: {
        color: 0xFF3333,            // Red warning
        pulseSpeed: 3.0             // Pulses per second
    }
};

// =============================================================================
// ANIMATION TIMING
// =============================================================================

export const ANIMATION = {
    // Attacker pullback distance during telegraph (pixels)
    pullbackDistance: 20,

    // How much of pre-impact time is spent pulling back (0-1)
    pullbackRatio: 0.6,

    // How much of pre-impact time is spent striking forward (0-1)
    strikeRatio: 0.4,

    // Piece movement duration (non-combat moves)
    moveDuration: 250,

    // Scale multiplier during telegraph wind-up
    telegraphScale: 1.2
};

// =============================================================================
// BOARD VISUALS
// =============================================================================

export const BOARD_COLORS = {
    lightSquare: 0xF0D9B5,
    darkSquare: 0xB58863,
    validMoveHighlight: 0x7FFF7F,   // Lime green
    selectedHighlight: 0xAAFF00,    // Green-yellow
    moveHighlight: 0xFFFF00         // Yellow for last move
};

// =============================================================================
// SOUND SETTINGS
// =============================================================================

/**
 * Sound effect configuration
 *
 * Each sound has:
 * - key: Asset key used in Phaser
 * - volume: Base volume (0.0 - 1.0)
 */
export const SOUNDS = {
    hit: {
        key: 'sfx_hit',
        volume: 0.7
    },
    parry: {
        key: 'sfx_parry',
        volume: 0.6
    },
    perfectParry: {
        key: 'sfx_perfect_parry',
        volume: 0.8
    },
    move: {
        key: 'sfx_move',
        volume: 0.4
    },
    capture: {
        key: 'sfx_capture',
        volume: 0.7
    },
    check: {
        key: 'sfx_check',
        volume: 0.8
    },
    victory: {
        key: 'sfx_victory',
        volume: 0.9
    },
    defeat: {
        key: 'sfx_defeat',
        volume: 0.9
    }
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get combat data for a piece type with timing multiplier applied
 */
export function getCombatData(pieceType) {
    const data = PIECE_COMBAT[pieceType];
    if (!data) return null;

    // Apply timing multiplier to all windows
    return {
        ...data,
        attacks: data.attacks.map(attack => ({
            ...attack,
            perfectWindow: Math.round(attack.perfectWindow * TIMING_MULTIPLIER),
            normalWindow: Math.round(attack.normalWindow * TIMING_MULTIPLIER)
        })),
        totalDuration: data.attacks.reduce(
            (sum, atk) => sum + atk.telegraphDuration + atk.attackDuration, 0
        )
    };
}

/**
 * Get AI parry settings for a difficulty level
 */
export function getAIParrySettings(difficulty) {
    const settings = DIFFICULTY_SETTINGS[difficulty] ?? DIFFICULTY_SETTINGS.medium;
    return {
        parryChance: settings.aiParryChance,
        perfectParryChance: settings.aiPerfectParryChance
    };
}

/**
 * Get posture limit for a piece type
 */
export function getPostureLimit(pieceType) {
    return POSTURE_LIMITS[pieceType] ?? 3;
}
