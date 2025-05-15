import '../styles/globals.css';
import type { AppProps } from 'next/app';
import React, { useState, useEffect } from 'react';
import MobileWarning from '../components/MobileWarning'; // Assuming components is at ../ from pages

function MyApp({ Component, pageProps }: AppProps) {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkTouchDevice = () => {
            // Check for touch events or maxTouchPoints
            const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
            // Optionally, check for coarse pointer (often indicates touch)
            const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
            setIsMobile(hasTouch || hasCoarsePointer);
        };

        checkTouchDevice();
        // Optional: re-check on resize if screen size might change pointer type (less common)
        // window.addEventListener('resize', checkTouchDevice);
        // return () => window.removeEventListener('resize', checkTouchDevice);
    }, []);

    if (isMobile) {
        return <MobileWarning />;
    }

    return <Component {...pageProps} />;
}

export default MyApp; 