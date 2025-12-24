# Shader Sync Investigation: Why afk-ai syncs better than makemusicvideo

## Summary

After comparing the audio sync systems in both projects, I found **two major issues**:

1. **Missing band-specific response multipliers** - afk-ai applies different intensity multipliers per frequency band, makemusicvideo doesn't
2. **Weak effect multipliers in shader** - The shader effects use very small multipliers that get dampened further

---

## Issue 1: No Band-Specific Response Multipliers

### How afk-ai does it (GOOD)

afk-ai has **per-band response multipliers** that amplify/dampen each frequency's influence:

```javascript
// afk-ai defaults
lowFrequencyIntensity: 1.2    // Bass hits 120% strength
midFrequencyIntensity: 0.8    // Mids hit 80% strength
highFrequencyIntensity: 0.5   // Highs hit 50% strength
```

These multipliers are applied directly to animation parameters:
- Height/bounce amount
- Rotation speed
- Tilt intensity
- Decay duration (bass lingers longer, highs decay fast)

The user's settings shown (0.84, 0.84, 0.35) are these response multipliers.

### How makemusicvideo does it (PROBLEM)

makemusicvideo has **uniform effect multipliers** that don't differentiate by band:

```javascript
// makemusicvideo defaults
energyCameraEffect: 1.0      // Same for all bands
energyColorEffect: 1.0       // Same for all bands
transientCameraEffect: 1.0   // Same for all bands
transientColorEffect: 1.0    // Same for all bands
```

**The problem:** Even though we detect low/mid/high separately, we don't apply different strengths to each band's effect on the shader.

---

## Issue 2: Weak Effect Multipliers in Shader

### The dampening chain

In the shader code, effects are multiplied by very small values:

```glsl
// Tunnel expansion - bass effect
expansion *= 1.0 + uLowEnergy * uEnergyCameraEffect * 0.2;
//                              ↑ this is 1.0      ↑ then * 0.2 = tiny effect

// Rotation speed - highs effect
rotationSpeed *= 1.0 + uHighEnergy * uEnergyCameraEffect * 0.2;
//                                                        ↑ 0.2 dampening

// Color shift thresholds are high
if (uLowEnergy * uEnergyColorEffect > 0.6) {  // Only activates at 60%+
    baseCol.r *= 1.0 + (uLowEnergy * uEnergyColorEffect - 0.6) * 0.5;
}
```

### The math problem

Let's trace a strong bass hit:

1. Raw bass energy detected: `1.0` (max)
2. Normalized to 0.5-1.0 range: `0.5 + (1.0 * 0.5) = 1.0`
3. Passed to shader as `uLowEnergy = 1.0`
4. Effect multiplier: `uEnergyCameraEffect = 1.0`
5. Shader calculation: `1.0 + 1.0 * 1.0 * 0.2 = 1.2`

**Result:** A maximum bass hit only causes 20% change.

### afk-ai's approach

afk-ai calculates influence strength differently:

```javascript
// Bass influence
height: 1.5 + (intensity * 0.5) * 1.2,  // 1.5x base + up to 0.6 more
rotation: 0.8 + (intensity * 0.4) * 1.2, // Strong rotation influence
decayMultiplier: 0.7                     // Bass lingers 30% longer

// Highs influence
height: 0.6 + (intensity * 0.2) * 0.5,   // Much smaller base
decayMultiplier: 1.2                     // Highs decay 20% faster
```

---

## Issue 3: Fixed 0.5-1.0 Output Range

### The problem

In `ShaderManager.js`, band energies are normalized to always be at least 0.5:

```javascript
lowEnergy = 0.5 + (mostIntense.intensity * 0.5); // Range: 0.5-1.0
highEnergy = 0.5 + (mostIntense.intensity * 0.5); // Range: 0.5-1.0
```

**The problem:** The "quiet" state is already at 0.5, so the dynamic range is only 0.5 (from 0.5 to 1.0).

This means:
- Silence = 0.5 (50% "active")
- Maximum hit = 1.0 (100% "active")
- Dynamic range = only 50%

afk-ai uses the full 0-1 range for intensity.

---

## Threshold Comparison

Both projects use **identical thresholds** (they're the same audio analyzer):

| Threshold | afk-ai | makemusicvideo |
|-----------|--------|----------------|
| Low Frequency Onset | 1.212 | 1.212 |
| Mid Frequency Onset | 1.158 | 1.158 |
| High Frequency Onset | 1.622 | 1.622 |
| Energy Threshold | 0.7 | 0.7 |
| Spectral Flux Threshold | 2.0 | 2.0 |

**Conclusion:** Thresholds are NOT the problem. Detection is the same.

---

## Key Differences Table

| Aspect | afk-ai | makemusicvideo |
|--------|--------|----------------|
| Band response multipliers | 1.2/0.8/0.5 per band | 1.0 uniform |
| Effect strength | Large (0.5-1.5 base values) | Small (0.1-0.3 multipliers) |
| Decay per band | 0.7/0.9/1.2 (varies) | 2.5 uniform |
| Output range | 0.0-1.0 full | 0.5-1.0 compressed |
| Animation targets | Height, rotation, tilt, speed | Tunnel expansion, colors, fog |

---

## Recommended Fixes

### Fix 1: Add band-specific response multipliers

Create UI controls like afk-ai has:

```javascript
// Add to AudioShaderControls.js state
bassResponse: 1.2,      // How strongly bass affects visuals
midResponse: 0.8,       // How strongly mids affect visuals
trebleResponse: 0.5,    // How strongly highs affect visuals
```

Pass these to the shader and multiply band-specific effects.

### Fix 2: Increase shader effect multipliers

Change from:
```glsl
expansion *= 1.0 + uLowEnergy * uEnergyCameraEffect * 0.2;
```

To:
```glsl
expansion *= 1.0 + uLowEnergy * uBassResponse * 0.5;  // Stronger base effect
```

### Fix 3: Use full 0-1 range

Change from:
```javascript
lowEnergy = 0.5 + (mostIntense.intensity * 0.5);
```

To:
```javascript
lowEnergy = mostIntense.intensity;  // Full range
```

Or with adaptive normalization (already implemented but using 0.5 base).

### Fix 4: Add band-specific decay

```javascript
// Different decay speeds per band
const decayRates = {
    low: 1.5,   // Bass lingers
    mid: 2.5,   // Standard
    high: 4.0   // Highs decay fast
};
```

---

## Quick Test

To verify the issue, temporarily boost the effect multipliers in the shader:

```glsl
// RetroTunnelShader.js - line with tunnel expansion
// Change from:
expansion *= 1.0 + uLowEnergy * uEnergyCameraEffect * 0.2;

// To:
expansion *= 1.0 + uLowEnergy * 1.5;  // Temporary: 7.5x stronger effect
```

If sync improves, the problem is confirmed as weak multipliers.

---

## Files to Modify

1. **`utils/shaders/ShaderManager.js`** - Change output range from 0.5-1.0 to 0.0-1.0
2. **`components/AudioShaderControls.js`** - Add bass/mid/treble response sliders
3. **`utils/shaders/*.js`** - Increase effect multipliers or make them uniform-controllable
4. **`utils/audio/adaptiveAudioNormalizer.js`** - Already uses 0-1 range, good

---

## Conclusion

The audio **detection** is identical between projects. The problem is in how the detected values are **applied**:

1. afk-ai amplifies bass (1.2x) and dampens highs (0.5x)
2. makemusicvideo applies uniform 1.0x to everything
3. Shader multipliers are then further dampened by 0.1-0.3x
4. Result: Weak, uniform response that doesn't "feel" synced to the music

The adaptive normalizer we added helps with detection, but we still need band-specific response multipliers to make bass hits feel like bass hits and hi-hats feel like hi-hats.
