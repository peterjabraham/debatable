import { createContext, useContext } from 'react';

export type Theme = 'light' | 'dark';

export const ThemeContext = createContext<{
    theme: Theme;
    toggleTheme: () => void;
}>({
    theme: 'light',
    toggleTheme: () => { },
});

export const useTheme = () => useContext(ThemeContext);

export const themeColors = {
    light: {
        background: 'bg-background',
        foreground: 'text-foreground',
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        accent: {
            red: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
            green: 'bg-[hsl(142,76%,36%)] text-white hover:bg-[hsl(142,76%,32%)]',
        },
        border: 'border-[hsl(var(--border))]',
        muted: 'text-muted-foreground',
        card: 'bg-card border-[hsl(var(--border))]',
        input: 'bg-background border-input focus:border-ring',
    },
    dark: {
        background: 'bg-background',
        foreground: 'text-foreground',
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        accent: {
            red: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
            green: 'bg-[hsl(142,76%,36%)] text-white hover:bg-[hsl(142,76%,32%)]',
        },
        border: 'border-[hsl(var(--border))]',
        muted: 'text-muted-foreground',
        card: 'bg-card border-[hsl(var(--border))]',
        input: 'bg-background border-input focus:border-ring',
    },
}; 