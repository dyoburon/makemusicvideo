/**
 * ShaderUpdate utility
 * Handles the combined logic for shader animation and audio data processing
 */

import { processAudioDataForShader } from './ShaderManager';
import AudioAnalysisManager from '../audio/AudioAnalysisManager';

// Interpolation settings
const DEFAULT_SMOOTHING_DURATION = 700; // Transition duration in ms
const DEFAULT_COLOR_SMOOTHING_DURATION = 1000; // Longer duration for color transitions
const DEFAULT_CAMERA_SPEED_SMOOTHING_DURATION = 300; // Reduced for faster response to transients

// Camera speed control constants - now using defaults that can be overridden
const DEFAULT_BASE_CAMERA_SPEED = 1.2;
const DEFAULT_MAX_CAMERA_SPEED_BOOST_FACTOR = 2.5; // Increased for more dramatic acceleration (1.2 * 2.5 = 3.0)
const DEFAULT_TRANSIENT_THRESHOLD_FOR_SPEED_BOOST = 0.1; // Lowered to make it more sensitive to transients
const DEFAULT_ENERGY_BOOST_FACTOR = 0.05; // Factor for energy's influence on camera speed

// Export smoothedValues to allow direct manipulation from ShaderManager
export const smoothedValues = {
    transients: {
        current: 0,
        target: 0,
        lastUpdateTime: 0
    },
    energy: {
        current: 0.5,
        target: 0.5,
        lastUpdateTime: 0
    },
    lowEnergy: {
        current: 0.5,
        target: 0.5,
        lastUpdateTime: 0
    },
    highEnergy: {
        current: 0.5,
        target: 0.5,
        lastUpdateTime: 0
    },
    // Add new color states
    color1: {
        r: { current: 0.4, target: 0.4, lastUpdateTime: 0 },
        g: { current: 1.0, target: 1.0, lastUpdateTime: 0 },
        b: { current: 0.2, target: 0.2, lastUpdateTime: 0 }
    },
    color2: {
        r: { current: 0.2, target: 0.2, lastUpdateTime: 0 },
        g: { current: 1.0, target: 1.0, lastUpdateTime: 0 },
        b: { current: 0.8, target: 0.8, lastUpdateTime: 0 }
    },
    color3: {
        r: { current: 1.0, target: 1.0, lastUpdateTime: 0 },
        g: { current: 0.2, target: 0.2, lastUpdateTime: 0 },
        b: { current: 0.8, target: 0.8, lastUpdateTime: 0 }
    },
    fogColor: {
        r: { current: 0.1, target: 0.1, lastUpdateTime: 0 },
        g: { current: 0.05, target: 0.05, lastUpdateTime: 0 },
        b: { current: 0.15, target: 0.15, lastUpdateTime: 0 }
    },
    glowColor: {
        r: { current: 0.1, target: 0.1, lastUpdateTime: 0 },
        g: { current: 0.05, target: 0.05, lastUpdateTime: 0 },
        b: { current: 0.2, target: 0.2, lastUpdateTime: 0 }
    },
    // Tunnel breathing effect parameters
    breathingRate: {
        current: 2.0,
        target: 2.0,
        lastUpdateTime: 0
    },
    breathingAmount: {
        current: 6.0,
        target: 6.0,
        lastUpdateTime: 0
    },
    cameraSpeed: {
        current: 1.2, // Initial base speed matching BASE_CAMERA_SPEED
        target: 1.2,  // Initial target speed
        lastUpdateTime: 0
    },
    // Add new custom control states
    transientEffect: {
        current: 0.3,
        target: 0.3,
        lastUpdateTime: 0
    },
    colorIntensity: {
        current: 0.5,
        target: 0.5,
        lastUpdateTime: 0
    },
    // Add new audio effect intensity controls
    energyCameraEffect: {
        current: 1.0,
        target: 1.0,
        lastUpdateTime: 0
    },
    energyColorEffect: {
        current: 1.0,
        target: 1.0,
        lastUpdateTime: 0
    },
    transientCameraEffect: {
        current: 1.0,
        target: 1.0,
        lastUpdateTime: 0
    },
    transientColorEffect: {
        current: 1.0,
        target: 1.0,
        lastUpdateTime: 0
    },
    // Add new camera movement configuration controls
    baseCameraSpeed: {
        current: DEFAULT_BASE_CAMERA_SPEED,
        target: DEFAULT_BASE_CAMERA_SPEED,
        lastUpdateTime: 0
    },
    maxCameraSpeedBoostFactor: {
        current: DEFAULT_MAX_CAMERA_SPEED_BOOST_FACTOR,
        target: DEFAULT_MAX_CAMERA_SPEED_BOOST_FACTOR,
        lastUpdateTime: 0
    },
    transientThresholdForSpeedBoost: {
        current: DEFAULT_TRANSIENT_THRESHOLD_FOR_SPEED_BOOST,
        target: DEFAULT_TRANSIENT_THRESHOLD_FOR_SPEED_BOOST,
        lastUpdateTime: 0
    },
    energyBoostFactor: {
        current: DEFAULT_ENERGY_BOOST_FACTOR,
        target: DEFAULT_ENERGY_BOOST_FACTOR,
        lastUpdateTime: 0
    },
    cameraSpeedSmoothingDuration: {
        current: DEFAULT_CAMERA_SPEED_SMOOTHING_DURATION,
        target: DEFAULT_CAMERA_SPEED_SMOOTHING_DURATION,
        lastUpdateTime: 0
    },
    colorSmoothingDuration: {
        current: DEFAULT_COLOR_SMOOTHING_DURATION,
        target: DEFAULT_COLOR_SMOOTHING_DURATION,
        lastUpdateTime: 0
    },
    smoothingDuration: {
        current: DEFAULT_SMOOTHING_DURATION,
        target: DEFAULT_SMOOTHING_DURATION,
        lastUpdateTime: 0
    },
    // New toggle for using color controls vs random colors
    useColorControls: {
        current: true, // Default to using color controls
        target: true,
        lastUpdateTime: 0
    }
};

// Playback state tracking for camera behavior
let lastPlayingState = false;

// Store the time of the last transient that triggered a color change
let lastTransientColorChangeTime = 0;
// Threshold for detecting a significant transient event
const TRANSIENT_THRESHOLD = 0.0;
// Minimum interval between color changes triggered by transients (in milliseconds)
const MIN_COLOR_CHANGE_INTERVAL = 500;

// Helper to generate a random float between min and max
function randomRange(min, max) {
    return Math.random() * (max - min) + min;
}

/**
 * Smoothly interpolate a single component (e.g., r, g, b, or a scalar uniform)
 * @param {Object} componentState - The state object for the component (e.g., smoothedValues.color1.r)
 * @param {number} targetValue - Target value to interpolate towards
 * @param {number} now - Current timestamp
 * @param {number} duration - Smoothing duration for this component
 * @returns {number} - Smoothly interpolated value
 */
function getSmoothComponentValue(componentState, targetValue, now, duration) {
    // If this is a new target value, update the target
    if (targetValue !== componentState.target) {
        componentState.target = targetValue;
        componentState.lastUpdateTime = now; // Reset time when target changes
    }

    // Calculate elapsed time since the last target change for this component
    const elapsed = now - componentState.lastUpdateTime;

    // Calculate interpolation progress (0 to 1)
    let progress = Math.min(1.0, elapsed / duration);

    // Use a smooth ease-in-out curve for interpolation
    progress = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    // Interpolate between current and target values
    const newValue = componentState.current + (componentState.target - componentState.current) * progress;

    // If we've reached the target, update the current value
    if (progress >= 0.999) { // Use a threshold to avoid floating point issues
        componentState.current = componentState.target;
    } else {
        componentState.current = newValue;
    }
    return componentState.current;
}

/**
 * Smoothly interpolate between current and target values (for scalar uniforms)
 * @param {string} uniformName - Name of the uniform to interpolate (from smoothedValues)
 * @param {number} targetValue - Target value to interpolate towards
 * @param {number} now - Current timestamp
 * @returns {number} - Smoothly interpolated value
 */
function getSmoothValue(uniformName, targetValue, now) {
    // This function now specifically handles scalar values like 'energy', 'transients'
    const valueState = smoothedValues[uniformName];
    return getSmoothComponentValue(valueState, targetValue, now, DEFAULT_SMOOTHING_DURATION);
}

/**
 * Smoothly interpolate an entire color object (r, g, b)
 * @param {string} colorName - Name of the color to interpolate (e.g., 'color1')
 * @param {{r: number, g: number, b: number}} targetColor - Target color object
 * @param {number} now - Current timestamp
 * @returns {{r: number, g: number, b: number}} - Smoothly interpolated color
 */
function getSmoothColor(colorName, targetColor, now) {
    const colorState = smoothedValues[colorName];
    const r = getSmoothComponentValue(colorState.r, targetColor.r, now, DEFAULT_COLOR_SMOOTHING_DURATION);
    const g = getSmoothComponentValue(colorState.g, targetColor.g, now, DEFAULT_COLOR_SMOOTHING_DURATION);
    const b = getSmoothComponentValue(colorState.b, targetColor.b, now, DEFAULT_COLOR_SMOOTHING_DURATION);
    return { r, g, b };
}

/**
 * Process audio data and prepare shader uniforms
 * @param {Object} audioAnalysis - The complete audio analysis data
 * @param {number} currentTime - The current playback time in seconds
 * @param {boolean} isPlaying - Whether audio is currently playing
 * @param {Object} debugOptions - Options for debug logging
 * @returns {Object} - Uniform values for the shader
 */
export function updateAudioUniforms(audioAnalysis, currentTime, isPlaying, debugOptions = {}) {
    const now = Date.now();

    // If not playing or no analysis data, return default values with smooth transitions
    if (!isPlaying || !audioAnalysis) {
        const defaultScalar = {
            energy: getSmoothValue('energy', 0.5, now),
            lowEnergy: getSmoothValue('lowEnergy', 0.5, now),
            highEnergy: getSmoothValue('highEnergy', 0.5, now),
            transients: getSmoothValue('transients', 0, now),
            time: currentTime
        };
        // Also return current (smoothed) colors
        return {
            ...defaultScalar,
            uColor1: { r: smoothedValues.color1.r.current, g: smoothedValues.color1.g.current, b: smoothedValues.color1.b.current },
            uColor2: { r: smoothedValues.color2.r.current, g: smoothedValues.color2.g.current, b: smoothedValues.color2.b.current },
            uColor3: { r: smoothedValues.color3.r.current, g: smoothedValues.color3.g.current, b: smoothedValues.color3.b.current },
            uFogColor: { r: smoothedValues.fogColor.r.current, g: smoothedValues.fogColor.g.current, b: smoothedValues.fogColor.b.current },
            uGlowColor: { r: smoothedValues.glowColor.r.current, g: smoothedValues.glowColor.g.current, b: smoothedValues.glowColor.b.current },
        };
    }

    // Process audio data for the current time
    const processedAudio = {
        ...audioAnalysis,
        currentTime
    };

    // Process the data to extract shader uniform values
    const rawUniforms = processAudioDataForShader(processedAudio);

    // --- Transient-based Color Change Logic ---
    const newTransientDetected = rawUniforms.transients > TRANSIENT_THRESHOLD;
    const sufficientTimePassed = (now - lastTransientColorChangeTime) > MIN_COLOR_CHANGE_INTERVAL;

    // Apply custom transient effect multiplier to make transient effects more/less pronounced
    const transientStrength = rawUniforms.transients * smoothedValues.transientEffect.current;

    if (newTransientDetected && sufficientTimePassed) {
        // Check if we should use color controls or random colors
        const useColorControls = smoothedValues.useColorControls.current;

        if (useColorControls) {
            // Using user-defined colors from color controls
            // Save the current color states
            const currentColor1 = {
                r: smoothedValues.color1.r.current,
                g: smoothedValues.color1.g.current,
                b: smoothedValues.color1.b.current
            };

            const currentColor2 = {
                r: smoothedValues.color2.r.current,
                g: smoothedValues.color2.g.current,
                b: smoothedValues.color2.b.current
            };

            const currentColor3 = {
                r: smoothedValues.color3.r.current,
                g: smoothedValues.color3.g.current,
                b: smoothedValues.color3.b.current
            };

            // Rotate the colors (1→2, 2→3, 3→1) with slight variations to add some dynamism
            // Color1 gets Color2 with variation
            smoothedValues.color1.r.target = currentColor2.r * (0.9 + 0.2 * Math.random());
            smoothedValues.color1.g.target = currentColor2.g * (0.9 + 0.2 * Math.random());
            smoothedValues.color1.b.target = currentColor2.b * (0.9 + 0.2 * Math.random());

            // Color2 gets Color3 with variation
            smoothedValues.color2.r.target = currentColor3.r * (0.9 + 0.2 * Math.random());
            smoothedValues.color2.g.target = currentColor3.g * (0.9 + 0.2 * Math.random());
            smoothedValues.color2.b.target = currentColor3.b * (0.9 + 0.2 * Math.random());

            // Color3 gets Color1 with variation
            smoothedValues.color3.r.target = currentColor1.r * (0.9 + 0.2 * Math.random());
            smoothedValues.color3.g.target = currentColor1.g * (0.9 + 0.2 * Math.random());
            smoothedValues.color3.b.target = currentColor1.b * (0.9 + 0.2 * Math.random());

            // Keep fog and glow colors from their current values with minor variations
            // This maintains the user-selected colors while adding some visual interest
            smoothedValues.fogColor.r.target = smoothedValues.fogColor.r.current * (0.95 + 0.1 * Math.random());
            smoothedValues.fogColor.g.target = smoothedValues.fogColor.g.current * (0.95 + 0.1 * Math.random());
            smoothedValues.fogColor.b.target = smoothedValues.fogColor.b.current * (0.95 + 0.1 * Math.random());

            smoothedValues.glowColor.r.target = smoothedValues.glowColor.r.current * (0.95 + 0.1 * Math.random());
            smoothedValues.glowColor.g.target = smoothedValues.glowColor.g.current * (0.95 + 0.1 * Math.random());
            smoothedValues.glowColor.b.target = smoothedValues.glowColor.b.current * (0.95 + 0.1 * Math.random());

            if (debugOptions.shouldLog) {
                console.log(`[COLOR CHANGE] New transient triggered color rotation at ${now}`);
            }
        } else {
            // Using completely random colors
            // Update target colors only on a new, significant transient
            smoothedValues.color1.r.target = randomRange(0.2, 1.0);
            smoothedValues.color1.g.target = randomRange(0.2, 1.0);
            smoothedValues.color1.b.target = randomRange(0.2, 1.0);

            smoothedValues.color2.r.target = randomRange(0.2, 1.0);
            smoothedValues.color2.g.target = randomRange(0.2, 1.0);
            smoothedValues.color2.b.target = randomRange(0.2, 1.0);

            smoothedValues.color3.r.target = randomRange(0.2, 1.0);
            smoothedValues.color3.g.target = randomRange(0.2, 1.0);
            smoothedValues.color3.b.target = randomRange(0.2, 1.0);

            // Fog colors should generally be darker
            smoothedValues.fogColor.r.target = randomRange(0.0, 0.3);
            smoothedValues.fogColor.g.target = randomRange(0.0, 0.2);
            smoothedValues.fogColor.b.target = randomRange(0.0, 0.4);

            // Glow colors can be a bit more vibrant but still somewhat controlled
            smoothedValues.glowColor.r.target = randomRange(0.1, 0.5);
            smoothedValues.glowColor.g.target = randomRange(0.1, 0.4);
            smoothedValues.glowColor.b.target = randomRange(0.1, 0.6);

            if (debugOptions.shouldLog) {
                console.log(`[COLOR CHANGE] New transient triggered random color generation at ${now}`);
            }
        }

        lastTransientColorChangeTime = now; // Record the time of this color change
    }
    // --- End Color Change Logic ---

    // --- Camera Speed Logic ---
    // Get the current dynamic values from smoothedValues
    const baseCameraSpeed = smoothedValues.baseCameraSpeed.current;
    const maxCameraSpeedBoostFactor = smoothedValues.maxCameraSpeedBoostFactor.current;
    const transientThresholdForSpeedBoost = smoothedValues.transientThresholdForSpeedBoost.current;
    const energyBoostFactor = smoothedValues.energyBoostFactor.current;

    // Calculate the speed the camera *would* ideally go to based on current transients
    let instantaneousTargetSpeed = baseCameraSpeed;
    const energyBoost = rawUniforms.energy * energyBoostFactor; // Apply the adjustable energyBoostFactor

    // If audio just started playing, give an initial acceleration boost
    if (isPlaying && !lastPlayingState) {
        instantaneousTargetSpeed = baseCameraSpeed * 2.0; // Initial acceleration when playback starts
        if (debugOptions.shouldLog) {
            console.log(`[CAMERA SPEED] Playback started - initial acceleration boost applied`);
        }
    }
    lastPlayingState = isPlaying;

    if (transientStrength > transientThresholdForSpeedBoost) {
        // Map transient strength (above threshold) to a boost multiplier
        // transientEffect will be 0 when transientStrength is at threshold, up to 1
        const effectRange = 1.0 - transientThresholdForSpeedBoost;
        // Ensure effectRange is not zero to prevent division by zero if threshold is 1.0
        const safeEffectRange = Math.max(effectRange, 0.0001);
        const transientEffect = Math.min(1.0, (transientStrength - transientThresholdForSpeedBoost) / safeEffectRange);

        // The boost factor scales from 1.0 (no boost) to maxCameraSpeedBoostFactor
        const currentBoostFactor = 1.0 + transientEffect * (maxCameraSpeedBoostFactor - 1.0);

        // Combine transient-based speed with energy-based boost
        instantaneousTargetSpeed = baseCameraSpeed * currentBoostFactor + energyBoost;

        // Additional pulse boost on strong transients
        if (transientStrength > 0.4) {
            instantaneousTargetSpeed *= 1.2; // Extra boost for strong beats
        }
    } else {
        // Even without transients, let energy influence the speed somewhat, but with reduced effect
        instantaneousTargetSpeed += energyBoost;
    }

    // Ensure camera never goes below baseCameraSpeed (never goes backward)
    instantaneousTargetSpeed = Math.max(instantaneousTargetSpeed, baseCameraSpeed);

    // For smoothing, use either current speed or new target, whichever is higher
    // This ensures we never decelerate below our current speed (no backward motion)
    const finalTargetSpeedForSmoothing = Math.max(
        smoothedValues.cameraSpeed.current, // The current actual speed
        instantaneousTargetSpeed            // The desired speed based on current audio
    );

    // Get the current smoothing duration from state
    const cameraSpeedSmoothingDuration = smoothedValues.cameraSpeedSmoothingDuration.current;

    // Apply smoothing to camera speed - this smooths acceleration only
    const smoothedCameraSpeed = getSmoothComponentValue(
        smoothedValues.cameraSpeed,         // The state object for cameraSpeed
        finalTargetSpeedForSmoothing,       // The new target, which won't cause deceleration
        now,
        cameraSpeedSmoothingDuration
    );

    // Log camera speed changes (every ~60 frames)
    if (debugOptions.shouldLog) {
        console.log(`[CAMERA SPEED] Transient: ${transientStrength.toFixed(2)}, Target: ${instantaneousTargetSpeed.toFixed(2)}, Final: ${smoothedCameraSpeed.toFixed(2)}`);
    }
    // --- End Camera Speed Logic ---

    // Apply smoothing to the uniforms with dynamic smoothing durations
    const smoothingDuration = smoothedValues.smoothingDuration.current;
    const colorSmoothingDuration = smoothedValues.colorSmoothingDuration.current;

    const smoothedScalarUniforms = {
        energy: getSmoothValue('energy', rawUniforms.energy, now),
        lowEnergy: getSmoothValue('lowEnergy', rawUniforms.lowEnergy, now),
        highEnergy: getSmoothValue('highEnergy', rawUniforms.highEnergy, now),
        transients: getSmoothValue('transients', rawUniforms.transients, now),
        time: currentTime,
        // Add these new parameters
        transientEffect: getSmoothComponentValue(smoothedValues.transientEffect, smoothedValues.transientEffect.target, now, smoothingDuration),
        colorIntensity: getSmoothComponentValue(smoothedValues.colorIntensity, smoothedValues.colorIntensity.target, now, smoothingDuration),
        energyCameraEffect: getSmoothComponentValue(smoothedValues.energyCameraEffect, smoothedValues.energyCameraEffect.target, now, smoothingDuration),
        energyColorEffect: getSmoothComponentValue(smoothedValues.energyColorEffect, smoothedValues.energyColorEffect.target, now, smoothingDuration),
        transientCameraEffect: getSmoothComponentValue(smoothedValues.transientCameraEffect, smoothedValues.transientCameraEffect.target, now, smoothingDuration),
        transientColorEffect: getSmoothComponentValue(smoothedValues.transientColorEffect, smoothedValues.transientColorEffect.target, now, smoothingDuration),
        // Add the breathing parameters
        breathingRate: getSmoothComponentValue(smoothedValues.breathingRate, smoothedValues.breathingRate.target, now, smoothingDuration),
        breathingAmount: getSmoothComponentValue(smoothedValues.breathingAmount, smoothedValues.breathingAmount.target, now, smoothingDuration),
        // Add new camera movement configuration parameters
        baseCameraSpeed: getSmoothComponentValue(smoothedValues.baseCameraSpeed, smoothedValues.baseCameraSpeed.target, now, smoothingDuration),
        maxCameraSpeedBoostFactor: getSmoothComponentValue(smoothedValues.maxCameraSpeedBoostFactor, smoothedValues.maxCameraSpeedBoostFactor.target, now, smoothingDuration),
        transientThresholdForSpeedBoost: getSmoothComponentValue(smoothedValues.transientThresholdForSpeedBoost, smoothedValues.transientThresholdForSpeedBoost.target, now, smoothingDuration),
        energyBoostFactor: getSmoothComponentValue(smoothedValues.energyBoostFactor, smoothedValues.energyBoostFactor.target, now, smoothingDuration),
        cameraSpeedSmoothingDuration: getSmoothComponentValue(smoothedValues.cameraSpeedSmoothingDuration, smoothedValues.cameraSpeedSmoothingDuration.target, now, smoothingDuration),
        colorSmoothingDuration: getSmoothComponentValue(smoothedValues.colorSmoothingDuration, smoothedValues.colorSmoothingDuration.target, now, smoothingDuration),
        smoothingDuration: getSmoothComponentValue(smoothedValues.smoothingDuration, smoothedValues.smoothingDuration.target, now, smoothingDuration),
        // Add color mode toggle
        useColorControls: getSmoothComponentValue(smoothedValues.useColorControls, smoothedValues.useColorControls.target, now, smoothingDuration)
    };

    // Get the current color intensity for amplifying colors
    const colorIntensity = smoothedValues.colorIntensity.current;

    // Get smoothed color values by directly calling getSmoothComponentValue for each component
    // Apply colorIntensity to amplify the color values, using the dynamic colorSmoothingDuration
    const uColor1 = {
        r: Math.min(1.0, getSmoothComponentValue(smoothedValues.color1.r, smoothedValues.color1.r.target, now, colorSmoothingDuration) * colorIntensity * 1.5),
        g: Math.min(1.0, getSmoothComponentValue(smoothedValues.color1.g, smoothedValues.color1.g.target, now, colorSmoothingDuration) * colorIntensity * 1.5),
        b: Math.min(1.0, getSmoothComponentValue(smoothedValues.color1.b, smoothedValues.color1.b.target, now, colorSmoothingDuration) * colorIntensity * 1.5)
    };
    const uColor2 = {
        r: Math.min(1.0, getSmoothComponentValue(smoothedValues.color2.r, smoothedValues.color2.r.target, now, colorSmoothingDuration) * colorIntensity * 1.5),
        g: Math.min(1.0, getSmoothComponentValue(smoothedValues.color2.g, smoothedValues.color2.g.target, now, colorSmoothingDuration) * colorIntensity * 1.5),
        b: Math.min(1.0, getSmoothComponentValue(smoothedValues.color2.b, smoothedValues.color2.b.target, now, colorSmoothingDuration) * colorIntensity * 1.5)
    };
    const uColor3 = {
        r: Math.min(1.0, getSmoothComponentValue(smoothedValues.color3.r, smoothedValues.color3.r.target, now, colorSmoothingDuration) * colorIntensity * 1.5),
        g: Math.min(1.0, getSmoothComponentValue(smoothedValues.color3.g, smoothedValues.color3.g.target, now, colorSmoothingDuration) * colorIntensity * 1.5),
        b: Math.min(1.0, getSmoothComponentValue(smoothedValues.color3.b, smoothedValues.color3.b.target, now, colorSmoothingDuration) * colorIntensity * 1.5)
    };
    const uFogColor = {
        r: getSmoothComponentValue(smoothedValues.fogColor.r, smoothedValues.fogColor.r.target, now, colorSmoothingDuration),
        g: getSmoothComponentValue(smoothedValues.fogColor.g, smoothedValues.fogColor.g.target, now, colorSmoothingDuration),
        b: getSmoothComponentValue(smoothedValues.fogColor.b, smoothedValues.fogColor.b.target, now, colorSmoothingDuration)
    };
    const uGlowColor = {
        r: Math.min(1.0, getSmoothComponentValue(smoothedValues.glowColor.r, smoothedValues.glowColor.r.target, now, colorSmoothingDuration) * colorIntensity * 1.5),
        g: Math.min(1.0, getSmoothComponentValue(smoothedValues.glowColor.g, smoothedValues.glowColor.g.target, now, colorSmoothingDuration) * colorIntensity * 1.5),
        b: Math.min(1.0, getSmoothComponentValue(smoothedValues.glowColor.b, smoothedValues.glowColor.b.target, now, colorSmoothingDuration) * colorIntensity * 1.5)
    };

    const smoothedUniforms = {
        ...smoothedScalarUniforms,
        uColor1,
        uColor2,
        uColor3,
        uFogColor,
        uGlowColor,
        cameraSpeed: smoothedCameraSpeed // Add smoothed camera speed
    };

    // Optional debug logging for breathing parameters (every 60 frames)
    if (debugOptions.shouldLog) {
        console.log(`[UNIFORM DEBUG] Breathing parameters:`,
            `rate: ${smoothedUniforms.breathingRate.toFixed(2)} (target: ${smoothedValues.breathingRate.target.toFixed(2)}), ` +
            `amount: ${smoothedUniforms.breathingAmount.toFixed(2)} (target: ${smoothedValues.breathingAmount.target.toFixed(2)})`);
    }

    // Optional debug logging
    if (debugOptions.shouldLog) {
        console.log(`[UNIFORM DEBUG] Time: ${currentTime.toFixed(2)}s, Uniforms:`,
            `energy: ${smoothedUniforms.energy.toFixed(2)} (raw: ${rawUniforms.energy.toFixed(2)}), ` +
            `lowEnergy: ${smoothedUniforms.lowEnergy.toFixed(2)} (raw: ${rawUniforms.lowEnergy.toFixed(2)}), ` +
            `highEnergy: ${smoothedUniforms.highEnergy.toFixed(2)} (raw: ${rawUniforms.highEnergy.toFixed(2)}), ` +
            `transients: ${smoothedUniforms.transients.toFixed(2)} (raw: ${rawUniforms.transients.toFixed(2)})`);
    }

    return smoothedUniforms;
}

/**
 * Get current audio state from AudioAnalysisManager or from passed props
 * @param {Object} providedAudioState - Optional audio state passed directly
 * @returns {Object} - Combined audio state
 */
function getAudioState(providedAudioState = {}) {
    // Get current state from the singleton
    const managerState = AudioAnalysisManager.getState();

    // Use provided values if they exist, otherwise use manager values
    return {
        analysis: providedAudioState.analysis || managerState.audioAnalysis,
        currentTime: providedAudioState.currentTime !== undefined ?
            providedAudioState.currentTime : managerState.currentTime,
        isPlaying: providedAudioState.isPlaying !== undefined ?
            providedAudioState.isPlaying : managerState.isPlaying
    };
}

/**
 * Main update function that handles both animation and audio processing in one loop
 * @param {Object} params - Parameters for the update
 * @param {WebGLRenderingContext} params.gl - WebGL context
 * @param {Object} params.shaderProgram - The compiled shader program
 * @param {Object} params.buffers - GPU buffers for geometry
 * @param {Array} params.resolution - Canvas resolution [width, height]
 * @param {Date} params.startTime - Animation start time
 * @param {Object} params.audioState - Optional override for audio state
 * @param {Function} params.onUpdateUniforms - Callback when uniforms are updated
 * @returns {Object} - Current state including time, FPS, etc.
 */
export function updateFrame({
    gl,
    shaderProgram,
    buffers,
    resolution,
    startTime,
    audioState,
    frameCount,
    onUpdateUniforms
}) {
    // Safety checks
    if (!gl || !shaderProgram || !shaderProgram.use) {
        console.warn('[SHADER UPDATE] Missing required WebGL context or shader program');
        return { frameCount: frameCount + 1, time: 0, audioUniforms: {} };
    }

    const now = Date.now();
    const newFrameCount = frameCount + 1;

    try {
        // Calculate animation time (elapsed time since start)
        const animationTime = (now - (startTime || now)) / 1000;

        // Get current audio state - combining singleton state with any passed props
        const combinedAudioState = getAudioState(audioState);

        // Log the combined state occasionally for debugging
        if (newFrameCount % 120 === 0) {  // Every ~2 seconds at 60fps
            console.log(`[SHADER AUDIO STATE] Combined audio state:`,
                `isPlaying: ${combinedAudioState.isPlaying}, `,
                `currentTime: ${combinedAudioState.currentTime}, `,
                `analysis: ${combinedAudioState.analysis ? 'available' : 'none'}`);
        }

        const audioUniforms = updateAudioUniforms(
            combinedAudioState.analysis,
            combinedAudioState.currentTime || 0,
            combinedAudioState.isPlaying || false,
            { shouldLog: newFrameCount % 60 === 0 } // Log every ~1 second at 60fps
        );

        // Notify parent component of updated uniforms if needed
        if (typeof onUpdateUniforms === 'function') {
            try {
                onUpdateUniforms(audioUniforms);
            } catch (callbackError) {
                console.error('[SHADER UPDATE] Error in onUpdateUniforms callback:', callbackError);
            }
        }

        // Clear the canvas
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Use shader program
        shaderProgram.use();

        // Set standard uniforms - safely handle missing resolution values
        const safeResolution = resolution || [1, 1];
        shaderProgram.setUniform1f('uTime', animationTime);
        shaderProgram.setUniform2f('uResolution', safeResolution[0] || 1, safeResolution[1] || 1);

        // Set audio uniforms safely - these will be smoothly interpolated now
        if (audioUniforms) {
            if (audioUniforms.energy !== undefined) {
                shaderProgram.setUniform1f('uEnergy', audioUniforms.energy);
                shaderProgram.setUniform1f('energy', audioUniforms.energy);
            }
            if (audioUniforms.lowEnergy !== undefined) {
                shaderProgram.setUniform1f('uLowEnergy', audioUniforms.lowEnergy);
                shaderProgram.setUniform1f('lowEnergy', audioUniforms.lowEnergy);
            }
            if (audioUniforms.highEnergy !== undefined) {
                shaderProgram.setUniform1f('uHighEnergy', audioUniforms.highEnergy);
                shaderProgram.setUniform1f('highEnergy', audioUniforms.highEnergy);
            }
            if (audioUniforms.transients !== undefined) {
                shaderProgram.setUniform1f('uTransients', audioUniforms.transients);
                shaderProgram.setUniform1f('transients', audioUniforms.transients);
            }
            if (audioUniforms.time !== undefined) {
                shaderProgram.setUniform1f('uAudioTime', audioUniforms.time);
                shaderProgram.setUniform1f('audioTime', audioUniforms.time);
            }
            // Pass transientEffect as uTransientIntensity
            if (audioUniforms.transientEffect !== undefined) {
                shaderProgram.setUniform1f('uTransientIntensity', audioUniforms.transientEffect);
            }
            // Set new color uniforms
            if (audioUniforms.uColor1) {
                shaderProgram.setUniform3f('uColor1', audioUniforms.uColor1.r, audioUniforms.uColor1.g, audioUniforms.uColor1.b);
            }
            if (audioUniforms.uColor2) {
                shaderProgram.setUniform3f('uColor2', audioUniforms.uColor2.r, audioUniforms.uColor2.g, audioUniforms.uColor2.b);
            }
            if (audioUniforms.uColor3) {
                shaderProgram.setUniform3f('uColor3', audioUniforms.uColor3.r, audioUniforms.uColor3.g, audioUniforms.uColor3.b);
            }
            if (audioUniforms.uFogColor) {
                shaderProgram.setUniform3f('uFogColor', audioUniforms.uFogColor.r, audioUniforms.uFogColor.g, audioUniforms.uFogColor.b);
            }
            if (audioUniforms.uGlowColor) {
                shaderProgram.setUniform3f('uGlowColor', audioUniforms.uGlowColor.r, audioUniforms.uGlowColor.g, audioUniforms.uGlowColor.b);
            }
            // Set new camera speed uniform
            if (audioUniforms.cameraSpeed !== undefined) {
                shaderProgram.setUniform1f('uCameraSpeed', audioUniforms.cameraSpeed);
            }
            // Set new effect control uniforms
            if (audioUniforms.energyCameraEffect !== undefined) {
                shaderProgram.setUniform1f('uEnergyCameraEffect', audioUniforms.energyCameraEffect);
            }
            if (audioUniforms.energyColorEffect !== undefined) {
                shaderProgram.setUniform1f('uEnergyColorEffect', audioUniforms.energyColorEffect);
            }
            if (audioUniforms.transientCameraEffect !== undefined) {
                shaderProgram.setUniform1f('uTransientCameraEffect', audioUniforms.transientCameraEffect);
            }
            if (audioUniforms.transientColorEffect !== undefined) {
                shaderProgram.setUniform1f('uTransientColorEffect', audioUniforms.transientColorEffect);
            }
            // Set new breathing effect uniforms
            if (audioUniforms.breathingRate !== undefined) {
                shaderProgram.setUniform1f('uBreathingRate', audioUniforms.breathingRate);
                if (newFrameCount % 60 === 0) {
                    console.log(`[SHADER UPDATE] Setting uBreathingRate: ${audioUniforms.breathingRate} (target: ${smoothedValues.breathingRate.target})`);
                }
            }
            if (audioUniforms.breathingAmount !== undefined) {
                shaderProgram.setUniform1f('uBreathingAmount', audioUniforms.breathingAmount);
                if (newFrameCount % 60 === 0) {
                    console.log(`[SHADER UPDATE] Setting uBreathingAmount: ${audioUniforms.breathingAmount} (target: ${smoothedValues.breathingAmount.target})`);
                }
            }
        }

        // Return updated state
        return {
            time: animationTime,
            frameCount: newFrameCount,
            audioUniforms
        };
    } catch (error) {
        console.error('[SHADER UPDATE] Error in updateFrame:', error);
        return {
            time: 0,
            frameCount: newFrameCount,
            audioUniforms: {},
            error
        };
    }
}

export default {
    updateAudioUniforms,
    updateFrame,
    smoothedValues
}; 