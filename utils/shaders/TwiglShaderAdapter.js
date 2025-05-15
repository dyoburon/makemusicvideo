/**
 * Utility class for working with twigl-style shaders in AudioShaderSync
 */

// Minimal noise functions implementation as an inline string instead of an import
const MINIMAL_NOISE_FUNCTIONS = `
float mod289(float x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec2 mod289(vec2 x) {return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec3 mod289(vec3 x) {return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 mod289(vec4 x) {return x - floor(x * (1.0 / 289.0)) * 289.0;}
float permute(float x){return mod289(((x*34.0)+1.0)*x);}
vec3 permute(vec3 x) {return mod289(((x*34.0)+1.0)*x);}
vec4 permute(vec4 x) {return mod289(((x*34.0)+1.0)*x);}
float taylorInvSqrt(float r){return 1.79284291400159 - 0.85373472095314 * r;}
vec4 taylorInvSqrt(vec4 r) {return 1.79284291400159 - 0.85373472095314 * r;}
`;

export class TwiglShaderAdapter {
    /**
     * Detects if a shader uses twigl syntax
     * @param {string} shaderSource - The shader source code to check
     * @returns {boolean} - True if it appears to be a twigl shader
     */
    static isTwiglShader(shaderSource) {
        // If it doesn't have void main() but uses FC, r, m, t variables
        return (
            !shaderSource.includes('void main') &&
            (shaderSource.includes('FC.') ||
                /\br\b/.test(shaderSource) ||
                /\bm\b/.test(shaderSource) ||
                /\bt\b/.test(shaderSource))
        );
    }

    /**
     * Adapts a twigl shader to work with AudioShaderSync
     * @param {string} twiglCode - The twigl shader code
     * @param {number} [mode=7] - Twigl mode (default is GEEKEST_300)
     * @returns {string} - The adapted shader code
     */
    static adaptTwiglShader(twiglCode, mode = 7) {
        // If it's a GEEKEST_300 style shader (mode 7)
        if (mode === 7 || mode === 3) {
            return `#version 300 es
precision highp float;

// AudioShaderSync uniforms
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform float uTime;
uniform float energy;
uniform float lowEnergy;
uniform float midEnergy;
uniform float highEnergy;
uniform float transients;
uniform sampler2D texture;

// Twigl shortcuts
#define FC gl_FragCoord
#define r uResolution
#define m uMouse
#define t uTime
#define f float(0.0) // Frame count not available, use a constant
#define s energy
#define b texture

// Output variable
out vec4 fragColor;
#define o fragColor

// Common helper functions
${MINIMAL_NOISE_FUNCTIONS}

void main() {
  // Initialize output to avoid uninitialized variable errors
  o = vec4(0.0, 0.0, 0.0, 1.0);
  
  // User shader code
  ${twiglCode}
}`;
        } else {
            // For other modes, return a version with appropriate mappings
            // This is a simplified implementation, might need to be expanded
            return `#version 300 es
precision highp float;

// AudioShaderSync uniforms
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform float uTime;
uniform float energy;
uniform sampler2D texture;

// Twigl shortcuts
#define FC gl_FragCoord
#define r uResolution
#define m uMouse
#define t uTime

// Output variable
out vec4 fragColor;
#define o fragColor

// Common helper functions
${MINIMAL_NOISE_FUNCTIONS}

void main() {
  // Initialize output to avoid uninitialized variable errors
  o = vec4(0.0, 0.0, 0.0, 1.0);
  
  // User shader code
  ${twiglCode}
}`;
        }
    }

    /**
     * Creates a wrapper that can be used with ShaderManager
     * @param {string} twiglCode - The twigl shader source
     * @param {object} options - Additional options
     * @returns {object} - A shader object compatible with ShaderManager
     */
    static createTwiglShaderWrapper(twiglCode, options = {}) {
        const name = options.name || 'TwiglShader';
        const mode = options.mode || 7;

        return {
            name,
            fragSrc: this.adaptTwiglShader(twiglCode, mode),
            isTwigl: true,
            originalCode: twiglCode
        };
    }
}

/**
 * Adapter function for ShaderManager to use with twigl shaders
 * @param {string} shaderCode - The shader code to adapt
 * @returns {string} - Adapted shader code
 */
export function adaptShaderForTwigl(shaderCode) {
    if (TwiglShaderAdapter.isTwiglShader(shaderCode)) {
        return TwiglShaderAdapter.adaptTwiglShader(shaderCode);
    }
    return shaderCode;
} 