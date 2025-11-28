"use client";

import { create } from 'zustand';

interface ConfirmDialogState {
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: (() => void) | null;
    onCancel: (() => void) | null;
}

interface ConfirmDialogStore extends ConfirmDialogState {
    confirm: (options: {
        title: string;
        description: string;
        onConfirm: () => void;
        onCancel?: () => void;
    }) => void;
    close: () => void;
}

export const useConfirmDialog = create<ConfirmDialogStore>((set) => ({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: null,
    onCancel: null,
    confirm: ({ title, description, onConfirm, onCancel }) => {
        set({
            isOpen: true,
            title,
            description,
            onConfirm,
            onCancel: onCancel || null,
        });
    },
    close: () => {
        set({
            isOpen: false,
            title: '',
            description: '',
            onConfirm: null,
            onCancel: null,
        });
    },
}));
