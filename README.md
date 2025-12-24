# MakeMusicVisualizer

A real-time music visualization engine that syncs WebGL shaders to audio beats using Meyda for audio feature extraction.

## Overview

MakeMusicVisualizer analyzes audio files and maps detected beats, energy levels, and spectral features to GLSL shader uniforms in real-time. The system performs band-specific onset detection across bass, mid, and high frequencies to create responsive visualizations.

## Tech Stack

- Next.js 14
- WebGL 2.0 / GLSL ES 3.0
- Meyda.js
- Web Audio API

## Getting Started

```bash
npm install
npm run dev
```

Navigate to `http://localhost:3000`

## Usage

1. Load an audio file
2. Select a shader
3. Press play
4. Adjust colors and parameters as needed

## To-Do

- [ ] Implement video export functionality
- [ ] Implement correct music sync for all current shaders
- [ ] Hook up color controls to remaining shaders (RetroNeonTunnel is done)
