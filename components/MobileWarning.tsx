import React from 'react';

const MobileWarning: React.FC = () => {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                textAlign: 'center',
                padding: '20px',
                backgroundColor: '#f0f0f0',
                color: '#333',
            }}
        >
            <h1 style={{ fontSize: '2em', marginBottom: '20px' }}>Mobile Support Coming Soon!</h1>
            <p style={{ fontSize: '1.2em', lineHeight: '1.6' }}>
                This site is not yet optimized for mobile devices.
            </p>
            <p style={{ fontSize: '1.2em', lineHeight: '1.6' }}>
                For the best experience, please visit us on a desktop computer.
            </p>
        </div>
    );
};

export default MobileWarning; 