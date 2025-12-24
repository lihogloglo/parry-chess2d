// Combat data for different piece types
// Re-exports from GameConfig for backward compatibility
// Edit values in src/config/GameConfig.js for easy tweaking

import {
    PIECE_COMBAT,
    POSTURE_LIMITS as CONFIG_POSTURE_LIMITS,
    VFX,
    getCombatData
} from '../config/GameConfig.js';

// Build COMBAT_DATA with computed totalDuration for each piece
export const COMBAT_DATA = Object.fromEntries(
    Object.entries(PIECE_COMBAT).map(([pieceType, data]) => [
        pieceType,
        getCombatData(pieceType)
    ])
);

// Re-export posture limits from config
export const POSTURE_LIMITS = CONFIG_POSTURE_LIMITS;

// Re-export VFX params (mapped to old names for compatibility)
export const VFX_PARAMS = {
    perfectParry: VFX.perfectParry,
    normalParry: VFX.normalParry,
    missedParry: VFX.missedParry,
    telegraph: VFX.telegraph
};
