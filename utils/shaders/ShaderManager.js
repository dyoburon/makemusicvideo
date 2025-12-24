/**
 * Shader management utility
 * Handles loading, compilation and hot-swapping of shader programs
 */

// Import shaders
import vortexShaderSource from './VortexShader.js';
import retroTunnelShaderSource from './RetroTunnelShader.js';
import oceanDepthsVortexShaderSource from './OceanDepthsVortexShader.js';
import neonBarShaderSource from './NeonBarShader.js';
import simplexShaderSource from './SimplexShader.js';
import convertedAbstractSpiralShaderSource from './ConvertedAbstractSpiralShader.js';
import ghostlySpiritsShaderSource from './GhostlySpiritsShader.js';
import nebulousTunnelShaderSource from './NebulousTunnelShader.js';
import fireShaderSource from './FireShader.js';
import mountainWavesShaderSource from './MountainWaves.js';
import neonTowerShaderSource from './NeonTower.js';
import neonCubesShaderSource from './NeonCubes.js';
import dreamyCubesShaderSource from './DreamyCubes.js';
import colorfulSwirlsShaderSource from './ColorfulSwirls.js';
import greenFractalsShaderSource from './GreenFractals.js';
import colorfulCirclesShaderSource from './ColorfulCircles.js';
import emergingCityShaderSource from './EmergingCity.js';
import emergingAbstractShapesShaderSource from './EmergingAbstractShapes.js';
import colorfulWorldShaderSource from './ColorfulWorld.js';
import colorfulSidewaysCityShaderSource from './ColorfulSidewaysCity.js';
import waveformShaderSrc from './Waveform.js'
import { getAdaptiveNormalizer, getAdaptiveValuesAtTime } from '../audio/adaptiveAudioNormalizer';

// Collection of predefined shaders
const shaderLibrary = {

    // Retro neon tunnel shader
    retroTunnel: {
        name: 'Retro Neon Tunnel',
        fragSrc: retroTunnelShaderSource
    },

    // Added new Ocean Depths Vortex shader
    oceanDepthsVortex: {
        name: 'Ocean Depths Vortex',
        fragSrc: oceanDepthsVortexShaderSource
    },

    // Added new Neon Bar shader
    neonBar: {
        name: 'Neon Bar',
        fragSrc: neonBarShaderSource
    },

    // Added new Simplex shader
    simplex: {
        name: 'Simplex',
        fragSrc: simplexShaderSource
    },

    // Added Fire Tornado shader
    fireTornado: {
        name: 'Fire Tornado',
        fragSrc: convertedAbstractSpiralShaderSource
    },

    // Added new Ghostly Spirits shader
    ghostlySpirits: {
        name: 'Ghostly Spirits',
        fragSrc: ghostlySpiritsShaderSource
    },
    NebulousTunnel: {
        name: 'Nebulous Tunnel',
        fragSrc: nebulousTunnelShaderSource
    },
    MountainWaves: {
        name: 'Mountain Waves',
        fragSrc: mountainWavesShaderSource
    },
    NeonTower: {
        name: 'Neon Tower',
        fragSrc: neonTowerShaderSource
    },
    NeonCubes: {
        name: 'Neon Cubes',
        fragSrc: neonCubesShaderSource
    },
    DreamyCubes: {
        name: 'Dreamy Cubes',
        fragSrc: dreamyCubesShaderSource
    },
    ColorfulSwirls: {
        name: 'Colorful Swirls',
        fragSrc: colorfulSwirlsShaderSource
    },
    GreenFractals: {
        name: 'Green Fractals',
        fragSrc: greenFractalsShaderSource
    },
    ColorfulCircles: {
        name: 'Colorful Circles',
        fragSrc: colorfulCirclesShaderSource
    },
    EmergingCity: {
        name: 'Emerging City',
        fragSrc: emergingCityShaderSource
    },
    EmergingAbstractShapes: {
        name: 'Emerging Abstract Shapes',
        fragSrc: emergingAbstractShapesShaderSource
    },
    ColorfulWorld: {
        name: 'Colorful World',
        fragSrc: colorfulWorldShaderSource
    },
    ColorfulSidewaysCity: {
        name: 'Colorful Sideways City',
        fragSrc: colorfulSidewaysCityShaderSource
    },
    Waveform: {
        name: 'Waveform',
        fragSrc: waveformShaderSrc
    }
};

// Path to custom shader
const CUSTOM_SHADER_PATH = '/utils/shaders/CustomAudioShader.glsl';

/**
 * Load a shader by name from the library
 * @param {string} name - Name of the shader to load
 * @returns {Object|null} - Shader object or null if not found
 */
export function loadLibraryShader(name) {
    console.log(`[SHADER MGR DEBUG] loadLibraryShader called for '${name}'`);
    const shader = shaderLibrary[name];

    if (!shader) {
        console.warn(`[SHADER MGR ERROR] Shader '${name}' not found in library`);
        return null;
    }

    // Log shader details for debugging
    console.log(`[SHADER MGR DEBUG] Found shader: ${shader.name}, source length: ${shader.fragSrc ? shader.fragSrc.length : 'undefined'}`);

    // If the shader needs to be loaded from file
    if (shader.dynamicLoad && shader.path) {
        console.log(`[SHADER MGR DEBUG] Loading dynamic shader from path: ${shader.path}`);
        return {
            ...shader,
            getFragSrc: async () => {
                return await loadShaderFromURL(shader.path);
            }
        };
    }

    // Return a new object to avoid reference issues
    console.log('[SHADER MGR DEBUG] Returning static shader object');
    return {
        id: name,
        name: shader.name,
        fragSrc: shader.fragSrc
    };
}

/**
 * Load a shader from URL
 * @param {string} url - URL to shader file
 * @returns {Promise<string>} - Promise resolving to shader source
 */
export async function loadShaderFromURL(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load shader from ${url}: ${response.statusText}`);
        }
        return await response.text();
    } catch (error) {
        console.error('Error loading shader:', error);
        throw error;
    }
}

/**
 * Load the custom audio shader
 * @returns {Promise<string>} - Promise resolving to shader source
 */
export async function loadCustomAudioShader() {
    return loadShaderFromURL(CUSTOM_SHADER_PATH);
}

/**
 * Get all available library shaders
 * @returns {Array} - Array of shader names and descriptions
 */
export function getAvailableShaders() {
    return Object.entries(shaderLibrary).map(([id, shader]) => ({
        id,
        name: shader.name || id
    }));
}

/**
 * Process audio data for shader uniforms
 * @param {Object} audioData - Audio analysis data from AudioAnalyzer
 * @returns {Object} - Processed uniform data
 */
export function processAudioDataForShader(audioData) {
    const processStart = performance.now();
    // Cache results to avoid excessive processing
    if (!processAudioDataForShader.lastResult) {
        processAudioDataForShader.lastResult = null;
        processAudioDataForShader.lastTimeStamp = 0;
        processAudioDataForShader.useAdaptive = true; // Default to adaptive mode
        console.log('[AUDIO PROC DEBUG] Initializing audio processor cache');
    }

    // Don't process too frequently
    const now = Date.now();
    if (processAudioDataForShader.lastResult && now - processAudioDataForShader.lastTimeStamp < 16) {
        return processAudioDataForShader.lastResult;
    }

    // Add less verbose debugging for the input data
    if (!processAudioDataForShader.frameCount) {
        processAudioDataForShader.frameCount = 0;
    }
    processAudioDataForShader.frameCount++;

    const currentTime = audioData?.currentTime || 0;

    // Try adaptive normalizer first if enabled and initialized
    const normalizer = getAdaptiveNormalizer();
    if (processAudioDataForShader.useAdaptive && normalizer.isInitialized) {
        const adaptiveResult = getAdaptiveValuesAtTime(currentTime);

        if (processAudioDataForShader.frameCount % 60 === 0) {
            console.log(`[AUDIO PROC ADAPTIVE] time=${currentTime.toFixed(2)}, E=${adaptiveResult.energy.toFixed(2)}, L=${adaptiveResult.lowEnergy.toFixed(2)}, H=${adaptiveResult.highEnergy.toFixed(2)}, T=${adaptiveResult.transients.toFixed(2)}`);
        }

        processAudioDataForShader.lastResult = adaptiveResult;
        processAudioDataForShader.lastTimeStamp = now;
        return adaptiveResult;
    }

    // Fall back to legacy threshold-based processing
    // Basic validation - FIXED: Changed from audioData.analysis.timeline to audioData.timeline
    if (!audioData || !audioData.timeline) {
        if (processAudioDataForShader.frameCount % 60 === 0) {
            console.warn('[AUDIO PROC DEBUG] Invalid audio data structure', {
                hasAudioData: !!audioData,
                hasTimeline: audioData ? !!audioData.timeline : false
            });
        }
        return {
            energy: 0.5,
            lowEnergy: 0.5,
            highEnergy: 0.5,
            transients: 0
        };
    }

    // Find the most recent events for different categories
    const timeline = audioData.timeline; // FIXED: Changed from audioData.analysis.timeline

    // Only log processing details every 60 frames
    if (processAudioDataForShader.frameCount % 60 === 0) {
        console.log(`[AUDIO PROC DETAILED] Processing timeline with ${timeline.length} events at time ${currentTime.toFixed(2)}`);

        // Sample a few events to see their structure
        if (timeline.length > 0) {
            console.log('[AUDIO PROC DETAILED] Sample timeline events:');
            const sampleEvents = timeline.slice(0, 3);
            sampleEvents.forEach((event, i) => {
                console.log(`  Event ${i}:`, {
                    type: event.type,
                    time: event.time,
                    intensity: event.intensity,
                    dominantBand: event.dominantBand,
                    value: event.value
                });
            });

            // Also check event times around current time
            const nearbyEvents = timeline.filter(event => Math.abs(event.time - currentTime) < 2.0);
            console.log(`[AUDIO PROC DETAILED] Found ${nearbyEvents.length} events within 2s of current time`);
            if (nearbyEvents.length > 0) {
                console.log('[AUDIO PROC DETAILED] Nearby events:', nearbyEvents.slice(0, 3));
            }
        }
    }

    // Process recent events to get current audio state
    let lowEnergy = 0.5;
    let highEnergy = 0.5;
    let transientIntensity = 0;

    // Look for recent transients
    const recentTransients = timeline.filter(event =>
        event.type === 'transient' &&
        event.time <= currentTime &&
        currentTime - event.time < 0.1 // Changed back to 100ms window to match afk-ai
    );

    // Only log dynamics when found or every 60 frames
    if (recentTransients.length > 0 || processAudioDataForShader.frameCount % 60 === 0) {
        console.log(`[AUDIO PROC DETAILED] Found ${recentTransients.length} recent transients`);
        if (recentTransients.length > 0) {
            console.log('[AUDIO PROC DETAILED] Sample transient:', recentTransients[0]);
        }
    }

    let mostIntenseTransientTime = currentTime; // Default if no transients

    if (recentTransients.length > 0) {
        // Use the most intense recent transient
        const mostIntense = recentTransients.reduce(
            (prev, current) => current.intensity > prev.intensity ? current : prev,
            recentTransients[0]
        );

        transientIntensity = mostIntense.intensity;
        mostIntenseTransientTime = mostIntense.time; // Store the time of the actual most intense transient

        // Only log very intense transients or during debug frames
        if (mostIntense.intensity > 0.5 || processAudioDataForShader.frameCount % 600 === 0) {
            console.log(`[AUDIO PROC DETAILED] Most intense transient: intensity=${mostIntense.intensity}, time=${mostIntense.time}, band=${mostIntense.dominantBand}`);
        }

        // Set band-specific energy based on the dominant band
        if (mostIntense.dominantBand === 'low') {
            lowEnergy = 0.5 + (mostIntense.intensity * 0.5); // Scale to 0.5-1.0
        } else if (mostIntense.dominantBand === 'high') {
            highEnergy = 0.5 + (mostIntense.intensity * 0.5); // Scale to 0.5-1.0
        }
    }

    // Find recent dynamic changes for overall energy
    const recentDynamics = timeline.filter(event =>
        event.type.startsWith('dynamic_') &&
        event.time <= currentTime &&
        currentTime - event.time < 0.3 // Changed to 300ms to match afk-ai
    );

    // Only log dynamics when found or every 60 frames
    if (recentDynamics.length > 0 || processAudioDataForShader.frameCount % 60 === 0) {
        console.log(`[AUDIO PROC DETAILED] Found ${recentDynamics.length} recent dynamics`);
        if (recentDynamics.length > 0) {
            console.log('[AUDIO PROC DETAILED] Sample dynamic:', recentDynamics[0]);
        }

        // Also check what event types exist in the timeline
        if (processAudioDataForShader.frameCount % 60 === 0) {
            const eventTypes = [...new Set(timeline.map(e => e.type))];
            console.log('[AUDIO PROC DETAILED] Available event types in timeline:', eventTypes);
        }
    }

    let energy = 0.5; // Default energy

    if (recentDynamics.length > 0) {
        // Use the most intense dynamic change
        const mostIntense = recentDynamics.reduce(
            (prev, current) => current.intensity > prev.intensity ? current : prev,
            recentDynamics[0]
        );

        // Scale intensity to 0.5-1.0
        energy = 0.5 + (mostIntense.intensity * 0.5);

        // Only log dynamics when found or every 60 frames
        if (processAudioDataForShader.frameCount % 60 === 0) {
            console.log(`[AUDIO PROC DETAILED] Most intense dynamic: intensity=${mostIntense.intensity}, energy=${energy}`);
        }
    }

    // Decay values over time for smoother transitions
    const timeFromActiveTransient = currentTime - mostIntenseTransientTime;

    // Decay over ~0.4 seconds (1.0 / 2.5 = 0.4s). Adjust 2.5 to change decay speed.
    const transientDecay = recentTransients.length > 0 ? Math.max(0, 1.0 - (timeFromActiveTransient * 2.5)) : 0;

    const result = {
        energy,
        lowEnergy,
        highEnergy,
        transients: transientIntensity * transientDecay, // transientIntensity will be 0 if no recent transients
        time: currentTime
    };

    // Only log final result every 60 frames
    if (processAudioDataForShader.frameCount % 60 === 0) {
        console.log(`[AUDIO PROC DETAILED] Final result: E=${result.energy.toFixed(2)}, L=${result.lowEnergy.toFixed(2)}, H=${result.highEnergy.toFixed(2)}, T=${result.transients.toFixed(2)}`);
    }

    const processEnd = performance.now();
    const processTime = processEnd - processStart;

    // Only log slow processing times to avoid console spam
    if (processTime > 5) {
        console.log(`[AUDIO PROC DEBUG] Audio processing took ${processTime.toFixed(2)}ms`);
    }

    // Main logging is now handled at the beginning of the function to avoid double counting
    if (processAudioDataForShader.frameCount % 60 === 0) {
        console.log(`[AUDIO PROC DEBUG] Energy values - E:${result.energy.toFixed(2)}, ` +
            `L:${result.lowEnergy.toFixed(2)}, H:${result.highEnergy.toFixed(2)}, ` +
            `T:${result.transients.toFixed(2)}`);
    }

    processAudioDataForShader.lastResult = result;
    processAudioDataForShader.lastTimeStamp = now;
    return result;
}

/**
 * Updates shader parameters in the smoothed state
 * This function allows external components to directly control shader parameters
 * without resetting the animation
 * 
 * @param {Object} params - The parameters to update (color1, color2, etc)
 * @returns {Object} - The updated parameters
 */
export function updateShaderParams(params) {
    // Lazy import to avoid circular dependency
    let smoothedValues;
    try {
        const shaderUpdateModule = require('./ShaderUpdate');
        smoothedValues = shaderUpdateModule.smoothedValues;
    } catch (error) {
        console.warn('[SHADER MANAGER] Could not access smoothedValues:', error.message);
        return params; // Return early if we can't access smoothedValues
    }

    if (!smoothedValues) {
        console.warn('[SHADER MANAGER] smoothedValues not available');
        return params;
    }

    const now = Date.now();

    // Update color parameters
    if (params.color1) {
        smoothedValues.color1.r.target = params.color1.r;
        smoothedValues.color1.g.target = params.color1.g;
        smoothedValues.color1.b.target = params.color1.b;
    }

    if (params.color2) {
        smoothedValues.color2.r.target = params.color2.r;
        smoothedValues.color2.g.target = params.color2.g;
        smoothedValues.color2.b.target = params.color2.b;
    }

    if (params.color3) {
        smoothedValues.color3.r.target = params.color3.r;
        smoothedValues.color3.g.target = params.color3.g;
        smoothedValues.color3.b.target = params.color3.b;
    }

    if (params.fogColor) {
        smoothedValues.fogColor.r.target = params.fogColor.r;
        smoothedValues.fogColor.g.target = params.fogColor.g;
        smoothedValues.fogColor.b.target = params.fogColor.b;
    }

    if (params.glowColor) {
        smoothedValues.glowColor.r.target = params.glowColor.r;
        smoothedValues.glowColor.g.target = params.glowColor.g;
        smoothedValues.glowColor.b.target = params.glowColor.b;
    }

    // Update scalar parameters
    if (params.cameraSpeed !== undefined) {
        smoothedValues.cameraSpeed.target = params.cameraSpeed;
    }

    // Update effect intensity parameters
    if (params.transientEffect !== undefined) {
        smoothedValues.transientEffect.target = params.transientEffect;
    }

    if (params.colorIntensity !== undefined) {
        smoothedValues.colorIntensity.target = params.colorIntensity;
    }

    // Update audio effect intensity parameters
    if (params.energyCameraEffect !== undefined) {
        smoothedValues.energyCameraEffect.target = params.energyCameraEffect;
    }

    if (params.energyColorEffect !== undefined) {
        smoothedValues.energyColorEffect.target = params.energyColorEffect;
    }

    if (params.transientCameraEffect !== undefined) {
        smoothedValues.transientCameraEffect.target = params.transientCameraEffect;
    }

    if (params.transientColorEffect !== undefined) {
        smoothedValues.transientColorEffect.target = params.transientColorEffect;
    }

    // Update advanced camera movement parameters
    if (params.baseCameraSpeed !== undefined) {
        smoothedValues.baseCameraSpeed.target = params.baseCameraSpeed;
    }

    if (params.maxCameraSpeedBoostFactor !== undefined) {
        smoothedValues.maxCameraSpeedBoostFactor.target = params.maxCameraSpeedBoostFactor;
    }

    if (params.transientThresholdForSpeedBoost !== undefined) {
        smoothedValues.transientThresholdForSpeedBoost.target = params.transientThresholdForSpeedBoost;
    }

    if (params.energyBoostFactor !== undefined) {
        smoothedValues.energyBoostFactor.target = params.energyBoostFactor;
    }

    // Update timing and smoothing parameters
    if (params.cameraSpeedSmoothingDuration !== undefined) {
        smoothedValues.cameraSpeedSmoothingDuration.target = params.cameraSpeedSmoothingDuration;
    }

    if (params.colorSmoothingDuration !== undefined) {
        smoothedValues.colorSmoothingDuration.target = params.colorSmoothingDuration;
    }

    if (params.smoothingDuration !== undefined) {
        smoothedValues.smoothingDuration.target = params.smoothingDuration;
    }

    // Update breathing parameters
    if (params.breathingRate !== undefined) {
        smoothedValues.breathingRate.target = params.breathingRate;
        console.log(`[SHADER MANAGER] Updated breathingRate to ${params.breathingRate}`);
    }

    if (params.breathingAmount !== undefined) {
        smoothedValues.breathingAmount.target = params.breathingAmount;
        console.log(`[SHADER MANAGER] Updated breathingAmount to ${params.breathingAmount}`);
    }

    // Update color mode toggle
    if (params.useColorControls !== undefined) {
        smoothedValues.useColorControls.target = params.useColorControls;
    }

    console.log('[SHADER MANAGER] Updated shader parameters:', params);

    // Return updated parameters for reference
    return params;
}

/**
 * Toggle between adaptive and legacy audio processing modes
 * @param {boolean} useAdaptive - True for adaptive mode, false for legacy
 */
export function setAdaptiveMode(useAdaptive) {
    processAudioDataForShader.useAdaptive = useAdaptive;
    console.log(`[SHADER MGR] Audio processing mode: ${useAdaptive ? 'ADAPTIVE' : 'LEGACY'}`);
}

/**
 * Check if adaptive mode is currently enabled
 * @returns {boolean}
 */
export function isAdaptiveModeEnabled() {
    return processAudioDataForShader.useAdaptive !== false;
}

export default {
    loadLibraryShader,
    loadShaderFromURL,
    loadCustomAudioShader,
    getAvailableShaders,
    processAudioDataForShader,
    shaderLibrary,
    updateShaderParams,
    setAdaptiveMode,
    isAdaptiveModeEnabled
}; 