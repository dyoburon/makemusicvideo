# RetroTunnelShader Audio Reactivity Plan

## Overview

Simplify audio reactivity to **4 effects only** - no position chaos, clean forward motion.

---

## Effect 1: Camera Speed (Forward Motion)

### Goal
Make it feel like we're zooming forward through the tunnel on beats. Speed up = forward zoom. Never slow down below baseline = never feels like going backward.

### Current Problem
Multiple things affect "position": expansion, displacement, rotation, breathing. All stacked = chaos.

### Solution

**In the shader (`RetroTunnelShader.js`):**

The forward motion is controlled by this line in `main()`:
```glsl
float time = -uTime * uCameraSpeed * timeScale;
vec3 ro = vec3(0, 0, time);  // Ray origin Z = forward position
```

- `uTime` increases constantly (from animation frame)
- `uCameraSpeed` multiplies it (1.0 = normal, 2.0 = double speed)
- Negative sign = forward direction through tunnel

**What to change:**
1. Remove `timeScale` audio modulation (energy affecting time) - too subtle and adds complexity
2. Keep ONLY `uCameraSpeed` as the speed control
3. In ShaderUpdate.js, boost `uCameraSpeed` on beats (1.0 → 1.5), then decay back

**Final shader line:**
```glsl
float time = -uTime * uCameraSpeed;  // Clean, just speed control
```

**In ShaderUpdate.js:**
```javascript
// On beat detection:
smoothedValues.cameraSpeed.current = 1.5;  // Boost
smoothedValues.cameraSpeed.target = 1.0;   // Decay back

// Floor of 1.0 enforced (already done)
cameraSpeed: Math.max(1.0, getSmoothComponentValue(...))
```

### What to REMOVE from shader

Disable all position-affecting audio reactivity:

1. **Expansion in `disp()`** - Set multipliers to 0:
   ```glsl
   // BEFORE: expansion *= 1.0 + uLowEnergy * uEnergyCameraEffect * 0.8;
   // AFTER: Remove or set uEnergyCameraEffect to 0
   ```

2. **Displacement amplitude in `map()`** - Remove audio modulation:
   ```glsl
   // BEFORE: float dspAmp = 0.15 * (1.0 + uTransients * ... * 0.4 + uEnergy * ... * 0.2);
   // AFTER: float dspAmp = 0.15;  // Fixed value
   ```

3. **Rotation speed** - Remove audio modulation:
   ```glsl
   // BEFORE: rotationSpeed *= 1.0 + uHighEnergy * uEnergyCameraEffect * 0.6;
   // AFTER: Remove this line
   ```

4. **Breathing effect** - Set to zero:
   ```glsl
   // BEFORE: float breathingFactor = 1.0 + uBreathingAmount * ...
   // AFTER: float breathingFactor = 1.0;  // No breathing
   ```

5. **Camera sway (bsMo)** - Remove audio modulation:
   ```glsl
   // BEFORE: bsMo.x += sin(...) * 0.1 * (1.0 + uLowEnergy * ... * 0.4);
   // AFTER: bsMo.x += sin(...) * 0.1;  // Fixed gentle sway
   ```

6. **audioExpand** - Set to 1.0:
   ```glsl
   // BEFORE: float audioExpand = 1.0 + (uTransients * ... + uLowEnergy * ...);
   // AFTER: float audioExpand = 1.0;  // No expansion
   ```

---

## Effect 2: Glow Intensity

### Goal
Glow pulses brighter on beats - visual punch without affecting position.

### How It Works

In the shader, glow is added at the end of `main()`:
```glsl
vec3 audioReactiveGlow = uGlowColor * (
    uTransients * uTransientIntensity * uTransientColorEffect * 2.0 +
    uLowEnergy * uEnergyColorEffect * 1.0 +
    uHighEnergy * uEnergyColorEffect * 1.0
);
col += audioReactiveGlow * 3.0;
```

### Solution

This is already working correctly. Glow responds to:
- `uTransients` - beat detection
- `uLowEnergy` - bass
- `uHighEnergy` - treble
- `uGlowColor` - the glow color (can be changed)

**What to keep:**
- `uTransientColorEffect` - controls how much transients affect glow
- `uEnergyColorEffect` - controls how much energy affects glow

**In ShaderUpdate.js on beat:**
```javascript
smoothedValues.transientColorEffect.current = 1.5;  // Boost glow
smoothedValues.transientColorEffect.target = 1.0;   // Decay
```

---

## Effect 3: Color Brightness

### Goal
Colors get more vivid/bright on beats.

### How It Works

In the shader, color brightness is affected in multiple places:

1. **Transient brightness boost** (line ~186):
   ```glsl
   if (uTransients * uTransientIntensity > 0.05) {
       baseCol *= 1.0 + uTransients * uTransientIntensity * uTransientColorEffect * 1.0;
   }
   ```

2. **Combined brightness** (line ~213):
   ```glsl
   col.rgb *= 1.0 + uTransients * ... * 0.8 + uLowEnergy * ... * 0.5 + uHighEnergy * ... * 0.4;
   ```

3. **Final saturation boost** (line ~330):
   ```glsl
   vec3 finalCol = col * (1.0 + uEnergy * uEnergyColorEffect * 0.2);
   ```

### Solution

This is already working. Keep these color effects, they don't affect position.

**Controls:**
- `uTransientColorEffect` - transient → brightness
- `uEnergyColorEffect` - energy → brightness
- `colorIntensity` (in ShaderUpdate) - overall color multiplier

**In ShaderUpdate.js on beat:**
```javascript
smoothedValues.colorIntensity.current = 1.3;  // Boost brightness
smoothedValues.colorIntensity.target = 1.0;   // Decay
```

---

## Effect 4: Fog Density

### Goal
Fog thickens/thins with audio energy - adds depth without position changes.

### How It Works

In the shader, fog is calculated in the render loop (lines ~220-240):
```glsl
float baseFogStrength = 0.15 + motionBlurFactor;
float audioFogStrength = uHighEnergy * uEnergyCameraEffect * 0.2;
float fogStrength = (baseFogStrength + audioFogStrength) / 5.0;
```

And fog color:
```glsl
vec4 activeFogColor = vec4(
    mix(uFogColor, uFogColor * 2.0, uTransients * uTransientIntensity * uTransientColorEffect),
    0.08 + uEnergy * uEnergyColorEffect * 0.1
);
```

### Problem

Currently fog uses `uEnergyCameraEffect` which we want to disable for position effects.

### Solution

Change fog to use `uEnergyColorEffect` instead (since fog is a visual effect, not position):

```glsl
// BEFORE:
float audioFogStrength = uHighEnergy * uEnergyCameraEffect * 0.2;

// AFTER:
float audioFogStrength = uHighEnergy * uEnergyColorEffect * 0.2;
```

This way fog responds to audio but through the "color" channel, not "camera" channel.

---

## Summary of Changes

### ShaderUpdate.js

**On beat detection, ONLY change:**
```javascript
// 1. Camera speed (forward motion)
smoothedValues.cameraSpeed.current = 1.5;
smoothedValues.cameraSpeed.target = 1.0;

// 2. Color effects (glow + brightness)
smoothedValues.transientColorEffect.current = 1.5;
smoothedValues.transientColorEffect.target = 1.0;
smoothedValues.energyColorEffect.current = 1.5;
smoothedValues.energyColorEffect.target = 1.0;

// 3. Color intensity
smoothedValues.colorIntensity.current = 1.3;
smoothedValues.colorIntensity.target = 1.0;
```

**REMOVE from beat effects:**
```javascript
// NO LONGER CHANGE:
// - transientEffect (too general)
// - energyCameraEffect (causes position chaos)
// - transientCameraEffect (causes position chaos)
// - breathingRate (causes expansion/contraction)
// - breathingAmount (causes expansion/contraction)
```

**Set camera effects to zero:**
```javascript
smoothedValues.energyCameraEffect.current = 0;
smoothedValues.energyCameraEffect.target = 0;
smoothedValues.transientCameraEffect.current = 0;
smoothedValues.transientCameraEffect.target = 0;
```

### RetroTunnelShader.js

**Remove audio modulation from:**
1. `disp()` - expansion calculation
2. `map()` - displacement amplitude, rotation speed
3. `main()` - camera sway (bsMo), timeScale
4. Breathing factor - set to 1.0
5. audioExpand - set to 1.0

**Keep audio modulation for:**
1. Glow intensity (already uses ColorEffect)
2. Color brightness (already uses ColorEffect)
3. Fog (change to use ColorEffect instead of CameraEffect)

---

## Implementation Order

1. **ShaderUpdate.js** - Simplify beat effects to only 4 things
2. **ShaderUpdate.js** - Set camera effects to 0 by default
3. **RetroTunnelShader.js** - Remove position chaos from shader
4. **RetroTunnelShader.js** - Simplify time calculation
5. **Test** - Should have clean forward motion + visual punch
