"use client";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

export function ConfirmDialogProvider() {
    const { isOpen, title, description, onConfirm, onCancel, close } = useConfirmDialog();

    const handleConfirm = () => {
        if (onConfirm) {
            onConfirm();
        }
        close();
    };

    const handleCancel = () => {
        if (onCancel) {
            onCancel();
        }
        close();
    };

    return (
        <AlertDialog open={isOpen} onOpenChange={(open) => !open && close()}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>{description}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirm}>Continue</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
