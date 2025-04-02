"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useUser } from "@/lib/hooks/useUser";
import { useSettings } from "@/lib/contexts/settings-context";
import { AlertCircle, Save, Trash2 } from "lucide-react";

type UserProfile = {
    id: string;
    email: string;
    name: string;
    profilePicture?: string;
    preferences: {
        defaultExpertType: 'historical' | 'ai';
        useVoiceSynthesis: boolean;
        theme: 'light' | 'dark' | 'system';
    };
};

export default function ProfilePage() {
    const router = useRouter();
    const { toast } = useToast();
    const { preferences, updatePreferences } = useSettings();
    const { profile, isLoading, isUpdating, updateProfile, isAuthenticated } = useUser();
    const [showDeleteAccountDialog, setShowDeleteAccountDialog] = useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState("");
    const [deleteError, setDeleteError] = useState("");

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push("/login");
        }
    }, [isLoading, isAuthenticated, router]);

    const handleProfileUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        const name = formData.get('name') as string;
        const email = formData.get('email') as string;

        try {
            await updateProfile({ name, email });
            toast({
                title: "Profile updated",
                description: "Your profile has been updated successfully.",
            });
        } catch (error) {
            console.error("Error updating profile:", error);
            toast({
                title: "Error",
                description: "Failed to update your profile. Please try again.",
                variant: "destructive",
            });
        }
    };

    const handlePreferencesUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        try {
            await updatePreferences({
                preferredLanguage: formData.get('language') as string,
                theme: formData.get('theme') as string,
                notifications: formData.get('notifications') === 'on',
                expertTypes: Array.from(formData.getAll('expertTypes') as string[]),
                preferredTopics: (formData.get('topics') as string)
                    .split(',')
                    .map(topic => topic.trim())
                    .filter(Boolean),
            });

            toast({
                title: "Preferences updated",
                description: "Your preferences have been updated successfully.",
            });
        } catch (error) {
            console.error("Error updating preferences:", error);
            toast({
                title: "Error",
                description: "Failed to update your preferences. Please try again.",
                variant: "destructive",
            });
        }
    };

    const handleDeleteAccount = async () => {
        if (deleteConfirmation !== profile?.email) {
            setDeleteError("Please enter your email address correctly to confirm deletion");
            return;
        }

        try {
            setIsDeletingAccount(true);
            const response = await fetch("/api/user/account/delete", {
                method: "DELETE",
            });

            if (response.ok) {
                toast({
                    title: "Account deleted",
                    description: "Your account has been deleted successfully.",
                });
                router.push("/");
            } else {
                const error = await response.json();
                throw new Error(error.message || "Failed to delete account");
            }
        } catch (error) {
            console.error("Error deleting account:", error);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to delete your account. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsDeletingAccount(false);
            setShowDeleteAccountDialog(false);
        }
    };

    if (isLoading) {
        return (
            <div className="container mx-auto py-8">
                <div className="flex justify-center">
                    <div className="w-full md:w-2/3 lg:w-1/2 p-8 rounded-lg border bg-gray-50 dark:bg-gray-800 animate-pulse">
                        <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded mb-4 w-1/4"></div>
                        <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded mb-6 w-3/4"></div>

                        <div className="space-y-4">
                            <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded"></div>
                            <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded"></div>
                            <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8">
            <h1 className="text-3xl font-bold mb-6">Profile Settings</h1>

            <Tabs defaultValue="profile" className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="profile">Profile Information</TabsTrigger>
                    <TabsTrigger value="preferences">Preferences</TabsTrigger>
                    <TabsTrigger value="account">Account</TabsTrigger>
                </TabsList>

                <TabsContent value="profile" className="p-6 rounded-lg border">
                    <h2 className="text-xl font-semibold mb-4">Your Profile</h2>

                    <form onSubmit={handleProfileUpdate} className="space-y-4">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium mb-1">
                                Name
                            </label>
                            <Input
                                id="name"
                                name="name"
                                defaultValue={profile?.name || ""}
                                placeholder="Your name"
                            />
                        </div>

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium mb-1">
                                Email
                            </label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                defaultValue={profile?.email || ""}
                                placeholder="Your email"
                                readOnly={!!profile?.email}
                                className={profile?.email ? "bg-gray-100 dark:bg-gray-800" : ""}
                            />
                            {profile?.email && (
                                <p className="text-xs text-gray-500 mt-1">
                                    Email cannot be changed
                                </p>
                            )}
                        </div>

                        <Button type="submit" disabled={isUpdating}>
                            {isUpdating ? (
                                <>
                                    <span className="mr-2">Saving...</span>
                                    <span className="animate-spin">⏳</span>
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Save Profile
                                </>
                            )}
                        </Button>
                    </form>
                </TabsContent>

                <TabsContent value="preferences" className="p-6 rounded-lg border">
                    <h2 className="text-xl font-semibold mb-4">Your Preferences</h2>

                    <form onSubmit={handlePreferencesUpdate} className="space-y-4">
                        <div>
                            <label htmlFor="language" className="block text-sm font-medium mb-1">
                                Preferred Language
                            </label>
                            <select
                                id="language"
                                name="language"
                                defaultValue={preferences.preferredLanguage}
                                className="w-full px-3 py-2 rounded border bg-white dark:bg-gray-800"
                            >
                                <option value="en">English</option>
                                <option value="es">Spanish</option>
                                <option value="fr">French</option>
                                <option value="de">German</option>
                                <option value="zh">Chinese</option>
                            </select>
                        </div>

                        <div>
                            <label htmlFor="theme" className="block text-sm font-medium mb-1">
                                Theme
                            </label>
                            <select
                                id="theme"
                                name="theme"
                                defaultValue={preferences.theme}
                                className="w-full px-3 py-2 rounded border bg-white dark:bg-gray-800"
                            >
                                <option value="light">Light</option>
                                <option value="dark">Dark</option>
                                <option value="system">System</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Expert Types
                            </label>
                            <div className="space-y-2">
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="expert-ai"
                                        name="expertTypes"
                                        value="ai"
                                        defaultChecked={preferences.expertTypes?.includes("ai")}
                                        className="mr-2"
                                    />
                                    <label htmlFor="expert-ai">AI Subject Expert</label>
                                </div>
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="expert-historical"
                                        name="expertTypes"
                                        value="historical"
                                        defaultChecked={preferences.expertTypes?.includes("historical")}
                                        className="mr-2"
                                    />
                                    <label htmlFor="expert-historical">Historical Figure</label>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="topics" className="block text-sm font-medium mb-1">
                                Preferred Topics (comma separated)
                            </label>
                            <Input
                                id="topics"
                                name="topics"
                                defaultValue={preferences.preferredTopics?.join(", ") || ""}
                                placeholder="AI, Climate Change, Economics"
                            />
                        </div>

                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="notifications"
                                name="notifications"
                                defaultChecked={preferences.notifications}
                                className="mr-2"
                            />
                            <label htmlFor="notifications">Enable Notifications</label>
                        </div>

                        <Button type="submit" disabled={isUpdating}>
                            {isUpdating ? (
                                <>
                                    <span className="mr-2">Saving...</span>
                                    <span className="animate-spin">⏳</span>
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Save Preferences
                                </>
                            )}
                        </Button>
                    </form>
                </TabsContent>

                <TabsContent value="account" className="p-6 rounded-lg border">
                    <h2 className="text-xl font-semibold mb-4">Account Management</h2>

                    <div className="border-t pt-4 mt-4">
                        <h3 className="text-lg font-medium text-red-600 dark:text-red-400 mb-2 flex items-center">
                            <AlertCircle className="h-5 w-5 mr-2" />
                            Danger Zone
                        </h3>

                        <p className="text-sm mb-4">
                            Once you delete your account, there is no going back. Please be certain.
                        </p>

                        {!showDeleteAccountDialog ? (
                            <Button
                                variant="destructive"
                                onClick={() => setShowDeleteAccountDialog(true)}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Account
                            </Button>
                        ) : (
                            <div className="border border-red-300 p-4 rounded-md">
                                <h4 className="font-medium mb-2">Confirm Account Deletion</h4>
                                <p className="text-sm mb-3">
                                    To verify, type your email address: <strong>{profile?.email}</strong>
                                </p>

                                <Input
                                    value={deleteConfirmation}
                                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                                    placeholder="Your email"
                                    className="mb-2"
                                />

                                {deleteError && (
                                    <p className="text-sm text-red-600 mb-2">{deleteError}</p>
                                )}

                                <div className="flex space-x-2 mt-2">
                                    <Button
                                        variant="destructive"
                                        onClick={handleDeleteAccount}
                                        disabled={isDeletingAccount}
                                    >
                                        {isDeletingAccount ? "Deleting..." : "Delete My Account"}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setShowDeleteAccountDialog(false);
                                            setDeleteConfirmation("");
                                            setDeleteError("");
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
} 