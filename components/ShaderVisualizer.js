import React, { useEffect, useRef, useState } from 'react';
import { updateFrame } from '../utils/shaders/ShaderUpdate';
import AudioAnalysisManager from '../utils/audio/AudioAnalysisManager';

class ShaderProgram {
    constructor(gl, vertSource, fragSource) {
        this.gl = gl;
        this.program = this.createProgram(vertSource, fragSource);
        this.uniforms = {};
        this.attributes = {};
    }

    createShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const shaderType = type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT';
            const errorLog = gl.getShaderInfoLog(shader);
            console.error(`${shaderType} shader compilation error:`, errorLog);

            // Log the source code with line numbers for easier debugging
            const sourceLines = source.split('\n');
            const numberedSource = sourceLines.map((line, i) => `${i + 1}: ${line}`).join('\n');
            console.error(`${shaderType} shader source:
${numberedSource}`);

            gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    createProgram(vertSource, fragSource) {
        const gl = this.gl;

        // Make sure we have sources before trying to compile
        if (!vertSource || !fragSource) {
            console.error('Shader source is missing:',
                !vertSource ? 'Vertex shader is missing' : 'Fragment shader is missing');
            return null;
        }

        const vertexShader = this.createShader(gl.VERTEX_SHADER, vertSource);
        const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragSource);

        if (!vertexShader || !fragmentShader) {
            console.error('Failed to create vertex or fragment shader');
            return null;
        }

        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program linking error:', gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return null;
        }

        return program;
    }

    use() {
        if (!this.program) {
            console.error('Cannot use shader: program is null');
            return;
        }
        this.gl.useProgram(this.program);
    }

    addUniform(name) {
        if (!this.program) {
            console.error('Cannot add uniform: shader program is null');
            return null;
        }
        const location = this.gl.getUniformLocation(this.program, name);
        this.uniforms[name] = location;
        return location;
    }

    addAttribute(name) {
        if (!this.program) {
            console.error('Cannot add attribute: shader program is null');
            return -1;
        }
        const location = this.gl.getAttribLocation(this.program, name);
        this.attributes[name] = location;
        return location;
    }

    setUniform1f(name, value) {
        if (!this.program) {
            console.error('Cannot set uniform: shader program is null');
            return;
        }
        if (!this.uniforms[name]) {
            this.addUniform(name);
        }
        this.gl.uniform1f(this.uniforms[name], value);
    }

    setUniform2f(name, x, y) {
        if (!this.program) {
            console.error('Cannot set uniform: shader program is null');
            return;
        }
        if (!this.uniforms[name]) {
            this.addUniform(name);
        }
        this.gl.uniform2f(this.uniforms[name], x, y);
    }

    setUniform3f(name, x, y, z) {
        if (!this.program) {
            console.error('Cannot set uniform: shader program is null');
            return;
        }
        if (!this.uniforms[name]) {
            this.addUniform(name);
        }
        this.gl.uniform3f(this.uniforms[name], x, y, z);
    }

    setUniform4f(name, x, y, z, w) {
        if (!this.program) {
            console.error('Cannot set uniform: shader program is null');
            return;
        }
        if (!this.uniforms[name]) {
            this.addUniform(name);
        }
        this.gl.uniform4f(this.uniforms[name], x, y, z, w);
    }
}

const ShaderVisualizer = ({
    width = '100%',
    height = '100%',
    // audioAnalysis and audioState props are now optional - will use AudioAnalysisManager if not provided
    audioAnalysis = null,
    audioState = null,
    shaderSrc,
    onUpdateUniforms,
    resolutionScale = 1.0 // New prop with default value 1.0 (no scaling)
}) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const shaderRef = useRef(null);
    const animationFrameRef = useRef(null);
    const startTimeRef = useRef(Date.now());
    const [resolution, setResolution] = useState([1, 1]);
    const frameCountRef = useRef(0);
    const [audioManagerState, setAudioManagerState] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Subscribe to AudioAnalysisManager for updates
    useEffect(() => {
        console.log('[SHADER VIZ] Setting up AudioAnalysisManager subscription');
        const unsubscribe = AudioAnalysisManager.subscribe(newState => {
            setAudioManagerState(newState);
        });

        return unsubscribe;
    }, []);

    // Track fullscreen changes
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(document.fullscreenElement === containerRef.current);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, []);

    // Fullscreen toggle function
    const toggleFullscreen = () => {
        if (!containerRef.current) return;

        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    // Buffer references for WebGL
    const bufferRefs = useRef({
        position: null,
        texCoord: null
    });

    // Default vertex shader for rendering a full-screen quad
    const defaultVertexShader = `#version 300 es
    in vec4 aPosition;
    in vec2 aTexCoord;
    out vec2 vTexCoord;
    void main() {
      gl_Position = aPosition;
      vTexCoord = aTexCoord;
    }
  `;

    // Default placeholder fragment shader
    const defaultFragmentShader = `#version 300 es
    precision mediump float;
    in vec2 vTexCoord;
    uniform float uTime;
    uniform vec2 uResolution;
    
    // GLSL ES 3.0 requires an explicit output variable
    out vec4 fragColor;
    
    void main() {
      vec2 uv = vTexCoord;
      // Add resolution-based effects
      vec2 normCoord = gl_FragCoord.xy / uResolution.xy;
      vec3 color = 0.5 + 0.5 * cos(uTime + uv.xyx + vec3(0, 2, 4));
      // Add subtle vignette
      float vignette = 1.0 - length(normCoord * 2.0 - 1.0);
      vignette = smoothstep(0.0, 0.7, vignette);
      color *= vignette;
      fragColor = vec4(color, 1.0);
    }
  `;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Setup WebGL context (antialiasing disabled for performance)
        const gl = canvas.getContext('webgl2', { antialias: false, alpha: true, powerPreference: 'high-performance' });
        if (!gl) {
            console.error('WebGL 2.0 not supported. Falling back to WebGL 1.0');
            const fallbackGL = canvas.getContext('webgl', { antialias: false, alpha: true, powerPreference: 'high-performance' }) ||
                canvas.getContext('experimental-webgl', { antialias: false, alpha: true, powerPreference: 'high-performance' });
            if (!fallbackGL) {
                console.error('WebGL not supported in this browser');
                return;
            }
        }

        // Set canvas size (devicePixelRatio capped at 1 for performance)
        const setCanvasSize = () => {
            const canvasContainer = canvas.parentElement;
            const devicePixelRatio = 1; // Ignore high-DPI for performance

            // Set the display size (css pixels)
            canvas.style.width = '100%';
            canvas.style.height = '100%';

            // Set the actual size in memory (scaled for high dpi and resolutionScale)
            const actualWidth = Math.floor(canvasContainer.clientWidth * devicePixelRatio * resolutionScale);
            const actualHeight = Math.floor(canvasContainer.clientHeight * devicePixelRatio * resolutionScale);

            if (canvas.width !== actualWidth || canvas.height !== actualHeight) {
                canvas.width = actualWidth;
                canvas.height = actualHeight;
                gl.viewport(0, 0, actualWidth, actualHeight);
                setResolution([actualWidth, actualHeight]);
            }
        };

        // Set viewport and resize listener
        setCanvasSize();
        window.addEventListener('resize', setCanvasSize);

        // Create buffer objects once
        const positionBuffer = gl.createBuffer();
        const texCoordBuffer = gl.createBuffer();

        // Store buffer references for the animation loop
        bufferRefs.current = {
            position: positionBuffer,
            texCoord: texCoordBuffer
        };

        // Create a full-screen quad
        const positions = new Float32Array([
            -1.0, -1.0,  // bottom left
            1.0, -1.0,  // bottom right
            -1.0, 1.0,  // top left
            1.0, 1.0,  // top right
        ]);

        const texCoords = new Float32Array([
            0.0, 0.0,  // bottom left
            1.0, 0.0,  // bottom right
            0.0, 1.0,  // top left
            1.0, 1.0,  // top right
        ]);

        // Create position buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        // Create texture coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

        // Enable blending for transparent effects
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // Cleanup
        return () => {
            window.removeEventListener('resize', setCanvasSize);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }

            // Clean up WebGL resources
            gl.deleteBuffer(positionBuffer);
            gl.deleteBuffer(texCoordBuffer);
            if (shaderRef.current && shaderRef.current.program) {
                gl.deleteProgram(shaderRef.current.program);
            }
        };
    }, []); // Empty dependency array means this runs once on mount

    // Separate effect for shader program creation - only runs when shader source changes
    useEffect(() => {
        console.log('[SHADER INIT DEBUG] Shader program creation effect triggered');
        const canvas = canvasRef.current;
        if (!canvas) return;

        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!gl) return;

        // Create shader program only when shaderSrc changes
        const fragmentShader = shaderSrc || defaultFragmentShader;

        console.log('[SHADER INIT DEBUG] Creating shader program');
        const startTime = performance.now();

        // Clean up any existing shader program to prevent memory leaks
        if (shaderRef.current && shaderRef.current.program) {
            console.log('[SHADER INIT DEBUG] Cleaning up previous shader program');
            gl.deleteProgram(shaderRef.current.program);
        }

        const shaderProgram = new ShaderProgram(gl, defaultVertexShader, fragmentShader);
        const endTime = performance.now();
        console.log(`[SHADER INIT DEBUG] Shader compilation took ${(endTime - startTime).toFixed(2)}ms`);

        if (!shaderProgram.program) {
            console.error('[SHADER ERROR] Failed to create shader program. Using fallback shader.');
            // Try with fallback shader
            const fallbackShaderProgram = new ShaderProgram(gl, defaultVertexShader, defaultFragmentShader);
            shaderRef.current = fallbackShaderProgram;
        } else {
            shaderRef.current = shaderProgram;
            console.log('[SHADER INIT DEBUG] Shader program created successfully');
        }

        // Set up attributes
        shaderProgram.use();
        shaderProgram.addAttribute('aPosition');
        shaderProgram.addAttribute('aTexCoord');

        // Reset animation time when shader changes
        startTimeRef.current = Date.now();
        frameCountRef.current = 0;
        console.log('[SHADER INIT DEBUG] Shader initialization complete');

    }, [shaderSrc]); // Only recreate shader when source changes

    // Store audio state in refs to avoid re-triggering the animation loop
    const audioAnalysisRef = useRef(audioAnalysis);
    const audioStateRef = useRef(audioState);
    const audioManagerStateRef = useRef(audioManagerState);
    const onUpdateUniformsRef = useRef(onUpdateUniforms);

    // Update refs when props change (without triggering animation restart)
    useEffect(() => {
        audioAnalysisRef.current = audioAnalysis;
    }, [audioAnalysis]);

    useEffect(() => {
        audioStateRef.current = audioState;
    }, [audioState]);

    useEffect(() => {
        audioManagerStateRef.current = audioManagerState;
    }, [audioManagerState]);

    useEffect(() => {
        onUpdateUniformsRef.current = onUpdateUniforms;
    }, [onUpdateUniforms]);

    // Combined animation loop for both shader animation and audio processing
    // IMPORTANT: This effect should only restart when resolution or shader changes, NOT on audio updates
    useEffect(() => {
        console.log('[SHADER ANIM DEBUG] Animation loop effect triggered');
        const canvas = canvasRef.current;
        if (!canvas || !shaderRef.current) return;

        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!gl) return;

        const shaderProgram = shaderRef.current;
        console.log('[SHADER ANIM DEBUG] Setting up animation with shader program:', shaderProgram ? 'Valid' : 'Invalid');

        // Get buffer references
        const { position: positionBuffer, texCoord: texCoordBuffer } = bufferRefs.current;

        // Get attribute locations
        const posAttrLocation = shaderProgram.attributes['aPosition'] || shaderProgram.addAttribute('aPosition');
        const texCoordAttrLocation = shaderProgram.attributes['aTexCoord'] || shaderProgram.addAttribute('aTexCoord');

        // Performance monitoring variables
        let lastFpsUpdate = Date.now();
        let fps = 0;
        let lastFrameTime = 0;
        const targetFrameTime = 1000 / 30; // 30fps cap for performance

        // Animation function - now using our centralized update logic
        const animate = (currentTime) => {
            // 30fps frame limiter - skip frame if not enough time has passed
            if (currentTime - lastFrameTime < targetFrameTime) {
                animationFrameRef.current = requestAnimationFrame(animate);
                return;
            }
            lastFrameTime = currentTime;

            // Calculate current frame count
            const currentFrameCount = frameCountRef.current;

            // Calculate FPS every second
            const now = Date.now();
            if (now - lastFpsUpdate >= 1000) {
                fps = currentFrameCount - (frameCountRef.current - fps);
                lastFpsUpdate = now;
                console.log(`[SHADER PERF] FPS: ${fps}, Resolution: ${resolution[0]}x${resolution[1]}`);
            }

            // Start frame timing
            const frameStartTime = performance.now();

            // Create the audio state, preferring props if provided, otherwise using the manager state
            // Use refs to get the latest values without triggering effect restarts
            const currentAudioAnalysis = audioAnalysisRef.current;
            const currentAudioState = audioStateRef.current;
            const currentManagerState = audioManagerStateRef.current;

            const audioStateForShader = {
                analysis: currentAudioAnalysis ?? currentManagerState?.audioAnalysis,
                currentTime: currentAudioState?.currentTime ?? currentManagerState?.currentTime ?? 0,
                isPlaying: currentAudioState?.isPlaying ?? currentManagerState?.isPlaying ?? false
            };

            // Add detailed logging for audio debug (only every 60 frames to avoid spam)
            if (currentFrameCount % 60 === 0) {
                console.log(`[SHADER VIZ DEBUG] Frame ${currentFrameCount}:`);
                console.log(`  - Audio props provided: analysis=${!!currentAudioAnalysis}, state=${!!currentAudioState}`);
                console.log(`  - Manager state: analysis=${!!currentManagerState?.audioAnalysis}, isPlaying=${currentManagerState?.isPlaying}`);
                console.log(`  - Final audio state: analysis=${!!audioStateForShader.analysis}, isPlaying=${audioStateForShader.isPlaying}, time=${audioStateForShader.currentTime?.toFixed(2)}`);
                if (audioStateForShader.analysis) {
                    console.log(`  - Timeline entries: ${audioStateForShader.analysis.timeline?.length || 0}`);
                }
            }

            // Use the unified update function
            const newState = updateFrame({
                gl,
                shaderProgram,
                buffers: { positionBuffer, texCoordBuffer },
                resolution,
                startTime: startTimeRef.current,
                audioState: audioStateForShader,
                frameCount: currentFrameCount,
                onUpdateUniforms: onUpdateUniformsRef.current
            });

            // Update frame counter reference
            frameCountRef.current = newState.frameCount;

            // Set position attribute
            if (posAttrLocation !== -1) {
                gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
                gl.enableVertexAttribArray(posAttrLocation);
                gl.vertexAttribPointer(posAttrLocation, 2, gl.FLOAT, false, 0, 0);
            }

            // Set texCoord attribute
            if (texCoordAttrLocation !== -1) {
                gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
                gl.enableVertexAttribArray(texCoordAttrLocation);
                gl.vertexAttribPointer(texCoordAttrLocation, 2, gl.FLOAT, false, 0, 0);
            }

            // Draw the quad
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

            // Measure frame time
            const frameTime = performance.now() - frameStartTime;
            if (frameTime > 16) { // Log slow frames (below 60fps)
                console.log(`[SHADER PERF WARNING] Slow frame: ${frameTime.toFixed(2)}ms`);
            }

            // Request next frame
            animationFrameRef.current = requestAnimationFrame(animate);
        };

        // Start animation
        console.log('[SHADER ANIM DEBUG] Starting animation loop');
        animate();

        return () => {
            console.log('[SHADER ANIM DEBUG] Cleaning up animation resources');
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    // IMPORTANT: Only restart animation when resolution changes
    // Audio state is read from refs on each frame, so no need to restart the loop
    }, [resolution]);

    return (
        <div
            ref={containerRef}
            style={{ width, height, position: 'relative', overflow: 'hidden' }}
        >
            <canvas
                ref={canvasRef}
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'block',
                    borderRadius: 'inherit'
                }}
            />
            <button
                onClick={toggleFullscreen}
                style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    zIndex: 10,
                    background: 'rgba(0, 0, 0, 0.5)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px'
                }}
                aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
                {isFullscreen ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                    </svg>
                ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                    </svg>
                )}
            </button>
        </div>
    );
};

export default ShaderVisualizer; 