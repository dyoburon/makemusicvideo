const waveformShaderSrc = `#version 300 es
precision highp float;

// Uniforms provided by ShaderVisualizer and AudioShaderSync
uniform vec2 uResolution; // Canvas resolution (width, height)
uniform float uTime;     // Elapsed time in seconds

// Audio-reactive uniforms
uniform float uEnergy;       // Overall audio energy
uniform float uHighEnergy;   // High frequency energy
uniform float uTransients;   // Beat detection

out vec4 fragColor;

// ShaderToy compatibility defines
#define iResolution vec3(uResolution, 1.0)
#define iTime uTime
#define iChannelTime vec4(uTime, uTime, uTime, uTime)
#define iFragCoord gl_FragCoord
#define iMouse vec4(0.0)

// GLSL-compatible tanh approximation
vec4 tanhApprox(vec4 x) {
    vec4 x2 = x * x;
    return clamp(x * (27.0 + x2) / (27.0 + 9.0 * x2), -1.0, 1.0);
}
float tanhApprox(float x) {
    float x2 = x * x;
    return clamp(x * (27.0 + x2) / (27.0 + 9.0 * x2), -1.0, 1.0);
}

// Vector max function helper
vec3 max_vec3(vec3 a, vec3 b) {
    return max(a, b);
}

// Automatic variable initialization
#define AUTO_INIT_FLOAT(name) float name = 0.0
#define AUTO_INIT_VEC3(name) vec3 name = vec3(0.0)
#define AUTO_INIT_VEC4(name) vec4 name = vec4(0.0)

float simplex_noise(vec3 p) {
    return 0.0; // Placeholder
}

#define tanh(x) tanhApprox(x)

// --- Modified ShaderToy Code ---
void mainImage(out vec4 O, vec2 I)
{
    // Raymarch iterator, step distance, depth and reflection
    float i, d, z, r;
    // Clear fragcolor and raymarch 90 steps
    for(O *= i; i++ < 9e1;
        // Pick color and attenuate with dramatic energy-based boost and color shift
        O += (cos(z * 0.5 + iTime + vec4(0, 2, 4, 3) + uHighEnergy * 0.5) + 1.3) / d / z * 
             (1.0 + uEnergy * 0.2 + uTransients * 0.5)) // Amplified color boost with high-energy tint
    {
        // Raymarch sample point with pronounced camera shake from transients
        vec3 p = z * normalize(vec3(I + I, 0) - iResolution.xyy);
        p.x += uTransients * 0.1 * sin(iTime * 2.0); // Stronger camera shake
        p.y += uTransients * 0.1 * cos(iTime * 2.0);
        p *= (1.0 + uEnergy * 0.05); // Subtle zoom effect based on energy

        // Shift camera and get reflection coordinates
        r = max(-++p, 0.).y;
        // Mirror
        p.y += r + r;

        // Sine waves with slight energy influence
        for(d = 1.; d < 3e1; d += d)
            p.y += cos(p * d + 2. * iTime * cos(d) + z).x / d * 
                   (1.0 + uHighEnergy * 0.1); // High-energy wave amplification

        // Step forward with pronounced transient-based distortion
        z += d = (.1 * r + abs(p.y - 1.) / (++r * r) + max(d = p.z + 3., -d * .1)) / 8. *
                 (1.0 + uTransients * 0.2); // Stronger step size variation
    }
    // Tanh tonemapping with stronger energy influence
    O = tanh(O / (9e2 * (1.0 - uHighEnergy * 0.1)));
}
// --- End Modified ShaderToy Code ---

void main() {
    vec4 color = vec4(0.0, 0.0, 0.0, 1.0);
    mainImage(color, gl_FragCoord.xy);
    fragColor = vec4(color.rgb, 1.0);
}`;

export default waveformShaderSrc;