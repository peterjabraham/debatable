"use client";

import { ReactNode, createContext, useContext, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useUser } from "@/lib/hooks/useUser";

// Define the user preferences interface
export interface UserPreferences {
    notifications: boolean;
    theme: string;
    expertTypes: string[];
    preferredLanguage: string;
    preferredTopics: string[];
}

// Define the context value interface
interface SettingsContextValue {
    preferences: UserPreferences;
    updatePreferences: (newPreferences: Partial<UserPreferences>) => Promise<void>;
    isLoaded: boolean;
}

// Default preferences
export const defaultPreferences: UserPreferences = {
    notifications: true,
    theme: "system",
    expertTypes: ["domain", "historical"],
    preferredLanguage: "en",
    preferredTopics: [],
};

// Create the context
const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

// Provider props
interface SettingsProviderProps {
    children: ReactNode;
}

// Provider component
export function SettingsProvider({ children }: SettingsProviderProps) {
    const { setTheme } = useTheme();
    const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
    const [isLoaded, setIsLoaded] = useState(false);
    const { profile, isLoading, updateProfile } = useUser();

    // Load user preferences from profile
    useEffect(() => {
        if (!isLoading && profile) {
            const userPrefs: UserPreferences = {
                notifications: profile.settings?.notifications ?? defaultPreferences.notifications,
                theme: profile.settings?.theme ?? defaultPreferences.theme,
                expertTypes: profile.expertTypes ?? defaultPreferences.expertTypes,
                preferredLanguage: profile.preferredLanguage ?? defaultPreferences.preferredLanguage,
                preferredTopics: profile.preferredTopics ?? defaultPreferences.preferredTopics,
            };

            setPreferences(userPrefs);
            setTheme(userPrefs.theme);
            setIsLoaded(true);
        } else if (!isLoading) {
            // If no profile but loading is done, use defaults
            setIsLoaded(true);
        }
    }, [profile, isLoading, setTheme]);

    // Function to update preferences
    const updatePreferences = async (newPreferences: Partial<UserPreferences>) => {
        const updatedPreferences = { ...preferences, ...newPreferences };
        setPreferences(updatedPreferences);

        // Apply theme change
        if (newPreferences.theme) {
            setTheme(newPreferences.theme);
        }

        // Only update API if authenticated
        if (profile && !profile.isGuest) {
            try {
                // Transform to API format
                const apiUpdate = {
                    settings: {
                        notifications: updatedPreferences.notifications,
                        theme: updatedPreferences.theme
                    },
                    expertTypes: updatedPreferences.expertTypes,
                    preferredLanguage: updatedPreferences.preferredLanguage,
                    preferredTopics: updatedPreferences.preferredTopics,
                };

                await updateProfile(apiUpdate);
            } catch (error) {
                console.error("Error updating preferences:", error);
                // Revert to previous settings on error
                setPreferences(preferences);
                throw error;
            }
        }
    };

    // Provide the context
    return (
        <SettingsContext.Provider value={{ preferences, updatePreferences, isLoaded }}>
            {children}
        </SettingsContext.Provider>
    );
}

// Hook to use settings
export function useSettings() {
    const context = useContext(SettingsContext);

    if (context === undefined) {
        throw new Error("useSettings must be used within a SettingsProvider");
    }

    return context;
} 