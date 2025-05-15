import React, { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import ShaderVisualizer from '../components/ShaderVisualizer';
import ShaderManager from '../utils/shaders/ShaderManager';
import AudioAnalysisManager from '../utils/audio/AudioAnalysisManager';
import AudioShaderControls from '../components/AudioShaderControls';
import ShaderEditor from '../components/ShaderEditor';
import styles from '../styles/AudioShaderSync.module.css';

const AudioShaderSync = () => {
    const [audioState, setAudioState] = useState({
        audioFile: null,
        audioAnalysis: null,
        isPlaying: false,
        currentTime: 0,
        isAnalyzing: false,
        isLooping: false
    });
    const [selectedShader, setSelectedShader] = useState('ghostlySpirits');
    const [shaderUniforms, setShaderUniforms] = useState(null);
    const [availableShaders, setAvailableShaders] = useState([]);
    const [customShader, setCustomShader] = useState(null);
    const [tempCustomShader, setTempCustomShader] = useState('');
    const [currentShaderSrc, setCurrentShaderSrc] = useState(null);
    const [isLoadingShader, setIsLoadingShader] = useState(false);
    const [shaderParams, setShaderParams] = useState({
        color1: { r: 0.4, g: 1.0, b: 0.2 },
        color2: { r: 0.2, g: 1.0, b: 0.8 },
        color3: { r: 1.0, g: 0.2, b: 0.8 },
        fogColor: { r: 0.1, g: 0.05, b: 0.15 },
        glowColor: { r: 0.1, g: 0.05, b: 0.2 },
        cameraSpeed: 1.2,
        transientEffect: 0.3,
        colorIntensity: 0.5
    });

    const audioRef = useRef(null);
    const fileInputRef = useRef(null);

    // Subscribe to AudioAnalysisManager
    useEffect(() => {
        console.log('[AUDIO SYNC] Setting up AudioAnalysisManager subscription');
        const unsubscribe = AudioAnalysisManager.subscribe(newState => {
            setAudioState(prevState => ({ ...prevState, ...newState }));
            console.log('[AUDIO SYNC] Received audio state update:',
                `isPlaying: ${newState.isPlaying}, `,
                `currentTime: ${newState.currentTime !== undefined ? newState.currentTime.toFixed(2) : 'N/A'}`);
        });

        return unsubscribe;
    }, []);

    // Effect to manage audio playback state and listeners
    useEffect(() => {
        if (audioRef.current) {
            console.log('[AUDIO SYNC] Audio ref available. Setting up listeners and managing playback.');
            const timeUpdateCleanup = AudioAnalysisManager.setupTimeUpdateListener(audioRef.current);
            const endedEventCleanup = AudioAnalysisManager.setupEndedEventListener(audioRef.current);

            // Sync audio element's loop property with state
            audioRef.current.loop = audioState.isLooping;

            if (audioState.audioFile && audioState.isPlaying && audioRef.current.paused) {
                console.log('[AUDIO SYNC] Attempting to play audio as state indicates playing and audio is loaded but paused.');
                audioRef.current.play().catch(error => {
                    console.warn("Audio play attempt failed. User interaction might be required or audio context not active yet.", error);
                    // If autoplay is blocked, the user will need to manually click play.
                    // We could update isPlaying to false here if necessary, but browser behavior might make this tricky.
                    // For now, let the UI show "Pause" and the user can interact.
                });
            } else if (audioState.audioFile && !audioState.isPlaying && !audioRef.current.paused) {
                console.log('[AUDIO SYNC] Pausing audio as state indicates not playing and audio is currently playing.');
                audioRef.current.pause();
            }

            return () => {
                console.log('[AUDIO SYNC] Cleaning up audio listeners for audioRef.');
                timeUpdateCleanup();
                endedEventCleanup();
            };
        }
    }, [audioRef.current, audioState.audioFile, audioState.isPlaying, audioState.isLooping]);

    // Load available shaders on mount
    useEffect(() => {
        setAvailableShaders(ShaderManager.getAvailableShaders());
    }, []);

    // Handle file upload
    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Use AudioAnalysisManager for file handling and analysis
        await AudioAnalysisManager.setAudioFile(file, audioRef.current);
    };

    // Handle playback controls
    const handlePlayPause = () => {
        AudioAnalysisManager.togglePlayPause(audioRef.current);
    };

    // Handle skip forward
    const handleSkipForward = () => {
        AudioAnalysisManager.skipForward(audioRef.current);
    };

    // Handle skip backward
    const handleSkipBackward = () => {
        AudioAnalysisManager.skipBackward(audioRef.current);
    };

    // Handle reset to beginning
    const handleReset = () => {
        AudioAnalysisManager.resetAudio(audioRef.current);
    };

    // Handle toggle looping
    const handleToggleLooping = () => {
        AudioAnalysisManager.toggleLooping(audioRef.current);
    };

    // Handle shader selection
    const handleShaderChange = async (e) => {
        const shaderId = e.target.value;

        // Clear custom shader state when selecting from presets
        setCustomShader(null);

        // Update selected shader state
        setSelectedShader(shaderId);

        // Load the shader source
        await loadShaderSource(shaderId);
    };

    // Load shader source based on ID
    const loadShaderSource = async (shaderId) => {
        try {
            setIsLoadingShader(true);
            console.log(`Loading shader with ID: ${shaderId}`);
            const shader = ShaderManager.loadLibraryShader(shaderId);

            if (!shader) {
                console.error(`Shader ${shaderId} not found`);
                setIsLoadingShader(false);
                return;
            }

            // Handle dynamically loaded shaders
            if (shader.getFragSrc) {
                const shaderSrc = await shader.getFragSrc();
                console.log(`Loaded dynamic shader source of length: ${shaderSrc.length}`);
                setCurrentShaderSrc(shaderSrc);
                setTempCustomShader(shaderSrc); // Set the editor to show this shader's code
            } else {
                console.log(`Loaded static shader source: ${shader.name}, length: ${shader.fragSrc.length}`);
                // Check if the source is the same as the current one
                if (currentShaderSrc === shader.fragSrc) {
                    console.warn('Attempted to load identical shader source!');
                }
                setCurrentShaderSrc(shader.fragSrc);

                // Store the original shader source for the editor
                if (shader.fragSrc) {
                    // If it's a wrapped shader, try to extract the original shader code
                    const isWrappedShader = shader.fragSrc.includes("// --- User's ShaderToy Code Start ---");
                    if (isWrappedShader) {
                        const startMarker = "// --- User's ShaderToy Code Start ---";
                        const endMarker = "// --- User's ShaderToy Code End ---";
                        const startIndex = shader.fragSrc.indexOf(startMarker) + startMarker.length;
                        const endIndex = shader.fragSrc.indexOf(endMarker);
                        if (startIndex > -1 && endIndex > -1) {
                            const extractedCode = shader.fragSrc.substring(startIndex, endIndex).trim();
                            setTempCustomShader(extractedCode);
                        } else {
                            setTempCustomShader(shader.fragSrc);
                        }
                    } else {
                        setTempCustomShader(shader.fragSrc);
                    }
                }
            }

            setIsLoadingShader(false);
        } catch (error) {
            console.error('Error loading shader:', error);
            setIsLoadingShader(false);
        }
    };

    // Load the default shader on mount
    useEffect(() => {
        if (availableShaders.length > 0) {
            loadShaderSource(selectedShader);
        }
    }, [availableShaders]);

    // Helper function to wrap ShaderToy GLSL code
    const wrapShaderToyCode = (shaderToyCode) => {
        // Check if the code already contains "void main()" to avoid double wrapping
        // or if it's not a ShaderToy style (doesn't contain mainImage)
        if (shaderToyCode.includes("void main()") || !shaderToyCode.includes("void mainImage(")) {
            // If it's potentially standard GLSL or already wrapped, use as is for now.
            // More sophisticated detection might be needed for mixed cases.
            console.log("Custom shader does not appear to be ShaderToy style or is already wrapped, using as is with highp if GLSL.");
            if (shaderToyCode.trim().startsWith("#version 300 es")) {
                // If version is present, try to insert highp precision after it.
                // This is a bit simplistic; a robust parser would be better.
                let lines = shaderToyCode.split('\n');
                if (!lines.some(line => line.includes("precision highp float;"))) {
                    lines.splice(1, 0, "precision highp float;");
                }
                return lines.join('\n');
            } else if (shaderToyCode.includes("#version")) {
                console.warn("Custom shader specifies a GLSL version other than 300 es. Attempting to use as is.");
                return shaderToyCode; // Or add highp similarly if desired
            } else if (shaderToyCode.includes("mainImage") || shaderToyCode.includes("main")) { // Likely GLSL
                return "#version 300 es\nprecision highp float;\n" + shaderToyCode;
            }
            return shaderToyCode; // Not clearly GLSL, return as is
        }

        // For ShaderToy code, prepend the version and necessary setup.
        return `#version 300 es
precision highp float; // Changed to highp

// Uniforms provided by ShaderVisualizer and AudioShaderSync
uniform vec2 uResolution; // Canvas resolution (width, height)
uniform float uTime;     // Elapsed time in seconds

// Audio-reactive uniforms (ensure these match what's in processAudioDataForShader)
uniform float energy;
uniform float lowEnergy;
uniform float midEnergy; // Assuming this might be added later or is part of general 'energy'
uniform float highEnergy;
uniform float transients;

out vec4 fragColor;

// ShaderToy compatibility defines
#define iResolution vec3(uResolution, 1.0) // Now iResolution is a vec3
#define iTime uTime
#define iChannelTime vec4(uTime, uTime, uTime, uTime) // Placeholder for iChannelTime
#define iFragCoord gl_FragCoord
#define iMouse vec4(0.0) // Placeholder for iMouse, can be implemented later if needed

// GLSL-compatible tanh approximation
vec4 tanhApprox(vec4 x) {
    vec4 x2 = x * x;
    return clamp(x * (27.0 + x2) / (27.0 + 9.0 * x2), -1.0, 1.0);
}
float tanhApprox(float x) { // Overload for float
    float x2 = x * x;
    return clamp(x * (27.0 + x2) / (27.0 + 9.0 * x2), -1.0, 1.0);
}

// Vector max function helper for GLSL ES 3.0 compatibility
vec3 max_vec3(vec3 a, vec3 b) {
    return max(a, b);
}

// Automatic variable initialization workaround for GLSL ES 3.0
#define AUTO_INIT_FLOAT(name) float name = 0.0
#define AUTO_INIT_VEC3(name) vec3 name = vec3(0.0)
#define AUTO_INIT_VEC4(name) vec4 name = vec4(0.0)

float simplex_noise(vec3 p) {
    return 0.0; // Placeholder - not used in your current shaders
}

// ShaderToy tanh replacement
#define tanh(x) tanhApprox(x)

// --- User's ShaderToy Code Start ---
${shaderToyCode}
// --- User's ShaderToy Code End ---

void main() {
    // Initialize a color vector
    vec4 color = vec4(0.0, 0.0, 0.0, 1.0);
    
    // Call the ShaderToy mainImage function with appropriate coordinates
    // Note: We're using gl_FragCoord.xy directly as ShaderToy expects
    mainImage(color, gl_FragCoord.xy);
    
    // Output the result
    fragColor = vec4(color.rgb, 1.0); // Force alpha to 1.0
}
        `;
    };

    // Handle custom shader input
    const handleCustomShaderChange = (e) => {
        setTempCustomShader(e.target.value);
    };

    // Apply custom shader
    const applyCustomShader = (shaderCode) => {
        if (!shaderCode) {
            // Clear custom shader and restore selected library shader
            setCustomShader(null);
            setTempCustomShader('');

            // Reload the previously selected library shader
            if (selectedShader && availableShaders.length > 0) {
                loadShaderSource(selectedShader);
            } else if (availableShaders.length > 0) {
                // Fallback to the first available shader if none was selected
                const defaultShader = availableShaders[0].id;
                setSelectedShader(defaultShader);
                loadShaderSource(defaultShader);
            }
            return;
        }

        // Generate a unique key for the custom shader to force re-rendering
        const customKey = `custom-${Date.now()}`;

        // Mark as using a custom shader
        setCustomShader(shaderCode);

        // Wrap the shader code for actual use
        const wrappedShader = wrapShaderToyCode(shaderCode);

        // Force rerender by using a new key
        setSelectedShader(customKey);

        // Update the current shader source
        setCurrentShaderSrc(wrappedShader);

        console.log("Applied custom shader. Original:", shaderCode);
        console.log("Wrapped for rendering:", wrappedShader);
    };

    // Handle updates from the ShaderVisualizer - use useCallback to maintain stable reference
    const handleUniformsUpdate = useCallback((uniforms) => {
        setShaderUniforms(uniforms);
    }, []);

    // Add handler for shader parameter updates
    const handleShaderParamUpdate = (newParams) => {
        // Update local state
        setShaderParams(prev => ({
            ...prev,
            ...newParams
        }));

        // Update actual shader parameters via ShaderManager
        ShaderManager.updateShaderParams(newParams);
    };

    return (
        <div className={styles.container}>
            <Head>
                <title>Audio-Shader Sync | afk.ai</title>
                <meta name="description" content="Visualize audio with reactive WebGL shaders" />
            </Head>

            {/* Header */}
            <header className={styles.pageHeader} style={{ position: 'relative', zIndex: 10 }}>
                <h1 className={styles.headerTitle}>afk.ai</h1>
                <p className={styles.headerTagline}>Animate Faster.</p>
            </header>

            <main className={styles.main}>

                {/* Two-column layout container */}
                <div className={styles.twoColumnLayout}>

                    {/* Left Column: Visualization */}
                    <div className={styles.canvasColumn}>
                        <div className={styles.visualizationContainer}>
                            <ShaderVisualizer
                                key={selectedShader}
                                width="100%"
                                height="100%"
                                shaderSrc={currentShaderSrc}
                                onUpdateUniforms={handleUniformsUpdate}
                            />
                        </div>

                        {/* Shader Editor below visualization */}
                        <ShaderEditor
                            shaderCode={customShader || tempCustomShader}
                            onApplyShader={applyCustomShader}
                        />
                    </div>

                    {/* Right Column: Controls */}
                    <div className={styles.controlsColumn}>
                        <div className={styles.controlsPanel}>
                            <div className={styles.fileUploadSection}>
                                <div className={styles.fileInputContainer}>
                                    <div className={styles.fileInput}>
                                        <input
                                            type="file"
                                            accept="audio/*"
                                            onChange={handleFileChange}
                                            id="audio-file"
                                            ref={fileInputRef}
                                        />
                                        <label htmlFor="audio-file" className={styles.fileInputLabel}>
                                            {audioState.audioFile ? 'Change Audio File' : 'Select Audio File'}
                                        </label>
                                    </div>

                                    <button
                                        onClick={handlePlayPause}
                                        disabled={!audioState.audioFile || audioState.isAnalyzing}
                                        className={`${styles.playButton} ${audioState.isPlaying ? styles.pause : styles.play}`}
                                    >
                                        {audioState.isAnalyzing ? 'Analyzing...' : audioState.isPlaying ? 'Pause' : 'Play'}
                                    </button>
                                </div>

                                {audioState.audioFile && (
                                    <div className={styles.fileInfoDisplay}>
                                        {audioState.audioFile.name} {audioState.isAnalyzing && '(Analyzing audio features...)'}
                                    </div>
                                )}
                            </div>

                            <div className={styles.controlsRow}>
                                <div className={styles.controlGroup}>
                                    <label htmlFor="shader-select" className={styles.controlLabel}>
                                        Select Shader:
                                    </label>
                                    <select
                                        id="shader-select"
                                        value={selectedShader}
                                        onChange={handleShaderChange}
                                        className={styles.controlSelect}
                                        disabled={isLoadingShader}
                                    >
                                        {availableShaders.map(shader => (
                                            <option key={shader.id} value={shader.id}>
                                                {shader.name}
                                            </option>
                                        ))}
                                    </select>
                                    {isLoadingShader && (
                                        <div className={styles.loadingMessage}>
                                            Loading shader...
                                        </div>
                                    )}
                                </div>

                                <div className={styles.controlGroup}>
                                    <span className={styles.controlLabel}>Current Time:</span>
                                    <div className={styles.timeControls}>
                                        <button
                                            onClick={handleSkipBackward}
                                            className={styles.skipButton}
                                            title="Skip backward 5 seconds"
                                            disabled={!audioState.audioFile}
                                        >
                                            ⏪
                                        </button>
                                        <div className={styles.timeDisplay}>
                                            {audioState.currentTime.toFixed(2)}s
                                        </div>
                                        <button
                                            onClick={handleReset}
                                            className={styles.skipButton}
                                            title="Reset to beginning"
                                            disabled={!audioState.audioFile}
                                        >
                                            ⟲
                                        </button>
                                        <button
                                            onClick={handleToggleLooping}
                                            className={`${styles.skipButton} ${audioState.isLooping ? styles.activeButton : ''}`}
                                            title="Toggle loop mode"
                                            disabled={!audioState.audioFile}
                                        >
                                            ↻
                                        </button>
                                        <button
                                            onClick={handleSkipForward}
                                            className={styles.skipButton}
                                            title="Skip forward 5 seconds"
                                            disabled={!audioState.audioFile}
                                        >
                                            ⏩
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* AudioShaderControls component */}
                            <AudioShaderControls
                                initialParams={shaderParams}
                                onUpdateParams={handleShaderParamUpdate}
                            />
                        </div> {/* End .controlsPanel */}
                    </div> {/* End .controlsColumn */}

                </div> {/* End .twoColumnLayout */}
            </main>

            <footer className={styles.footer}>
                <p>&copy; {new Date().getFullYear()} afk.ai - All Rights Reserved</p>
            </footer>

            {/* Hidden audio element */}
            <audio ref={audioRef} style={{ display: 'none' }} controls />
        </div>
    );
};

export default AudioShaderSync; 