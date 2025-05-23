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
    const [selectedShader, setSelectedShader] = useState('retroTunnel');
    const [shaderUniforms, setShaderUniforms] = useState(null);
    const [availableShaders, setAvailableShaders] = useState([]);
    const [customShader, setCustomShader] = useState(null);
    const [tempCustomShader, setTempCustomShader] = useState('');
    const [currentShaderSrc, setCurrentShaderSrc] = useState(null);
    const [isLoadingShader, setIsLoadingShader] = useState(false);
    const [shaderParams, setShaderParams] = useState({
        color1: { r: 0.8, g: 0.2, b: 0.9 },
        color2: { r: 0.1, g: 0.6, b: 0.9 },
        color3: { r: 0.9, g: 0.5, b: 0.1 },
        fogColor: { r: 0.15, g: 0.05, b: 0.25 },
        glowColor: { r: 0.2, g: 0.1, b: 0.3 },
        cameraSpeed: 1.2,
        transientEffect: 0.3,
        colorIntensity: 0.5
    });
    const [activeControlsView, setActiveControlsView] = useState('controls');
    const [paneSizes, setPaneSizes] = useState({ left: 40, right: 60 });
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef(null);

    const audioRef = useRef(null);
    const fileInputRef = useRef(null);

    // Subscribe to AudioAnalysisManager
    useEffect(() => {
        console.log('[AUDIO SYNC] Setting up AudioAnalysisManager subscription');
        const unsubscribe = AudioAnalysisManager.subscribe(newState => {
            setAudioState(newState);
            console.log('[AUDIO SYNC] Received audio state update:',
                `isPlaying: ${newState.isPlaying}, `,
                `currentTime: ${newState.currentTime.toFixed(2)}`);
        });

        return unsubscribe;
    }, []);

    // Set up time update listener when audio element is ready
    useEffect(() => {
        if (audioRef.current) {
            console.log('[AUDIO SYNC] Setting up time update listener');
            const timeUpdateCleanup = AudioAnalysisManager.setupTimeUpdateListener(audioRef.current);
            const endedEventCleanup = AudioAnalysisManager.setupEndedEventListener(audioRef.current);

            return () => {
                timeUpdateCleanup();
                endedEventCleanup();
            };
        }
    }, [audioRef.current]);

    // Load available shaders on mount
    useEffect(() => {
        setAvailableShaders(ShaderManager.getAvailableShaders());
    }, []);

    useEffect(() => {
        if (selectedShader && selectedShader.startsWith('custom-')) {
            console.log(`[ShaderLoadEffect] ${selectedShader} is a custom shader. Source should already be set. No library load.`);
            return;
        }

        if (availableShaders.length > 0 && selectedShader && !isLoadingShader) {
            console.log(`[ShaderLoadEffect] Attempting to load library shader: ${selectedShader}`);
            loadShaderSource(selectedShader);
        }
    }, [availableShaders, selectedShader, isLoadingShader]);

    // Load the default shader on mount  
    useEffect(() => {
        if (availableShaders.length > 0) {
            loadShaderSource(selectedShader);
        }
    }, [availableShaders]);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Use AudioAnalysisManager for file handling and analysis
        await AudioAnalysisManager.setAudioFile(file, audioRef.current);
    };

    const handlePlayPause = () => {
        AudioAnalysisManager.togglePlayPause(audioRef.current);
    };

    const handleSkipForward = () => {
        AudioAnalysisManager.skipForward(audioRef.current);
    };

    const handleSkipBackward = () => {
        AudioAnalysisManager.skipBackward(audioRef.current);
    };

    const handleReset = () => {
        AudioAnalysisManager.resetAudio(audioRef.current);
    };

    const handleToggleLooping = () => {
        AudioAnalysisManager.toggleLooping(audioRef.current);
    };

    const handleShaderChange = async (e) => {
        const shaderId = e.target.value;

        // Clear custom shader state when selecting from presets
        setCustomShader(null);

        // Update selected shader state
        setSelectedShader(shaderId);

        // Load the shader source
        await loadShaderSource(shaderId);
    };

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

            if (shader.getFragSrc) {
                const shaderSrc = await shader.getFragSrc();
                console.log(`Loaded dynamic shader source of length: ${shaderSrc.length}`);
                setCurrentShaderSrc(shaderSrc);
                setTempCustomShader(shaderSrc);
            } else {
                console.log(`Loaded static shader source: ${shader.name}, length: ${shader.fragSrc.length}`);
                if (currentShaderSrc === shader.fragSrc) {
                    console.warn('Attempted to load identical shader source!');
                }
                setCurrentShaderSrc(shader.fragSrc);

                if (shader.fragSrc) {
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

    const wrapShaderToyCode = (shaderToyCode) => {
        if (shaderToyCode.includes("void main()") || !shaderToyCode.includes("void mainImage(")) {
            console.log("Custom shader does not appear to be ShaderToy style or is already wrapped, using as is with highp if GLSL.");
            if (shaderToyCode.trim().startsWith("#version 300 es")) {
                let lines = shaderToyCode.split('\n');
                if (!lines.some(line => line.includes("precision highp float;"))) {
                    lines.splice(1, 0, "precision highp float;");
                }
                return lines.join('\n');
            } else if (shaderToyCode.includes("#version")) {
                console.warn("Custom shader specifies a GLSL version other than 300 es. Attempting to use as is.");
                return shaderToyCode;
            } else if (shaderToyCode.includes("mainImage") || shaderToyCode.includes("main")) { // Likely GLSL
                return "#version 300 es\nprecision highp float;\n" + shaderToyCode;
            }
            return shaderToyCode;
        }

        return `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform float uTime;

uniform float energy;
uniform float lowEnergy;
uniform float midEnergy;
uniform float highEnergy;
uniform float transients;

out vec4 fragColor;

#define iResolution vec3(uResolution, 1.0)
#define iTime uTime
#define iChannelTime vec4(uTime, uTime, uTime, uTime)
#define iFragCoord gl_FragCoord
#define iMouse vec4(0.0)

vec4 tanhApprox(vec4 x) {
    vec4 x2 = x * x;
    return clamp(x * (27.0 + x2) / (27.0 + 9.0 * x2), -1.0, 1.0);
}
float tanhApprox(float x) {
    float x2 = x * x;
    return clamp(x * (27.0 + x2) / (27.0 + 9.0 * x2), -1.0, 1.0);
}

vec3 max_vec3(vec3 a, vec3 b) {
    return max(a, b);
}

#define AUTO_INIT_FLOAT(name) float name = 0.0
#define AUTO_INIT_VEC3(name) vec3 name = vec3(0.0)
#define AUTO_INIT_VEC4(name) vec4 name = vec4(0.0)

float simplex_noise(vec3 p) {
    return 0.0;
}

#define tanh(x) tanhApprox(x)

// --- User's ShaderToy Code Start ---
${shaderToyCode}
// --- User's ShaderToy Code End ---

void main() {
    vec4 color = vec4(0.0, 0.0, 0.0, 1.0);
    mainImage(color, gl_FragCoord.xy);
    fragColor = vec4(color.rgb, 1.0);
}
        `;
    };

    const handleCustomShaderChange = (e) => {
        setTempCustomShader(e.target.value);
    };

    const applyCustomShader = (shaderCode) => {
        if (!shaderCode || shaderCode.trim() === '') {
            console.log("[CustomShader] Cleared custom shader. Reverting to last selected library shader or default.");
            setCustomShader(null);
            setTempCustomShader('');

            const firstLibraryShader = availableShaders.find(s => !s.id.startsWith('custom-'));
            const revertShaderId = firstLibraryShader ? firstLibraryShader.id : 'neonBar';

            setSelectedShader(revertShaderId);
            return;
        }

        const customKey = `custom-${Date.now()}`;
        const wrappedShader = wrapShaderToyCode(shaderCode);

        console.log(`[CustomShader] Applying custom shader. Key: ${customKey}`);
        setCustomShader(shaderCode);
        setCurrentShaderSrc(wrappedShader);
        setSelectedShader(customKey);
        setIsLoadingShader(false);
    };

    const handleUniformsUpdate = useCallback((uniforms) => {
        setShaderUniforms(uniforms);
    }, []);

    const handleShaderParamUpdate = (newParams) => {
        setShaderParams(prev => ({
            ...prev,
            ...newParams
        }));
        ShaderManager.updateShaderParams(newParams);
    };

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

        newLeftWidthPercentage = Math.max(20, newLeftWidthPercentage);
        newLeftWidthPercentage = Math.min(80, newLeftWidthPercentage);

        setPaneSizes({
            left: newLeftWidthPercentage,
            right: 100 - newLeftWidthPercentage
        });
    }, [isDragging]);

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
        <div className={`${styles.container} ${styles.scrollbarStyles}`}>
            <Head>
                <title>Make Music Video Online | makemusic.video</title>
                <meta name="description" content="Visualize audio with reactive WebGL shaders" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
                <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&family=Fira+Code:wght@400;500&family=Orbitron:wght@400;500;700&display=swap" rel="stylesheet" />
            </Head>

            <header className={styles.pageHeader}>
                <h1 className={styles.headerTitle}>makemusic.video</h1>
                {/* Optional: Add tagline or nav links here if desired for the global header */}
            </header>

            <main className={styles.main}>
                <div
                    ref={containerRef}
                    style={{
                        display: 'flex',
                        width: '100%',
                        height: 'calc(100vh - 120px)',
                        maxHeight: 'calc(100vh - 120px)',
                        border: '1px solid var(--anime-light-blue)',
                        borderRadius: '6px',
                        position: 'relative',
                        overflow: 'hidden',
                        backgroundColor: 'var(--anime-darker)'
                    }}
                >
                    {/* LEFT SIDE: Controls */}
                    <div style={{
                        width: `${paneSizes.left}%`,
                        padding: '1rem',
                        backgroundColor: 'rgba(46, 40, 60, 0.9)',
                        overflow: 'auto',
                        position: 'relative',
                        zIndex: 5,
                        display: 'flex',
                        flexDirection: 'column',
                        borderRight: '1px solid var(--anime-accent-secondary)'
                    }}>
                        <div className={styles.fileUploadSection} style={{ marginBottom: '1rem', paddingBottom: '1rem' }}>
                            <div className={styles.fileInputContainer} style={{ gap: '0.75rem' }}>
                                <div className={styles.fileInput} style={{ flex: '0.7' }}>
                                    <input
                                        type="file"
                                        accept="audio/*"
                                        onChange={handleFileChange}
                                        id="audio-file"
                                        ref={fileInputRef}
                                        style={{ display: 'none' }} // Keep input hidden
                                    />
                                    <label htmlFor="audio-file" className={styles.fileInputLabel} style={{ width: '100%', textAlign: 'center', fontSize: '0.8rem', padding: '0.6rem 0.75rem' }}>
                                        {audioState.audioFile ? 'Change Audio' : 'Select Audio'}
                                    </label>
                                </div>

                                <button
                                    onClick={handlePlayPause}
                                    disabled={!audioState.audioFile || audioState.isAnalyzing}
                                    className={`${styles.playButton} ${audioState.isPlaying ? styles.pause : styles.play}`}
                                    style={{ padding: '0.6rem 0.75rem', fontSize: '0.8rem', flex: '0.3' }} // Adjusted padding
                                >
                                    {audioState.isAnalyzing ? 'Analyzing...' : audioState.isPlaying ? 'Pause' : 'Play'}
                                </button>
                            </div>

                            {audioState.audioFile && (
                                <div className={styles.fileInfoDisplay} style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
                                    {audioState.audioFile.name} {audioState.isAnalyzing && '(Analyzing...)'}
                                </div>
                            )}
                        </div>

                        <div className={styles.controlsRow} style={{ marginBottom: '1rem' }}>
                            <div className={styles.controlGroup} style={{ minWidth: '150px' }}>
                                <label htmlFor="shader-select" className={styles.controlLabel} style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                                    Select Visual Template:
                                </label>
                                <select
                                    id="shader-select"
                                    value={selectedShader}
                                    onChange={handleShaderChange}
                                    className={styles.controlSelect}
                                    disabled={isLoadingShader}
                                    style={{ fontSize: '0.75rem', padding: '0.45rem' }} // Adjusted padding
                                >
                                    {availableShaders.map(shader => (
                                        <option key={shader.id} value={shader.id}>
                                            {shader.name}
                                        </option>
                                    ))}
                                </select>
                                {isLoadingShader && (
                                    <div className={styles.loadingMessage} style={{ fontSize: '0.7rem' }}>
                                        Loading shader...
                                    </div>
                                )}
                            </div>

                            <div className={styles.controlGroup} style={{ minWidth: '150px' }}>
                                <span className={styles.controlLabel} style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Playback:</span>
                                <div className={styles.timeControls}>
                                    <button
                                        onClick={handleSkipBackward}
                                        className={styles.skipButton}
                                        title="Skip backward 5s"
                                        disabled={!audioState.audioFile}
                                        style={{ padding: '0.3rem 0.45rem', fontSize: '0.75rem' }}
                                    >
                                        ⏪
                                    </button>
                                    <div className={styles.timeDisplay} style={{ padding: '0.35rem 0.5rem', fontSize: '0.65rem' }}>
                                        {audioState.currentTime.toFixed(2)}s
                                    </div>
                                    <button
                                        onClick={handleReset}
                                        className={styles.skipButton}
                                        title="Reset to 0s"
                                        disabled={!audioState.audioFile}
                                        style={{ padding: '0.3rem 0.45rem', fontSize: '0.75rem' }}
                                    >
                                        ⟲
                                    </button>
                                    <button
                                        onClick={handleToggleLooping}
                                        className={`${styles.skipButton} ${audioState.isLooping ? styles.activeButton : ''}`}
                                        title="Toggle Loop"
                                        disabled={!audioState.audioFile}
                                        style={{ padding: '0.3rem 0.45rem', fontSize: '0.75rem' }}
                                    >
                                        {audioState.isLooping ? '🔁' : '↻'} {/* Changed icon for active loop */}
                                    </button>
                                    <button
                                        onClick={handleSkipForward}
                                        className={styles.skipButton}
                                        title="Skip forward 5s"
                                        disabled={!audioState.audioFile}
                                        style={{ padding: '0.3rem 0.45rem', fontSize: '0.75rem' }}
                                    >
                                        ⏩
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div style={{
                            display: 'flex',
                            borderBottom: '1px solid #00FFFF', // Neon Cyan separator
                            marginBottom: '10px'
                        }}>
                            <button
                                onClick={() => setActiveControlsView('controls')}
                                className={`${styles.tabButton} ${activeControlsView === 'controls' ? styles.activeTabButton : ''}`}
                                style={{ flex: 1 /* Style is now mostly from CSS module */ }}
                            >
                                VISUAL CONTROLS
                            </button>
                            <button
                                onClick={() => setActiveControlsView('editor')}
                                className={`${styles.tabButton} ${activeControlsView === 'editor' ? styles.activeTabButton : ''}`}
                                style={{ flex: 1 /* Style is now mostly from CSS module */ }}
                            >
                                VISUAL EDITOR
                            </button>
                        </div>

                        <div style={{
                            flexGrow: 1,
                            padding: '0.5rem', // Slightly reduced padding for content area
                            display: 'block', // Changed from flex to block to allow natural flow
                            position: 'relative',
                            overflow: 'auto',
                            backgroundColor: '#0A0A10' // Match pane background
                        }}>
                            {activeControlsView === 'controls' && (
                                <AudioShaderControls
                                    initialParams={shaderParams}
                                    onUpdateParams={handleShaderParamUpdate}
                                />
                            )}

                            {activeControlsView === 'editor' && (
                                <div className={styles.editorScrollbars}>
                                    <ShaderEditor
                                        shaderCode={customShader || tempCustomShader}
                                        onApplyShader={applyCustomShader}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Resizer Handle */}
                    <div
                        style={{
                            width: '8px',
                            cursor: 'col-resize',
                            background: isDragging ? 'var(--anime-pink)' : 'var(--anime-purple)',
                            zIndex: 10,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderLeft: '1px solid rgba(108, 92, 231, 0.3)',
                            borderRight: '1px solid rgba(108, 92, 231, 0.3)',
                            transition: 'background 0.2s ease'
                        }}
                        onMouseDown={handleMouseDown}
                        title="Drag to resize"
                    >
                        <div style={{
                            width: '2px',
                            height: '25px',
                            backgroundColor: isDragging ? '#FFFFFF' : 'var(--anime-light-blue)',
                            borderRadius: '1px'
                        }}></div>
                    </div>

                    {/* RIGHT SIDE: Visualization */}
                    <div style={{
                        width: `${paneSizes.right}%`,
                        backgroundColor: 'var(--anime-darker)',
                        display: 'flex',
                        position: 'relative',
                        overflow: 'hidden',
                        borderLeft: '1px solid var(--anime-accent-secondary)'
                    }}>
                        <div style={{
                            width: '100%',
                            height: '100%',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            {isLoadingShader && <div className={styles.loadingOverlay}>Loading Visual...</div>}
                            {!isLoadingShader && currentShaderSrc && (
                                <ShaderVisualizer
                                    key={selectedShader} // Unique key for re-mount on change
                                    shaderSrc={currentShaderSrc}
                                    onUpdateUniforms={handleUniformsUpdate}
                                    resolutionScale={0.8} // Slightly increased resolution scale
                                />
                            )}
                            {!isLoadingShader && !currentShaderSrc && (
                                <div className={styles.placeholderVis}>Upload audio & select a visual template or edit code.</div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            <footer className={styles.footer}>
                <p>&copy; {new Date().getFullYear()} makemusic.video - Cyberfunk Division</p>
            </footer>

            <audio ref={audioRef} style={{ display: 'none' }} controls />
        </div>
    );
};

export default AudioShaderSync; 