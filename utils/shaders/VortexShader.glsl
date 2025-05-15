precision mediump float;
varying vec2 vTexCoord;

// Common uniforms
uniform float uTime;
uniform vec2 uResolution;

// Audio reactive uniforms
uniform float uEnergy;
uniform float uLowEnergy;
uniform float uHighEnergy;
uniform float uTransients;

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

// Function to compute the vortex shape at a given center position
float vortexShape(vec3 p, vec3 center, float t, float speedOffset) {
    // Adjust position relative to the vortex center
    vec3 q = p - center;
    
    // Create a vortex effect by rotating the position around the y-axis
    float vortexAngle = length(q.xz) * 0.8 - t * (TURB_SPEED + speedOffset);
    q.xz *= rotate2D(vortexAngle);
    
    // Turbulence loop for water currents
    float d = 1.0;
    float freq = TURB_FREQ;
    for (float j = 0.0; j < TURB_NUM; j++) {
        q += TURB_AMP * sin(q.yzx * freq + t * (TURB_SPEED + speedOffset)) / freq;
        q *= rotate3D(freq * 0.3, vec3(0.5, 1.0, 0.2));
        freq *= TURB_EXP;
        d += d;
    }
    
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
    float t = uTime; // Time for animation
    
    // Make the vortexes respond to audio
    float audioAmplitude = 0.3 + 0.7 * uLowEnergy; // Bass affects amplitude
    float audioSpeed = 1.0 + 2.0 * uHighEnergy;    // High frequencies affect speed
    float audioTurbulence = 0.8 + 1.0 * uEnergy;   // Overall energy affects turbulence
    float audioTransients = uTransients * 2.0;     // Transients create pulses
    
    // Add audio-reactive effects to time
    t = t * audioSpeed + audioTransients;
    
    // Zoom in by scaling down the UV coordinates (narrower FOV)
    float zoom = 0.3; // Smaller value = more zoomed in
    uv *= zoom;
    
    // Ray setup: origin at (0,0,0), direction based on pixel position
    vec3 rayDir = normalize(vec3(uv, -1.0)); // Ray direction (negative z-axis)
    
    // Rotate the ray slightly downward to frame the vortex
    rayDir.yz *= rotate2D(0.2);
    
    // Add subtle camera movement based on energy
    rayDir.xy *= rotate2D(sin(t * 0.1) * 0.05 * uEnergy);
    
    // Raymarching loop (100 iterations)
    float z = 0.0; // Distance along the ray
    for (float i = 0.0; i < float(MAX_STEPS); i++) {
        // Current position along the ray
        vec3 p = z * rayDir;
        
        // Apply time-based animation for the scene motion
        p.z += t * 0.3;
        
        // Define multiple vortex centers that move with audio
        vec3 center1 = vec3(0.0, 0.0, 0.0); // Main vortex at the origin
        vec3 center2 = vec3(3.0 + sin(t * 0.2) * uEnergy, 0.0, 2.0); // Second vortex offset to the right
        vec3 center3 = vec3(-3.0 - cos(t * 0.3) * uEnergy, 0.0, 1.0); // Third vortex offset to the left
        vec3 center4 = vec3(0.0, 0.0, -4.0 + sin(t * 0.15) * uLowEnergy * 2.0); // Fourth vortex further back
        
        // Compute the distance to each vortex and take the minimum
        float s1 = vortexShape(p, center1, t, 0.0);
        float s2 = vortexShape(p, center2, t, 0.1 * audioSpeed);
        float s3 = vortexShape(p, center3, t, -0.05 * audioSpeed);
        float s4 = vortexShape(p, center4, t, 0.15 * audioSpeed);
        float s = min(min(s1, s2), min(s3, s4)); // Combine all vortexes
        
        // Raymarching step size (volumetric density)
        float d = STEP_SCALE * (0.005 + 0.5 * max(s, -s * 0.3 * audioTurbulence));
        z += d;
        
        // Simulate light scattering from above (shafts of light)
        float light = 0.7 + 0.5 * cos(p.x * 0.7 + p.z * 0.5 + t * 0.2);
        light *= exp(-z * 0.03);
        light *= 1.0 - smoothstep(0.0, 1.0, abs(p.y));
        
        // Add particulate matter (bubbles and debris) using noise
        float particles = noise(p * 3.0 + t * 0.2) * 0.5;
        
        // Volumetric coloring for the underwater vortex
        vec4 waterColor = vec4(0.1, 0.3, 0.5, 1.0); // Base color: deep blue
        
        // Add audio reactivity to the color
        float colorShift = 0.2 + 0.8 * uHighEnergy; // High frequencies affect color
        waterColor.rgb += vec3(0.0, 0.2 * colorShift, 0.1 * colorShift) * sin(s * 3.0 + t * 0.3);
        waterColor.rgb += vec3(0.5, 0.7, 0.9) * light * (1.0 + uEnergy * 0.5);
        waterColor.rgb += vec3(0.6, 0.7, 0.8) * particles * (1.0 + uTransients);
        
        // Pulse the color on transients
        if (uTransients > 0.3) {
            waterColor.rgb += vec3(0.1, 0.2, 0.3) * uTransients;
        }
        
        waterColor *= exp(-s * 0.5 * audioAmplitude);
        
        // Accumulate color based on density (volumetric rendering)
        o += waterColor * 0.3 / d;
    }
    
    // Apply a tanh to compress the color range
    o = tanh(o * o / 1e7);
    
    // Add a subtle background color for the deep ocean with noise
    float bgNoise = noise(vec3(uv * 5.0, t * 0.1)) * 0.1;
    o += vec4(0.02, 0.05, 0.1, 0.0) * (1.0 - exp(-z * 0.02));
    o += vec4(0.05, 0.1, 0.15, 0.0) * bgNoise;
    
    // Output the final color
    gl_FragColor = o;
} 