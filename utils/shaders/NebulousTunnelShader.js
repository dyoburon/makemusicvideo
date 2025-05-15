/**
 * NebulousTunnelShader.js
 * Exports a cosmic nebulous tunnel shader with audio reactivity.
 * Converted from twigl GEEKEST_300 format to standard GLSL.
 */

const nebulousTunnelShaderSource = `#version 300 es
precision highp float;

// Standard uniforms
uniform vec2 uResolution;
uniform float uTime;

// Audio analysis uniforms
uniform float uEnergy;       // Overall audio energy
uniform float uLowEnergy;    // Low frequency energy
uniform float uHighEnergy;   // High frequency energy
uniform float uTransients;   // Beat detection

// Effect intensity uniforms
uniform float uTransientIntensity;    // Overall intensity of transient effects
uniform float uEnergyCameraEffect;    // How much energy affects camera
uniform float uEnergyColorEffect;     // How much energy affects colors
uniform float uTransientCameraEffect; // How much transients affect camera
uniform float uTransientColorEffect;  // How much transients affect colors

// Tunnel breathing effect uniforms
uniform float uBreathingRate;         // Controls how fast the tunnel breathes
uniform float uBreathingAmount;       // Controls how much the tunnel expands/contracts

// Color uniforms
uniform vec3 uColor1;    // First color for tunnel
uniform vec3 uColor2;    // Second color for tunnel
uniform vec3 uColor3;    // Third color for tunnel
uniform vec3 uFogColor;  // Fog color
uniform vec3 uGlowColor; // Glow color

// Output color
out vec4 fragColor;

// Helper function for rotation
mat2 rot(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, s, -s, c);
}

// Smooth step function for transitions (from RetroTunnelShader.js)
float smootherstep(float edge0, float edge1, float x) {
    x = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}

void main() {
    // Calculate ray direction based on fragment coordinates
    vec3 rayDirection = normalize(vec3(gl_FragCoord.xy * 2.0 - uResolution.xy, -uResolution.y));

    // Subtle camera shift based on audio (extremely minimal)
    vec2 cameraShift = vec2(
        sin(uTime * 0.3) * 0.01 * uLowEnergy * uEnergyCameraEffect,    // Low freq horizontal shift
        cos(uTime * 0.4) * 0.005 * uHighEnergy * uEnergyCameraEffect   // High freq vertical shift
    );
    rayDirection.xy += cameraShift;

    vec4 totalColor = vec4(0.0); // Accumulator for the color
    float z = 0.0; // Accumulator for distance/depth parameter

    // Main loop: iterate 50 times
    for (float i = 1.0; i <= 50.0; i++) {
        // Calculate position
        vec3 p = z * rayDirection;
        p.z += 6.0;

        // Apply rotation with subtle transient-driven variation
        float angle = p.y * 0.5;
        angle += uTransients * uTransientCameraEffect * 0.005; // Extremely subtle rotation tweak
        p.xz *= rot(angle);

        // Inner loop for tunnel shape
        float j;
        for (j = 1.0; j < 9.0; j /= 0.8) {
            vec3 timeOffset = uTime * vec3(3.0, 1.0, 0.0);
            p += cos(ceil(p.yzx - timeOffset) * j) / j;
        }

        // Breathing effect: subtle tunnel expansion based on time and low frequency
        float breathingPhase = sin(uTime * uBreathingRate);
        float breathingFactor = 1.0 + uBreathingAmount * 0.01 * (1.0 + uLowEnergy * uEnergyCameraEffect * 0.1) * breathingPhase;

        // Calculate distance step with breathing effect
        float dist_step = 0.01 + abs(length(p.xz) - 0.5) / 7.0;
        dist_step *= breathingFactor; // Apply breathing to tunnel size
        z += dist_step;

        // Color contribution with subtle audio modulation
        vec4 color_contribution = (cos(z + vec4(0.0, 1.0, 2.0, 0.0)) + 1.1) / dist_step;

        // Apply color1, color2, color3 based on position (z) for retro tunnel aesthetic
        float colorMix = smootherstep(0.0, 50.0, z);
        vec3 baseColor = mix(uColor1, mix(uColor2, uColor3, colorMix), colorMix);

        // Subtle color modulation based on transients and energy
        baseColor *= 1.0 + uTransients * uTransientColorEffect * 0.02; // Very faint brightness boost
        baseColor += uEnergy * uEnergyColorEffect * 0.005 * uGlowColor; // Faint glow tint

        color_contribution.rgb *= baseColor;
        totalColor += color_contribution;
    }

    // Final tonemapping
    totalColor = tanh(totalColor / 1000.0);

    // Add subtle fog effect influenced by high energy
    vec3 fog = uFogColor * (0.05 + uHighEnergy * uEnergyColorEffect * 0.01);
    totalColor.rgb += fog;

    // Add faint glow effect based on transients
    totalColor.rgb += uGlowColor * uTransients * uTransientColorEffect * 0.02;

    // Set final fragment color
    fragColor = vec4(totalColor.rgb, 1.0);
}
`;

export default nebulousTunnelShaderSource; 