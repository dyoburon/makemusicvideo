/**
 * ConvertedAbstractSpiralShader.js
 * Exports a converted shader, originally in a compact format.
 * This version uses standard GLSL structure and uniforms.
 */

const convertedAbstractSpiralShaderSource = `#version 300 es
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
uniform float uTransientIntensity;    // Intensity of transient effects
uniform float uEnergyCameraEffect;    // Energy effect on camera
uniform float uEnergyColorEffect;     // Energy effect on colors
uniform float uTransientCameraEffect; // Transients effect on camera
uniform float uTransientColorEffect;  // Transients effect on colors

// Tunnel breathing effect uniforms
uniform float uBreathingRate;         // Speed of tunnel breathing
uniform float uBreathingAmount;       // Amount of tunnel expansion/contraction

// Color uniforms
uniform vec3 uColor1;    // Primary color
uniform vec3 uColor2;    // Secondary color
uniform vec3 uColor3;    // Tertiary color
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

void main() {
    // Calculate ray direction with aspect ratio correction
    vec2 p = (gl_FragCoord.xy * 2.0 - uResolution.xy) / uResolution.y;
    vec3 rayDirection = normalize(vec3(p, -1.0));

    vec4 totalColor = vec4(0.0); // Accumulator for color
    float z = 0.0; // Accumulator for distance/depth

    // Subtle camera offset based on audio
    vec3 cameraOffset = vec3(0.0);
    cameraOffset.x += sin(uTime * 0.3) * uLowEnergy * uEnergyCameraEffect * 0.02; // Low freq horizontal shift
    cameraOffset.y += cos(uTime * 0.4) * uHighEnergy * uEnergyCameraEffect * 0.01; // High freq vertical shift
    cameraOffset.z += uTransients * uTransientIntensity * uTransientCameraEffect * 0.01; // Transient forward pulse

    // Main loop (60 iterations as per original)
    for (float i = 1.0; i <= 60.0; i++) {
        // Calculate position with camera offset
        vec3 pos = (z * rayDirection) + cameraOffset;

        // Shift z forward (as in original)
        pos.z += 6.0;

        // Apply rotation based on pos.z
        float angle = pos.z * 0.4;
        // Subtle rotation speed increase with high frequencies
        angle *= 1.0 + uHighEnergy * uEnergyCameraEffect * 0.01;
        pos.xy *= rot(angle);

        // Inner fractal/deformation loop
        float inner_step;
        for (inner_step = 2.0; inner_step < 15.0; inner_step /= 0.6) {
            pos += cos((pos.yzx + uTime * 3.0) * inner_step) / inner_step;
        }

        // Breathing effect: modulate tunnel size with time and low frequencies
        float breathingPhase = sin(uTime * uBreathingRate);
        float breathingFactor = 1.0 + uBreathingAmount * (0.05 + 0.05 * breathingPhase);
        breathingFactor *= 1.0 + uLowEnergy * uEnergyCameraEffect * 0.02; // Bass enhances breathing

        // Calculate distance step with breathing effect
        float dist = min(length(pos.xy) - 3.0, 4.0 - length(pos));
        dist *= breathingFactor; // Apply breathing to tunnel geometry
        float dist_step = 0.02 + abs(dist) / 8.0;
        z += dist_step;

        // Color contribution with audio-reactive modulation
        vec3 baseColor = uColor1; // Default to primary color
        if (length(pos.xy) > 3.5) baseColor = uColor2; // Secondary color for outer regions
        if (length(pos) > 4.0) baseColor = uColor3; // Tertiary color for far regions

        // Subtle color modulation
        baseColor *= 1.0 + uTransients * uTransientIntensity * uTransientColorEffect * 0.05; // Transient brightness
        baseColor.r *= 1.0 + uLowEnergy * uEnergyColorEffect * 0.02; // Bass boosts red
        baseColor.b *= 1.0 + uHighEnergy * uEnergyColorEffect * 0.02; // High freq boosts blue

        // Accumulate color
        vec4 color_contribution = (sin(z * 0.5 + vec4(6.0, 1.0, 2.0, 0.0)) + 1.1) / dist_step;
        color_contribution.rgb *= baseColor; // Apply modulated color
        totalColor += color_contribution;
    }

    // Apply tonemapping
    totalColor = tanh(totalColor / 1500.0);

    // Subtle fog effect
    float fogStrength = 0.01 + uHighEnergy * uEnergyCameraEffect * 0.005; // High freq enhances fog
    float fogAmount = exp(-z * fogStrength);
    vec3 foggedColor = mix(uFogColor, totalColor.rgb, fogAmount);

    // Subtle glow effect
    vec3 glow = uGlowColor * (uTransients * uTransientIntensity * uTransientColorEffect * 0.1 +
                             uEnergy * uEnergyColorEffect * 0.05);
    foggedColor += glow;

    // Final color output
    fragColor = vec4(foggedColor, 1.0);
}
`;

export default convertedAbstractSpiralShaderSource; 