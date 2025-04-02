"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface ThinkingIndicatorProps {
    isThinking?: boolean;
    speakerName?: string;
    className?: string;
    duration?: number; // in milliseconds
}

/**
 * A component that displays an animated "thinking" indicator when an expert is generating a response
 */
export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({
    isThinking = false,
    speakerName = 'Expert',
    className = '',
    duration = 3000,
}) => {
    if (!isThinking) {
        return null;
    }

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
                <Dot delay={0} />
                <Dot delay={0.2} />
                <Dot delay={0.4} />
            </motion.div>
        </div>
    );
};

// Helper component for the animated dots
const Dot: React.FC<{ delay?: number }> = ({ delay = 0 }) => (
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

export default ThinkingIndicator; 