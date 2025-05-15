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
    const [activeControlsView, setActiveControlsView] = useState('editor'); // Default to 'editor'
    const [paneSizes, setPaneSizes] = useState({ left: 40, right: 60 });
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef(null);

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

    // Load available shaders on mount
    useEffect(() => {
        setAvailableShaders(ShaderManager.getAvailableShaders());
    }, []);

    // useEffect to load shader source when selectedShader changes or on initial load
    useEffect(() => {
        if (selectedShader && selectedShader.startsWith('custom-')) {
            console.log(`[ShaderLoadEffect] ${selectedShader} is a custom shader. Source should already be set. No library load.`);
            // For custom shaders, currentShaderSrc is set directly by applyCustomShader.
            // No further action needed here by this effect.
            return;
        }

        if (availableShaders.length > 0 && selectedShader && !isLoadingShader) {
            console.log(`[ShaderLoadEffect] Attempting to load library shader: ${selectedShader}`);
            loadShaderSource(selectedShader); // This is async
        }
    }, [availableShaders, selectedShader, isLoadingShader]); // isLoadingShader helps prevent re-entry if loadShaderSource is slow

    // Consolidated useEffect for managing audio playback based on state and shader readiness
    useEffect(() => {
        console.log(`[AUDIO SYNC Playback Effect] audioFile: ${!!audioState.audioFile}, isPlaying: ${audioState.isPlaying}, isAnalyzing: ${audioState.isAnalyzing}, currentShaderSrc: ${!!currentShaderSrc}, audioSrc: ${audioRef.current ? audioRef.current.src : 'no ref'}`);

        if (audioRef.current && audioState.audioFile && currentShaderSrc) {
            audioRef.current.loop = audioState.isLooping;

            if (audioState.isPlaying && !audioState.isAnalyzing) {
                // Double check if audio element has a valid src, sometimes it might be reset
                if (!audioRef.current.src || audioRef.current.src === window.location.href) { // Checking against location.href as some browsers set src to page URL if empty
                    console.warn('[AUDIO SYNC Playback Effect] Audio src is missing or invalid. Re-attaching from audioState.audioFile.url if available.');
                    // This case should ideally be handled by AudioAnalysisManager ensuring src is set
                    // but as a fallback:
                    if (audioState.audioFile.url) { // Assuming audioFile object might have a URL if re-attachment is needed
                        audioRef.current.src = audioState.audioFile.url;
                    } else {
                        console.error('[AUDIO SYNC Playback Effect] Cannot play, audio src is invalid and no backup URL in audioState.audioFile.');
                        setAudioState(prev => ({ ...prev, isPlaying: false })); // Prevent trying to play
                        return;
                    }
                }

                if (audioRef.current.paused) {
                    console.log('[AUDIO SYNC Playback Effect] Attempting to play audio. Current time:', audioState.currentTime);
                    if (audioRef.current.currentTime !== audioState.currentTime) {
                        audioRef.current.currentTime = audioState.currentTime;
                    }
                    audioRef.current.play().then(() => {
                        console.log("[AUDIO SYNC Playback Effect] Playback started successfully.");
                    }).catch(error => {
                        console.warn("[AUDIO SYNC Playback Effect] Audio play attempt failed.", error);
                        setAudioState(prev => ({ ...prev, isPlaying: false }));
                    });
                }
            } else { // Not playing or is analyzing
                if (!audioRef.current.paused) {
                    console.log('[AUDIO SYNC Playback Effect] Pausing audio.');
                    audioRef.current.pause();
                }
            }
        } else {
            if (audioRef.current && !audioRef.current.paused) {
                console.log('[AUDIO SYNC Playback Effect] Conditions not met (no audioFile, or no currentShaderSrc, or analyzing), ensuring audio is paused.');
                audioRef.current.pause();
            }
        }
    }, [
        audioState.audioFile,
        audioState.isPlaying,
        audioState.isLooping,
        audioState.currentTime,
        audioState.isAnalyzing,
        currentShaderSrc
    ]);

    // Handle file upload
    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        console.log('[AUDIO SYNC] File selected. Resetting state and preparing for new audio.');
        // Update state to reflect loading and stop current playback
        setAudioState(prev => ({
            ...prev,
            audioFile: null,
            isPlaying: false,
            isAnalyzing: true,
            currentTime: 0
        }));

        if (audioRef.current) {
            if (!audioRef.current.paused) {
                audioRef.current.pause();
            }
            audioRef.current.src = ''; // Detach old source to prevent issues
            audioRef.current.removeAttribute('src'); // Further ensure it's cleared
            audioRef.current.load(); // Reset internal state of audio element
            console.log('[AUDIO SYNC] Audio element reset.');
        }

        console.log('[AUDIO SYNC] Calling AudioAnalysisManager.setAudioFile');
        await AudioAnalysisManager.setAudioFile(file, audioRef.current);
        console.log('[AUDIO SYNC] AudioAnalysisManager.setAudioFile completed. Expecting state update via subscription.');
        // AudioAnalysisManager's subscription is now responsible for setting isPlaying to true
        // which will trigger the playback useEffect.
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

    // Handle shader selection from dropdown
    const handleShaderChange = (e) => {
        const shaderId = e.target.value;
        console.log(`[ShaderChange] Selected library shader: ${shaderId}`);
        setCustomShader(null); // Clear any active custom shader code from editor's perspective
        // currentShaderSrc will be set to null temporarily if the visualizer is unmounted due to key change,
        // then loadShaderSource (triggered by useEffect) will provide the new src.
        // Or, if we want to avoid a flash of no visualizer, we could set isLoadingShader here.
        // For now, rely on the key change and conditional rendering.
        setSelectedShader(shaderId); // This will trigger the useEffect above to load the shader
    };

    // Load shader source based on ID (for library shaders)
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
        if (!shaderCode || shaderCode.trim() === '') {
            console.log("[CustomShader] Cleared custom shader. Reverting to last selected library shader or default.");
            setCustomShader(null);
            setTempCustomShader(''); // Clear editor

            // Find the first non-custom shader in the available shaders list as a fallback or use a default.
            // For a more robust revert, you might want to store the last selected *library* shader.
            const firstLibraryShader = availableShaders.find(s => !s.id.startsWith('custom-'));
            const revertShaderId = firstLibraryShader ? firstLibraryShader.id : 'neonBar'; // Default fallback

            setSelectedShader(revertShaderId); // This will trigger the useEffect to load the library shader
            // currentShaderSrc will be updated by the loadShaderSource call from the useEffect
            return;
        }

        const customKey = `custom-${Date.now()}`;
        const wrappedShader = wrapShaderToyCode(shaderCode);

        console.log(`[CustomShader] Applying custom shader. Key: ${customKey}`);
        setCustomShader(shaderCode); // Store raw code for editor state
        setCurrentShaderSrc(wrappedShader); // Directly set the source for the visualizer
        setSelectedShader(customKey); // Update selectedShader to this unique key. This is crucial for the <ShaderVisualizer key={selectedShader} />
        // This also ensures the ShaderLoadEffect for library shaders doesn't try to load it.
        setIsLoadingShader(false); // We've manually set the source.
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

    // Handlers for resizable panes
    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleMouseUp = useCallback(() => {
        if (isDragging) {
            setIsDragging(false);
        }
    }, [isDragging]);

    const handleMouseMove = useCallback((e) => {
        if (!isDragging || !containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        let newLeftWidthPercentage = ((e.clientX - containerRect.left) / containerRect.width) * 100;

        // Clamp values to min/max percentages (20% minimum for each pane)
        newLeftWidthPercentage = Math.max(20, newLeftWidthPercentage);
        newLeftWidthPercentage = Math.min(80, newLeftWidthPercentage);

        setPaneSizes({
            left: newLeftWidthPercentage,
            right: 100 - newLeftWidthPercentage
        });
    }, [isDragging]);

    // Add/remove event listeners for drag operation
    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        } else {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    return (
        <div className={styles.container}>
            <Head>
                <title>Audio-Shader Sync | afk.ai</title>
                <meta name="description" content="Visualize audio with reactive WebGL shaders" />
            </Head>

            {/* Header */}
            <header className={styles.pageHeader} style={{ position: 'relative', zIndex: 10 }}>
                <h1 className={styles.headerTitle}>makemusic.video</h1>
            </header>

            <main className={styles.main}>
                {/* Flex container with resizable panels */}
                <div
                    ref={containerRef}
                    style={{
                        display: 'flex',
                        width: '100%',
                        height: '85vh', // Constrain height to viewport
                        maxHeight: 'calc(100vh - 140px)', // Subtract header + footer + some margin
                        border: '2px solid #333',
                        borderRadius: '8px',
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                >
                    {/* LEFT SIDE: Controls */}
                    <div style={{
                        width: `${paneSizes.left}%`,
                        padding: '12px',
                        backgroundColor: '#0a001e',
                        overflow: 'auto',
                        position: 'relative',
                        zIndex: 5,
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        {/* More compact file upload and controls section */}
                        <div className={styles.fileUploadSection} style={{ marginBottom: '0.75rem', paddingBottom: '0.75rem' }}>
                            <div className={styles.fileInputContainer} style={{ gap: '0.5rem' }}>
                                <div className={styles.fileInput} style={{ flex: '0.7' }}>
                                    <input
                                        type="file"
                                        accept="audio/*"
                                        onChange={handleFileChange}
                                        id="audio-file"
                                        ref={fileInputRef}
                                    />
                                    <label htmlFor="audio-file" className={styles.fileInputLabel} style={{ width: '100%', textAlign: 'center', fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}>
                                        {audioState.audioFile ? 'Change Audio' : 'Select Audio'}
                                    </label>
                                </div>

                                <button
                                    onClick={handlePlayPause}
                                    disabled={!audioState.audioFile || audioState.isAnalyzing}
                                    className={`${styles.playButton} ${audioState.isPlaying ? styles.pause : styles.play}`}
                                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', flex: '0.3' }}
                                >
                                    {audioState.isAnalyzing ? 'Analyzing...' : audioState.isPlaying ? 'Pause' : 'Play'}
                                </button>
                            </div>

                            {audioState.audioFile && (
                                <div className={styles.fileInfoDisplay} style={{ fontSize: '0.75rem', marginTop: '0.3rem' }}>
                                    {audioState.audioFile.name} {audioState.isAnalyzing && '(Analyzing...)'}
                                </div>
                            )}
                        </div>

                        <div className={styles.controlsRow} style={{ marginBottom: '0.75rem' }}>
                            <div className={styles.controlGroup} style={{ minWidth: '140px' }}>
                                <label htmlFor="shader-select" className={styles.controlLabel} style={{ fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                                    Select Visual:
                                </label>
                                <select
                                    id="shader-select"
                                    value={selectedShader}
                                    onChange={handleShaderChange}
                                    className={styles.controlSelect}
                                    disabled={isLoadingShader}
                                    style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                                >
                                    {availableShaders.map(shader => (
                                        <option key={shader.id} value={shader.id}>
                                            {shader.name}
                                        </option>
                                    ))}
                                </select>
                                {isLoadingShader && (
                                    <div className={styles.loadingMessage} style={{ fontSize: '0.75rem' }}>
                                        Loading shader...
                                    </div>
                                )}
                            </div>

                            <div className={styles.controlGroup} style={{ minWidth: '140px' }}>
                                <span className={styles.controlLabel} style={{ fontSize: '0.8rem', marginBottom: '0.3rem' }}>Current Time:</span>
                                <div className={styles.timeControls}>
                                    <button
                                        onClick={handleSkipBackward}
                                        className={styles.skipButton}
                                        title="Skip backward 5 seconds"
                                        disabled={!audioState.audioFile}
                                        style={{ padding: '0.25rem 0.4rem', fontSize: '0.8rem' }}
                                    >
                                        ⏪
                                    </button>
                                    <div className={styles.timeDisplay} style={{ padding: '0.3rem 0.5rem', fontSize: '0.7rem' }}>
                                        {audioState.currentTime.toFixed(2)}s
                                    </div>
                                    <button
                                        onClick={handleReset}
                                        className={styles.skipButton}
                                        title="Reset to beginning"
                                        disabled={!audioState.audioFile}
                                        style={{ padding: '0.25rem 0.4rem', fontSize: '0.8rem' }}
                                    >
                                        ⟲
                                    </button>
                                    <button
                                        onClick={handleToggleLooping}
                                        className={`${styles.skipButton} ${audioState.isLooping ? styles.activeButton : ''}`}
                                        title="Toggle loop mode"
                                        disabled={!audioState.audioFile}
                                        style={{ padding: '0.25rem 0.4rem', fontSize: '0.8rem' }}
                                    >
                                        ↻
                                    </button>
                                    <button
                                        onClick={handleSkipForward}
                                        className={styles.skipButton}
                                        title="Skip forward 5 seconds"
                                        disabled={!audioState.audioFile}
                                        style={{ padding: '0.25rem 0.4rem', fontSize: '0.8rem' }}
                                    >
                                        ⏩
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Tab Controls - more compact */}
                        <div style={{
                            display: 'flex',
                            borderBottom: '2px solid #00FFFF',
                            marginBottom: '10px'
                        }}>
                            <button
                                onClick={() => setActiveControlsView('controls')}
                                style={{
                                    flex: 1,
                                    padding: '6px',
                                    background: activeControlsView === 'controls' ? 'rgba(0, 255, 255, 0.2)' : 'transparent',
                                    color: activeControlsView === 'controls' ? '#00FFFF' : '#00AAAA',
                                    border: 'none',
                                    borderBottom: activeControlsView === 'controls' ? '3px solid #FF00FF' : '3px solid transparent',
                                    cursor: 'pointer',
                                    fontWeight: activeControlsView === 'controls' ? 'bold' : 'normal',
                                    fontSize: '0.8rem'
                                }}
                            >
                                SHADER CONTROLS
                            </button>
                            <button
                                onClick={() => setActiveControlsView('editor')}
                                style={{
                                    flex: 1,
                                    padding: '6px',
                                    background: activeControlsView === 'editor' ? 'rgba(0, 255, 255, 0.2)' : 'transparent',
                                    color: activeControlsView === 'editor' ? '#00FFFF' : '#00AAAA',
                                    border: 'none',
                                    borderBottom: activeControlsView === 'editor' ? '3px solid #FF00FF' : '3px solid transparent',
                                    cursor: 'pointer',
                                    fontWeight: activeControlsView === 'editor' ? 'bold' : 'normal',
                                    fontSize: '0.8rem'
                                }}
                            >
                                SHADER EDITOR
                            </button>
                        </div>

                        {/* Content container with tabs */}
                        <div style={{
                            flexGrow: 1,
                            padding: '8px',
                            display: 'block',
                            position: 'relative',
                            zIndex: 10,
                            overflow: 'auto',
                            backgroundColor: '#0a001e' // Ensure background is visible
                        }}>
                            {/* Conditional content based on tabs */}
                            {activeControlsView === 'controls' && (
                                <AudioShaderControls
                                    initialParams={shaderParams}
                                    onUpdateParams={handleShaderParamUpdate}
                                />
                            )}

                            {activeControlsView === 'editor' && (
                                <ShaderEditor
                                    shaderCode={customShader || tempCustomShader}
                                    onApplyShader={applyCustomShader}
                                />
                            )}
                        </div>
                    </div>

                    {/* Resizer Handle */}
                    <div
                        style={{
                            width: '10px',
                            cursor: 'col-resize',
                            background: 'linear-gradient(to right, #1A0530, #4A00E0)',
                            zIndex: 10,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderLeft: '1px solid #4A00E0',
                            borderRight: '1px solid #4A00E0',
                            transition: 'background 0.2s ease'
                        }}
                        onMouseDown={handleMouseDown}
                        title="Drag to resize"
                    >
                        <div style={{
                            width: '2px',
                            height: '30px',
                            backgroundColor: '#FF00FF',
                            borderRadius: '1px'
                        }}></div>
                    </div>

                    {/* RIGHT SIDE: Visualization */}
                    <div style={{
                        width: `${paneSizes.right}%`,
                        backgroundColor: '#050108',
                        display: 'flex',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            width: '100%',
                            height: '100%',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            {isLoadingShader && <div className={styles.loadingOverlay}>Loading Shader...</div>}
                            {!isLoadingShader && currentShaderSrc && (
                                <ShaderVisualizer
                                    key={selectedShader}
                                    shaderSrc={currentShaderSrc}
                                    onUpdateUniforms={handleUniformsUpdate}
                                />
                            )}
                            {!isLoadingShader && !currentShaderSrc && (
                                <div className={styles.placeholderVis}>Select a shader or apply custom code.</div>
                            )}
                        </div>
                    </div>
                </div>
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