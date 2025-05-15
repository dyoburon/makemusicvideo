import React, { useState, useEffect } from 'react';
import styles from '../styles/ShaderEditor.module.css';

/**
 * Shader Editor component that allows editing and applying shader code changes
 */
const ShaderEditor = ({ shaderCode, onApplyShader }) => {
    const [tempShaderCode, setTempShaderCode] = useState(shaderCode || '');
    const [isEdited, setIsEdited] = useState(false);

    // Update internal state when shader code prop changes
    useEffect(() => {
        setTempShaderCode(shaderCode || '');
        setIsEdited(false);
    }, [shaderCode]);

    // Handle shader code changes in textarea
    const handleShaderCodeChange = (e) => {
        setTempShaderCode(e.target.value);

        // When user starts editing, mark as edited
        if (e.target.value !== shaderCode) {
            setIsEdited(true);
        }
    };

    // Apply shader changes
    const applyShaderChanges = () => {
        if (onApplyShader && tempShaderCode) {
            onApplyShader(tempShaderCode);
            setIsEdited(false); // Reset edited state after applying
        }
    };

    // Clear shader code
    const clearShaderCode = () => {
        setTempShaderCode('');
        setIsEdited(false);
        if (onApplyShader) {
            onApplyShader('');
        }
    };

    // Handle keyboard shortcuts
    const handleKeyDown = (e) => {
        // If Ctrl+Enter or Cmd+Enter is pressed, apply shader changes
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            applyShaderChanges();
        }
    };

    return (
        <div className={styles.shaderEditor}>
            <div className={styles.editorHeader}>
                <h3 className={styles.editorTitle}>
                    {isEdited ? 'Modified Shader Code' : 'Shader Editor'}
                </h3>
                <div className={styles.editorInfo}>
                    Press Ctrl+Enter or Cmd+Enter to apply changes
                </div>
            </div>
            <div className={styles.textareaContainer}>
                <textarea
                    value={tempShaderCode}
                    onChange={handleShaderCodeChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Edit GLSL fragment shader code here..."
                    className={styles.shaderTextarea}
                    spellCheck="false"
                />
            </div>
            <div className={styles.buttonContainer}>
                <button
                    onClick={clearShaderCode}
                    className={styles.clearButton}
                    disabled={!tempShaderCode}
                >
                    Clear Shader
                </button>
                <button
                    onClick={applyShaderChanges}
                    className={styles.applyButton}
                    disabled={!tempShaderCode || (tempShaderCode === shaderCode)}
                >
                    Apply Shader
                </button>
            </div>
        </div>
    );
};

export default ShaderEditor;
