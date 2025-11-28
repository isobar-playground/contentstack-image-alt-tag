"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { AppState, AppConfig, Language, ContentType, ImageAsset, BatchInfo } from '@/lib/types';
import { DEFAULT_MASTER_PROMPT } from '@/lib/constants';

interface AppContextType {
    state: AppState;
    setState: React.Dispatch<React.SetStateAction<AppState>>;
    updateConfig: (config: Partial<AppConfig>) => void;
    resetWorkflow: () => void;
    resetToImageReview: () => void;
    fullReset: () => void;
    setStep: (step: number) => void;
}

const defaultState: AppState = {
    step: 1,
    config: {
        contentstackApiKey: '',
        contentstackManagementToken: '',
        contentstackEnvironment: '',
        openaiApiKey: '',
        openaiModel: 'gpt-4o',
        brandName: '',
        masterPrompt: DEFAULT_MASTER_PROMPT,
    },
    selectedLanguages: [],
    selectedContentTypes: [],
    images: [],
    batchInfo: null,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY = 'cs-alt-tag-app-state';

export function AppProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<AppState>(defaultState);
    const [isLoaded, setIsLoaded] = useState(false);


    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
    
                setState((prev) => ({ ...prev, ...parsed }));
            }
        } catch (e) {
            console.error('Failed to load state from local storage', e);
        } finally {
            setIsLoaded(true);
        }
    }, []);


    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        }
    }, [state, isLoaded]);

    const updateConfig = (config: Partial<AppConfig>) => {
        setState((prev) => ({
            ...prev,
            config: { ...prev.config, ...config },
        }));
    };

    const setStep = (step: number) => {
        setState((prev) => ({ ...prev, step }));
    };

    const resetWorkflow = () => {
        setState(prev => ({
            ...prev,
            step: 2,
            selectedLanguages: [],
            selectedContentTypes: [],
            images: [],
            batchInfo: null,
        }));
    };

    const resetToImageReview = () => {
        setState(prev => ({
            ...prev,
            step: 3,
            images: prev.images.map(img => ({
                ...img,
                status: 'active',
                generatedAltText: undefined,
                updateStatus: undefined,
                updateError: undefined,
            })),
            batchInfo: null,
        }));
    };

    const fullReset = () => {
        localStorage.removeItem(STORAGE_KEY);
        setState(defaultState);
    };

    if (!isLoaded) {
        return null;
    }

    return (
        <AppContext.Provider value={{
            state,
            setState,
            setStep,
            updateConfig,
            resetWorkflow,
            resetToImageReview,
            fullReset,
        }}>
            {children}
        </AppContext.Provider>
    );
}

export function useAppContext() {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
}
