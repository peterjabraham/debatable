"use client";

import { useSettings } from "@/lib/contexts/settings-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function SettingsTestPage() {
  const { preferences, updatePreferences, isLoaded } = useSettings();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [themeApplied, setThemeApplied] = useState(false);

  // Check if theme matches preferences when loaded
  useEffect(() => {
    if (isLoaded && theme) {
      setThemeApplied(theme === preferences.theme);
    }
  }, [isLoaded, preferences.theme, theme]);

  const toggleTheme = async () => {
    const newTheme = preferences.theme === 'light' ? 'dark' : 'light';
    const success = await updatePreferences({ theme: newTheme });

    if (success) {
      toast({
        title: "Theme Updated",
        description: `Theme switched to ${newTheme} mode`,
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to update theme",
        variant: "destructive",
      });
    }
  };

  const toggleVoiceSynthesis = async () => {
    const newValue = !preferences.useVoiceSynthesis;
    const success = await updatePreferences({ useVoiceSynthesis: newValue });

    if (success) {
      toast({
        title: "Voice Synthesis Updated",
        description: `Voice synthesis ${newValue ? 'enabled' : 'disabled'}`,
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to update voice synthesis setting",
        variant: "destructive",
      });
    }
  };

  const changeExpertType = async () => {
    const newType = preferences.defaultExpertType === 'historical' ? 'ai' : 'historical';
    const success = await updatePreferences({ defaultExpertType: newType });

    if (success) {
      toast({
        title: "Expert Type Updated",
        description: `Default expert type set to ${newType}`,
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to update expert type",
        variant: "destructive",
      });
    }
  };

  // Update text display
  const expertTypeDisplay = preferences.defaultExpertType === 'historical' ? 'Historical Figures' : 'AI Subject Experts';

  if (!isLoaded) {
    return <div className="container py-8">Loading settings...</div>;
  }

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-8">Settings Test Page</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Current Settings</CardTitle>
            <CardDescription>Your current user preferences</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <span className="font-medium">Theme:</span> {preferences.theme}
                {themeApplied ? (
                  <span className="ml-2 text-green-600 dark:text-green-400">✓ Applied</span>
                ) : (
                  <span className="ml-2 text-red-600 dark:text-red-400">✗ Not Applied</span>
                )}
              </div>
              <div>
                <span className="font-medium">Voice Synthesis:</span> {preferences.useVoiceSynthesis ? 'Enabled' : 'Disabled'}
              </div>
              <div>
                <span className="font-medium">Default Expert Type:</span> {expertTypeDisplay}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Actions</CardTitle>
            <CardDescription>Try changing your settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button onClick={toggleTheme} className="w-full">
                Toggle Theme
              </Button>
              <Button onClick={toggleVoiceSynthesis} className="w-full">
                Toggle Voice Synthesis
              </Button>
              <Button onClick={changeExpertType} className="w-full">
                Switch Expert Type
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Technical Details</CardTitle>
            <CardDescription>Raw data for debugging</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-auto">
              {JSON.stringify({
                preferences,
                currentTheme: theme,
                themeApplied
              }, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 