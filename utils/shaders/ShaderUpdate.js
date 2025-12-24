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
const DEFAULT_BASE_CAMERA_SPEED = 1.2; // Reverted from 1.8
const DEFAULT_MAX_CAMERA_SPEED_BOOST_FACTOR = 2.5;
const DEFAULT_TRANSIENT_THRESHOLD_FOR_SPEED_BOOST = 0.1;
const DEFAULT_ENERGY_BOOST_FACTOR = 0.05;

// IDLE_ANIMATION_PERIOD constant removed

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
        current: 0,
        target: 0,
        lastUpdateTime: 0
    },
    midEnergy: {
        current: 0,
        target: 0,
        lastUpdateTime: 0
    },
    // Color states - initial values match AudioShaderControls defaults
    color1: {
        r: { current: 0.8, target: 0.8, lastUpdateTime: 0 },
        g: { current: 0.2, target: 0.2, lastUpdateTime: 0 },
        b: { current: 0.9, target: 0.9, lastUpdateTime: 0 }
    },
    color2: {
        r: { current: 0.1, target: 0.1, lastUpdateTime: 0 },
        g: { current: 0.6, target: 0.6, lastUpdateTime: 0 },
        b: { current: 0.9, target: 0.9, lastUpdateTime: 0 }
    },
    color3: {
        r: { current: 0.9, target: 0.9, lastUpdateTime: 0 },
        g: { current: 0.5, target: 0.5, lastUpdateTime: 0 },
        b: { current: 0.1, target: 0.1, lastUpdateTime: 0 }
    },
    fogColor: {
        r: { current: 0.15, target: 0.15, lastUpdateTime: 0 },
        g: { current: 0.05, target: 0.05, lastUpdateTime: 0 },
        b: { current: 0.25, target: 0.25, lastUpdateTime: 0 }
    },
    glowColor: {
        r: { current: 0.2, target: 0.2, lastUpdateTime: 0 },
        g: { current: 0.1, target: 0.1, lastUpdateTime: 0 },
        b: { current: 0.3, target: 0.3, lastUpdateTime: 0 }
    },
    // Tunnel breathing effect parameters - DISABLED to prevent expansion/contraction
    breathingRate: {
        current: 0,
        target: 0,
        lastUpdateTime: 0
    },
    breathingAmount: {
        current: 0,  // DISABLED - causes backward feeling
        target: 0,
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
    // Audio effect intensity controls
    // Camera effects set to 0 to prevent position chaos - only ColorEffects are active
    energyCameraEffect: {
        current: 0,  // DISABLED - causes position chaos
        target: 0,
        lastUpdateTime: 0
    },
    energyColorEffect: {
        current: 1.0,
        target: 1.0,
        lastUpdateTime: 0
    },
    transientCameraEffect: {
        current: 0,  // DISABLED - causes position chaos
        target: 0,
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
    },
    // Band-specific response multipliers (like afk-ai)
    bassResponse: {
        current: 1.2,  // Bass hits hard
        target: 1.2,
        lastUpdateTime: 0
    },
    midResponse: {
        current: 0.8,  // Mids moderate
        target: 0.8,
        lastUpdateTime: 0
    },
    trebleResponse: {
        current: 0.5,  // Highs subtle but quick
        target: 0.5,
        lastUpdateTime: 0
    },
    // Debug beat flash - for visualizing beat detection
    debugBeatFlash: {
        current: 0,
        target: 0,
        lastUpdateTime: 0
    },
    debugBeatColorR: {
        current: 1.0,
        target: 1.0,
        lastUpdateTime: 0
    },
    debugBeatColorG: {
        current: 0.0,
        target: 0.0,
        lastUpdateTime: 0
    },
    debugBeatColorB: {
        current: 0.0,
        target: 0.0,
        lastUpdateTime: 0
    },
    debugBeatEnabled: {
        current: 0,  // 0 = disabled, 1 = enabled
        target: 0,
        lastUpdateTime: 0
    },
    // Toggle to disable camera movement (for testing colors only)
    cameraMovementEnabled: {
        current: 0,  // 0 = disabled (fixed speed), 1 = enabled (audio reactive)
        target: 0,
        lastUpdateTime: 0
    },
    // Toggle to disable fog and glow (for testing primary colors only)
    fogGlowEnabled: {
        current: 0,  // 0 = disabled (black fog/glow), 1 = enabled
        target: 0,
        lastUpdateTime: 0
    },
    // Tunnel expansion control (how open/brain-like the tunnel looks)
    tunnelExpansion: {
        current: 2.5,  // Higher = more open/brain-like
        target: 2.5,
        lastUpdateTime: 0
    },
    // Glow intensity multiplier
    glowIntensity: {
        current: 1.0,
        target: 1.0,
        lastUpdateTime: 0
    }
};

// Playback state tracking for camera behavior
let lastPlayingState = false;

// Store the time of the last transient that triggered a color change
let lastTransientColorChangeTime = 0;
// Threshold for detecting a significant transient event
const TRANSIENT_THRESHOLD = 0.05; // Balanced threshold - detects real transients but ignores noise
// Minimum interval between color changes triggered by transients (in milliseconds)
const MIN_COLOR_CHANGE_INTERVAL = 100; // Reduced from 500 for more frequent changes during debug

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

    // Get current band response multipliers
    const bassResponse = smoothedValues.bassResponse.current;
    const midResponse = smoothedValues.midResponse.current;
    const trebleResponse = smoothedValues.trebleResponse.current;

    // Step 1: Determine base audio-reactive values.
    // Default to 0 (silent) when not playing - use FULL 0-1 range
    let audioDrivenEnergy = 0;
    let audioDrivenLowEnergy = 0;
    let audioDrivenMidEnergy = 0;
    let audioDrivenHighEnergy = 0;
    let audioDrivenTransients = 0;

    // Step 2: If audio is playing, process it and potentially trigger audio-reactive events.
    if (isPlaying && audioAnalysis) {
        // FIXED: Pass the timeline directly on the audioData object, not nested under analysis
        const processedAudio = {
            timeline: audioAnalysis.timeline,
            currentTime: currentTime
        };
        const liveRawUniforms = processAudioDataForShader(processedAudio);

        // Apply band-specific response multipliers (like afk-ai)
        // These amplify/dampen each frequency's visual impact
        audioDrivenEnergy = Math.min(1.0, liveRawUniforms.energy * midResponse);
        audioDrivenLowEnergy = Math.min(1.0, liveRawUniforms.lowEnergy * bassResponse);
        audioDrivenMidEnergy = Math.min(1.0, (liveRawUniforms.midEnergy || liveRawUniforms.energy) * midResponse);
        audioDrivenHighEnergy = Math.min(1.0, liveRawUniforms.highEnergy * trebleResponse);
        audioDrivenTransients = Math.min(1.0, liveRawUniforms.transients * bassResponse); // Transients driven by bass

        // Add debug logging for audio processing (only when debug is requested)
        if (debugOptions.shouldLog) {
            console.log(`[SHADER UPDATE] Audio (with response) - E:${audioDrivenEnergy.toFixed(2)}, L:${audioDrivenLowEnergy.toFixed(2)}, M:${audioDrivenMidEnergy.toFixed(2)}, H:${audioDrivenHighEnergy.toFixed(2)}, T:${audioDrivenTransients.toFixed(2)}`);
        }

        // --- Transient-based Beat Effects (only active if playing) ---
        const newTransientDetected = liveRawUniforms.transients > TRANSIENT_THRESHOLD;
        const sufficientTimePassed = (now - lastTransientColorChangeTime) > MIN_COLOR_CHANGE_INTERVAL;

        if (newTransientDetected && sufficientTimePassed) {
            // ============================================
            // SIMPLIFIED BEAT EFFECTS - Only 4 things:
            // 1. Camera Speed (forward motion) - can be disabled
            // 2. Glow Intensity (via colorEffect)
            // 3. Color Brightness (via colorEffect + colorIntensity)
            // 4. Fog responds to same colorEffect
            // ============================================

            // 1. CAMERA SPEED - Forward zoom on beat (only if enabled)
            let speedBoost = 1.0;
            if (smoothedValues.cameraMovementEnabled.current > 0.5) {
                speedBoost = 1.25 + Math.random() * 0.5; // 1.25x to 1.75x
                smoothedValues.cameraSpeed.current = speedBoost;
                smoothedValues.cameraSpeed.target = 1.0;
            }

            // 2 & 3. COLOR EFFECTS - Glow + Brightness (no position chaos)
            smoothedValues.transientColorEffect.current = 1.5;
            smoothedValues.transientColorEffect.target = 1.0;
            smoothedValues.energyColorEffect.current = 1.5;
            smoothedValues.energyColorEffect.target = 1.0;

            // 4. COLOR INTENSITY - Extra brightness punch
            const colorBoost = 1.2 + Math.random() * 0.3; // 1.2x to 1.5x
            smoothedValues.colorIntensity.current = colorBoost;
            smoothedValues.colorIntensity.target = 1.0;

            console.log(`[BEAT] Speed:${speedBoost.toFixed(2)}x | Color:${colorBoost.toFixed(2)}x | CamEnabled:${smoothedValues.cameraMovementEnabled.current > 0.5}`);

            lastTransientColorChangeTime = now;
        }
    }
    // Update lastPlayingState AFTER processing audio-dependent logic for the current frame
    // This helps the camera speed logic detect transitions from playing to not playing or vice-versa.
    // However, for instantaneousTargetSpeed, it's better to check current `isPlaying` state.
    // `lastPlayingState` is used for detecting *just started* or *just stopped* scenarios.


    // Step 3: Determine target camera speed.
    let instantaneousTargetSpeed;
    const currentBaseCameraSpeedTarget = smoothedValues.baseCameraSpeed.target; // Target from controls

    if (isPlaying && audioAnalysis) {
        // Use current smoothed values for calculation parameters if they come from controls
        const baseCamSpeed = getSmoothComponentValue(smoothedValues.baseCameraSpeed, smoothedValues.baseCameraSpeed.target, now, DEFAULT_SMOOTHING_DURATION);
        const maxBoost = getSmoothComponentValue(smoothedValues.maxCameraSpeedBoostFactor, smoothedValues.maxCameraSpeedBoostFactor.target, now, DEFAULT_SMOOTHING_DURATION);
        const transientThresh = getSmoothComponentValue(smoothedValues.transientThresholdForSpeedBoost, smoothedValues.transientThresholdForSpeedBoost.target, now, DEFAULT_SMOOTHING_DURATION);
        const energyBoostFactor = getSmoothComponentValue(smoothedValues.energyBoostFactor, smoothedValues.energyBoostFactor.target, now, DEFAULT_SMOOTHING_DURATION);
        const transientEffectControl = getSmoothComponentValue(smoothedValues.transientEffect, smoothedValues.transientEffect.target, now, DEFAULT_SMOOTHING_DURATION);

        const transientStrength = audioDrivenTransients * transientEffectControl;

        instantaneousTargetSpeed = baseCamSpeed;
        const energyBoost = audioDrivenEnergy * energyBoostFactor;

        // If audio just started playing, give an initial acceleration boost
        if (!lastPlayingState) { // Just started playing
            instantaneousTargetSpeed = baseCamSpeed * 2.0; // Initial acceleration when playback starts
        }

        if (transientStrength > transientThresh) {
            // Map transient strength (above threshold) to a boost multiplier
            const effectRange = 1.0 - transientThresh;
            const safeEffectRange = Math.max(effectRange, 0.0001);
            const transientEffect = Math.min(1.0, (transientStrength - transientThresh) / safeEffectRange);
            const currentBoostFactor = 1.0 + transientEffect * (maxBoost - 1.0);

            // Combine transient-based speed with energy-based boost
            instantaneousTargetSpeed = baseCamSpeed * currentBoostFactor + energyBoost;

            // Additional pulse boost on strong transients
            if (transientStrength > 0.4) {
                instantaneousTargetSpeed *= 1.2; // Extra boost for strong beats
            }
        } else {
            // Even without transients, let energy influence the speed somewhat
            instantaneousTargetSpeed += energyBoost;
        }

        // Ensure camera never goes below baseCameraSpeed (never goes backward)
        instantaneousTargetSpeed = Math.max(instantaneousTargetSpeed, baseCamSpeed);
    } else {
        // Not playing: camera speed smoothly moves towards the current baseCameraSpeed target set by controls.
        instantaneousTargetSpeed = currentBaseCameraSpeedTarget;
    }
    lastPlayingState = isPlaying; // Update for next frame's detection

    // For smoothing, use either current speed or new target, whichever is higher
    // This ensures we never decelerate below our current speed (no backward motion)
    const finalTargetSpeedForSmoothing = Math.max(
        smoothedValues.cameraSpeed.current, // The current actual speed
        instantaneousTargetSpeed            // The desired speed based on current audio
    );

    // Get the current smoothing duration from state
    const activeCameraSpeedSmoothingDuration = getSmoothComponentValue(smoothedValues.cameraSpeedSmoothingDuration, smoothedValues.cameraSpeedSmoothingDuration.target, now, DEFAULT_SMOOTHING_DURATION);

    // Step 4: Smooth ALL parameters towards their targets.
    // Targets for audio-reactive params come from audioDrivenXXX (defaulted if not playing).
    // Targets for control-driven params come from smoothedValues.XXX.target.

    const activeSmoothingDuration = getSmoothComponentValue(smoothedValues.smoothingDuration, smoothedValues.smoothingDuration.target, now, DEFAULT_SMOOTHING_DURATION);
    const activeColorSmoothingDuration = getSmoothComponentValue(smoothedValues.colorSmoothingDuration, smoothedValues.colorSmoothingDuration.target, now, DEFAULT_SMOOTHING_DURATION);

    const finalUniforms = {
        energy: getSmoothValue('energy', audioDrivenEnergy, now), // 'energy' etc. are keys in smoothedValues for current/target state
        lowEnergy: getSmoothValue('lowEnergy', audioDrivenLowEnergy, now),
        midEnergy: getSmoothValue('midEnergy', audioDrivenMidEnergy, now),
        highEnergy: getSmoothValue('highEnergy', audioDrivenHighEnergy, now),
        transients: getSmoothValue('transients', audioDrivenTransients, now),
        time: currentTime, // This is audio currentTime, uTime (animationTime) is set in updateFrame

        // Band response multipliers (passed to shader for direct use)
        bassResponse: getSmoothComponentValue(smoothedValues.bassResponse, smoothedValues.bassResponse.target, now, activeSmoothingDuration),
        midResponse: getSmoothComponentValue(smoothedValues.midResponse, smoothedValues.midResponse.target, now, activeSmoothingDuration),
        trebleResponse: getSmoothComponentValue(smoothedValues.trebleResponse, smoothedValues.trebleResponse.target, now, activeSmoothingDuration),

        // Control-driven parameters
        // Camera speed: fixed at 1.0 when movement disabled, otherwise audio-reactive with floor of 1.0
        cameraSpeed: smoothedValues.cameraMovementEnabled.current > 0.5
            ? Math.max(1.0, getSmoothComponentValue(smoothedValues.cameraSpeed, finalTargetSpeedForSmoothing, now, activeCameraSpeedSmoothingDuration))
            : 1.0,
        transientEffect: getSmoothComponentValue(smoothedValues.transientEffect, smoothedValues.transientEffect.target, now, activeSmoothingDuration),
        colorIntensity: getSmoothComponentValue(smoothedValues.colorIntensity, smoothedValues.colorIntensity.target, now, activeSmoothingDuration),
        energyCameraEffect: getSmoothComponentValue(smoothedValues.energyCameraEffect, smoothedValues.energyCameraEffect.target, now, activeSmoothingDuration),
        energyColorEffect: getSmoothComponentValue(smoothedValues.energyColorEffect, smoothedValues.energyColorEffect.target, now, activeSmoothingDuration),
        transientCameraEffect: getSmoothComponentValue(smoothedValues.transientCameraEffect, smoothedValues.transientCameraEffect.target, now, activeSmoothingDuration),
        transientColorEffect: getSmoothComponentValue(smoothedValues.transientColorEffect, smoothedValues.transientColorEffect.target, now, activeSmoothingDuration),

        breathingRate: getSmoothComponentValue(smoothedValues.breathingRate, smoothedValues.breathingRate.target, now, activeSmoothingDuration),
        breathingAmount: getSmoothComponentValue(smoothedValues.breathingAmount, smoothedValues.breathingAmount.target, now, activeSmoothingDuration),

        baseCameraSpeed: getSmoothComponentValue(smoothedValues.baseCameraSpeed, smoothedValues.baseCameraSpeed.target, now, activeCameraSpeedSmoothingDuration), // It smooths its own target, effectively
        maxCameraSpeedBoostFactor: getSmoothComponentValue(smoothedValues.maxCameraSpeedBoostFactor, smoothedValues.maxCameraSpeedBoostFactor.target, now, activeSmoothingDuration),
        transientThresholdForSpeedBoost: getSmoothComponentValue(smoothedValues.transientThresholdForSpeedBoost, smoothedValues.transientThresholdForSpeedBoost.target, now, activeSmoothingDuration),
        energyBoostFactor: getSmoothComponentValue(smoothedValues.energyBoostFactor, smoothedValues.energyBoostFactor.target, now, activeSmoothingDuration),

        useColorControls: getSmoothComponentValue(smoothedValues.useColorControls, smoothedValues.useColorControls.target, now, activeSmoothingDuration),

        // Tunnel expansion (how open/brain-like it looks)
        tunnelExpansion: getSmoothComponentValue(smoothedValues.tunnelExpansion, smoothedValues.tunnelExpansion.target, now, activeSmoothingDuration),

        // Glow intensity multiplier
        glowIntensity: getSmoothComponentValue(smoothedValues.glowIntensity, smoothedValues.glowIntensity.target, now, activeSmoothingDuration),

        // Colors (apply colorIntensity)
        uColor1: {
            r: Math.min(1.0, getSmoothComponentValue(smoothedValues.color1.r, smoothedValues.color1.r.target, now, activeColorSmoothingDuration) * smoothedValues.colorIntensity.current * 1.5),
            g: Math.min(1.0, getSmoothComponentValue(smoothedValues.color1.g, smoothedValues.color1.g.target, now, activeColorSmoothingDuration) * smoothedValues.colorIntensity.current * 1.5),
            b: Math.min(1.0, getSmoothComponentValue(smoothedValues.color1.b, smoothedValues.color1.b.target, now, activeColorSmoothingDuration) * smoothedValues.colorIntensity.current * 1.5)
        },
        uColor2: {
            r: Math.min(1.0, getSmoothComponentValue(smoothedValues.color2.r, smoothedValues.color2.r.target, now, activeColorSmoothingDuration) * smoothedValues.colorIntensity.current * 1.5),
            g: Math.min(1.0, getSmoothComponentValue(smoothedValues.color2.g, smoothedValues.color2.g.target, now, activeColorSmoothingDuration) * smoothedValues.colorIntensity.current * 1.5),
            b: Math.min(1.0, getSmoothComponentValue(smoothedValues.color2.b, smoothedValues.color2.b.target, now, activeColorSmoothingDuration) * smoothedValues.colorIntensity.current * 1.5)
        },
        uColor3: {
            r: Math.min(1.0, getSmoothComponentValue(smoothedValues.color3.r, smoothedValues.color3.r.target, now, activeColorSmoothingDuration) * smoothedValues.colorIntensity.current * 1.5),
            g: Math.min(1.0, getSmoothComponentValue(smoothedValues.color3.g, smoothedValues.color3.g.target, now, activeColorSmoothingDuration) * smoothedValues.colorIntensity.current * 1.5),
            b: Math.min(1.0, getSmoothComponentValue(smoothedValues.color3.b, smoothedValues.color3.b.target, now, activeColorSmoothingDuration) * smoothedValues.colorIntensity.current * 1.5)
        },
        // Fog and Glow - disabled (black) when fogGlowEnabled is off
        uFogColor: smoothedValues.fogGlowEnabled.current > 0.5 ? {
            r: getSmoothComponentValue(smoothedValues.fogColor.r, smoothedValues.fogColor.r.target, now, activeColorSmoothingDuration),
            g: getSmoothComponentValue(smoothedValues.fogColor.g, smoothedValues.fogColor.g.target, now, activeColorSmoothingDuration),
            b: getSmoothComponentValue(smoothedValues.fogColor.b, smoothedValues.fogColor.b.target, now, activeColorSmoothingDuration)
        } : { r: 0, g: 0, b: 0 },
        uGlowColor: smoothedValues.fogGlowEnabled.current > 0.5 ? {
            r: Math.min(1.0, getSmoothComponentValue(smoothedValues.glowColor.r, smoothedValues.glowColor.r.target, now, activeColorSmoothingDuration) * smoothedValues.glowIntensity.current),
            g: Math.min(1.0, getSmoothComponentValue(smoothedValues.glowColor.g, smoothedValues.glowColor.g.target, now, activeColorSmoothingDuration) * smoothedValues.glowIntensity.current),
            b: Math.min(1.0, getSmoothComponentValue(smoothedValues.glowColor.b, smoothedValues.glowColor.b.target, now, activeColorSmoothingDuration) * smoothedValues.glowIntensity.current)
        } : { r: 0, g: 0, b: 0 },

    };

    // Debug logging
    if (debugOptions.shouldLog && now % 60 === 0) { // Approx every second
        // console.log("[ShaderUpdate] Final Uniforms:", JSON.parse(JSON.stringify(finalUniforms)));
        // console.log(`[ShaderUpdate] IsPlaying: ${isPlaying}, BaseCamSpeedTarget: ${currentBaseCameraSpeedTarget.toFixed(2)}, InstantTargetSpeed: ${instantaneousTargetSpeed.toFixed(2)}, FinalCamSpeed: ${finalUniforms.cameraSpeed.toFixed(2)}`);
    }

    return finalUniforms;
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

        // Get current audio state from AudioAnalysisManager, potentially overridden by audioState prop
        const currentGlobalAudioState = AudioAnalysisManager.getState();
        const combinedAudioState = {
            analysis: audioState && audioState.analysis !== undefined ? audioState.analysis : currentGlobalAudioState.audioAnalysis,
            currentTime: audioState && audioState.currentTime !== undefined ? audioState.currentTime : currentGlobalAudioState.currentTime,
            isPlaying: audioState && audioState.isPlaying !== undefined ? audioState.isPlaying : currentGlobalAudioState.isPlaying,
        };

        // Call the refactored updateAudioUniforms
        const audioUniforms = updateAudioUniforms(
            combinedAudioState.analysis,
            combinedAudioState.currentTime || 0, // Ensure currentTime is a number
            combinedAudioState.isPlaying || false, // Ensure isPlaying is a boolean
            { shouldLog: newFrameCount % 60 === 0 }
        );

        if (typeof onUpdateUniforms === 'function') {
            onUpdateUniforms(audioUniforms);
        }

        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        shaderProgram.use();

        shaderProgram.setUniform1f('uTime', animationTime); // CRITICAL: This is the main animation time
        shaderProgram.setUniform2f('uResolution', resolution[0] || 1, resolution[1] || 1);

        // Set all uniforms from audioUniforms object
        if (audioUniforms) {
            // Audio-reactive (now using FULL 0-1 range with response multipliers applied)
            shaderProgram.setUniform1f('uEnergy', audioUniforms.energy);
            shaderProgram.setUniform1f('energy', audioUniforms.energy); // common alias
            shaderProgram.setUniform1f('uLowEnergy', audioUniforms.lowEnergy);
            shaderProgram.setUniform1f('lowEnergy', audioUniforms.lowEnergy);
            shaderProgram.setUniform1f('uMidEnergy', audioUniforms.midEnergy);
            shaderProgram.setUniform1f('midEnergy', audioUniforms.midEnergy);
            shaderProgram.setUniform1f('uHighEnergy', audioUniforms.highEnergy);
            shaderProgram.setUniform1f('highEnergy', audioUniforms.highEnergy);
            shaderProgram.setUniform1f('uTransients', audioUniforms.transients);
            shaderProgram.setUniform1f('transients', audioUniforms.transients);
            shaderProgram.setUniform1f('uAudioTime', audioUniforms.time); // This is audio's currentTime
            shaderProgram.setUniform1f('audioTime', audioUniforms.time); // alias

            // Band response multipliers (for shader-side calculations)
            shaderProgram.setUniform1f('uBassResponse', audioUniforms.bassResponse);
            shaderProgram.setUniform1f('uMidResponse', audioUniforms.midResponse);
            shaderProgram.setUniform1f('uTrebleResponse', audioUniforms.trebleResponse);

            // Control-driven
            shaderProgram.setUniform1f('uCameraSpeed', audioUniforms.cameraSpeed);
            shaderProgram.setUniform1f('uTransientIntensity', audioUniforms.transientEffect); // Shader uses uTransientIntensity
            // shaderProgram.setUniform1f('uColorIntensity', audioUniforms.colorIntensity); // colorIntensity is used in JS to calc colors

            shaderProgram.setUniform1f('uEnergyCameraEffect', audioUniforms.energyCameraEffect);
            shaderProgram.setUniform1f('uEnergyColorEffect', audioUniforms.energyColorEffect);
            shaderProgram.setUniform1f('uTransientCameraEffect', audioUniforms.transientCameraEffect);
            shaderProgram.setUniform1f('uTransientColorEffect', audioUniforms.transientColorEffect);

            shaderProgram.setUniform1f('uBreathingRate', audioUniforms.breathingRate);
            shaderProgram.setUniform1f('uBreathingAmount', audioUniforms.breathingAmount);

            // Tunnel expansion
            shaderProgram.setUniform1f('uTunnelExpansion', audioUniforms.tunnelExpansion);

            // uBaseCameraSpeed etc. are not direct uniforms; they influence uCameraSpeed calculation.
            // uUseColorControls is also not a direct uniform; it influences color calculation in JS.

            // Colors
            if (audioUniforms.uColor1) shaderProgram.setUniform3f('uColor1', audioUniforms.uColor1.r, audioUniforms.uColor1.g, audioUniforms.uColor1.b);
            if (audioUniforms.uColor2) shaderProgram.setUniform3f('uColor2', audioUniforms.uColor2.r, audioUniforms.uColor2.g, audioUniforms.uColor2.b);
            if (audioUniforms.uColor3) shaderProgram.setUniform3f('uColor3', audioUniforms.uColor3.r, audioUniforms.uColor3.g, audioUniforms.uColor3.b);
            if (audioUniforms.uFogColor) shaderProgram.setUniform3f('uFogColor', audioUniforms.uFogColor.r, audioUniforms.uFogColor.g, audioUniforms.uFogColor.b);
            if (audioUniforms.uGlowColor) shaderProgram.setUniform3f('uGlowColor', audioUniforms.uGlowColor.r, audioUniforms.uGlowColor.g, audioUniforms.uGlowColor.b);
        }
        // ... (rest of draw logic)
        // Bind vertex buffer and draw
        if (buffers && buffers.positionBuffer) {
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.positionBuffer);
            const positionAttributeLocation = shaderProgram.addAttribute('aPosition');
            if (positionAttributeLocation !== -1) { // Check if attribute exists
                gl.enableVertexAttribArray(positionAttributeLocation);
                gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); // Draw quad as triangle strip with 4 vertices
            } else {
                console.warn("[Shader Render] aPosition attribute not found in shader.");
            }
        } else {
            console.warn("[Shader Render] Position buffer is missing.");
        }


        return { time: animationTime, frameCount: newFrameCount, audioUniforms };
    } catch (error) {
        console.error('[SHADER UPDATE] Error in updateFrame:', error);
        return { time: 0, frameCount: newFrameCount, audioUniforms: {}, error };
    }
}

export default {
    updateAudioUniforms,
    updateFrame,
    smoothedValues
}; 