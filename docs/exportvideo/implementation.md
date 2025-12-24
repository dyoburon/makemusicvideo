# Video Export Implementation Plan

## Overview

This document outlines the implementation strategy for exporting shader-based audio visualizations as video files. Currently, the makemusicvideo project only supports real-time visualization with no export capability.

**Related Documents:**
- [Client vs Server Comparison](./client-vs-server.md) - Cost and timing analysis

---

## Design Principles

### Scoped & Isolated

All export code will be **completely isolated** from existing visualization code:

```
Existing Code (UNTOUCHED)              Export Module (NEW)
─────────────────────────              ─────────────────────
ShaderVisualizer.js                    utils/export/ExportRenderer.js
  └─ canvas            ──────────────▶   └─ borrows canvas ref
  └─ gl context        ──────────────▶   └─ borrows gl context
  └─ shader program    ──────────────▶   └─ borrows program ref
  └─ uniformLocations  ──────────────▶   └─ borrows locations
                                         └─ has OWN render loop

ShaderManager.js
  └─ processAudioDataForShader() ────▶ calls with arbitrary time

AudioAnalysisManager.js
  └─ audioAnalysis     ──────────────▶ reads timeline data
```

**Key principle:** Export module only **reads from** and **calls into** existing code. No modifications to ShaderVisualizer, ShaderManager, etc.

### Single Touch Point

The only addition to existing code is a **read-only getter**:

```javascript
// Add to ShaderVisualizer.js (or expose via React ref)
getExportContext() {
    return {
        canvas: this.canvasRef.current,
        gl: this.gl,
        shaderProgram: this.shaderProgram,
        uniformLocations: this.uniformLocations
    };
}
```

Everything else lives in `utils/export/`.

---

## Current Architecture

```
Audio File → Meyda Analysis → Timeline Events → Per-Frame Uniforms → WebGL Shader → Canvas Display
                                                                                    ↓
                                                                              (NO EXPORT)
```

### Key Components
| Component | File | Purpose |
|-----------|------|---------|
| ShaderVisualizer | `components/ShaderVisualizer.js` | WebGL rendering at 30fps |
| ShaderManager | `utils/shaders/ShaderManager.js` | Shader loading & audio processing |
| ShaderUpdate | `utils/shaders/ShaderUpdate.js` | Per-frame uniform calculation |
| AudioAnalysisManager | `utils/audio/AudioAnalysisManager.js` | Audio state & timeline |

---

## Export Architecture Options

### Option A: MediaRecorder API (Browser-Native)

**Pros:**
- No external dependencies
- Hardware-accelerated encoding
- Simple implementation

**Cons:**
- WebM/VP8/VP9 only (no MP4/H.264 in most browsers)
- Audio muxing requires workarounds
- Quality/bitrate control limited

```
Canvas → captureStream() → MediaRecorder → WebM Blob → Download
                              ↓
                    Audio Track (from source)
```

### Option B: FFmpeg.wasm (Client-Side)

**Pros:**
- Full codec support (H.264, MP4, etc.)
- Professional quality control
- Audio muxing built-in

**Cons:**
- ~25MB WASM bundle
- Slower than hardware encoding
- Memory intensive for long videos

```
Canvas → Frame-by-frame capture → FFmpeg.wasm → MP4/WebM → Download
                                       ↓
                              Audio File (muxed)
```

### Option C: Server-Side Encoding

**Pros:**
- Full FFmpeg capabilities
- Offloads processing from client
- Better for long videos

**Cons:**
- Requires server infrastructure
- Upload/download latency
- More complex architecture

```
Canvas → Frame capture → Upload frames → Server FFmpeg → Download MP4
```

---

## Recommended Approach: Hybrid (Option A + B)

Use **MediaRecorder** for quick exports, with **FFmpeg.wasm** as fallback for MP4/quality needs.

---

## Implementation Plan

### Phase 1: Canvas Capture Foundation

**Files to Create:**
- `utils/export/CanvasCapture.js` - Frame capture utility
- `utils/export/ExportManager.js` - Export state management
- `components/ExportControls.js` - UI component

**CanvasCapture.js:**
```javascript
export class CanvasCapture {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.fps = options.fps || 30;
        this.stream = null;
    }

    startCapture() {
        // Get stream from WebGL canvas
        this.stream = this.canvas.captureStream(this.fps);
        return this.stream;
    }

    // For frame-by-frame (FFmpeg approach)
    captureFrame() {
        return new Promise((resolve) => {
            this.canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/png');
        });
    }
}
```

### Phase 2: MediaRecorder Implementation

**ExportManager.js:**
```javascript
export class ExportManager {
    constructor() {
        this.recorder = null;
        this.chunks = [];
        this.isRecording = false;
    }

    async startRecording(canvasStream, audioElement) {
        // Combine video stream with audio
        const audioCtx = new AudioContext();
        const audioSource = audioCtx.createMediaElementSource(audioElement);
        const audioDestination = audioCtx.createMediaStreamDestination();
        audioSource.connect(audioDestination);
        audioSource.connect(audioCtx.destination); // Keep audio audible

        // Combine streams
        const combinedStream = new MediaStream([
            ...canvasStream.getVideoTracks(),
            ...audioDestination.stream.getAudioTracks()
        ]);

        // Configure recorder
        this.recorder = new MediaRecorder(combinedStream, {
            mimeType: 'video/webm;codecs=vp9',
            videoBitsPerSecond: 8000000 // 8 Mbps
        });

        this.chunks = [];
        this.recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                this.chunks.push(e.data);
            }
        };

        this.recorder.start(100); // Collect data every 100ms
        this.isRecording = true;
    }

    stopRecording() {
        return new Promise((resolve) => {
            this.recorder.onstop = () => {
                const blob = new Blob(this.chunks, { type: 'video/webm' });
                resolve(blob);
            };
            this.recorder.stop();
            this.isRecording = false;
        });
    }

    downloadVideo(blob, filename = 'visualization.webm') {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
}
```

### Phase 3: Offline Rendering (Frame-Perfect Export)

For frame-perfect synchronization, render offline without real-time constraints:

**OfflineRenderer.js:**
```javascript
export class OfflineRenderer {
    constructor(shaderVisualizer, audioAnalysis, options = {}) {
        this.visualizer = shaderVisualizer;
        this.analysis = audioAnalysis;
        this.fps = options.fps || 30;
        this.duration = audioAnalysis.duration;
        this.totalFrames = Math.ceil(this.duration * this.fps);
    }

    async renderAllFrames(onProgress) {
        const frames = [];

        for (let i = 0; i < this.totalFrames; i++) {
            const time = i / this.fps;

            // Set audio time manually (not from playback)
            this.visualizer.setTime(time);

            // Render single frame
            this.visualizer.renderFrame();

            // Capture frame
            const frameBlob = await this.captureFrame();
            frames.push(frameBlob);

            // Progress callback
            if (onProgress) {
                onProgress(i / this.totalFrames);
            }

            // Yield to UI
            if (i % 10 === 0) {
                await new Promise(r => setTimeout(r, 0));
            }
        }

        return frames;
    }

    captureFrame() {
        return new Promise((resolve) => {
            this.visualizer.canvas.toBlob(resolve, 'image/png');
        });
    }
}
```

### Phase 4: FFmpeg.wasm Integration

**FFmpegEncoder.js:**
```javascript
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export class FFmpegEncoder {
    constructor() {
        this.ffmpeg = new FFmpeg();
        this.loaded = false;
    }

    async load() {
        if (this.loaded) return;

        // Load FFmpeg WASM
        await this.ffmpeg.load({
            coreURL: await toBlobURL('/ffmpeg-core.js', 'text/javascript'),
            wasmURL: await toBlobURL('/ffmpeg-core.wasm', 'application/wasm'),
        });

        this.loaded = true;
    }

    async encodeVideo(frames, audioFile, options = {}) {
        const { fps = 30, outputFormat = 'mp4' } = options;

        // Write frames to virtual filesystem
        for (let i = 0; i < frames.length; i++) {
            const frameData = await frames[i].arrayBuffer();
            this.ffmpeg.writeFile(
                `frame${i.toString().padStart(5, '0')}.png`,
                new Uint8Array(frameData)
            );
        }

        // Write audio file
        this.ffmpeg.writeFile('audio.mp3', await fetchFile(audioFile));

        // Encode video with audio
        await this.ffmpeg.exec([
            '-framerate', fps.toString(),
            '-i', 'frame%05d.png',
            '-i', 'audio.mp3',
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-crf', '23',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-pix_fmt', 'yuv420p',
            '-shortest',
            `output.${outputFormat}`
        ]);

        // Read output
        const data = await this.ffmpeg.readFile(`output.${outputFormat}`);
        return new Blob([data.buffer], {
            type: outputFormat === 'mp4' ? 'video/mp4' : 'video/webm'
        });
    }
}
```

### Phase 5: Export UI Component

**ExportControls.js:**
```javascript
import React, { useState } from 'react';
import { ExportManager } from '../utils/export/ExportManager';
import { OfflineRenderer } from '../utils/export/OfflineRenderer';
import { FFmpegEncoder } from '../utils/export/FFmpegEncoder';

export function ExportControls({
    canvas,
    audioElement,
    audioAnalysis,
    shaderVisualizer
}) {
    const [isExporting, setIsExporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [exportMode, setExportMode] = useState('realtime'); // 'realtime' | 'offline'
    const [format, setFormat] = useState('webm'); // 'webm' | 'mp4'

    const handleRealtimeExport = async () => {
        setIsExporting(true);
        const manager = new ExportManager();

        // Start recording
        const stream = canvas.captureStream(30);
        await manager.startRecording(stream, audioElement);

        // Play audio from start
        audioElement.currentTime = 0;
        audioElement.play();

        // Wait for audio to finish
        audioElement.onended = async () => {
            const blob = await manager.stopRecording();
            manager.downloadVideo(blob);
            setIsExporting(false);
        };
    };

    const handleOfflineExport = async () => {
        setIsExporting(true);
        setProgress(0);

        const renderer = new OfflineRenderer(shaderVisualizer, audioAnalysis);
        const frames = await renderer.renderAllFrames((p) => setProgress(p * 0.5));

        if (format === 'mp4') {
            const encoder = new FFmpegEncoder();
            await encoder.load();
            setProgress(0.5);

            const blob = await encoder.encodeVideo(
                frames,
                audioElement.src,
                { fps: 30, outputFormat: 'mp4' }
            );

            // Download
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'visualization.mp4';
            a.click();
        }

        setProgress(1);
        setIsExporting(false);
    };

    return (
        <div className="export-controls">
            <h3>Export Video</h3>

            <div className="export-options">
                <label>
                    Mode:
                    <select
                        value={exportMode}
                        onChange={(e) => setExportMode(e.target.value)}
                    >
                        <option value="realtime">Real-time (Fast)</option>
                        <option value="offline">Offline (Frame-Perfect)</option>
                    </select>
                </label>

                <label>
                    Format:
                    <select
                        value={format}
                        onChange={(e) => setFormat(e.target.value)}
                    >
                        <option value="webm">WebM (VP9)</option>
                        <option value="mp4">MP4 (H.264)</option>
                    </select>
                </label>
            </div>

            {isExporting ? (
                <div className="export-progress">
                    <progress value={progress} max={1} />
                    <span>{Math.round(progress * 100)}%</span>
                </div>
            ) : (
                <button
                    onClick={exportMode === 'realtime'
                        ? handleRealtimeExport
                        : handleOfflineExport
                    }
                >
                    Export Video
                </button>
            )}
        </div>
    );
}
```

---

## ShaderVisualizer Modifications

The existing ShaderVisualizer needs modifications to support offline rendering:

**Add to ShaderVisualizer.js:**
```javascript
// Add method to render at specific time (not tied to audio playback)
renderAtTime(time) {
    // Calculate uniforms for this specific time
    const uniforms = calculateUniformsForTime(time, this.audioAnalysis);

    // Set all uniforms
    this.setUniforms(uniforms);

    // Render single frame
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
}

// Expose canvas for capture
getCanvas() {
    return this.canvasRef.current;
}
```

---

## Audio Sync Strategy

### Real-time Export
- Use `MediaRecorder` with combined audio+video stream
- Audio syncs automatically with playback
- Simple but may have minor drift on long videos

### Offline Export
- Calculate exact frame time: `frameIndex / fps`
- Query audio analysis timeline for that exact time
- No drift possible - frame-perfect sync
- Mux original audio file (not re-recorded)

**Time Calculation:**
```javascript
function getTimeForFrame(frameIndex, fps) {
    return frameIndex / fps;
}

function getUniformsForTime(time, audioAnalysis) {
    // Find events in timeline near this time
    const window = 0.1; // 100ms window
    const events = audioAnalysis.timeline.filter(e =>
        Math.abs(e.time - time) < window
    );

    // Calculate uniforms from events
    return calculateUniforms(events, time);
}
```

---

## Dependencies to Add

```json
{
    "dependencies": {
        "@ffmpeg/ffmpeg": "^0.12.7",
        "@ffmpeg/util": "^0.12.1"
    }
}
```

**Note:** FFmpeg.wasm requires specific headers for SharedArrayBuffer:
```javascript
// next.config.js
module.exports = {
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
                    { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
                ],
            },
        ];
    },
};
```

---

## File Structure

```
utils/
  export/
    CanvasCapture.js      # Canvas stream/frame capture
    ExportManager.js       # MediaRecorder wrapper
    OfflineRenderer.js     # Frame-by-frame offline render
    FFmpegEncoder.js       # FFmpeg.wasm integration
    index.js               # Export all utilities

components/
    ExportControls.js      # Export UI component
```

---

## Implementation Order

1. **Week 1: Foundation**
   - Create `utils/export/` directory structure
   - Implement `CanvasCapture.js`
   - Implement `ExportManager.js` (MediaRecorder)
   - Basic WebM export working

2. **Week 2: UI & Real-time Export**
   - Create `ExportControls.js` component
   - Integrate into main page
   - Test audio sync with MediaRecorder
   - Add progress indicators

3. **Week 3: Offline Rendering**
   - Modify ShaderVisualizer for time-based rendering
   - Implement `OfflineRenderer.js`
   - Test frame-perfect capture

4. **Week 4: FFmpeg Integration**
   - Add FFmpeg.wasm dependencies
   - Implement `FFmpegEncoder.js`
   - MP4 export working
   - Memory optimization for long videos

5. **Week 5: Polish**
   - Quality/bitrate options
   - Resolution selection
   - Error handling
   - Performance optimization

---

## Performance Considerations

### Memory Management
- For long videos (5+ minutes), don't store all frames in memory
- Stream frames to FFmpeg as they're captured
- Or use IndexedDB for temporary frame storage

### Resolution Options
```javascript
const resolutionPresets = {
    '720p': { width: 1280, height: 720 },
    '1080p': { width: 1920, height: 1080 },
    '4K': { width: 3840, height: 2160 }
};
```

### Estimated Export Times (5-minute video)
| Method | 720p | 1080p |
|--------|------|-------|
| MediaRecorder (real-time) | 5 min | 5 min |
| FFmpeg.wasm (offline) | ~10-15 min | ~20-30 min |

---

## Alternative: WebCodecs API (Future)

For browsers supporting WebCodecs (Chrome 94+), this provides:
- Hardware-accelerated encoding
- H.264/H.265 support
- Better performance than FFmpeg.wasm

```javascript
// Future implementation sketch
const encoder = new VideoEncoder({
    output: (chunk) => { /* handle encoded chunk */ },
    error: (e) => console.error(e)
});

encoder.configure({
    codec: 'avc1.42001f', // H.264
    width: 1920,
    height: 1080,
    bitrate: 8_000_000,
    framerate: 30
});
```

---

## Summary

The recommended implementation uses:
1. **MediaRecorder** for quick WebM exports (real-time)
2. **Offline rendering + FFmpeg.wasm** for frame-perfect MP4 exports
3. **WebCodecs** as future enhancement when browser support improves

Key challenges:
- Audio synchronization (solved via offline rendering)
- Memory management for long videos
- Cross-browser codec support
