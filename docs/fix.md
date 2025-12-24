# Music Sync System - Current State & Improvement Plan

## Part 1: How Things Currently Work

### Audio Analysis Pipeline

The system uses **Meyda.js** to extract audio features from uploaded music files. The analysis runs offline (before playback) and generates a timeline of events.

**Feature Extraction:**
- `energy` - Overall loudness
- `loudness.specific` - Per-bark-band energy values
- `spectralFlatness` - Timbre information
- `rms` - Root mean square for dynamics

**Frequency Bands:**
- Low: indices 0-3 (~20-250Hz) - bass, kicks
- Mid: indices 4-12 (~250Hz-2kHz) - snares, vocals
- High: indices 13-23 (~2kHz-8kHz) - hi-hats, cymbals

### Threshold-Based Detection

The core problem: detection relies on static thresholds that must be manually tuned.

```
Current Thresholds (from UI):
- Energy Threshold: 0.7
- Spectral Flux Threshold: 2
- Low Frequency Threshold: 2
- Low Frequency Onset Threshold: 1.182
- Mid Frequency Onset Threshold: 5.000
- High Frequency Onset Threshold: 4.577
```

**How Detection Works:**
1. Compare band energy change against threshold
2. If `bandChange / threshold > 1.0` → trigger event
3. Store event with intensity, time, and dominant band

**Problem:** These thresholds assume a specific energy distribution. A quiet acoustic song vs loud EDM track have completely different energy profiles, requiring different thresholds.

### Shader Uniforms

The timeline events get converted to these uniforms each frame:

| Uniform | Range | Source |
|---------|-------|--------|
| `uEnergy` | 0.5-1.0 | Overall dynamic intensity |
| `uLowEnergy` | 0.5-1.0 | Low frequency transient intensity |
| `uHighEnergy` | 0.5-1.0 | High frequency transient intensity |
| `uTransients` | 0-1.0 | Recent onset intensity with decay |

**Smoothing Applied:**
- General: 700ms easing interpolation
- Camera speed: 300ms
- Colors: 1000ms
- Transient decay: ~400ms exponential falloff

---

## Part 2: What The Shaders Currently Do

### Low Frequency (`uLowEnergy`) Effects

1. **Tunnel Expansion** - Bass makes tunnel wider
   ```glsl
   expansion *= 1.0 + uLowEnergy * uEnergyCameraEffect * 0.2;
   ```

2. **Horizontal Camera Drift**
   ```glsl
   bsMo.x += sin(uTime * 0.3) * 0.1 * (1.0 + uLowEnergy * uEnergyCameraEffect * 0.1);
   ```

3. **Warm Color Shift** - Strong bass shifts toward red
   ```glsl
   if (uLowEnergy * uEnergyColorEffect > 0.6) {
       baseCol.r *= 1.0 + (uLowEnergy * uEnergyColorEffect - 0.6) * 0.5;
   }
   ```

4. **Fog Mixing** - Low frequencies contribute to atmospheric fog
   ```glsl
   fogColor = mix(fogColor, activeFogColor,
       uLowEnergy * uEnergyColorEffect * 0.2);
   ```

### High Frequency (`uHighEnergy`) Effects

1. **Tunnel Asymmetry** - Creates more dynamic shape
   ```glsl
   float asymmetry = uHighEnergy * uEnergyCameraEffect * 0.1;
   ```

2. **Rotation Speed** - Hi-hats make tunnel spin faster
   ```glsl
   rotationSpeed *= 1.0 + uHighEnergy * uEnergyCameraEffect * 0.2;
   ```

3. **Vertical Camera Drift**
   ```glsl
   bsMo.y += cos(uTime * 0.4) * 0.05 * uHighEnergy * uEnergyCameraEffect;
   ```

4. **Cool Color Shift** - High frequencies enhance blues/cyans
   ```glsl
   if (uHighEnergy * uEnergyColorEffect > 0.6) {
       baseCol.b *= 1.0 + (uHighEnergy * uEnergyColorEffect - 0.6) * 0.5;
   }
   ```

5. **Color Inversion Effect**
   ```glsl
   colorMix = mix(colorMix, 1.0 - colorMix, uHighEnergy * uEnergyColorEffect * 0.2);
   ```

### Overall Energy (`uEnergy`) Effects

1. **Time Flow Speed**
   ```glsl
   float timeScale = 1.0 + uEnergy * uEnergyCameraEffect * 0.1;
   ```

2. **Noise Pattern Reactivity**
   ```glsl
   float noiseScale = 0.8 * (1.0 + uEnergy * uEnergyCameraEffect * 0.05);
   ```

3. **Step Size (Ray Marching Distance)**
   ```glsl
   speedAdjustedStep *= (1.0 + uEnergy * uEnergyCameraEffect * 0.05);
   ```

4. **Final Saturation Boost**
   ```glsl
   fragColor = vec4(col * (1.0 + uEnergy * uEnergyColorEffect * 0.05), 1.0);
   ```

### Transient (`uTransients`) Effects

1. **Tunnel Expansion Burst**
   ```glsl
   float expansion = 1.5 * (1.0 + uTransients * uTransientIntensity * uTransientCameraEffect * 0.10);
   ```

2. **Brightness Boost**
   ```glsl
   if (uTransients * uTransientIntensity > 0.1) {
       baseCol *= 1.0 + uTransients * uTransientIntensity * uTransientColorEffect * 0.3;
   }
   ```

3. **Amplitude Boost**
   ```glsl
   float dspAmp = 0.15 * (1.0 + uTransients * uTransientIntensity * uTransientCameraEffect * 0.10);
   ```

4. **Fog Brightening**
   ```glsl
   activeFogColor = vec4(
       mix(uFogColor, uFogColor * 1.5, uTransients * uTransientIntensity * uTransientColorEffect),
       ...
   );
   ```

5. **Glow Enhancement**
   ```glsl
   vec3 audioReactiveGlow = uGlowColor * (uTransients * uTransientIntensity * uTransientColorEffect * 0.8);
   ```

---

## Part 3: The Problem

### Why Manual Tuning is Required

1. **Static Thresholds vs Dynamic Music**
   - Electronic music: constant high energy, needs high thresholds
   - Acoustic music: low baseline, needs low thresholds
   - Songs with builds: threshold that works for quiet intro fails at drop

2. **Arbitrary Normalization**
   - Output range is 0.5-1.0 regardless of source dynamics
   - Quiet song with threshold 0.5 produces same visual as loud song
   - No relationship between perceived loudness and visual intensity

3. **No Adaptation to Song Structure**
   - Verse and chorus have different energy profiles
   - System doesn't know when a "drop" happens relative to context
   - A "loud" part of a quiet song looks the same as a "quiet" part of a loud song

4. **Genre-Specific Challenges**
   - Hip-hop: Strong low end but sparse highs
   - Classical: Wide dynamic range, no consistent beat
   - EDM: Compressed dynamics, constant energy
   - Jazz: Irregular rhythms, complex frequency content

---

## Part 4: Potential Solutions

### Approach 1: Adaptive Thresholds (Per-Song Calibration)

**Idea:** Analyze the entire song first, then set thresholds based on that song's statistics.

**Implementation:**
1. Pre-analyze to get min/max/mean/stddev for each frequency band
2. Set thresholds relative to song statistics:
   ```
   threshold = mean + (stddev * sensitivity)
   ```
3. Events trigger when value exceeds that song's statistical outliers

**Pros:**
- Adapts to each song's energy profile
- Single "sensitivity" slider replaces multiple thresholds
- Works without genre knowledge

**Cons:**
- Still one threshold for entire song
- Doesn't handle songs with dramatic structure changes

---

### Approach 2: Rolling Window Normalization

**Idea:** Instead of static thresholds, compare current values to recent history.

**Implementation:**
1. Keep rolling buffer of last N seconds (e.g., 5-10 seconds)
2. Normalize current value against rolling statistics:
   ```
   normalized = (current - rollingMean) / rollingStdDev
   ```
3. Trigger events when normalized value exceeds configurable Z-score

**Pros:**
- Automatically adapts to song structure
- Quiet intro → small values become "loud" relative to context
- Drop hits → values exceed recent baseline significantly

**Cons:**
- Lag in adaptation (takes N seconds to calibrate)
- Very consistent sections might have no peaks

---

### Approach 3: Percentile-Based Mapping

**Idea:** Map audio features to visual intensity based on percentile rank within the song.

**Implementation:**
1. Pre-analyze song, store all energy values
2. Sort values to create percentile distribution
3. At playback, map current value to its percentile:
   ```
   if current_energy is at 95th percentile → intensity = 0.95
   ```

**Pros:**
- Full dynamic range always utilized
- Loudest parts of ANY song map to maximum intensity
- Quietest parts map to minimum
- No thresholds needed

**Cons:**
- Requires full pre-analysis
- Monotonous songs might have flat visuals despite constant energy

---

### Approach 4: Multi-Scale Analysis

**Idea:** Combine multiple time scales to capture both local and global dynamics.

**Implementation:**
1. Short-term (100ms): Beat/transient detection
2. Medium-term (2-5s): Phrase/pattern detection
3. Long-term (30s+): Section/structure detection

```
finalIntensity = (shortTerm * 0.4) + (mediumDeviation * 0.4) + (longTermContext * 0.2)
```

**Pros:**
- Captures both immediate impacts and structural changes
- Balances local reactivity with global context

**Cons:**
- More complex implementation
- Harder to tune weighting

---

### Approach 5: Machine Learning Beat Detection

**Idea:** Use a pre-trained model for beat/onset detection instead of threshold comparison.

**Options:**
- Use Web Audio API's `OfflineAudioContext` with a beat detection library
- Port a lightweight beat detection model to run in browser
- Use a simple neural network trained on diverse music

**Pros:**
- More robust across genres
- Can detect musical events humans perceive
- No per-song tuning

**Cons:**
- Model size/performance concerns
- Black box behavior
- May require significant integration work

---

### Recommended Hybrid Approach

Combine approaches 2 and 3:

1. **Pre-analyze song** to get percentile distributions per frequency band
2. **Use percentile mapping** for base intensity values
3. **Apply rolling deviation** to boost values that stand out locally
4. **Single sensitivity slider** controls how much local deviation affects output

**Result:**
```
baseIntensity = percentileRank(currentEnergy)  // 0-1 based on song
localBoost = (current - rollingMean) / rollingStdDev  // Z-score
finalIntensity = baseIntensity + (localBoost * sensitivity)
```

This ensures:
- Every song uses full visual dynamic range
- Drops/buildups are detected relative to context
- Single slider replaces 6+ thresholds
- Works across all genres without configuration

---

## Part 5: Implementation - Adaptive Audio Normalizer

A new utility has been created at `utils/audio/adaptiveAudioNormalizer.js` that implements the recommended hybrid approach.

### How It Works

1. **Percentile Distributions**: After audio analysis, builds a lookup table mapping each value to its percentile rank within the song
2. **Rolling Window**: Maintains a ~5 second window to detect local standouts
3. **Combined Output**: Blends global percentile with local Z-score for responsive yet contextualized values

### Integration Points

The utility is designed to work alongside the existing system with minimal changes. Here's how to integrate:

#### Option A: Replace processAudioDataForShader (Recommended)

In `ShaderManager.js`, modify `processAudioDataForShader` to use the adaptive normalizer:

```javascript
import { getAdaptiveNormalizer, initializeAdaptiveNormalizer } from '../audio/adaptiveAudioNormalizer';

// In processAudioDataForShader:
export function processAudioDataForShader(audioData) {
    const normalizer = getAdaptiveNormalizer();

    if (!normalizer.isInitialized) {
        // Fall back to original behavior if not initialized
        return originalProcessAudioDataForShader(audioData);
    }

    // Get current features from timeline
    const currentFeatures = extractCurrentFeatures(audioData);

    // Use adaptive normalization
    return normalizer.getShaderValues(currentFeatures);
}
```

#### Option B: Initialize After Analysis

In `AudioAnalysisManager.js`, after analysis completes:

```javascript
import { initializeAdaptiveNormalizer } from './adaptiveAudioNormalizer';

// In setAudioFile, after analyzeAudioFile completes:
const analysis = await analyzeAudioFile(file);
this.state.audioAnalysis = analysis;

// Initialize the adaptive normalizer with the feature history
// Note: Need to expose featureHistory from AudioAnalyzer
initializeAdaptiveNormalizer(analyzer.featureHistory);
```

#### Option C: UI Toggle (Gradual Rollout)

Add a toggle in `AudioShaderControls.js` to switch between:
- Legacy mode (threshold-based)
- Adaptive mode (percentile-based)

This allows A/B testing with users.

### API Reference

```javascript
import {
    getAdaptiveNormalizer,
    initializeAdaptiveNormalizer,
    getAdaptiveShaderValues,
    resetAdaptiveNormalizer
} from './adaptiveAudioNormalizer';

// Initialize after audio analysis
initializeAdaptiveNormalizer(featureHistory);

// During playback - get normalized values
const values = getAdaptiveShaderValues({
    lowBandEnergy: currentLowEnergy,
    midBandEnergy: currentMidEnergy,
    highBandEnergy: currentHighEnergy,
    energy: currentEnergy
});
// Returns: { energy, lowEnergy, highEnergy, transients }

// Adjust sensitivity (0 = only global percentile, 1 = only local deviation)
getAdaptiveNormalizer().setSensitivity(0.5);

// Reset when loading new song
resetAdaptiveNormalizer();
```

### Configuration

The normalizer has these tunable parameters:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `rollingWindowSize` | 430 | Samples in rolling window (~5s at 86 samples/sec) |
| `localSensitivity` | 0.5 | Blend between global (0) and local (1) normalization |
| `activeFloor` | 0.3 | Percentile below which values fade to 0 |
| `percentileBins` | 100 | Resolution of percentile lookup table |

### Single Sensitivity Slider

Replace the 6 threshold sliders with one "Sensitivity" control:

```javascript
// In AudioShaderControls.js
<Slider
    label="Sensitivity"
    value={sensitivity}
    min={0}
    max={1}
    step={0.1}
    onChange={(v) => {
        getAdaptiveNormalizer().setSensitivity(v);
    }}
/>
```

- **Low sensitivity (0.0-0.3)**: Smooth, song-wide normalization. Good for ambient/classical.
- **Medium sensitivity (0.3-0.7)**: Balanced response. Good for most pop/rock.
- **High sensitivity (0.7-1.0)**: Highly reactive to local changes. Good for dynamic EDM.

---

## Next Steps

1. [x] Create adaptive normalizer utility (`adaptiveAudioNormalizer.js`)
2. [ ] Expose `featureHistory` from `AudioAnalyzer` class
3. [ ] Call `initializeAdaptiveNormalizer()` after analysis completes
4. [ ] Modify `processAudioDataForShader()` to use adaptive values
5. [ ] Add UI toggle to switch between legacy/adaptive modes
6. [ ] Replace threshold sliders with single sensitivity control
7. [ ] Test with diverse music: EDM, classical, hip-hop, acoustic, jazz
8. [ ] Measure sync quality (peak alignment accuracy)
