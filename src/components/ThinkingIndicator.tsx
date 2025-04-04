"use client";

import React, { useEffect, useState } from 'react';

// Conditional import for framer-motion
let motion: any;
try {
    // Try to dynamically import framer-motion
    motion = require('framer-motion');
} catch (e) {
    // If framer-motion is not available, we'll use the fallback
    motion = null;
}

interface ThinkingIndicatorProps {
    isThinking?: boolean;
    speakerName?: string;
    className?: string;
    duration?: number; // in milliseconds
}

/**
 * A component that displays an animated "thinking" indicator when an expert is generating a response
 * Uses a fallback non-animated version if framer-motion is not available
 */
export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({
    isThinking = false,
    speakerName = 'Expert',
    className = '',
    duration = 3000,
}) => {
    const [dots, setDots] = useState('.');

    // If not thinking, don't render anything
    if (!isThinking) {
        return null;
    }

    // If framer-motion is available, use the animated version
    if (motion) {
        return (
            <div className={`flex items-center ${className}`}>
                <div className="mr-2 text-sm text-gray-600 font-medium">
                    {speakerName} is thinking
                </div>
                <motion.div
                    className="flex space-x-1"
                    initial={{ opacity: 0.5 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8, repeat: Infinity, repeatType: 'reverse' }}
                >
                    <AnimatedDot delay={0} />
                    <AnimatedDot delay={0.2} />
                    <AnimatedDot delay={0.4} />
                </motion.div>
            </div>
        );
    }

    // Fallback version with CSS animation (no framer-motion dependency)
    return (
        <div className={`flex items-center ${className}`}>
            <div className="mr-2 text-sm text-gray-600 font-medium">
                {speakerName} is thinking
            </div>
            <div className="flex space-x-1">
                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-pulse" style={{ animationDelay: '0s' }}></div>
                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            </div>
        </div>
    );
};

// Helper component for the animated dots - only used if framer-motion is available
const AnimatedDot: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
    if (!motion) return null;

    return (
        <motion.div
            className="w-1.5 h-1.5 bg-gray-500 rounded-full"
            initial={{ y: 0 }}
            animate={{ y: [0, -5, 0] }}
            transition={{
                duration: 0.6,
                repeat: Infinity,
                repeatType: 'loop',
                delay,
                ease: 'easeInOut',
            }}
        />
    );
};

export default ThinkingIndicator; 