"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { AppState, AppConfig } from '@/lib/types';
import { DEFAULT_MASTER_PROMPT } from '@/lib/constants';

interface AppContextType {
    state: AppState;
    setState: React.Dispatch<React.SetStateAction<AppState>>;
    updateConfig: (config: Partial<AppConfig>) => void;
    resetWorkflow: () => void;
    resetToImageReview: () => void;
    fullReset: () => void;
    setStep: (step: number) => void;
    getSessionKey: () => string;
    restoreSession: (key: string) => boolean;
}

const defaultState: AppState = {
    step: 1,
    config: {
        contentstackApiKey: '',
        contentstackManagementToken: '',
        contentstackEnvironment: '',
        openaiApiKey: '',
        openaiModel: 'gpt-5.2',
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
            const saved = sessionStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);

                setState((prev) => ({ ...prev, ...parsed }));
            }
        } catch (e) {
            console.error('Failed to load state from session storage', e);
        } finally {
            setIsLoaded(true);
        }
    }, []);


    useEffect(() => {
        if (isLoaded) {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
        sessionStorage.removeItem(STORAGE_KEY);
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
            getSessionKey: () => {
                const json = JSON.stringify(state);
                return btoa(encodeURIComponent(json));
            },
            restoreSession: (key: string) => {
                try {
                    const json = decodeURIComponent(atob(key));
                    const parsed = JSON.parse(json);
                    // Basic validation
                    if (typeof parsed !== 'object' || !parsed.config) {
                        throw new Error('Invalid session data');
                    }
                    setState(parsed);
                    return true;
                } catch (e) {
                    console.error('Failed to restore session', e);
                    return false;
                }
            }
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
