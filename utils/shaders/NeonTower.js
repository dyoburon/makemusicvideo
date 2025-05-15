const neonTowerShaderSource = `#version 300 es
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
uniform float uTransientIntensity;    // Intensity of transient effects
uniform float uEnergyCameraEffect;    // Energy effect on camera/motion
uniform float uEnergyColorEffect;     // Energy effect on colors
uniform float uTransientCameraEffect; // Transients effect on camera
uniform float uTransientColorEffect;  // Transients effect on colors

// Tunnel breathing effect uniforms
uniform float uBreathingRate;         // Speed of tunnel breathing
uniform float uBreathingAmount;       // Amount of tunnel expansion/contraction

// Color uniforms
uniform vec3 uColor1; // Primary color
uniform vec3 uColor2; // Secondary color
uniform vec3 uColor3; // Tertiary color
uniform vec3 uFogColor; // Fog color
uniform vec3 uGlowColor; // Glow color

// Output color
out vec4 fragColor;

// Utility functions from RetroTunnelShader.js
float smootherstep(float edge0, float edge1, float x) {
    x = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}

float getsat(vec3 c) {
    float mi = min(min(c.x, c.y), c.z);
    float ma = max(max(c.x, c.y), c.z);
    return (ma - mi) / (ma + 1e-7);
}

vec3 iLerp(vec3 a, vec3 b, float x) {
    return mix(a, b, x);
}

void main() {
    // Calculate ray direction
    vec3 rayDirection = normalize(vec3(gl_FragCoord.xy * 2.0 - uResolution.xy, -uResolution.y));

    vec4 totalColor = vec4(0.0);
    float z = 0.0;

    // Subtle audio-reactive breathing effect
    float breathingPhase = sin(uTime * uBreathingRate);
    float breathingFactor = 1.0 + uBreathingAmount * 0.01 * (1.0 + uLowEnergy * uEnergyCameraEffect * 0.05) * breathingPhase;

    for (float i = 1.0; i <= 70.0; i++) {
        vec3 p = z * rayDirection;
        p.z += 2.0;

        // Apply subtle breathing to position
        p.xy *= breathingFactor;

        float d = length(p.xz);

        // Subtle transient effect on motion
        float transientMotion = 1.0 + uTransients * uTransientIntensity * uTransientCameraEffect * 0.02;
        float energyMotion = 1.0 + uEnergy * uEnergyCameraEffect * 0.01;
        vec2 cosInput = vec2(log(d), p.y / d + atan(p.x, p.z) * 0.5 + uTime * uCameraSpeed) * 4.0;
        d *= 0.1 * length(cos(cosInput)) * transientMotion * energyMotion;

        z += d;

        // Base color contribution
        vec4 colorContribution = (cos(p.y + z + vec4(0.0, 2.0, 5.0, 3.0)) + 1.2) / d;

        // Subtle audio-reactive color modulation
        vec3 colorMod = uColor1; // Default to uColor1
        if (uTransients * uTransientIntensity * uTransientColorEffect > 0.1) {
            colorMod = iLerp(colorMod, uColor2, uTransients * uTransientIntensity * uTransientColorEffect * 0.05);
        }
        if (uLowEnergy * uEnergyColorEffect > 0.3) {
            colorMod.r += uLowEnergy * uEnergyColorEffect * 0.03; // Subtle red boost
        }
        if (uHighEnergy * uEnergyColorEffect > 0.3) {
            colorMod.b += uHighEnergy * uEnergyColorEffect * 0.03; // Subtle blue boost
        }
        colorContribution.rgb *= colorMod * (1.0 + uEnergy * uEnergyColorEffect * 0.02);

        totalColor += colorContribution;
    }

    // Tonemapping
    totalColor = tanh(totalColor / 2000.0);

    // Subtle fog effect
    float fogStrength = 0.01 + uHighEnergy * uEnergyCameraEffect * 0.005;
    float fogT = exp(z * fogStrength - 2.0);
    vec4 fogColor = vec4(uFogColor, 0.05);
    fogColor.rgb *= 1.0 + uTransients * uTransientIntensity * uTransientColorEffect * 0.05;
    totalColor += fogColor * clamp(fogT, 0.0, 1.0);

    // Subtle glow effect
    vec3 audioReactiveGlow = uGlowColor * (uTransients * uTransientIntensity * uTransientColorEffect * 0.05 + uEnergy * uEnergyColorEffect * 0.02);
    totalColor.rgb += audioReactiveGlow * 0.1;

    // Final color with subtle energy-based saturation
    totalColor.rgb = iLerp(totalColor.rgb, totalColor.rgb * (1.0 + getsat(totalColor.rgb) * uEnergy * uEnergyColorEffect * 0.02), 0.5);

    fragColor = vec4(totalColor.rgb, 1.0);
}`;

export default neonTowerShaderSource;