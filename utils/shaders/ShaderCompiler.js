/**
 * ShaderCompiler.js
 * Utilities to compile and convert shaders for compatibility with twigl
 */

/**
 * Adapts a shader to be compatible with twigl's classic (300) mode
 * 
 * @param {string} shaderSource - Original shader source
 * @return {string} - Transformed shader source compatible with twigl
 */
export function compileForTwiglClassic300(shaderSource) {
    // Check if shader already contains #version directive
    const hasVersionDirective = shaderSource.includes('#version 300 es');

    // Parse the shader to identify uniform declarations, input variables, and output variables
    const uniformRegex = /uniform\s+\w+\s+(\w+);/g;
    const outputRegex = /out\s+\w+\s+(\w+);/g;
    const inRegex = /in\s+\w+\s+(\w+);/g;

    // Find all declared uniforms
    let uniforms = [];
    let match;
    while ((match = uniformRegex.exec(shaderSource)) !== null) {
        uniforms.push(match[1]);
    }

    // Find output variable
    let outputVar = null;
    while ((match = outputRegex.exec(shaderSource)) !== null) {
        outputVar = match[1];
    }

    // Find input variable (usually vTexCoord)
    let inputVar = null;
    while ((match = inRegex.exec(shaderSource)) !== null) {
        inputVar = match[1];
    }

    // Prepare the replacement shader
    let transformedShader = shaderSource;

    // 1. Replace output variable with "outColor" if it's not already "outColor"
    if (outputVar && outputVar !== 'outColor') {
        transformedShader = transformedShader.replace(
            new RegExp(`out\s+vec4\s+${outputVar};`),
            'out vec4 outColor;'
        );
        // Also replace usage in the code
        transformedShader = transformedShader.replace(
            new RegExp(`\b${outputVar}\b\s*=`, 'g'),
            'outColor ='
        );
    }

    // 2. Replace common uniform variables to match twigl's naming conventions
    const uniformMappings = {
        'uTime': { twiglName: 'time', type: 'float' },
        'uResolution': { twiglName: 'resolution', type: 'vec2' },
        'uMouse': { twiglName: 'mouse', type: 'vec2' },
        'uTexture': { twiglName: 'backbuffer', type: 'sampler2D' }
    };

    Object.entries(uniformMappings).forEach(([ourName, twiglInfo]) => {
        if (uniforms.includes(ourName)) {
            // Regex to find the uniform declaration. This is a simplified approach.
            // A more robust regex might capture the original type if we needed to preserve it for other reasons.
            const declarationRegex = new RegExp(`uniform\s+\w+\s+${ourName};`);
            transformedShader = transformedShader.replace(
                declarationRegex,
                `uniform ${twiglInfo.type} ${twiglInfo.twiglName};`
            );
            // Replace any usage of the uniform in the code, with word boundaries
            transformedShader = transformedShader.replace(
                new RegExp(`\b${ourName}\b`, 'g'),
                twiglInfo.twiglName
            );
        }
    });

    // 3. Handle vertex input variable if needed (typically vTexCoord)
    if (inputVar && inputVar !== 'vTexCoord') {
        transformedShader = transformedShader.replace(
            new RegExp(`in\s+vec2\s+${inputVar};`),
            'in vec2 vTexCoord;'
        );
        // Also replace usage in the code
        transformedShader = transformedShader.replace(
            new RegExp(`\b${inputVar}\b`, 'g'),
            'vTexCoord'
        );
    }

    // 4. Ensure it has the #version 300 es directive at the beginning
    if (!hasVersionDirective) {
        transformedShader = '#version 300 es\n' + transformedShader;
    }

    return transformedShader;
}

/**
 * Adapts a shader to be compatible with twigl's classic mode (WebGL 1.0)
 * 
 * @param {string} shaderSource - Original shader source
 * @return {string} - Transformed shader source compatible with twigl classic mode
 */
export function compileForTwiglClassic(shaderSource) {
    // Parse the shader to identify uniform declarations and output variables
    const uniformRegex = /uniform\s+\w+\s+(\w+);/g;

    // Find all declared uniforms
    let uniforms = [];
    let match;
    while ((match = uniformRegex.exec(shaderSource)) !== null) {
        uniforms.push(match[1]);
    }

    // Prepare the replacement shader
    let transformedShader = shaderSource;

    // 1. Remove any #version directive and replace ES 3.0 specific syntax
    transformedShader = transformedShader.replace(/#version\s+300\s+es\s*/g, '');

    // 2. Replace "in" with "varying" for inputs
    transformedShader = transformedShader.replace(/in\s+vec2\s+vTexCoord;/g, 'varying vec2 vTexCoord;');

    // 3. Replace "out vec4 outColor" or similar with gl_FragColor
    transformedShader = transformedShader.replace(/out\s+vec4\s+\w+;/g, '');
    transformedShader = transformedShader.replace(/outColor\s*=/g, 'gl_FragColor =');
    transformedShader = transformedShader.replace(/fragColor\s*=/g, 'gl_FragColor =');

    // 4. Replace common uniform variables to match twigl's naming conventions
    const uniformMappings = {
        'uTime': 'time',
        'uResolution': 'resolution',
        'uMouse': 'mouse',
        'uTexture': 'backbuffer'
    };

    Object.entries(uniformMappings).forEach(([ourName, twiglName]) => {
        if (uniforms.includes(ourName)) {
            // Replace both the declaration and the usage
            transformedShader = transformedShader.replace(
                new RegExp(`uniform\\s+\\w+\\s+${ourName};`),
                `uniform float ${twiglName};`
            );
            // Replace any usage of the uniform in the code
            transformedShader = transformedShader.replace(
                new RegExp(`${ourName}`, 'g'),
                twiglName
            );
        }
    });

    // 5. Add precision if it doesn't exist
    if (!transformedShader.includes('precision')) {
        transformedShader = 'precision highp float;\n' + transformedShader;
    }

    // 6. Replace texture() with texture2D()
    transformedShader = transformedShader.replace(/texture\(/g, 'texture2D(');

    return transformedShader;
}

/**
 * Create a complete shader setup for RetroTunnelShader that works with twigl
 * 
 * @param {string} mode - The twigl mode to use ('classic', 'classic300', etc.)
 * @param {Object} defaultValues - Default values for the uniforms
 * @return {string} - The transformed shader source
 */
export function createTwiglCompatibleRetroTunnelShader(mode = 'classic300', defaultValues = {}) {
    // Import the original shader source
    const { default: retroTunnelShaderSource } = require('./RetroTunnelShader.js');

    // Define default values for all the custom uniforms
    const defaultUniforms = {
        uCameraSpeed: 1.0,
        uTransients: 0.0,
        uEnergy: 0.5,
        uLowEnergy: 0.2,
        uHighEnergy: 0.1,
        uTransientIntensity: 0.3,
        uEnergyCameraEffect: 0.05,
        uEnergyColorEffect: 1.0,
        uTransientCameraEffect: 1.0,
        uTransientColorEffect: 1.0,
        uBreathingRate: 0.2,
        uBreathingAmount: 0.006,
        uSwirlIntensity: 0.15,
        uNoiseScale: 0.8,
        uVignetteStrength: 0.6,
        uRandomizeFogColor: 0.0, // Boolean represented as float
        uColor1: [0.8, 0.2, 0.2],
        uColor2: [0.2, 0.8, 0.2],
        uColor3: [0.2, 0.2, 0.8],
        uFogColor: [0.05, 0.05, 0.1],
        uGlowColor: [0.8, 0.3, 0.1]
    };

    // Merge with provided default values
    const mergedDefaults = { ...defaultUniforms, ...defaultValues };

    // Transform the shader based on mode
    let transformedShader;
    if (mode === 'classic300') {
        transformedShader = compileForTwiglClassic300(retroTunnelShaderSource);
    } else {
        transformedShader = compileForTwiglClassic(retroTunnelShaderSource);
    }

    return transformedShader;
}

export default {
    compileForTwiglClassic300,
    compileForTwiglClassic,
    createTwiglCompatibleRetroTunnelShader
}; 