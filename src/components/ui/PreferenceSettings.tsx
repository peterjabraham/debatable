"use client";

import { useState, useEffect } from "react";
import { Switch } from "./switch";
import { Button } from "./button";
import { Check, Save } from "lucide-react";
import { useTheme } from "next-themes";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./select";

interface UserPreferences {
    defaultExpertType: 'historical' | 'ai';
    useVoiceSynthesis: boolean;
    theme: 'light' | 'dark' | 'system';
}

interface PreferenceSettingsProps {
    preferences: UserPreferences;
    onSave: (preferences: UserPreferences) => Promise<boolean>;
}

export function PreferenceSettings({ preferences, onSave }: PreferenceSettingsProps) {
    const { setTheme } = useTheme();
    const [editedPreferences, setEditedPreferences] = useState<UserPreferences>({ ...preferences });
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        if (editedPreferences.theme !== preferences.theme) {
            setTheme(editedPreferences.theme);
        }
    }, [editedPreferences.theme, preferences.theme, setTheme]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const success = await onSave(editedPreferences);
            if (success) {
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 3000);
            } else {
                throw new Error("Failed to save preferences");
            }
        } catch (error) {
            console.error("Error saving preferences:", error);
            alert("Failed to save preferences. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const hasChanges = JSON.stringify(preferences) !== JSON.stringify(editedPreferences);

    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Default Expert Type
                </label>
                <Select
                    value={editedPreferences.defaultExpertType}
                    onValueChange={(value) =>
                        setEditedPreferences({
                            ...editedPreferences,
                            defaultExpertType: value as 'historical' | 'ai'
                        })
                    }
                >
                    <SelectTrigger className="w-full text-sm">
                        <SelectValue placeholder="Select expert type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="historical" className="text-sm">Historical Figures</SelectItem>
                        <SelectItem value="ai" className="text-sm">AI Experts</SelectItem>
                    </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Choose your preferred type of experts for debates
                </p>
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        Voice Synthesis
                    </label>
                    <Switch
                        checked={editedPreferences.useVoiceSynthesis}
                        onCheckedChange={(checked) =>
                            setEditedPreferences({
                                ...editedPreferences,
                                useVoiceSynthesis: checked
                            })
                        }
                    />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Enable voice synthesis for expert responses
                </p>
            </div>

            <div className="space-y-3">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Theme
                </label>
                <Select
                    value={editedPreferences.theme}
                    onValueChange={(value) =>
                        setEditedPreferences({
                            ...editedPreferences,
                            theme: value as 'light' | 'dark' | 'system'
                        })
                    }
                >
                    <SelectTrigger className="w-full text-sm">
                        <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="light" className="text-sm">Light</SelectItem>
                        <SelectItem value="dark" className="text-sm">Dark</SelectItem>
                        <SelectItem value="system" className="text-sm">System</SelectItem>
                    </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Choose your preferred application theme (changes applied immediately)
                </p>
            </div>

            <div className="pt-4">
                <Button
                    className="w-full flex items-center justify-center gap-2 text-sm"
                    onClick={handleSave}
                    disabled={!hasChanges || isSaving}
                >
                    {isSaving ? (
                        "Saving..."
                    ) : saveSuccess ? (
                        <>
                            <Check size={14} />
                            Saved
                        </>
                    ) : (
                        <>
                            <Save size={14} />
                            Save Preferences
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
} 