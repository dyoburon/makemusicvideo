// utils/shaders/GhostlySpiritsShader.js

const ghostlySpiritsShaderSource = `#version 300 es
precision highp float;

// Standard uniforms
uniform vec2 uResolution;
uniform float uTime;
uniform float uCameraSpeed; // Controls movement speed through tunnel

// Audio analysis uniforms
uniform float uTransients;   // Beat detection
uniform float uEnergy;       // Overall audio energy
uniform float uLowEnergy;    // Low frequency energy
uniform float uHighEnergy;   // High frequency energy

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
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uFogColor;
uniform vec3 uGlowColor;

// Output color
out vec4 fragColor;

// Helper function for rotation
mat2 rot(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, s, -s, c);
}

void main() {
    // Calculate ray direction based on fragment coordinates
    vec3 rayDirection = normalize(vec3(gl_FragCoord.xy * 2.0 - uResolution.xy, -uResolution.y));

    // Subtle camera offset based on audio (similar to bsMo in RetroTunnelShader)
    vec2 cameraOffset = vec2(0.0);
    cameraOffset.x += sin(uTime * 0.3) * 0.01 * (1.0 + uLowEnergy * uEnergyCameraEffect * 0.005); // Extremely subtle low-frequency sway
    cameraOffset.y += cos(uTime * 0.4) * 0.005 * uHighEnergy * uEnergyCameraEffect * 0.005; // Extremely subtle high-frequency sway

    vec4 totalColor = vec4(0.0); // Accumulator for the color
    float z = 0.0; // Accumulator for distance/depth parameter

    // Main loop
    for (float i = 1.0; i <= 100.0; i++) {
        // Calculate position 'p' with camera offset
        vec3 p = z * rayDirection;
        p.xy += cameraOffset; // Apply subtle audio-reactive camera offset

        // Time-dependent offset adjusted by camera speed
        p.z -= 5.0 * uTime * uCameraSpeed;

        // Apply rotation with subtle high-frequency variation
        float angle = z * 0.1 + uTime * 0.1;
        angle += uHighEnergy * uEnergyCameraEffect * 0.002; // Extremely subtle rotation speed increase
        p.xy *= rot(angle);

        // Inner fractal loop
        float inner_step;
        for (inner_step = 1.0; inner_step < 9.0; inner_step /= 0.7) {
            p += cos(p.yzx * inner_step + uTime) / inner_step;
        }

        // Subtle breathing effect for distance step
        float breathingPhase = sin(uTime * uBreathingRate);
        float breathingFactor = 1.0 + uBreathingAmount * (0.01 + 0.01 * breathingPhase) * (1.0 + uTransients * uTransientIntensity * uTransientCameraEffect * 0.005); // Very subtle beat-driven breathing
        float dist_step = (0.02 + abs(2.0 - dot(cos(p), sin(p.yzx * 0.6))) / 8.0) * breathingFactor;
        z += dist_step;

        // Accumulate color with subtle audio-reactive tint
        vec4 color_contribution = vec4(z / 7.0, 2.0, 3.0, 1.0) / dist_step;
        color_contribution.rgb *= 1.0 + uTransients * uTransientIntensity * uTransientColorEffect * 0.005; // Extremely subtle brightness pulse on beats
        totalColor += color_contribution;
    }

    // Final tonemapping
    totalColor = tanh(totalColor * totalColor / 10000000.0);

    // Subtle color modulation with audio-reactive glow
    vec3 audioReactiveGlow = uGlowColor * (uTransients * uTransientIntensity * uTransientColorEffect * 0.01 + uEnergy * uEnergyColorEffect * 0.005);
    totalColor.rgb += audioReactiveGlow; // Very subtle glow effect

    // Apply color uniforms for base tint (default to original behavior if not set)
    vec3 finalColor = totalColor.rgb;
    finalColor = mix(finalColor, uColor1, 0.1 + uEnergy * uEnergyColorEffect * 0.005); // Subtle shift toward uColor1 based on energy

    // Set final fragment color
    fragColor = vec4(finalColor, 1.0);
}
`;

export default ghostlySpiritsShaderSource; 