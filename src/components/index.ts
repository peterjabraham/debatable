/**
 * Root components exports and re-exports
 */

// Root level components
export { default as AppHeader } from './AppHeader';
export { default as UserNavigation } from './UserNavigation';
export { default as ThemeProvider } from './ThemeProvider';
export { default as ThemeToggle } from './ThemeToggle';
export { default as ThinkingIndicator } from './ThinkingIndicator';

// Re-export from subdirectories
export * from './ui';
export * from './debate';
export * from './monitoring';
export * from './content-processing/ContentUploader';

// Auth components
export * from './auth';

// Provider components
export * from './providers'; 