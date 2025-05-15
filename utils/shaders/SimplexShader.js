/**
 * SimplexShader.js
 * This is a standalone version, not requiring the ShaderToy wrapper.
 */

const simplexShaderSource = `#version 300 es
precision highp float; // ShaderToy often uses highp

// Uniforms that were previously provided by the ShaderToy wrapper
uniform vec2 uResolution; // Canvas resolution (width, height)
uniform float uTime;     // Elapsed time in seconds

// Audio-reactive uniforms (declared for consistency with other shaders, though not used by this specific one)
uniform float energy;
uniform float lowEnergy;
uniform float midEnergy;
uniform float highEnergy;
uniform float transients;

// --- New uniforms from AudioShaderControls.js ---

// Color controls
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uFogColor;
uniform vec3 uGlowColor;

// Camera & movement controls
uniform float uCameraSpeed; // Already used by ShaderUpdate.js

// Tunnel breathing controls
uniform float uBreathingRate; // Already used by ShaderUpdate.js
uniform float uBreathingAmount; // Already used by ShaderUpdate.js

// Effect intensity
uniform float uTransientIntensity; // Corresponds to transientEffect, as used in ShaderUpdate.js
uniform float uColorIntensity;

// Audio effect intensity controls
uniform float uEnergyCameraEffect; // Already used by ShaderUpdate.js
uniform float uEnergyColorEffect; // Already used by ShaderUpdate.js
uniform float uTransientCameraEffect; // Already used by ShaderUpdate.js
uniform float uTransientColorEffect; // Already used by ShaderUpdate.js

// Advanced camera movement parameters
uniform float uBaseCameraSpeed;
uniform float uMaxCameraSpeedBoostFactor;
uniform float uTransientThresholdForSpeedBoost;
uniform float uEnergyBoostFactor;

// Timing and smoothing parameters (durations)
uniform float uCameraSpeedSmoothingDuration;
uniform float uColorSmoothingDuration;
uniform float uSmoothingDuration;

// Color mode toggle
uniform bool uUseColorControls;

// Standard output for a fragment shader
out vec4 fragColor;

// If this shader were to use texture coordinates from a vertex shader,
// it would be declared as: in vec2 vTexCoord;
// However, this shader uses gl_FragCoord directly to emulate ShaderToy's 'I'.

void main()
{
    // Replicating ShaderToy 'I' input (pixel coordinates)
    vec2 I = gl_FragCoord.xy;

    // Replicating ShaderToy 'iResolution' uniform (vec3)
    // The z-component is often 1.0 (pixelAspectRatio) or uResolution.y, depending on the shader.
    // The original wrapper used vec3(uResolution, 1.0)
    vec3 iResolution = vec3(uResolution, 1.0);

    // Replicating ShaderToy 'iTime' uniform
    float iTime = uTime;

    // --- Original mainImage logic, adapted ---
    // Variable names from the 'mainImage(out vec4 O, vec2 I)' version:
    // O -> fragColor
    // i (iterator) -> loop_iter
    // v (temp vec3) -> temp_v

    float loop_iter = 0.0;
    float z_depth = 0.0; // 'z' from original
    float d_step;        // 'd' from original
    vec3 temp_v;

    // Initialize output color.
    fragColor = vec4(0.0, 0.0, 0.0, 0.0); // Start with zero alpha too

    for(; loop_iter < 50.0; loop_iter++)
    {
        // Original calculation for point 'p'
        vec3 p = z_depth * normalize(vec3(I + I - iResolution.xy, -iResolution.y));

        // --- Camera Speed Integration ---
        // Modulate time by uCameraSpeed and audio-reactive camera effects
        float camSpeedFactor = uCameraSpeed * (1.0 + energy * uEnergyCameraEffect + transients * uTransientCameraEffect);
        // Scroll 'p' in time
        p.z -= iTime * camSpeedFactor; // Use the calculated effective time
        
        // --- Breathing Effect ---
        // Modulate p.xy for tunnel breathing effect
        // A small multiplier (e.g., 0.01 to 0.05) for uBreathingAmount might be needed depending on desired strength
        p.xy *= (1.0 + sin(iTime * uBreathingRate) * uBreathingAmount * 0.02); 

        // Compute distance for sine pattern
        temp_v = cos(p) - sin(p).yzx; 
        d_step = 0.0001 + 0.5 * length(max(temp_v, temp_v.yzx * 0.2)); // Added 1e-4 for safety
        z_depth += d_step;

        // --- Determine the base color contribution ---
        vec3 baseColorContribution;

        if (uUseColorControls) {
            // --- New 3-Color Energy-Modulated Blending Logic ---
            
            // 1. Modulate base colors by energy (e.g., pulse brightness)
            // Adjust (0.7 + 0.6 * energy) for desired sensitivity and range
            float energyMod = 0.7 + 0.6 * energy; 
            vec3 eColor1 = uColor1 * energyMod;
            vec3 eColor2 = uColor2 * energyMod;
            vec3 eColor3 = uColor3 * energyMod;

            // 2. Spatially blend these three energy-modulated colors.
            // Using a factor from p.z and loop_iter to cycle through mixing them.
            // Adjust multipliers for p.z (0.1) and loop_iter (0.01) for desired pattern speed/scale.
            float mixFactor = fract(p.z * 0.1 + loop_iter * 0.01); 

            if (mixFactor < 0.33333) {
                baseColorContribution = mix(eColor1, eColor2, smoothstep(0.0, 0.33333, mixFactor));
            } else if (mixFactor < 0.66666) {
                baseColorContribution = mix(eColor2, eColor3, smoothstep(0.33333, 0.66666, mixFactor));
            } else {
                baseColorContribution = mix(eColor3, eColor1, smoothstep(0.66666, 1.0, mixFactor));
            }
            // Ensure colors resulting from modulation/mixing don't go negative.
            baseColorContribution = max(baseColorContribution, vec3(0.0));

        } else {
            // Fallback: Use the original Simplex noise inspired coloring if not using color controls
            // This was the (cos(p) + 1.2) part from the original shader before extensive color edits.
            baseColorContribution = cos(p) + 1.2;
        }

        // Apply overall color intensity (applies to both modes)
        baseColorContribution *= uColorIntensity;

        // Apply audio-reactive color effects (multiplicative, applies to both modes)
        baseColorContribution *= (1.0 + energy * uEnergyColorEffect + transients * uTransientColorEffect);
        
        // Additive glow effect, scaled by transients and transient intensity (applies to both modes)
        // uGlowColor alpha component could be used for glow strength if it were vec4
        baseColorContribution += uGlowColor * transients * uTransientIntensity;

        // Apply fog
        // Adjust fogDensityFactor (e.g., 0.01 to 0.1) for desired fog strength
        float fogDensityFactor = 0.03; 
        float fogFactor = clamp(z_depth * fogDensityFactor, 0.0, 1.0);
        baseColorContribution = mix(baseColorContribution, uFogColor, fogFactor);
        
        // Accumulate color
        // The division by d_step is kept from the original
        fragColor.rgb += baseColorContribution / d_step;
    }
    
    // Tonemapping
    fragColor /= (fragColor + 1000.0);
    
    // Ensure final alpha is 1.0, as the ShaderToy wrapper used to do.
    fragColor.a = 1.0;
}
`;

export default simplexShaderSource; 