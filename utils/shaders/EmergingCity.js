const emergingCityShaderSource = `#version 300 es
precision highp float; // High precision for complex calculations

// Standard uniforms
uniform vec2 uResolution;
uniform float uTime;

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
uniform vec3 uColor1; // Primary color
uniform vec3 uColor2; // Secondary color
uniform vec3 uColor3; // Tertiary color
uniform vec3 uFogColor; // Fog color
uniform vec3 uGlowColor; // Glow color

// Output color
out vec4 fragColor;

// Smooth step function for subtle transitions
float smootherstep(float edge0, float edge1, float x) {
    x = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}

void main() {
    // Calculate ray direction based on fragment coordinates
    vec3 rayDirection = normalize(vec3(gl_FragCoord.xy * 2.0 - uResolution.xy, -uResolution.y));

    vec4 totalColor = vec4(0.0); // Accumulator for color
    float z = 0.0; // Accumulator for depth/distance

    // Subtle camera modulation: Low frequencies cause faint depth oscillation
    float cameraOffset = uLowEnergy * uEnergyCameraEffect * 0.01; // Extremely subtle
    z += sin(uTime * 0.1) * cameraOffset;

    // Breathing effect: Subtle modulation of step size
    float breathingPhase = sin(uTime * uBreathingRate);
    float breathingFactor = 1.0 + uBreathingAmount * breathingPhase * 0.005; // Very subtle expansion

    // Main loop: 100 iterations
    for (float i = 1.0; i <= 100.0; i++) {
        // Calculate position
        vec3 p = z * rayDirection;

        // Update position with subtle audio-reactive displacement
        p += 0.15;
        p.xy += vec2(
            sin(uTime * 0.1) * uTransients * uTransientIntensity * uTransientCameraEffect * 0.005,
            cos(uTime * 0.1) * uTransients * uTransientIntensity * uTransientCameraEffect * 0.005
        ); // Subtle transient-driven wobble

        // Calculate vector v
        vec3 v = vec3(
            atan(p.x, p.y) - uTime * 0.1,
            length(p.xy),
            p.z / 0.2 - uTime
        );

        // Subtle audio modulation of v: High frequencies affect rotation slightly
        v.x += uHighEnergy * uEnergyCameraEffect * 0.005; // Minimal rotation tweak

        // Calculate step size
        vec3 v_temp = sin(v * 7.0 + cos(v / 0.03 - uTime));
        v = v_temp;
        vec3 v_compare = v.yzx * 0.1;
        float dist_step = length(max(v, v_compare)) / 100.0;

        // Apply breathing factor to step size
        dist_step *= breathingFactor;

        // Update depth
        z += dist_step;

        // Base color contribution
        vec4 color_contribution = (sin((p.z - uTime * 0.2) * vec4(3.0, 5.0, 9.0, 4.0)) + 1.0) / dist_step;

        // Subtle color modulation: Use uColor1, uColor2, uColor3 based on depth
        vec3 baseColor = uColor1;
        if (z > 10.0) baseColor = uColor2;
        if (z > 20.0) baseColor = uColor3;

        // Apply faint audio-reactive color boost
        baseColor *= 1.0 + uTransients * uTransientIntensity * uTransientColorEffect * 0.01; // Subtle transient brightness
        baseColor += uHighEnergy * uEnergyColorEffect * uGlowColor * 0.005; // Faint glow from high frequencies

        // Apply color to contribution
        color_contribution.rgb *= baseColor;

        // Subtle fog effect: Accumulate fog based on depth
        float fogStrength = 0.01 + uEnergy * uEnergyCameraEffect * 0.002; // Very subtle fog
        float fogAmount = exp(-z * fogStrength);
        color_contribution.rgb = mix(uFogColor, color_contribution.rgb, fogAmount);

        totalColor += color_contribution;
    }

    // Final tonemapping
    totalColor = tanh(totalColor / 100000.0);

    // Subtle post-processing: Add faint glow and vignette
    vec2 q = gl_FragCoord.xy / uResolution.xy;
    totalColor.rgb += uGlowColor * uTransients * uTransientIntensity * uTransientColorEffect * 0.01; // Faint glow
    // totalColor.rgb *= pow(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), 0.1) * 0.6 + 0.4; // Optional vignette (commented out)

    // Set final fragment color
    fragColor = vec4(totalColor.rgb, 1.0);
}`;

export default emergingCityShaderSource;