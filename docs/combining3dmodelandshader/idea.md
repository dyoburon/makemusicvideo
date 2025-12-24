# Combining 3D Models with Audio-Reactive Shaders

## The Vision

Allow users to upload their own 3D model and have it move to music, with an audio-reactive shader rendering in the background. The model should feel like it's actually inhabiting the shader world, not just overlaid on top.

## The Core Challenge

**Shaders** (like EmergingCity, NebulousTunnel, etc.) are raymarched 2D illusions - they create the *appearance* of 3D depth on a flat screen.

**3D models** exist in actual Three.js 3D space with real depth, perspective, and transforms.

When you overlay a model on a shader, there's a visual disconnect - the model looks "pasted on" rather than inhabiting the world. This happens because:

- The shader's "depth" is calculated per-pixel using raymarching
- The model's depth is real 3D transforms tracked by Three.js
- They have no shared coordinate system

## Potential Approaches

### Option 1: Shader as Skybox/Environment Sphere

Render the shader to the inside of a massive sphere surrounding the Three.js scene.

**Pros:**
- Model appears "inside" the shader world
- Works well for tunnel/forward-motion effects
- Relatively simple to implement

**Cons:**
- Model is always centered, can't move "through" the space
- No real depth interaction with shader elements

**Implementation:**
- Render shader to a WebGL texture
- Apply texture to inside of a large sphere or cube
- Place 3D model at center of sphere

### Option 2: Shader on 3D Geometry

Instead of fullscreen rendering, render shader on actual 3D objects (planes, spheres, abstract shapes) within the Three.js scene.

**Pros:**
- Creates real depth relationships
- Model can move behind/in front of shader elements
- Most "realistic" integration
- Enables occlusion and proper spatial relationships

**Cons:**
- Shader may need adaptation for UV mapping
- Need to design the scene geometry
- More complex scene setup

**Implementation:**
- Create 3D meshes with ShaderMaterial
- Apply audio-reactive shader as the material
- Position model among these meshes

### Option 3: Depth-Aware Compositing

Render model with depth buffer, pass that depth information to the shader, and have the shader respect the model's position in its raymarched space.

**Pros:**
- True integration - shader elements can occlude the model
- Most sophisticated result

**Cons:**
- Complex implementation
- Requires modifying shaders to accept depth input
- Performance considerations

**Implementation:**
- Render model to framebuffer with depth
- Pass depth texture as uniform to shader
- Shader compares raymarched depth vs model depth

### Option 4: Layered Hybrid Approach (Recommended)

Combine multiple techniques for the best result:

**Layer 1 - Background:** Shader on distant sphere (the infinite world/skybox)
**Layer 2 - Midground:** Shader on 3D geometry near model (ground plane, floating particles, abstract shapes)
**Layer 3 - Foreground:** The 3D model itself

**Pros:**
- Creates depth layers that feel natural
- Model can cast shadows on midground elements
- Background gives immersive "world" feeling
- Midground provides spatial grounding

**Cons:**
- More setup required
- Need to coordinate visual language between layers

## Technical Considerations

### From afk-ai (audioAnimationPlayer.js)
- Uses React Three Fiber with Canvas
- Has animation mixer for audio-reactive model animations
- Camera controls with cinematic rotation
- Environment presets from @react-three/drei

### From makemusicvideo
- WebGL2 shaders with audio uniforms (uTransients, uEnergy, uLowEnergy, uHighEnergy)
- ShaderVisualizer component for rendering
- AudioAnalysisManager for beat detection and frequency analysis
- Various shader presets (tunnels, cities, fractals)

### Integration Points
- Both use audio analysis - could share the same audio data
- Model animation timing could sync with shader intensity
- Camera movement could affect both model and shader perspective

## Open Questions

1. What's the primary use case?
   - Character flying through tunnel?
   - Character standing in abstract space?
   - Character as focal point with world reacting around them?

2. Should shader elements occlude the model, or is model always in front acceptable?

3. Performance budget - how complex can the combined scene be?

4. Export format - video only, or interactive WebGL experience?

## Next Steps

1. Prototype the skybox approach as simplest first test
2. Add ground plane with shader material for grounding
3. Test with different shader types to see which integrate best
4. Evaluate performance with model + shader rendering simultaneously
