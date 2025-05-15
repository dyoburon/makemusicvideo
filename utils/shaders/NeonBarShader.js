/**
 * NeonBarShader.js
 * Exports a neon bar shader adapted from ShaderToy to work with our WebGL setup.
 */

const neonBarShaderSource = `#version 300 es
precision highp float;

// Input from vertex shader
in vec2 vTexCoord;

// Uniforms provided by ShaderVisualizer
uniform vec2 uResolution;
uniform float uTime;

// Audio reactive uniforms
uniform float uEnergy;
uniform float uLowEnergy;
uniform float uHighEnergy;
uniform float uTransients;

// Output color
out vec4 fragColor;

// GLSL-compatible tanh approximation
vec4 tanhApprox(vec4 x) {
    vec4 x2 = x * x;
    return clamp(x * (27.0 + x2) / (27.0 + 9.0 * x2), -1.0, 1.0);
}

void main() {
    // Convert from vTexCoord to ShaderToy-style coordinates
    vec2 I = vec2(vTexCoord.x * uResolution.x, (1.0 - vTexCoord.y) * uResolution.y);
    float t = uTime;
    
    // Add audio reactivity
    t *= 0.5 + 0.5 * uHighEnergy; // Speed based on high frequencies
    float intensity = 1.0 + 3.0 * uEnergy; // Overall intensity
    float pulseEffect = 1.0 + uTransients * 2.0; // Add pulse effect on transients
    
    float i, z = 0.0, d, s;
    vec4 O = vec4(0.0);
    
    // Number of raymarching steps - higher for better quality but might impact performance
    float steps = 30.0 + 10.0 * uEnergy; // More detail with higher energy
    
    for(i = 0.0; i < steps; i++) {
        // Ray direction calculation adapted for our coordinate system
        vec3 p = z * normalize(vec3((I / uResolution.y * 2.0 - vec2(1.0, uResolution.x/uResolution.y)) * 2.0, 0.0) - vec3(uResolution.x, uResolution.y, uResolution.x)/uResolution.y);
        
        // Camera position adjustment
        p.z += 2.0; // Camera moved back
        
        // Rotation matrix for animation
        float ct = cos(t), st = sin(t);
        mat2 rot = mat2(ct, -st, st, ct);
        p.yz *= rot;
        
        // Distance field function - a cosine-based shape
        s = dot(cos(p), cos(p.yzx / 0.6));
        
        // Step along the ray
        z += d = 0.2 * max(0.2 + abs(s), length(p) - 4.0);
        
        // Define neon colors
        vec3 neonColors[4];
        neonColors[0] = vec3(1.0, 0.0, 0.7); // Pink
        neonColors[1] = vec3(0.0, 0.7, 1.0); // Cyan
        neonColors[2] = vec3(0.0, 1.0, 0.2); // Green
        neonColors[3] = vec3(0.0, 1.0, 1.0); // Turquoise
        
        // Audio reactive color selection
        float colorIndex = mod(p.y + t * 0.5 + uLowEnergy * 2.0, 4.0);
        int idx = int(floor(colorIndex));
        int nextIdx = (idx + 1) % 4;
        float frac = fract(colorIndex);
        vec3 col = mix(neonColors[idx], neonColors[nextIdx], frac);
        
        // Add color contribution with audio reactivity
        O += vec4(col * (2.0 + 0.5 * sin(t + p.y)) * intensity * pulseEffect, 0.0) / d;
    }
    
    // Apply exposure tone mapping (replacing tanh)
    vec4 finalColorAppliedTahn = tanhApprox(O / (1000.0 / (1.0 + uEnergy * 2.0)));
    
    // Output the final color, ensuring alpha is 1.0 for visibility
    fragColor = vec4(finalColorAppliedTahn.rgb, 1.0);
}`;

export default neonBarShaderSource; 