"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Camera, Upload, X, AlertCircle } from "lucide-react";
import { Button } from "./button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "./alert-dialog";

interface ProfilePictureProps {
    imageUrl?: string | null;
    userName: string;
    onImageChange: (imageDataUrl: string | null) => Promise<boolean>;
    className?: string;
    size?: "small" | "medium" | "large";
}

export function ProfilePicture({
    imageUrl,
    userName,
    onImageChange,
    className = "",
    size = "medium"
}: ProfilePictureProps) {
    const [isEditMode, setIsEditMode] = useState(false);
    const [isRemoving, setIsRemoving] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Get first letter of name for fallback avatar
    const nameInitial = userName?.charAt(0)?.toUpperCase() || "?";

    // Map size string to pixel value
    const sizeMap = {
        small: 64,
        medium: 120,
        large: 160
    };

    const pixelSize = typeof size === "string" ? sizeMap[size] : size;

    // Handle profile picture upload
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Check file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert("Image is too large. Maximum size is 5MB.");
            return;
        }

        // Check file type
        if (!file.type.startsWith("image/")) {
            alert("Please upload an image file.");
            return;
        }

        setIsLoading(true);

        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const dataUrl = e.target?.result as string;
                const success = await onImageChange(dataUrl);

                if (success) {
                    setIsEditMode(false);
                } else {
                    alert("Failed to update profile picture. Please try again.");
                }
                setIsLoading(false);
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error("Error uploading image:", error);
            alert("Failed to upload image. Please try again.");
            setIsLoading(false);
        }
    };

    const confirmRemoveImage = () => {
        setShowDeleteDialog(true);
    };

    const handleRemoveImage = async () => {
        setIsRemoving(true);
        try {
            const success = await onImageChange(null);
            if (success) {
                setIsEditMode(false);
                setShowDeleteDialog(false);
            } else {
                alert("Failed to remove profile picture. Please try again.");
            }
        } catch (error) {
            console.error("Error removing image:", error);
        } finally {
            setIsRemoving(false);
        }
    };

    return (
        <div className={`relative ${className}`}>
            {/* Profile Image */}
            {imageUrl ? (
                <Image
                    src={imageUrl}
                    alt={`${userName}'s profile`}
                    width={pixelSize}
                    height={pixelSize}
                    className="rounded-full object-cover"
                />
            ) : (
                <div
                    className="rounded-full bg-primary flex items-center justify-center text-white font-bold"
                    style={{ width: pixelSize, height: pixelSize }}
                >
                    {nameInitial}
                </div>
            )}

            {/* Edit Overlay */}
            <div
                className="absolute inset-0 rounded-full flex items-center justify-center bg-black bg-opacity-40 opacity-0 hover:opacity-100 transition cursor-pointer"
                onClick={() => setIsEditMode(true)}
            >
                <div className="bg-black bg-opacity-50 p-3 rounded-full">
                    <Camera className="text-white" size={pixelSize / 2.5} strokeWidth={2} />
                </div>
            </div>

            {/* Upload Dialog */}
            {isEditMode && (
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg z-10 min-w-[200px] w-max">
                    <div className="flex flex-col gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center justify-center gap-2 w-full px-4 py-2"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <span className="animate-spin mr-2">⏳</span>
                            ) : (
                                <Upload size={18} />
                            )}
                            {isLoading ? "Uploading..." : "Upload Photo"}
                        </Button>
                        {imageUrl && (
                            <Button
                                variant="destructive"
                                size="sm"
                                className="flex items-center justify-center gap-2 w-full px-4 py-2"
                                onClick={confirmRemoveImage}
                                disabled={isRemoving}
                            >
                                <X size={18} />
                                {isRemoving ? "Removing..." : "Remove Photo"}
                            </Button>
                        )}
                        <Button
                            variant="secondary"
                            size="sm"
                            className="w-full px-4 py-2"
                            onClick={() => setIsEditMode(false)}
                            disabled={isLoading || isRemoving}
                        >
                            Cancel
                        </Button>
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept="image/*"
                    />
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove Profile Picture</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to remove your profile picture?
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleRemoveImage}
                            disabled={isRemoving}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isRemoving ? "Removing..." : "Remove"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
} 