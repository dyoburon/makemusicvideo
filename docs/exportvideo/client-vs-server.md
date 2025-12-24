# Video Export: Client-Side vs Server-Side

## Overview

This document compares two approaches for exporting shader-based audio visualizations:
1. **Client-Side** - User's browser does all the work
2. **Server-Side** - We deploy infrastructure to handle rendering

---

## The Export Pipeline

Regardless of where it runs, the pipeline is:

```
Audio Analysis Data + Shader Code
         ↓
    For each frame:
         ├─ Calculate time (frame / fps)
         ├─ Compute audio uniforms for that time
         ├─ Render shader to canvas/framebuffer
         └─ Capture pixels
         ↓
    5,400 frames (for 3 min @ 30fps)
         ↓
    Encode frames → Video file
         ↓
    Mux audio track
         ↓
    Final MP4/WebM
```

---

## Client-Side Export (User's Machine)

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User's Browser                        │
│                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────┐  │
│  │ ExportRenderer│───▶│ Frame Capture│───▶│FFmpeg.wasm│  │
│  │ (WebGL)      │    │ (readPixels) │    │ (encode)  │  │
│  └──────────────┘    └──────────────┘    └─────┬─────┘  │
│                                                 │        │
│                                          ┌─────▼─────┐  │
│                                          │  Download │  │
│                                          │   MP4     │  │
│                                          └───────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Timing Estimates

**Per-frame breakdown:**
| Operation | Time | Notes |
|-----------|------|-------|
| Uniform calculation | 1-2ms | JavaScript, audio lookup |
| Shader render | 2-10ms | GPU dependent |
| Pixel readback | 5-15ms | gl.readPixels() |
| Frame storage | 1-5ms | Memory allocation |
| **Total per frame** | **10-30ms** | |

**Full video export times:**

| Video Length | Frames (30fps) | Fast Machine | Average Machine | Slow Machine |
|--------------|----------------|--------------|-----------------|--------------|
| 1 minute | 1,800 | 30-45 sec | 1-1.5 min | 2-3 min |
| 3 minutes | 5,400 | 1.5-2 min | 3-4 min | 5-8 min |
| 5 minutes | 9,000 | 2.5-3 min | 5-7 min | 10-15 min |
| 10 minutes | 18,000 | 5-6 min | 10-15 min | 20-30 min |

**Add FFmpeg encoding time:**
| Video Length | Encoding Time |
|--------------|---------------|
| 1 minute | +15-30 sec |
| 3 minutes | +30-60 sec |
| 5 minutes | +1-2 min |
| 10 minutes | +2-4 min |

### Total Client-Side Export Time

| Video Length | Best Case | Typical | Worst Case |
|--------------|-----------|---------|------------|
| **3 minutes** | **2 min** | **4-5 min** | **10 min** |
| **5 minutes** | **3.5 min** | **7-8 min** | **17 min** |

### Pros
- No server costs
- User data stays on their machine (privacy)
- No upload/download bandwidth
- Works offline
- Simple deployment (just static files)

### Cons
- Depends entirely on user's hardware
- Slow machines = bad experience
- Browser may run out of memory on long videos
- User's machine is blocked during export
- Can't do batch exports
- Mobile devices basically can't do this

### Memory Concerns

For raw frame storage before encoding:
```
1080p frame = 1920 × 1080 × 4 bytes = 8.3 MB per frame

3 minute video = 5,400 frames × 8.3 MB = 44.8 GB ❌ (won't fit in memory)
```

**Solution: Stream to FFmpeg**
- Don't store all frames in memory
- Pipe each frame directly to FFmpeg.wasm as it's captured
- Memory usage stays constant (~100-200 MB)

---

## Server-Side Export (Deployed Infrastructure)

### Architecture Options

#### Option A: Headless Browser (Puppeteer/Playwright)

```
┌─────────────────────────────────────────────────────────────────┐
│                         User's Browser                           │
│  ┌─────────────────┐                                             │
│  │ Upload:         │                                             │
│  │ • Audio file    │─────────────────┐                           │
│  │ • Shader code   │                 │                           │
│  │ • Settings      │                 │                           │
│  └─────────────────┘                 │                           │
└──────────────────────────────────────┼───────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                           Server                                  │
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────────────┐   │
│  │   Puppeteer  │───▶│ Headless     │───▶│ FFmpeg            │   │
│  │   (Chrome)   │    │ WebGL Render │    │ (native, fast)    │   │
│  └──────────────┘    └──────────────┘    └─────────┬─────────┘   │
│                                                     │             │
│                                              ┌──────▼──────┐      │
│                                              │ S3 / Storage│      │
│                                              └──────┬──────┘      │
└─────────────────────────────────────────────────────┼─────────────┘
                                                      │
                                                      ▼
                                              Download Link to User
```

**How it works:**
1. User uploads audio + shader config
2. Server spins up headless Chrome with Puppeteer
3. Loads the visualization page with uploaded assets
4. Captures frames using Chrome DevTools Protocol
5. Pipes to native FFmpeg (much faster than wasm)
6. Stores result, sends download link

#### Option B: Native GPU Rendering (No Browser)

```
┌─────────────────────────────────────────────────────────────────┐
│                           Server (GPU Instance)                  │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────────────┐  │
│  │ Node.js +    │───▶│ headless-gl  │───▶│ FFmpeg            │  │
│  │ Shader code  │    │ (WebGL)      │    │ (native)          │  │
│  └──────────────┘    └──────────────┘    └───────────────────┘  │
│                                                                  │
│  OR                                                              │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────────────┐  │
│  │ Python +     │───▶│ ModernGL /   │───▶│ FFmpeg            │  │
│  │ GLSL         │    │ PyOpenGL     │    │ (native)          │  │
│  └──────────────┘    └──────────────┘    └───────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Libraries:**
- `headless-gl` - WebGL in Node.js without browser
- `node-canvas` - Canvas API for Node.js
- `ModernGL` (Python) - Modern OpenGL bindings

### Server Timing Estimates

**Per-frame breakdown (server with GPU):**
| Operation | Time | Notes |
|-----------|------|-------|
| Uniform calculation | 0.5-1ms | Faster CPU |
| Shader render | 1-3ms | Server GPU (e.g., T4) |
| Pixel readback | 2-5ms | Faster bus |
| FFmpeg pipe | 1-2ms | Native, no wasm overhead |
| **Total per frame** | **5-10ms** | |

**Full video export times (server):**

| Video Length | Frames | GPU Server | CPU-Only Server |
|--------------|--------|------------|-----------------|
| 1 minute | 1,800 | 15-20 sec | 1-2 min |
| 3 minutes | 5,400 | 45-60 sec | 3-5 min |
| 5 minutes | 9,000 | 1.5-2 min | 5-8 min |
| 10 minutes | 18,000 | 3-4 min | 10-15 min |

### Server Cost Estimates

#### AWS/GCP GPU Instances

| Instance Type | GPU | Cost/Hour | 3-Min Export Time | Cost per Export |
|---------------|-----|-----------|-------------------|-----------------|
| AWS g4dn.xlarge | T4 | $0.526 | ~1 min | ~$0.01 |
| AWS g5.xlarge | A10G | $1.006 | ~45 sec | ~$0.01 |
| GCP n1 + T4 | T4 | $0.35 | ~1 min | ~$0.006 |

#### Serverless GPU Options

| Service | Cost Model | Notes |
|---------|------------|-------|
| Modal | $0.000016/sec (T4) | ~$0.001 per 3-min video |
| Replicate | Per-prediction | Good for ML, overkill here |
| RunPod | $0.20/hr (T4) | ~$0.003 per 3-min video |
| Banana.dev | Per-second GPU | Similar to Modal |

#### Headless Browser (No GPU needed)

| Instance Type | Cost/Hour | 3-Min Export Time | Cost per Export |
|---------------|-----------|-------------------|-----------------|
| AWS t3.large (2 vCPU) | $0.0832 | ~4-5 min | ~$0.007 |
| AWS c6i.xlarge (4 vCPU) | $0.17 | ~2-3 min | ~$0.008 |
| Vercel/Lambda | Per-invocation | May timeout (5 min limit) |

**Realistic monthly costs (1000 exports/month):**
- GPU serverless (Modal): **$1-5/month**
- GPU dedicated (spot): **$20-50/month**
- CPU headless browser: **$7-15/month**

### Pros
- Consistent, fast experience for all users
- No client memory/CPU limitations
- Can handle long videos (30+ minutes)
- Native FFmpeg = faster encoding
- Batch processing possible
- Works on mobile (offload to server)

### Cons
- Server costs (though minimal)
- User must upload audio file
- Download time for result
- More complex deployment
- Privacy concerns (audio on your server)
- Cold start latency (serverless)

---

## Hybrid Approach

Offer both options:

```
┌─────────────────────────────────────────────────────────┐
│                    Export Options                        │
│                                                          │
│  ┌────────────────────┐    ┌────────────────────────┐   │
│  │ 🖥️ Export Locally   │    │ ☁️ Export in Cloud      │   │
│  │                    │    │                        │   │
│  │ • Free             │    │ • Fast & consistent    │   │
│  │ • Private          │    │ • Works on any device  │   │
│  │ • Uses your CPU    │    │ • Premium feature?     │   │
│  │ • May be slow      │    │                        │   │
│  └────────────────────┘    └────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Decision Matrix

| Factor | Client-Side | Server-Side |
|--------|-------------|-------------|
| Video < 2 min | ✅ Good | Overkill |
| Video 2-5 min | ⚠️ Depends on machine | ✅ Better |
| Video > 5 min | ❌ Painful | ✅ Required |
| Mobile users | ❌ Won't work | ✅ Only option |
| Privacy sensitive | ✅ Data stays local | ⚠️ Upload required |
| Free tier | ✅ Always free | ⚠️ Has costs |
| Consistent UX | ❌ Varies wildly | ✅ Predictable |

---

## Recommendation

### Start With: Client-Side Only

1. **Zero infrastructure cost**
2. **Simpler to build** (just JavaScript)
3. **Validates the feature** (do users even want export?)
4. **Works for short videos** (1-3 min)

### Add Server-Side When:

1. Users complain about slow exports
2. You want to support mobile
3. You want to offer long video export (5+ min)
4. You have paying users who expect quality

### Server Implementation Path

If you add server-side later:

1. **Phase 1: Headless Browser** (simplest)
   - Use existing frontend code in Puppeteer
   - No shader porting needed
   - ~$10-20/month for moderate usage

2. **Phase 2: GPU Serverless** (if needed)
   - Modal or RunPod for burst capacity
   - ~$0.001 per export
   - Auto-scales to zero when not used

---

## Summary Table

| Metric | Client-Side | Server (CPU) | Server (GPU) |
|--------|-------------|--------------|--------------|
| 3-min export time | 4-10 min | 3-5 min | 45-90 sec |
| 5-min export time | 7-17 min | 5-8 min | 1.5-2 min |
| Cost per export | $0 | ~$0.007 | ~$0.003 |
| Monthly (1k exports) | $0 | ~$10 | ~$5 |
| Works on mobile | ❌ | ✅ | ✅ |
| Max video length | ~5 min | ~30 min | ~60 min |
| Implementation effort | Low | Medium | Medium-High |

---

## Technical Notes

### Client-Side Memory Optimization

Stream frames directly to FFmpeg instead of storing:

```javascript
// Don't do this (stores all frames):
const frames = [];
for (let i = 0; i < totalFrames; i++) {
    frames.push(captureFrame()); // 💥 Memory explodes
}
ffmpeg.encode(frames);

// Do this (streams frames):
const ffmpeg = new FFmpegEncoder();
await ffmpeg.startEncoding(fps, duration);

for (let i = 0; i < totalFrames; i++) {
    const pixels = captureFrame();
    await ffmpeg.addFrame(pixels); // Immediately encoded, memory freed
}

const video = await ffmpeg.finalize();
```

### Server-Side: Puppeteer Frame Capture

```javascript
const browser = await puppeteer.launch({
    args: ['--use-gl=egl'] // Enable GPU in headless
});

const page = await browser.newPage();
await page.goto('http://localhost:3000/visualizer');

// Capture frames via CDP
const client = await page.target().createCDPSession();

for (let i = 0; i < totalFrames; i++) {
    const time = i / fps;
    await page.evaluate((t) => window.renderAtTime(t), time);

    const { data } = await client.send('Page.captureScreenshot', {
        format: 'png'
    });

    fs.writeFileSync(`frame_${i}.png`, Buffer.from(data, 'base64'));
}
```

### Server-Side: Native WebGL (headless-gl)

```javascript
const gl = require('gl')(1920, 1080); // Headless WebGL context
const fs = require('fs');

// Load shader, set up buffers (same as browser)
const program = createShaderProgram(gl, vertexSrc, fragmentSrc);

for (let i = 0; i < totalFrames; i++) {
    const time = i / fps;

    // Set uniforms
    gl.uniform1f(gl.getUniformLocation(program, 'uTime'), time);
    // ... other uniforms

    // Render
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Read pixels
    const pixels = new Uint8Array(1920 * 1080 * 4);
    gl.readPixels(0, 0, 1920, 1080, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // Pipe to FFmpeg
    ffmpegProcess.stdin.write(Buffer.from(pixels));
}
```
