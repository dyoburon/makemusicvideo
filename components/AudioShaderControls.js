import React, { useState, useEffect, useCallback } from 'react';
import styles from '../styles/AudioShaderSync.module.css';
import { updateShaderParams, setAdaptiveMode, isAdaptiveModeEnabled } from '../utils/shaders/ShaderManager';
import { getAdaptiveNormalizer } from '../utils/audio/adaptiveAudioNormalizer';
import { smoothedValues } from '../utils/shaders/ShaderUpdate';

/**
 * AudioShaderControls Component
 * 
 * Provides controls for modifying shader parameters in real-time
 * without resetting the animation. Includes controls for:
 * - Colors (main colors, fog, glow)
 * - Camera speed and movement
 * - Visual effects intensity
 * - Audio reactivity parameters
 * - Advanced timing and smoothing parameters
 */
const AudioShaderControls = ({
    onUpdateParams,
    initialParams = {}
}) => {
    // Initialize state with default values or passed initialParams
    const [params, setParams] = useState({
        // Color controls
        color1: initialParams.color1 || { r: 0.8, g: 0.2, b: 0.9 },
        color2: initialParams.color2 || { r: 0.1, g: 0.6, b: 0.9 },
        color3: initialParams.color3 || { r: 0.9, g: 0.5, b: 0.1 },
        fogColor: initialParams.fogColor || { r: 0.15, g: 0.05, b: 0.25 },
        glowColor: initialParams.glowColor || { r: 0.2, g: 0.1, b: 0.3 },

        // Camera & movement controls
        cameraSpeed: initialParams.cameraSpeed || 1.2,

        // Tunnel breathing controls
        breathingRate: initialParams.breathingRate || 2.0,
        breathingAmount: initialParams.breathingAmount || 6.0,

        // Effect intensity
        transientEffect: initialParams.transientEffect || 0.3,
        colorIntensity: initialParams.colorIntensity || 0.5,

        // Audio effect intensity controls
        energyCameraEffect: initialParams.energyCameraEffect || 0.05,
        energyColorEffect: initialParams.energyColorEffect || 1.0,
        transientCameraEffect: initialParams.transientCameraEffect || 1.0,
        transientColorEffect: initialParams.transientColorEffect || 1.0,

        // New advanced camera movement parameters
        baseCameraSpeed: initialParams.baseCameraSpeed || 1.2,
        maxCameraSpeedBoostFactor: initialParams.maxCameraSpeedBoostFactor || 2.5,
        transientThresholdForSpeedBoost: initialParams.transientThresholdForSpeedBoost || 0.1,
        energyBoostFactor: initialParams.energyBoostFactor || 0.05,

        // Timing and smoothing parameters
        cameraSpeedSmoothingDuration: initialParams.cameraSpeedSmoothingDuration || 300,
        colorSmoothingDuration: initialParams.colorSmoothingDuration || 1000,
        smoothingDuration: initialParams.smoothingDuration || 700,

        // Color mode toggle
        useColorControls: initialParams.useColorControls !== undefined ? initialParams.useColorControls : true,

        // Tunnel and effect controls
        tunnelExpansion: initialParams.tunnelExpansion || 2.5,
        glowIntensity: initialParams.glowIntensity || 1.0,
    });

    // Track if any parameter has been changed since last apply
    const [hasChanges, setHasChanges] = useState(false);

    // Adaptive audio sync mode state
    const [useAdaptiveMode, setUseAdaptiveMode] = useState(isAdaptiveModeEnabled());
    const [adaptiveSensitivity, setAdaptiveSensitivity] = useState(0.5);

    // Band response multipliers (like afk-ai)
    const [bassResponse, setBassResponse] = useState(1.2);
    const [midResponse, setMidResponse] = useState(0.8);
    const [trebleResponse, setTrebleResponse] = useState(0.5);

    // Debug beat flash toggle
    const [debugBeatEnabled, setDebugBeatEnabled] = useState(false);

    // Camera movement toggle (for testing colors without movement)
    const [cameraMovementEnabled, setCameraMovementEnabled] = useState(false);

    // Fog/Glow toggle (for testing primary colors without fog/glow interference)
    const [fogGlowEnabled, setFogGlowEnabled] = useState(false);


    // Helper to convert RGB [0-1] to hex color string for input elements
    const rgbToHex = useCallback((r, g, b) => {
        const toHex = (value) => {
            const hex = Math.round(value * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }, []);

    // Helper to convert hex color string to RGB [0-1] values
    const hexToRgb = useCallback((hex) => {
        // Remove # if present
        hex = hex.replace('#', '');

        // Parse the hex values
        const r = parseInt(hex.substring(0, 2), 16) / 255;
        const g = parseInt(hex.substring(2, 4), 16) / 255;
        const b = parseInt(hex.substring(4, 6), 16) / 255;

        return { r, g, b };
    }, []);

    // Apply all current parameters to the shader
    const applyChanges = () => {
        console.log('[AudioShaderControls] Applying params:', JSON.parse(JSON.stringify(params)));

        // First, update via the ShaderManager's updateShaderParams function
        updateShaderParams(params);

        // Then, inform the parent component if needed
        if (onUpdateParams) {
            onUpdateParams(params);
        }

        console.log('[SHADER CONTROLS] Applied all parameters:', params);
        setHasChanges(false);
    };

    // Handle color input changes
    const handleColorChange = (colorName, hexValue) => {
        const rgbValue = hexToRgb(hexValue);

        setParams(prevParams => {
            const newParams = {
                ...prevParams,
                [colorName]: rgbValue
            };

            setHasChanges(true);
            return newParams;
        });
    };

    // Handle slider input changes
    const handleSliderChange = (paramName, value) => {
        setParams(prevParams => {
            // Special handling for boolean toggle values
            const newValue = paramName === 'useColorControls' ? value : parseFloat(value);

            const newParams = {
                ...prevParams,
                [paramName]: newValue
            };

            setHasChanges(true);
            return newParams;
        });
    };

    // Handle adaptive mode toggle
    const handleAdaptiveModeChange = (enabled) => {
        setUseAdaptiveMode(enabled);
        setAdaptiveMode(enabled);
    };

    // Handle adaptive sensitivity change
    const handleSensitivityChange = (value) => {
        const sensitivity = parseFloat(value);
        setAdaptiveSensitivity(sensitivity);
        getAdaptiveNormalizer().setSensitivity(sensitivity);
    };

    // Handle band response changes - directly update smoothedValues
    const handleBassResponseChange = (value) => {
        const val = parseFloat(value);
        setBassResponse(val);
        smoothedValues.bassResponse.target = val;
    };

    const handleMidResponseChange = (value) => {
        const val = parseFloat(value);
        setMidResponse(val);
        smoothedValues.midResponse.target = val;
    };

    const handleTrebleResponseChange = (value) => {
        const val = parseFloat(value);
        setTrebleResponse(val);
        smoothedValues.trebleResponse.target = val;
    };

    // Handle debug beat flash toggle
    const handleDebugBeatToggle = (enabled) => {
        setDebugBeatEnabled(enabled);
        smoothedValues.debugBeatEnabled.current = enabled ? 1 : 0;
        smoothedValues.debugBeatEnabled.target = enabled ? 1 : 0;
        console.log(`[DEBUG BEAT] ${enabled ? 'ENABLED' : 'DISABLED'} - Screen will flash on each beat`);
    };

    // Handle camera movement toggle
    const handleCameraMovementToggle = (enabled) => {
        setCameraMovementEnabled(enabled);
        smoothedValues.cameraMovementEnabled.current = enabled ? 1 : 0;
        smoothedValues.cameraMovementEnabled.target = enabled ? 1 : 0;
        console.log(`[CAMERA MOVEMENT] ${enabled ? 'ENABLED' : 'DISABLED'} - Camera speed ${enabled ? 'reacts to beats' : 'fixed at 1.0'}`);
    };

    // Handle fog/glow toggle
    const handleFogGlowToggle = (enabled) => {
        setFogGlowEnabled(enabled);
        smoothedValues.fogGlowEnabled.current = enabled ? 1 : 0;
        smoothedValues.fogGlowEnabled.target = enabled ? 1 : 0;
        console.log(`[FOG/GLOW] ${enabled ? 'ENABLED' : 'DISABLED'} - ${enabled ? 'Fog and glow colors active' : 'Primary colors only (no fog/glow)'}`);
    };


    // Randomize all colors with one click
    const randomizeColors = () => {
        const getRandomColor = () => ({
            r: Math.random(),
            g: Math.random(),
            b: Math.random()
        });

        // Fog colors are generally darker
        const getRandomFogColor = () => ({
            r: Math.random() * 0.3,
            g: Math.random() * 0.2,
            b: Math.random() * 0.4
        });

        // Glow colors are more vibrant
        const getRandomGlowColor = () => ({
            r: 0.1 + Math.random() * 0.4,
            g: 0.1 + Math.random() * 0.3,
            b: 0.1 + Math.random() * 0.5
        });

        const newParams = {
            ...params,
            color1: getRandomColor(),
            color2: getRandomColor(),
            color3: getRandomColor(),
            fogColor: getRandomFogColor(),
            glowColor: getRandomGlowColor()
        };

        setParams(newParams);
        setHasChanges(true);
    };

    // Randomize all parameters
    const randomizeAllSettings = () => {
        // Helper for generating random values within ranges
        const randomInRange = (min, max) => min + Math.random() * (max - min);

        // Random color generators (reused from randomizeColors)
        const getRandomColor = () => ({
            r: Math.random(),
            g: Math.random(),
            b: Math.random()
        });

        const getRandomFogColor = () => ({
            r: Math.random() * 0.3,
            g: Math.random() * 0.2,
            b: Math.random() * 0.4
        });

        const getRandomGlowColor = () => ({
            r: 0.1 + Math.random() * 0.4,
            g: 0.1 + Math.random() * 0.3,
            b: 0.1 + Math.random() * 0.5
        });

        // Create new random parameters
        const newParams = {
            // Random colors
            color1: getRandomColor(),
            color2: getRandomColor(),
            color3: getRandomColor(),
            fogColor: getRandomFogColor(),
            glowColor: getRandomGlowColor(),

            // Random camera & movement controls
            cameraSpeed: randomInRange(0.0, 3.0),

            // Random tunnel breathing controls
            breathingRate: randomInRange(0.1, 5.0),
            breathingAmount: randomInRange(0, 15.0),

            // Random effect intensity
            transientEffect: randomInRange(0, 1.0),
            colorIntensity: randomInRange(0.0, 0.2),

            // Random audio effect intensity controls
            energyCameraEffect: randomInRange(0, 0.01),
            energyColorEffect: randomInRange(0, 0.5),
            transientCameraEffect: parseFloat(randomInRange(0, 0.1).toFixed(3)),
            transientColorEffect: randomInRange(0, 1.0),

            // Random advanced camera movement parameters
            baseCameraSpeed: randomInRange(0.5, 3.0),
            maxCameraSpeedBoostFactor: randomInRange(1.0, 5.0),
            transientThresholdForSpeedBoost: randomInRange(0, 0.5),
            energyBoostFactor: randomInRange(0, 0.3),

            // Random timing and smoothing parameters
            cameraSpeedSmoothingDuration: Math.floor(randomInRange(100, 1000)),
            colorSmoothingDuration: Math.floor(randomInRange(200, 2000)),
            smoothingDuration: Math.floor(randomInRange(200, 1500)),

            // Random boolean for color mode toggle
            useColorControls: Math.random() > 0.5,

            // Random tunnel and effect controls
            tunnelExpansion: randomInRange(0.5, 5.0),
            glowIntensity: randomInRange(0.0, 3.0),
        };

        setParams(newParams);
        setHasChanges(true);
        console.log('[SHADER CONTROLS] Randomized all parameters:', newParams);
    };

    // Reset to default values
    const resetToDefaults = () => {
        const defaultParams = {
            // Default color controls
            color1: { r: 0.8, g: 0.2, b: 0.9 }, // Purple-magenta
            color2: { r: 0.1, g: 0.6, b: 0.9 }, // Blue-cyan
            color3: { r: 0.9, g: 0.5, b: 0.1 }, // Orange
            fogColor: { r: 0.15, g: 0.05, b: 0.25 }, // Dark purple
            glowColor: { r: 0.2, g: 0.1, b: 0.3 }, // Purple glow
            // Default camera & movement
            cameraSpeed: 1.2,
            // Default breathing settings
            breathingRate: 2.0,
            breathingAmount: 6.0,
            transientEffect: 0.3,
            colorIntensity: 0.5,
            // Audio effect intensity controls
            energyCameraEffect: 0.05,
            energyColorEffect: 1.0,
            transientCameraEffect: 1.0,
            transientColorEffect: 1.0,
            // Advanced camera movement parameters
            baseCameraSpeed: 1.2,
            maxCameraSpeedBoostFactor: 2.5,
            transientThresholdForSpeedBoost: 0.1,
            energyBoostFactor: 0.05,
            // Timing and smoothing parameters
            cameraSpeedSmoothingDuration: 300,
            colorSmoothingDuration: 1000,
            smoothingDuration: 700,
            // Color mode toggle
            useColorControls: true,
            // Tunnel and effect controls
            tunnelExpansion: 2.5,
            glowIntensity: 1.0,
        };

        setParams(defaultParams);
        setHasChanges(true);
    };

    // Auto-apply changes when component mounts to ensure initial values are applied
    useEffect(() => {
        applyChanges();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className={styles.audioShaderControlsContainer} style={{ width: '100%', padding: '5px' }}>
            <h3 className={styles.controlGroupTitle} style={{ fontSize: '1rem', marginBottom: '8px', paddingBottom: '6px', color: '#FFD700', borderBottom: '1px dashed #00FFFF' }}>
                Visual Controls
            </h3>

            {/* Action buttons at the top */}
            <div className={styles.shaderButtonsContainer} style={{ gap: '6px', marginTop: '6px', marginBottom: '10px', display: 'flex', flexWrap: 'wrap' }}>
                <button
                    onClick={randomizeColors}
                    className={styles.applyShaderButton}
                    style={{ padding: '4px 8px', fontSize: '0.75rem', minWidth: 'auto' }}
                >
                    Randomize Colors
                </button>
                <button
                    onClick={randomizeAllSettings}
                    className={styles.applyShaderButton}
                    style={{ padding: '4px 8px', fontSize: '0.75rem', minWidth: 'auto' }}
                >
                    Randomize All
                </button>
                <button
                    onClick={resetToDefaults}
                    className={styles.clearShaderButton}
                    style={{ padding: '4px 8px', fontSize: '0.75rem', minWidth: 'auto' }}
                >
                    Reset
                </button>
                <button
                    onClick={applyChanges}
                    className={`${styles.applyShaderButton} ${hasChanges ? styles.hasChanges : ''}`}
                    disabled={!hasChanges}
                    style={{ padding: '4px 8px', fontSize: '0.75rem', minWidth: 'auto' }}
                >
                    Apply
                </button>
            </div>

            {/* Audio Sync Mode */}
            <details className={styles.customShaderContainer} style={{ marginTop: '6px', paddingTop: '6px', display: 'block' }} open>
                <summary className={styles.customShaderSummary} style={{ fontSize: '0.85rem', padding: '2px 0', color: '#00FF00', marginBottom: '5px' }}>
                    Audio Sync Mode
                </summary>

                {/* Debug Beat Flash Toggle - prominent at top for debugging */}
                <div className={styles.controlsRow} style={{ marginBottom: '12px', padding: '8px', backgroundColor: debugBeatEnabled ? 'rgba(255, 0, 0, 0.2)' : 'rgba(50, 50, 50, 0.3)', borderRadius: '4px', border: debugBeatEnabled ? '2px solid #FF0000' : '1px dashed #666' }}>
                    <div className={styles.controlGroup} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                        <label className={styles.switchLabel} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}>
                            Debug Beat Flash:
                            <div className={styles.toggleSwitch} style={{ position: 'relative', display: 'inline-block', margin: '0 8px' }}>
                                <input
                                    type="checkbox"
                                    checked={debugBeatEnabled}
                                    onChange={(e) => handleDebugBeatToggle(e.target.checked)}
                                    className={styles.toggleInput}
                                />
                                <span className={styles.toggleSlider}></span>
                            </div>
                            <span className={styles.toggleHint} style={{ fontSize: '0.65rem', opacity: 0.9, fontWeight: 'bold', color: debugBeatEnabled ? '#FF0000' : '#666' }}>
                                {debugBeatEnabled ? 'ON - FLASHING ON BEATS' : 'OFF'}
                            </span>
                        </label>
                        <span style={{ fontSize: '0.65rem', color: '#888', marginTop: '4px' }}>
                            When enabled, screen flashes a random color on each detected beat
                        </span>
                    </div>
                </div>

                {/* DISABLED: Adaptive Mode UI - keeping code for future use
                <div className={styles.controlsRow} style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <div className={styles.controlGroup} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                        <label className={styles.switchLabel} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}>
                            Adaptive Mode:
                            <div className={styles.toggleSwitch} style={{ position: 'relative', display: 'inline-block', margin: '0 8px' }}>
                                <input
                                    type="checkbox"
                                    checked={useAdaptiveMode}
                                    onChange={(e) => handleAdaptiveModeChange(e.target.checked)}
                                    className={styles.toggleInput}
                                />
                                <span className={styles.toggleSlider}></span>
                            </div>
                            <span className={styles.toggleHint} style={{ fontSize: '0.65rem', opacity: 0.8, fontStyle: 'italic', color: useAdaptiveMode ? '#00FF00' : '#FF6600' }}>
                                {useAdaptiveMode ? 'ADAPTIVE (auto-tuning)' : 'LEGACY (threshold-based)'}
                            </span>
                        </label>
                    </div>
                </div>

                {useAdaptiveMode && (
                    <div className={styles.controlsRow} style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap' }}>
                        <div className={styles.controlGroup} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                            <label className={styles.controlLabel} style={{ fontSize: '0.8rem', marginBottom: '3px', color: '#00FFFF' }}>
                                Sensitivity: {adaptiveSensitivity.toFixed(1)}
                                <input
                                    type="range"
                                    min="0.0"
                                    max="1.0"
                                    step="0.1"
                                    value={adaptiveSensitivity}
                                    onChange={(e) => handleSensitivityChange(e.target.value)}
                                    className={styles.rangeInput}
                                    style={{ width: '100%', marginTop: '5px' }}
                                />
                            </label>
                            <span style={{ fontSize: '0.65rem', color: '#888', marginTop: '2px' }}>
                                Low = smooth/global | High = reactive/local
                            </span>
                        </div>
                    </div>
                )}
                */}

                {/* Band Response Multipliers - like afk-ai */}
                <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px dashed #444' }}>
                    <span style={{ fontSize: '0.75rem', color: '#FFD700', fontWeight: 'bold' }}>Band Response (like afk-ai)</span>
                </div>

                <div className={styles.controlsRow} style={{ marginBottom: '6px', marginTop: '8px', display: 'flex', flexWrap: 'wrap' }}>
                    <div className={styles.controlGroup} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                        <label className={styles.controlLabel} style={{ fontSize: '0.8rem', marginBottom: '3px', color: '#FF6B6B' }}>
                            Bass Response: {bassResponse.toFixed(1)}x
                            <input
                                type="range"
                                min="0.0"
                                max="2.0"
                                step="0.1"
                                value={bassResponse}
                                onChange={(e) => handleBassResponseChange(e.target.value)}
                                className={styles.rangeInput}
                                style={{ width: '100%', marginTop: '5px' }}
                            />
                        </label>
                    </div>
                </div>

                <div className={styles.controlsRow} style={{ marginBottom: '6px', display: 'flex', flexWrap: 'wrap' }}>
                    <div className={styles.controlGroup} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                        <label className={styles.controlLabel} style={{ fontSize: '0.8rem', marginBottom: '3px', color: '#4ECDC4' }}>
                            Mid Response: {midResponse.toFixed(1)}x
                            <input
                                type="range"
                                min="0.0"
                                max="1.5"
                                step="0.1"
                                value={midResponse}
                                onChange={(e) => handleMidResponseChange(e.target.value)}
                                className={styles.rangeInput}
                                style={{ width: '100%', marginTop: '5px' }}
                            />
                        </label>
                    </div>
                </div>

                <div className={styles.controlsRow} style={{ marginBottom: '6px', display: 'flex', flexWrap: 'wrap' }}>
                    <div className={styles.controlGroup} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                        <label className={styles.controlLabel} style={{ fontSize: '0.8rem', marginBottom: '3px', color: '#A78BFA' }}>
                            Treble Response: {trebleResponse.toFixed(1)}x
                            <input
                                type="range"
                                min="0.0"
                                max="1.2"
                                step="0.1"
                                value={trebleResponse}
                                onChange={(e) => handleTrebleResponseChange(e.target.value)}
                                className={styles.rangeInput}
                                style={{ width: '100%', marginTop: '5px' }}
                            />
                        </label>
                    </div>
                </div>
            </details>

            {/* Color controls */}
            <details className={styles.customShaderContainer} style={{ marginTop: '6px', paddingTop: '6px', display: 'block' }} open>
                <summary className={styles.customShaderSummary} style={{ fontSize: '0.85rem', padding: '2px 0', color: '#FF00FF', marginBottom: '5px' }}>
                    Color Controls
                </summary>

                <div className={styles.controlsRow} style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <div className={styles.controlGroup} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                        <label className={styles.switchLabel} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}>
                            Use Selected Colors:
                            <div className={styles.toggleSwitch} style={{ position: 'relative', display: 'inline-block', margin: '0 8px' }}>
                                <input
                                    type="checkbox"
                                    checked={params.useColorControls}
                                    onChange={(e) => handleSliderChange('useColorControls', e.target.checked)}
                                    className={styles.toggleInput}
                                />
                                <span className={styles.toggleSlider}></span>
                            </div>
                            <span className={styles.toggleHint} style={{ fontSize: '0.65rem', opacity: 0.8, fontStyle: 'italic', color: '#A0A0F0' }}>
                                {params.useColorControls ? 'ON' : 'OFF'}
                            </span>
                        </label>
                    </div>
                </div>

                <div className={styles.controlsRow} style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <div className={styles.controlGroup} style={{ flex: '1', minWidth: '105px', display: 'flex', flexDirection: 'column' }}>
                        <label className={styles.controlLabel} style={{ fontSize: '0.8rem', marginBottom: '3px', color: '#00FFFF' }}>
                            Primary Color:
                            <input
                                type="color"
                                value={rgbToHex(params.color1.r, params.color1.g, params.color1.b)}
                                onChange={(e) => handleColorChange('color1', e.target.value)}
                                className={styles.colorInput}
                                style={{ width: '25px', height: '25px', verticalAlign: 'middle', marginLeft: '5px' }}
                            />
                        </label>
                    </div>

                    <div className={styles.controlGroup} style={{ flex: '1', minWidth: '105px', display: 'flex', flexDirection: 'column' }}>
                        <label className={styles.controlLabel} style={{ fontSize: '0.8rem', marginBottom: '3px', color: '#00FFFF' }}>
                            Secondary:
                            <input
                                type="color"
                                value={rgbToHex(params.color2.r, params.color2.g, params.color2.b)}
                                onChange={(e) => handleColorChange('color2', e.target.value)}
                                className={styles.colorInput}
                                style={{ width: '25px', height: '25px', verticalAlign: 'middle', marginLeft: '5px' }}
                            />
                        </label>
                    </div>

                    <div className={styles.controlGroup} style={{ flex: '1', minWidth: '105px', display: 'flex', flexDirection: 'column' }}>
                        <label className={styles.controlLabel} style={{ fontSize: '0.8rem', marginBottom: '3px', color: '#00FFFF' }}>
                            Tertiary:
                            <input
                                type="color"
                                value={rgbToHex(params.color3.r, params.color3.g, params.color3.b)}
                                onChange={(e) => handleColorChange('color3', e.target.value)}
                                className={styles.colorInput}
                                style={{ width: '25px', height: '25px', verticalAlign: 'middle', marginLeft: '5px' }}
                            />
                        </label>
                    </div>
                </div>

                <div className={styles.controlsRow} style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <div className={styles.controlGroup} style={{ flex: '1', minWidth: '130px', display: 'flex', flexDirection: 'column' }}>
                        <label className={styles.controlLabel} style={{ fontSize: '0.8rem', marginBottom: '3px', color: '#00FFFF' }}>
                            Fog Color:
                            <input
                                type="color"
                                value={rgbToHex(params.fogColor.r, params.fogColor.g, params.fogColor.b)}
                                onChange={(e) => handleColorChange('fogColor', e.target.value)}
                                className={styles.colorInput}
                                style={{ width: '25px', height: '25px', verticalAlign: 'middle', marginLeft: '5px' }}
                            />
                        </label>
                    </div>

                    <div className={styles.controlGroup} style={{ flex: '1', minWidth: '130px', display: 'flex', flexDirection: 'column' }}>
                        <label className={styles.controlLabel} style={{ fontSize: '0.8rem', marginBottom: '3px', color: '#00FFFF' }}>
                            Glow Color:
                            <input
                                type="color"
                                value={rgbToHex(params.glowColor.r, params.glowColor.g, params.glowColor.b)}
                                onChange={(e) => handleColorChange('glowColor', e.target.value)}
                                className={styles.colorInput}
                                style={{ width: '25px', height: '25px', verticalAlign: 'middle', marginLeft: '5px' }}
                            />
                        </label>
                    </div>
                </div>
            </details>

            {/* Motion and effect controls */}
            <details className={styles.customShaderContainer} style={{ marginTop: '6px', paddingTop: '6px', display: 'block' }} open>
                <summary className={styles.customShaderSummary} style={{ fontSize: '0.85rem', padding: '2px 0', color: '#FF00FF', marginBottom: '5px' }}>
                    Motion & Effects
                </summary>

                {/* Camera Movement Toggle */}
                <div className={styles.controlsRow} style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap' }}>
                    <div className={styles.controlGroup} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                        <label className={styles.switchLabel} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}>
                            Camera Movement:
                            <div className={styles.toggleSwitch} style={{ position: 'relative', display: 'inline-block', margin: '0 8px' }}>
                                <input
                                    type="checkbox"
                                    checked={cameraMovementEnabled}
                                    onChange={(e) => handleCameraMovementToggle(e.target.checked)}
                                    className={styles.toggleInput}
                                />
                                <span className={styles.toggleSlider}></span>
                            </div>
                            <span style={{ fontSize: '0.65rem', color: '#888' }}>
                                {cameraMovementEnabled ? 'ON' : 'OFF'}
                            </span>
                        </label>
                    </div>
                </div>

                {/* Fog/Glow Toggle */}
                <div className={styles.controlsRow} style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap' }}>
                    <div className={styles.controlGroup} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                        <label className={styles.switchLabel} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}>
                            Fog & Glow:
                            <div className={styles.toggleSwitch} style={{ position: 'relative', display: 'inline-block', margin: '0 8px' }}>
                                <input
                                    type="checkbox"
                                    checked={fogGlowEnabled}
                                    onChange={(e) => handleFogGlowToggle(e.target.checked)}
                                    className={styles.toggleInput}
                                />
                                <span className={styles.toggleSlider}></span>
                            </div>
                            <span style={{ fontSize: '0.65rem', color: '#888' }}>
                                {fogGlowEnabled ? 'ON' : 'OFF'}
                            </span>
                        </label>
                    </div>
                </div>

                {/* Tunnel Expansion Slider */}
                <div className={styles.controlsRow} style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap' }}>
                    <div className={styles.controlGroup} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                        <label className={styles.controlLabel} style={{ fontSize: '0.8rem', marginBottom: '3px', color: '#00FFFF' }}>
                            Tunnel Expansion: {params.tunnelExpansion.toFixed(1)}
                            <input
                                type="range"
                                min="0.5"
                                max="5.0"
                                step="0.1"
                                value={params.tunnelExpansion}
                                onChange={(e) => handleSliderChange('tunnelExpansion', e.target.value)}
                                className={styles.rangeInput}
                                style={{ width: '100%', marginTop: '5px' }}
                            />
                        </label>
                    </div>
                </div>

                {/* Glow Intensity Slider */}
                <div className={styles.controlsRow} style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap' }}>
                    <div className={styles.controlGroup} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                        <label className={styles.controlLabel} style={{ fontSize: '0.8rem', marginBottom: '3px', color: '#00FFFF' }}>
                            Glow Intensity: {params.glowIntensity.toFixed(1)}
                            <input
                                type="range"
                                min="0.0"
                                max="3.0"
                                step="0.1"
                                value={params.glowIntensity}
                                onChange={(e) => handleSliderChange('glowIntensity', e.target.value)}
                                className={styles.rangeInput}
                                style={{ width: '100%', marginTop: '5px' }}
                            />
                        </label>
                    </div>
                </div>

                {/* Breathing Rate Slider */}
                <div className={styles.controlsRow} style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap' }}>
                    <div className={styles.controlGroup} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                        <label className={styles.controlLabel} style={{ fontSize: '0.8rem', marginBottom: '3px', color: '#00FFFF' }}>
                            Breathing Rate: {params.breathingRate.toFixed(1)}
                            <input
                                type="range"
                                min="0.0"
                                max="5.0"
                                step="0.1"
                                value={params.breathingRate}
                                onChange={(e) => handleSliderChange('breathingRate', e.target.value)}
                                className={styles.rangeInput}
                                style={{ width: '100%', marginTop: '5px' }}
                            />
                        </label>
                    </div>
                </div>

                {/* Breathing Amount Slider */}
                <div className={styles.controlsRow} style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap' }}>
                    <div className={styles.controlGroup} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                        <label className={styles.controlLabel} style={{ fontSize: '0.8rem', marginBottom: '3px', color: '#00FFFF' }}>
                            Breathing Amount: {params.breathingAmount.toFixed(1)}
                            <input
                                type="range"
                                min="0.0"
                                max="15.0"
                                step="0.5"
                                value={params.breathingAmount}
                                onChange={(e) => handleSliderChange('breathingAmount', e.target.value)}
                                className={styles.rangeInput}
                                style={{ width: '100%', marginTop: '5px' }}
                            />
                        </label>
                    </div>
                </div>

                <div className={styles.controlsRow} style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap' }}>
                    <div className={styles.controlGroup} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                        <label className={styles.controlLabel} style={{ fontSize: '0.8rem', marginBottom: '3px', color: '#00FFFF' }}>
                            Camera Speed: {params.cameraSpeed.toFixed(2)}
                            <input
                                type="range"
                                min="0.5"
                                max="3.0"
                                step="0.1"
                                value={params.cameraSpeed}
                                onChange={(e) => handleSliderChange('cameraSpeed', e.target.value)}
                                className={styles.rangeInput}
                                style={{ width: '100%', marginTop: '5px' }}
                            />
                        </label>
                    </div>
                </div>

                <div className={styles.controlsRow} style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap' }}>
                    <div className={styles.controlGroup} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                        <label className={styles.controlLabel} style={{ fontSize: '0.8rem', marginBottom: '3px', color: '#00FFFF' }}>
                            Transient Effect: {params.transientEffect.toFixed(1)}
                            <input
                                type="range"
                                min="0.0"
                                max="1.0"
                                step="0.1"
                                value={params.transientEffect}
                                onChange={(e) => handleSliderChange('transientEffect', e.target.value)}
                                className={styles.rangeInput}
                                style={{ width: '100%', marginTop: '5px' }}
                            />
                        </label>
                    </div>
                </div>

                <div className={styles.controlsRow} style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap' }}>
                    <div className={styles.controlGroup} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                        <label className={styles.controlLabel} style={{ fontSize: '0.8rem', marginBottom: '3px', color: '#00FFFF' }}>
                            Color Intensity: {params.colorIntensity.toFixed(2)}
                            <input
                                type="range"
                                min="0.0"
                                max="1.0"
                                step="0.01"
                                value={params.colorIntensity}
                                onChange={(e) => handleSliderChange('colorIntensity', e.target.value)}
                                className={styles.rangeInput}
                                style={{ width: '100%', marginTop: '5px' }}
                            />
                        </label>
                    </div>
                </div>
            </details>

            {/* Remaining controls sections are hidden by default to focus on the most important ones */}
            <details className={styles.customShaderContainer} style={{ marginTop: '6px', paddingTop: '6px', display: 'block' }}>
                <summary className={styles.customShaderSummary} style={{ fontSize: '0.85rem', padding: '2px 0', color: '#FF00FF', marginBottom: '5px' }}>
                    Audio Effect Intensity
                </summary>
                <div className={styles.controlsRow} style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap' }}>
                    <div className={styles.controlGroup} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                        <label className={styles.controlLabel} style={{ fontSize: '0.8rem', marginBottom: '3px', color: '#00FFFF' }}>
                            Energy Camera Effect: {params.energyCameraEffect.toFixed(3)}
                            <input
                                type="range"
                                min="0.000"
                                max="0.010"
                                step="0.001"
                                value={params.energyCameraEffect}
                                onChange={(e) => handleSliderChange('energyCameraEffect', e.target.value)}
                                className={styles.rangeInput}
                                style={{ width: '100%', marginTop: '5px' }}
                            />
                        </label>
                    </div>
                </div>
                <div className={styles.controlsRow} style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap' }}>
                    <div className={styles.controlGroup} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                        <label className={styles.controlLabel} style={{ fontSize: '0.8rem', marginBottom: '3px', color: '#00FFFF' }}>
                            Energy Color Effect: {params.energyColorEffect.toFixed(1)}
                            <input
                                type="range"
                                min="0.0"
                                max="1.0"
                                step="0.1"
                                value={params.energyColorEffect}
                                onChange={(e) => handleSliderChange('energyColorEffect', e.target.value)}
                                className={styles.rangeInput}
                                style={{ width: '100%', marginTop: '5px' }}
                            />
                        </label>
                    </div>
                </div>
                <div className={styles.controlsRow} style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap' }}>
                    <div className={styles.controlGroup} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                        <label className={styles.controlLabel} style={{ fontSize: '0.8rem', marginBottom: '3px', color: '#00FFFF' }}>
                            Transient Camera Effect: {params.transientCameraEffect.toFixed(3)}
                            <input
                                type="range"
                                min="0.0"
                                max="0.2"
                                step="0.001"
                                value={params.transientCameraEffect}
                                onChange={(e) => handleSliderChange('transientCameraEffect', e.target.value)}
                                className={styles.rangeInput}
                                style={{ width: '100%', marginTop: '5px' }}
                            />
                        </label>
                    </div>
                </div>
                <div className={styles.controlsRow} style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap' }}>
                    <div className={styles.controlGroup} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                        <label className={styles.controlLabel} style={{ fontSize: '0.8rem', marginBottom: '3px', color: '#00FFFF' }}>
                            Transient Color Effect: {params.transientColorEffect.toFixed(1)}
                            <input
                                type="range"
                                min="0.0"
                                max="1.0"
                                step="0.1"
                                value={params.transientColorEffect}
                                onChange={(e) => handleSliderChange('transientColorEffect', e.target.value)}
                                className={styles.rangeInput}
                                style={{ width: '100%', marginTop: '5px' }}
                            />
                        </label>
                    </div>
                </div>
            </details>

            <details className={styles.customShaderContainer} style={{ marginTop: '6px', paddingTop: '6px', display: 'block' }}>
                <summary className={styles.customShaderSummary} style={{ fontSize: '0.85rem', padding: '2px 0', color: '#FF00FF', marginBottom: '5px' }}>
                    Advanced Camera Movement
                </summary>
                <div className={styles.controlsRow} style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap' }}>
                    <div className={styles.controlGroup} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                        <label className={styles.controlLabel} style={{ fontSize: '0.8rem', marginBottom: '3px', color: '#00FFFF' }}>
                            Base Camera Speed: {params.baseCameraSpeed.toFixed(1)}
                            <input
                                type="range"
                                min="0.5"
                                max="3.0"
                                step="0.1"
                                value={params.baseCameraSpeed}
                                onChange={(e) => handleSliderChange('baseCameraSpeed', e.target.value)}
                                className={styles.rangeInput}
                                style={{ width: '100%', marginTop: '5px' }}
                            />
                        </label>
                    </div>
                </div>
                <div className={styles.controlsRow} style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap' }}>
                    <div className={styles.controlGroup} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                        <label className={styles.controlLabel} style={{ fontSize: '0.8rem', marginBottom: '3px', color: '#00FFFF' }}>
                            Max Speed Boost Factor: {params.maxCameraSpeedBoostFactor.toFixed(1)}
                            <input
                                type="range"
                                min="1.0"
                                max="5.0"
                                step="0.1"
                                value={params.maxCameraSpeedBoostFactor}
                                onChange={(e) => handleSliderChange('maxCameraSpeedBoostFactor', e.target.value)}
                                className={styles.rangeInput}
                                style={{ width: '100%', marginTop: '5px' }}
                            />
                        </label>
                    </div>
                </div>
                <div className={styles.controlsRow} style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap' }}>
                    <div className={styles.controlGroup} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                        <label className={styles.controlLabel} style={{ fontSize: '0.8rem', marginBottom: '3px', color: '#00FFFF' }}>
                            Transient Threshold: {params.transientThresholdForSpeedBoost.toFixed(2)}
                            <input
                                type="range"
                                min="0.0"
                                max="0.5"
                                step="0.01"
                                value={params.transientThresholdForSpeedBoost}
                                onChange={(e) => handleSliderChange('transientThresholdForSpeedBoost', e.target.value)}
                                className={styles.rangeInput}
                                style={{ width: '100%', marginTop: '5px' }}
                            />
                        </label>
                    </div>
                </div>
                <div className={styles.controlsRow} style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap' }}>
                    <div className={styles.controlGroup} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                        <label className={styles.controlLabel} style={{ fontSize: '0.8rem', marginBottom: '3px', color: '#00FFFF' }}>
                            Energy Boost Factor: {params.energyBoostFactor.toFixed(2)}
                            <input
                                type="range"
                                min="0.0"
                                max="0.3"
                                step="0.01"
                                value={params.energyBoostFactor}
                                onChange={(e) => handleSliderChange('energyBoostFactor', e.target.value)}
                                className={styles.rangeInput}
                                style={{ width: '100%', marginTop: '5px' }}
                            />
                        </label>
                    </div>
                </div>
            </details>

            <details className={styles.customShaderContainer} style={{ marginTop: '6px', paddingTop: '6px', display: 'block' }}>
                <summary className={styles.customShaderSummary} style={{ fontSize: '0.85rem', padding: '2px 0', color: '#FF00FF', marginBottom: '5px' }}>
                    Timing & Smoothing
                </summary>
                <div className={styles.controlsRow} style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap' }}>
                    <div className={styles.controlGroup} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                        <label className={styles.controlLabel} style={{ fontSize: '0.8rem', marginBottom: '3px', color: '#00FFFF' }}>
                            Camera Speed Smoothing: {params.cameraSpeedSmoothingDuration}ms
                            <input
                                type="range"
                                min="100"
                                max="1000"
                                step="50"
                                value={params.cameraSpeedSmoothingDuration}
                                onChange={(e) => handleSliderChange('cameraSpeedSmoothingDuration', e.target.value)}
                                className={styles.rangeInput}
                                style={{ width: '100%', marginTop: '5px' }}
                            />
                        </label>
                    </div>
                </div>
                <div className={styles.controlsRow} style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap' }}>
                    <div className={styles.controlGroup} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                        <label className={styles.controlLabel} style={{ fontSize: '0.8rem', marginBottom: '3px', color: '#00FFFF' }}>
                            Color Smoothing: {params.colorSmoothingDuration}ms
                            <input
                                type="range"
                                min="200"
                                max="2000"
                                step="100"
                                value={params.colorSmoothingDuration}
                                onChange={(e) => handleSliderChange('colorSmoothingDuration', e.target.value)}
                                className={styles.rangeInput}
                                style={{ width: '100%', marginTop: '5px' }}
                            />
                        </label>
                    </div>
                </div>
                <div className={styles.controlsRow} style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap' }}>
                    <div className={styles.controlGroup} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                        <label className={styles.controlLabel} style={{ fontSize: '0.8rem', marginBottom: '3px', color: '#00FFFF' }}>
                            General Smoothing: {params.smoothingDuration}ms
                            <input
                                type="range"
                                min="200"
                                max="1500"
                                step="100"
                                value={params.smoothingDuration}
                                onChange={(e) => handleSliderChange('smoothingDuration', e.target.value)}
                                className={styles.rangeInput}
                                style={{ width: '100%', marginTop: '5px' }}
                            />
                        </label>
                    </div>
                </div>
            </details>
        </div>
    );
};

export default AudioShaderControls; 