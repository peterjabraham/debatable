"use client";

import { useState } from "react";
import { Button } from "./button";
import { Input } from "./input";
import { Check, Edit2, Save, X } from "lucide-react";

interface AccountDetailsProps {
    name: string;
    email: string;
    isEditable?: boolean;
    onSave?: (data: { name: string }) => Promise<boolean>;
}

export function AccountDetails({
    name,
    email,
    isEditable = true,
    onSave
}: AccountDetailsProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedName, setEditedName] = useState(name);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const handleSave = async () => {
        if (!onSave) return;

        setIsSaving(true);
        try {
            const success = await onSave({ name: editedName });
            if (success) {
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 3000);
                setIsEditing(false);
            } else {
                throw new Error("Failed to save account details");
            }
        } catch (error) {
            console.error("Error saving account details:", error);
            alert("Failed to save account details. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setEditedName(name);
        setIsEditing(false);
    };

    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        Name
                    </label>
                    {isEditable && !isEditing && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="flex items-center gap-1 text-xs h-7 px-2"
                            onClick={() => setIsEditing(true)}
                        >
                            <Edit2 size={12} />
                            Edit
                        </Button>
                    )}
                </div>

                {isEditing ? (
                    <div className="space-y-2">
                        <Input
                            value={editedName}
                            onChange={(e) => setEditedName(e.target.value)}
                            placeholder="Your name"
                            className="w-full text-sm"
                        />
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                className="flex items-center gap-1 text-xs h-7"
                                onClick={handleSave}
                                disabled={isSaving || editedName === name || !editedName.trim()}
                            >
                                {isSaving ? (
                                    "Saving..."
                                ) : (
                                    <>
                                        <Save size={12} />
                                        Save
                                    </>
                                )}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex items-center gap-1 text-xs h-7"
                                onClick={handleCancel}
                                disabled={isSaving}
                            >
                                <X size={12} />
                                Cancel
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center">
                        <p className="text-base">{name}</p>
                        {saveSuccess && (
                            <span className="ml-2 text-green-500 flex items-center text-xs">
                                <Check size={12} className="mr-1" />
                                Saved
                            </span>
                        )}
                    </div>
                )}
            </div>

            <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Email
                </label>
                <p className="text-base">{email}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Your email address is used for login and notifications
                </p>
            </div>
        </div>
    );
} 