const neonCubesShaderSource = `#version 300 es
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

// Effect intensity and specific audio component effects
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

// Helper function for rotation
mat2 rot(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, s, -s, c);
}

void main() {
    // Calculate ray direction with subtle audio influence
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    vec2 p = (uv * 2.0 - 1.0);
    p.x *= uResolution.x / uResolution.y; // Aspect ratio correction

    // Subtle camera shake based on transients and low energy
    float cameraShake = uTransients * uTransientIntensity * uTransientCameraEffect * 0.01 + 
                        uLowEnergy * uEnergyCameraEffect * 0.005;
    p += vec2(sin(uTime * 0.5), cos(uTime * 0.5)) * cameraShake;

    vec3 rayDirection = normalize(vec3(p, -1.0));

    vec4 totalColor = vec4(0.0); // Accumulator for the color
    float z = 0.0; // Accumulator for distance/depth parameter

    // Adjust time scale subtly with energy
    float timeScale = 1.0 + uEnergy * uEnergyCameraEffect * 0.01;
    float adjustedTime = uTime * uCameraSpeed * timeScale;

    // Breathing effect for subtle depth modulation
    float breathingPhase = sin(adjustedTime * uBreathingRate);
    float breathingFactor = 1.0 + uBreathingAmount * breathingPhase * 0.05; // Very subtle

    for (float i = 1.0; i <= 70.0; i++) {
        // Calculate position with subtle audio-reactive displacement
        vec3 pos = z * rayDirection * breathingFactor;

        // Subtle position offset with audio
        pos.xz -= adjustedTime;
        float displacement = uHighEnergy * uEnergyCameraEffect * 0.005;
        pos.xy += vec2(sin(pos.z * 0.2), cos(pos.z * 0.2)) * displacement;

        // Calculate 'v' with subtle audio modulation
        vec3 v = cos(pos + sin(pos / (0.4 + uLowEnergy * uEnergyCameraEffect * 0.01) + vec3(0.0, 0.0, adjustedTime))) + 0.5;

        // Distance step with subtle transient influence
        float dist_step = 0.001 + length(max(v, v.yzy * 0.5)) / 5.0;
        dist_step *= 1.0 + uTransients * uTransientIntensity * uTransientCameraEffect * 0.005;

        // Update 'z'
        z += dist_step;

        // Color contribution with audio-reactive color modulation
        vec3 baseColor = mix(uColor1, uColor2, clamp(v.x, 0.0, 1.0));
        baseColor = mix(baseColor, uColor3, clamp(v.y, 0.0, 1.0) * uHighEnergy * uEnergyColorEffect * 0.1);

        // Subtle color pulsing with transients
        float pulse = 1.0 + uTransients * uTransientIntensity * uTransientColorEffect * 0.05;
        baseColor *= pulse;

        // Accumulate color
        vec4 color_contribution = vec4(baseColor, 1.0) * (cos(pos.y + z + vec4(4.0, 6.0, 8.0, 0.0)) + 1.2) / dist_step;
        totalColor += color_contribution;
    }

    // Final tonemapping
    totalColor = tanh(totalColor / 7000.0);

    // Subtle fog effect
    float fogStrength = 0.05 + uEnergy * uEnergyColorEffect * 0.01;
    vec3 fog = uFogColor * fogStrength * z;
    totalColor.rgb += fog;

    // Subtle glow effect
    vec3 glow = uGlowColor * (uTransients * uTransientIntensity * uTransientColorEffect * 0.05 + 
                              uEnergy * uEnergyColorEffect * 0.02);
    totalColor.rgb += glow;

    // Final fragment color
    fragColor = vec4(totalColor.rgb, 1.0);
}`;

export default neonCubesShaderSource;