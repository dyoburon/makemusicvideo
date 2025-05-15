import React, { useState, useCallback, useRef, useEffect } from 'react';
import styles from './ResizablePanes.module.css';

const ResizablePanes = ({ children, initialSizes = [50, 50], minPaneWidthPercentage = 20 }) => {
    const [paneSizes, setPaneSizes] = useState(initialSizes);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef(null);
    // We don't directly use leftPaneRef and rightPaneRef for resizing logic in this version
    // but they could be useful for other effects or direct manipulations if needed later.
    // const leftPaneRef = useRef(null);
    // const rightPaneRef = useRef(null);

    const handleMouseDown = useCallback((e) => {
        // Prevent text selection while dragging
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleMouseUp = useCallback(() => {
        if (isDragging) {
            setIsDragging(false);
        }
    }, [isDragging]);

    const handleMouseMove = useCallback((e) => {
        if (!isDragging || !containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        let newLeftWidthPercentage = ((e.clientX - containerRect.left) / containerRect.width) * 100;

        // Clamp values to min/max percentages
        newLeftWidthPercentage = Math.max(minPaneWidthPercentage, newLeftWidthPercentage);
        newLeftWidthPercentage = Math.min(100 - minPaneWidthPercentage, newLeftWidthPercentage);

        setPaneSizes([newLeftWidthPercentage, 100 - newLeftWidthPercentage]);
    }, [isDragging, minPaneWidthPercentage]);

    useEffect(() => {
        // Attach global listeners when dragging starts
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            // Add a class to body to change cursor globally or prevent selection
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        } else {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        }

        // Cleanup function
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    // Ensure children is an array
    const childrenArray = React.Children.toArray(children);
    const leftPane = childrenArray[0] || null;
    const rightPane = childrenArray[1] || null;

    if (!leftPane || !rightPane) {
        console.warn("ResizablePanes expects exactly two children elements.");
        return <div className={styles.errorFallback}>ResizablePanes requires two children.</div>;
    }

    return (
        <div ref={containerRef} className={styles.resizablePanesContainer}>
            <div
                /*ref={leftPaneRef}*/
                className={styles.pane}
                style={{ width: `${paneSizes[0]}%` }}
            >
                {leftPane}
            </div>
            <div
                className={styles.divider}
                onMouseDown={handleMouseDown}
                role="separator"
                aria-orientation="vertical"
                aria-valuenow={paneSizes[0]}
                aria-valuemin={minPaneWidthPercentage}
                aria-valuemax={100 - minPaneWidthPercentage}
                tabIndex={0} // Make it focusable for accessibility
                onKeyDown={(e) => { // Basic keyboard support
                    if (e.key === 'ArrowLeft') {
                        setPaneSizes(prev => [Math.max(minPaneWidthPercentage, prev[0] - 1), Math.min(100 - minPaneWidthPercentage, prev[1] + 1)]);
                    } else if (e.key === 'ArrowRight') {
                        setPaneSizes(prev => [Math.min(100 - minPaneWidthPercentage, prev[0] + 1), Math.max(minPaneWidthPercentage, prev[1] - 1)]);
                    }
                }}
            />
            <div
                /*ref={rightPaneRef}*/
                className={styles.pane}
                style={{ width: `${paneSizes[1]}%` }}
            >
                {rightPane}
            </div>
        </div>
    );
};

export default ResizablePanes; 