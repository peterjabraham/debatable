/**
 * Root components exports and re-exports
 */

// Root level components
export { AppHeader } from './AppHeader';
export { UserNavigation } from './UserNavigation';
export { ThemeProvider } from './ThemeProvider';
export { ThemeToggle } from './ThemeToggle';
export { ThinkingIndicator } from './ThinkingIndicator';

// Re-export from subdirectories
export * from './ui';
export * from './debate';
export * from './monitoring';
export * from './content-processing/ContentUploader';

// Auth components
export * from './auth';

// Provider components
export * from './providers'; 