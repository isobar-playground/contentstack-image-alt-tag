"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, ChevronDown, RotateCcw } from 'lucide-react';

import { getEnvironments } from '@/app/actions';
import { ContentstackAPIError } from '@/lib/types';
import { ThemeToggle } from '@/components/theme-toggle';


import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Step2Discovery from '@/components/workflow/Step2Discovery';
import Step3ImageReview from '@/components/workflow/Step3ImageReview';
import Step4BatchProcessing from '@/components/workflow/Step4BatchProcessing';
import Step5ResultReview from '@/components/workflow/Step5ResultReview';
import Step6Update from '@/components/workflow/Step6Update';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

export default function Home() {
    const { state, updateConfig, setStep, resetWorkflow, resetToImageReview, fullReset } = useAppContext();
    const confirmDialog = useConfirmDialog();

    const [formData, setFormData] = useState(state.config);
    const [environments, setEnvironments] = useState<{ uid: string; name: string }[]>([]);
    const [loadingEnvs, setLoadingEnvs] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [envError, setEnvError] = useState<string>('');

    // Sync local state with context state on mount
    useEffect(() => {
        setFormData(state.config);
    }, [state.config]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));

        if (name === 'contentstackApiKey' || name === 'contentstackManagementToken') {
            const isApiKey = name === 'contentstackApiKey';
            const apiKey = isApiKey ? value : formData.contentstackApiKey;
            const token = isApiKey ? formData.contentstackManagementToken : value;

            if (apiKey && token) {
                setIsTyping(true);
                setEnvError(''); // Clear error when typing starts
            } else {
                setEnvError(''); // Clear error if keys are incomplete
                setIsTyping(false);
            }
        }
    };

    const handleEnvChange = (value: string) => {
        setFormData((prev) => ({ ...prev, contentstackEnvironment: value }));
    };

    const fetchEnvironments = useCallback(async (apiKey: string, token: string) => {
        if (!apiKey || !token) {
            setLoadingEnvs(false);
            setIsTyping(false);
            return;
        }

        setLoadingEnvs(true);
        setEnvError('');
        try {
            const envs = await getEnvironments({
                ...formData,
                contentstackApiKey: apiKey,
                contentstackManagementToken: token,
            });
            setEnvironments(envs);
        } catch (error: unknown) {
            console.error('Error fetching environments:', error);
            let message = 'Failed to fetch environments.';

            try {
                if (typeof error === 'object' && error !== null) {
                    const apiError = error as ContentstackAPIError;
                    if (apiError.message && apiError.message.includes('errorMessage')) {
                        try {
                            const parsed = JSON.parse(apiError.message);
                            if (parsed.errorMessage) {
                                message = parsed.errorMessage;
                            } else if (parsed.errors && Array.isArray(parsed.errors) && parsed.errors.length > 0) {
                                message = parsed.errors.map((err: unknown) => {
                                    if (typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string') {
                                        return err.message;
                                    }
                                    return JSON.stringify(err);
                                }).join(', ');
                            }
                        } catch (_: unknown) {
                            message = apiError.message;
                        }
                    } else if (apiError.errorMessage) {
                        message = apiError.errorMessage;
                    } else if (apiError.message) {
                        message = apiError.message;
                    }
                } else {
                    message = String(error);
                }
            } catch (e) {
                console.error('Error while processing error object:', e);
                message = 'An unknown error occurred.';
            }

            setEnvError(message);
            setEnvironments([]);
        } finally {
            setLoadingEnvs(false);
            setIsTyping(false);
        }
    }, [formData, setLoadingEnvs, setEnvError, setEnvironments, setIsTyping]);

    // Debounce logic for fetching environments
    useEffect(() => {
        const timer = setTimeout(() => {
            if (formData.contentstackApiKey && formData.contentstackManagementToken) {
                fetchEnvironments(formData.contentstackApiKey, formData.contentstackManagementToken);
            } else {
                setIsTyping(false);
                setEnvError('');
            }
        }, 2000);

        return () => clearTimeout(timer);
    }, [formData.contentstackApiKey, formData.contentstackManagementToken, fetchEnvironments]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.contentstackApiKey || !formData.contentstackManagementToken) {
            toast.error('Please fill in all required API keys.');
            return;
        }

        if (!formData.contentstackEnvironment) {
            toast.error('Please select a Contentstack environment.');
            return;
        }

        updateConfig(formData);
        setStep(2); // Move to Discovery step
        toast.success('Configuration saved! Starting workflow...');

    };


    const renderStep = () => {
        switch (state.step) {
            case 2:
                return <Step2Discovery />;
            case 3:
                return <Step3ImageReview />;
            case 4:
                return <Step4BatchProcessing />;
            case 5:
                return <Step5ResultReview />;
            case 6:
                return <Step6Update />;
            default:
                return <Step2Discovery />;
        }
    };

    const handleResetWorkflow = () => {
        confirmDialog.confirm({
            title: 'Reset Workflow',
            description: 'Are you sure you want to reset the workflow? This will clear current progress but keep your API keys.',
            onConfirm: () => {
                resetWorkflow();
                setStep(2); // Ensure it goes back to step 2 after reset
            }
        });
    };

    const handleResetToImageReview = () => {
        confirmDialog.confirm({
            title: 'Reset to Image Review',
            description: 'Return to image selection step? This will keep your discovered images and their usage data, but clear batch processing results.',
            onConfirm: () => {
                resetToImageReview();
            }
        });
    };

    const handleFullReset = () => {
        confirmDialog.confirm({
            title: 'Full Reset',
            description: 'Are you sure you want to fully reset? This will clear ALL data including API keys.',
            onConfirm: () => {
                fullReset();

            }
        });
    };

    // Conditional rendering based on API key presence
    const isConfigured = state.config.contentstackApiKey && state.config.contentstackManagementToken && state.config.contentstackEnvironment;

    if (!isConfigured) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 relative">
                <div className="absolute top-4 right-4">
                    <ThemeToggle />
                </div>
                <Card className="w-full max-w-2xl shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-2xl font-bold text-center">Contentstack Image Alt Tag Generator</CardTitle>
                        <CardDescription className="text-center">
                            Configure your API keys and settings to start generating Alt tags using AI.
                            <br />
                            <span className="text-xs text-gray-500">Data is stored locally in your browser.</span>
                        </CardDescription>
                    </CardHeader>
                    <form onSubmit={handleSubmit}>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold border-b pb-2">Contentstack Configuration</h3>
                                <div className="grid grid-cols-1 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="contentstackApiKey">API Key</Label>
                                        <Input
                                            id="contentstackApiKey"
                                            name="contentstackApiKey"
                                            placeholder="blt..."
                                            value={formData.contentstackApiKey}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="contentstackManagementToken">Management Token</Label>
                                        <Input
                                            id="contentstackManagementToken"
                                            name="contentstackManagementToken"
                                            type="password"
                                            placeholder="cs..."
                                            value={formData.contentstackManagementToken}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Label htmlFor="contentstackEnvironment">Environment</Label>
                                            {(loadingEnvs || isTyping) && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                                        </div>
                                        <Select
                                            value={formData.contentstackEnvironment}
                                            onValueChange={handleEnvChange}
                                            disabled={loadingEnvs || isTyping || environments.length === 0}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={envError ? "Check configuration" : "Select environment"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {environments.map(env => (
                                                    <SelectItem key={env.uid} value={env.name}>{env.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {envError && (
                                            <p className="text-sm text-destructive">{envError}</p>
                                        )}
                                        {!envError && !loadingEnvs && !isTyping && environments.length === 0 && (
                                            <p className="text-sm text-muted-foreground">Enter keys to load environments.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="pt-6">
                            <Button type="submit" className="w-full text-lg py-6">Start Workflow</Button>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        );
    } else {
        // Render Workflow Page content
        return (
            <div className="min-h-screen flex flex-col">
                <header className="bg-background border-b px-6 py-4 flex justify-between items-center sticky top-0 z-10">
                    <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                        Alt Tag Generator
                    </h1>
                    <div className="flex items-center gap-4">
                        <ThemeToggle />
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    Reset <ChevronDown className="ml-2 h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={handleResetToImageReview} disabled={state.step < 3}>
                                    <RotateCcw className="mr-2 h-4 w-4" /> Reset to Image Review
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleResetWorkflow}>
                                    <RotateCcw className="mr-2 h-4 w-4" /> Reset Workflow
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleFullReset} className="text-red-600 focus:text-red-600">
                                    <RotateCcw className="mr-2 h-4 w-4" /> Full Reset
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </header>
                <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
                    {renderStep()}
                </main>
            </div>
        );
    }
}