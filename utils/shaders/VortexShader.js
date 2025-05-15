/**
 * VortexShader.js
 * Exports the vortex shader code as a string for direct use in JavaScript.
 */

const vortexShaderSource = `#version 300 es
precision mediump float;
in vec2 vTexCoord;

// Common uniforms
uniform float uTime;
uniform vec2 uResolution;

// Audio reactive uniforms
uniform float uEnergy;
uniform float uLowEnergy;
uniform float uHighEnergy;
uniform float uTransients;

out vec4 fragColor; // GLSL ES 3.0 output

// Constants
#define MAX_STEPS 100 // Maximum raymarching steps
#define STEP_SCALE 0.15 // Reduced for finer sampling
#define TURB_NUM 10.0 // Turbulence iterations for swirling water currents
#define TURB_AMP 0.7 // Increased amplitude for stronger vortex distortions
#define TURB_FREQ 0.8 // Adjusted frequency for smoother currents
#define TURB_SPEED 0.6 // Slightly faster animation for the vortex swirl
#define TURB_EXP 1.4 // Increased for more variation in turbulence

// 2D rotation matrix function
mat2 rotate2D(float angle) {
    float s = sin(angle), c = cos(angle);
    return mat2(c, -s, s, c);
}

// 3D rotation matrix around an axis
mat3 rotate3D(float angle, vec3 axis) {
    float s = sin(angle), c = cos(angle), ic = 1.0 - c;
    vec3 n = normalize(axis);
    float x = n.x, y = n.y, z = n.z;
    return mat3(
        ic * x * x + c, ic * x * y - z * s, ic * x * z + y * s,
        ic * x * y + z * s, ic * y * y + c, ic * y * z - x * s,
        ic * x * z - y * s, ic * y * z + x * s, ic * z * z + c
    );
}

// Simple noise function for particulate matter (bubbles and debris)
float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i + vec3(0.0, 0.0, 0.0)), hash(i + vec3(1.0, 0.0, 0.0)), u.x),
                   mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), u.x), u.y),
               mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), u.x),
                   mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), u.x), u.y), u.z);
}

// Basic caustic light pattern function
float causticPattern(vec2 p_caustic, float t_caustic) {
    vec2 p1_c = p_caustic + vec2(sin(t_caustic * 0.22), cos(t_caustic * 0.33)) * 0.25;
    vec2 p2_c = p_caustic + vec2(cos(t_caustic * 0.27), sin(t_caustic * 0.38)) * 0.35;
    float n1_c = noise(vec3(p1_c * 3.5, t_caustic * 0.11));
    float n2_c = noise(vec3(p2_c * 5.5, t_caustic * 0.16));
    float n3_c = noise(vec3(p_caustic * 7.5, t_caustic * 0.21));
    return pow(max(0.0, n1_c * 0.5 + n2_c * 0.35 + n3_c * 0.15 - 0.4), 3.0) * 3.0;
}

// Function to compute the vortex shape at a given center position
float vortexShape(vec3 p, vec3 center, float t, float speedOffset) {
    // Adjust position relative to the vortex center
    vec3 q = p - center;
    
    // Create a vortex effect by rotating the position around the y-axis
    float vortexAngle = length(q.xz) * 0.8 - t * (TURB_SPEED + speedOffset);
    q.xz *= rotate2D(vortexAngle);
    
    // Turbulence loop for water currents with fixed iterations
    float d_turb = 1.0; // Renamed to avoid conflict with distance variable d in other scopes
    float freq = TURB_FREQ;
    
    // Unroll turbulence loop for WebGL compatibility
    // Iteration 1
    q += TURB_AMP * sin(q.yzx * freq + t * (TURB_SPEED + speedOffset)) / freq;
    q *= rotate3D(freq * 0.3, vec3(0.5, 1.0, 0.2));
    freq *= TURB_EXP;
    d_turb += d_turb;
    
    // Iteration 2
    q += TURB_AMP * sin(q.yzx * freq + t * (TURB_SPEED + speedOffset)) / freq;
    q *= rotate3D(freq * 0.3, vec3(0.5, 1.0, 0.2));
    freq *= TURB_EXP;
    d_turb += d_turb;
    
    // Iteration 3
    q += TURB_AMP * sin(q.yzx * freq + t * (TURB_SPEED + speedOffset)) / freq;
    q *= rotate3D(freq * 0.3, vec3(0.5, 1.0, 0.2));
    freq *= TURB_EXP;
    d_turb += d_turb;
    
    // Define the vortex shape: a cylindrical shape with distortions
    float r = length(q.xz);
    float s = r - 2.0 + 0.7 * sin(q.y * 1.5 + t * 0.4);
    s += 0.5 * cos(q.y * 1.0 + q.z * 0.7 + t * 0.3);
    s *= 0.8;
    return s;
}

void main() {
    // Normalized pixel coordinates (from 0 to 1, centered)
    vec2 uv = (vTexCoord * 2.0 - 1.0);
    uv.x *= uResolution.x / uResolution.y; // Aspect ratio correction
    
    vec4 o = vec4(0.0); // Output color
    float t_anim = uTime; // Time for animation (renamed from t to avoid conflict)
    
    // Make the vortexes respond to audio -- MODIFIED FOR COLOR ONLY
    float audioAmplitude = 0.7; // FIXED value - Bass no longer affects amplitude here
    // float audioSpeed = 1.0 + 2.0 * uHighEnergy;    // REMOVED: High frequencies affect speed
    float audioSpeed = 1.0; // FIXED value
    // float audioTurbulence = 0.8 + 1.0 * uEnergy;   // REMOVED: Overall energy affects turbulence
    float audioTurbulence = 0.8; // FIXED value
    // float audioTransients = uTransients * 2.0;     // REMOVED: Transients create pulses (for time)
    
    // Add audio-reactive effects to time -- MODIFIED
    // t_anim = t_anim * audioSpeed + audioTransients; // REMOVED audio influence on time
    // t_anim is now just uTime (or uTime * fixed_speed if desired, but audioSpeed is 1.0)
    
    // Zoom in by scaling down the UV coordinates (narrower FOV)
    float zoom = 0.5; // Smaller value = more zoomed in
    uv *= zoom;
    
    // Ray setup: origin at (0,0,0), direction based on pixel position
    vec3 rayDir = normalize(vec3(uv, -5.0)); // Ray direction (negative z-axis)
    
    // Rotate the ray slightly downward to frame the vortex
    rayDir.yz *= rotate2D(5.0);
    
    // Add subtle camera movement based on energy -- REMOVED
    // rayDir.xy *= rotate2D(sin(t_anim * 0.1) * 0.05 * uEnergy);
    
    // Raymarching loop (100 iterations)
    float z_dist = 0.0; // Distance along the ray (renamed from z to avoid conflict)
    // Fixed loop iteration for WebGL compatibility
    for (int i = 0; i < MAX_STEPS; i++) { // Use MAX_STEPS define
        // Current position along the ray
        vec3 p = z_dist * rayDir;
        
        // Apply time-based animation for the scene motion
        p.z += t_anim * 0.3;
        
        // Define multiple vortex centers that move with audio -- MODIFIED
        vec3 center1 = vec3(0.0, 0.0, 0.0); // Main vortex at the origin
        // vec3 center2 = vec3(3.0 + sin(t_anim * 0.2) * uEnergy, 0.0, 2.0); // Second vortex offset to the right
        vec3 center2 = vec3(3.0 + sin(t_anim * 0.2), 0.0, 2.0); // REMOVED uEnergy
        // vec3 center3 = vec3(-3.0 - cos(t_anim * 0.3) * uEnergy, 0.0, 1.0); // Third vortex offset to the left
        vec3 center3 = vec3(-3.0 - cos(t_anim * 0.3), 0.0, 1.0); // REMOVED uEnergy
        // vec3 center4 = vec3(0.0, 0.0, -4.0 + sin(t_anim * 0.15) * uLowEnergy * 2.0); // Fourth vortex further back
        vec3 center4 = vec3(0.0, 0.0, -4.0 + sin(t_anim * 0.15) * 2.0); // REMOVED uLowEnergy
        
        // Compute the distance to each vortex and take the minimum
        float s1 = vortexShape(p, center1, t_anim, 0.0);
        // float s2 = vortexShape(p, center2, t_anim, 0.1 * audioSpeed); // audioSpeed is now 1.0
        float s2 = vortexShape(p, center2, t_anim, 0.1);
        // float s3 = vortexShape(p, center3, t_anim, -0.05 * audioSpeed); // audioSpeed is now 1.0
        float s3 = vortexShape(p, center3, t_anim, -0.05);
        // float s4 = vortexShape(p, center4, t_anim, 0.15 * audioSpeed); // audioSpeed is now 1.0
        float s4 = vortexShape(p, center4, t_anim, 0.15);
        float s_dist = min(min(s1, s2), min(s3, s4)); // Combine all vortexes (renamed from s)
        
        // Raymarching step size (volumetric density) -- MODIFIED
        // float d_step = STEP_SCALE * (0.005 + 0.5 * max(s_dist, -s_dist * 0.3 * audioTurbulence)); // audioTurbulence is now fixed
        float d_step = STEP_SCALE * (0.005 + 0.5 * max(s_dist, -s_dist * 0.3 * 0.8)); // Using fixed audioTurbulence 0.8
        z_dist += d_step;
        
        // Simulate light scattering from above (shafts of light)
        float light = 0.7 + 0.5 * cos(p.x * 0.7 + p.z * 0.5 + t_anim * 0.2);
        light *= exp(-z_dist * 0.03);
        light *= 1.0 - smoothstep(0.0, 1.0, abs(p.y));
        
        // Add particulate matter (bubbles and debris) using noise
        float particles = noise(p * 3.0 + t_anim * 0.2) * 0.5;
        
        // Volumetric coloring for the underwater vortex
        vec4 waterColor = vec4(0.0, 0.0, 0.0, 1.0); // Initialize with black for color to be purely audio-driven
        
        // Add audio reactivity to the color
        // Shift base color hue with overall energy. If uEnergy is 0, mix_factor is 0, color remains black.
        waterColor.rgb = mix(waterColor.rgb, vec3(0.6, 0.2, 0.4), smoothstep(0.0, 1.0, uEnergy)); 
        
        // Add low energy (bass) influence - more red/orange
        waterColor.rgb += vec3(0.4 * uLowEnergy, 0.1 * uLowEnergy, 0.0);
        
        // Add high energy (treble) influence - more green/blue
        waterColor.rgb += vec3(0.0, 0.2 * uHighEnergy, 0.3 * uHighEnergy);

        // Modulate brightness with overall energy. If rgb is black and uEnergy is 0, stays black.
        waterColor.rgb *= (0.7 + 0.6 * uEnergy); 

        // Color shift based on high energy, now fully scaled by uHighEnergy
        float colorShift = 0.2 + 0.8 * uHighEnergy; 
        // If uHighEnergy is 0, colorShift is 0.2, but the term is multiplied by uHighEnergy (0), so adds nothing.
        waterColor.rgb += vec3(0.0, 0.1 * colorShift, 0.05 * colorShift) * sin(s_dist * 3.0 + t_anim * 0.3) * uHighEnergy;

        // Lighting effects, now scaled by uEnergy. The 'light' variable is a pattern.
        // If uEnergy is 0, this term adds nothing.
        waterColor.rgb += vec3(0.5, 0.7, 0.9) * light * (uEnergy * 1.5); 
        
        // Particle effects, now scaled by uTransients. The 'particles' variable is a pattern.
        // If uTransients is 0, this term adds nothing.
        waterColor.rgb += vec3(0.6, 0.7, 0.8) * particles * uTransients * 1.5; 
        
        // Pulse the color on transients
        if (uTransients > 0.3) {
            waterColor.rgb += vec3(0.1, 0.2, 0.3) * uTransients;
        }
        
        waterColor *= exp(-s_dist * 0.5 * audioAmplitude);
        
        // Accumulate color based on density (volumetric rendering)
        o += waterColor * 0.3 / d_step;

        if(z_dist > 20.0 || o.a > 0.99) break; // Break if too far or opaque enough for GLSL ES 3.0
    }
    
    // Apply a custom tanh approximation to compress the color range (tanh is not standard in GLSL ES 1.0)
    // For GLSL ES 3.0, we can use tanh directly if preferred, or keep this approximation.
    o = o / ( vec4(1.0) + abs(o / 1e2) ); // Approximation: x / (1 + abs(x/C)) - C can be 1e2 or similar
    o = clamp(o, 0.0, 1.0); // This is the final color of the vortex volume

    // --- New Water Background Implementation ---
    // Define base background color
    vec3 baseBgColor = vec3(0.05, 0.2, 0.4); // A deep, slightly cyan blue

    // Calculate caustics using 'uv' (world-space coordinates after zoom) for the background effect
    // Add small time-based offsets to uv to make caustics drift slowly
    float causticStrength = causticPattern(uv * 1.5 + vec2(t_anim * 0.01, t_anim * 0.005), t_anim * 0.4);

    vec3 causticBgColor = baseBgColor + vec3(0.1, 0.25, 0.35) * causticStrength; // Caustics add highlights

    // Blend the vortex rendering (o) with the new background.
    // The background is "behind" the vortices.
    vec4 sceneBackgroundColor = vec4(causticBgColor, 1.0);
    fragColor = mix(sceneBackgroundColor, o, o.a); // Standard alpha blending

    // Add a general scene fog based on how far the ray traveled
    // This fog affects the combined scene (vortices + background)
    float sceneDepthFogFactor = smoothstep(0.0, 1.0, exp(-z_dist * 0.02)); // z_dist from raymarching
    vec3 fogColor = vec3(0.02, 0.05, 0.1); // Very dark blue fog
    fragColor.rgb = mix(fogColor, fragColor.rgb, sceneDepthFogFactor);

    // Final clamp to be safe
    fragColor = clamp(fragColor, 0.0, 1.0);
    // --- End of New Water Background Implementation ---
}
`;

export default vortexShaderSource; 