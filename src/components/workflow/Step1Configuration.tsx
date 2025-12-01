"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { getEnvironments, validateOpenAIKey } from '@/app/actions';
import { parseContentstackError } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function Step1Configuration() {
    const { state, updateConfig, setStep } = useAppContext();

    const [formData, setFormData] = useState(state.config);
    const [environments, setEnvironments] = useState<{ uid: string; name: string }[]>([]);
    const [loadingEnvs, setLoadingEnvs] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [envError, setEnvError] = useState<string>('');

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
                setEnvError('');
            } else {
                setEnvError('');
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
            const message = parseContentstackError(error);
            setEnvError(message);
            setEnvironments([]);
        } finally {
            setLoadingEnvs(false);
            setIsTyping(false);
        }
    }, [formData, setLoadingEnvs, setEnvError, setEnvironments, setIsTyping]);

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.contentstackApiKey || !formData.contentstackManagementToken) {
            toast.error('Please fill in all required Contentstack API keys.');
            return;
        }

        if (!formData.openaiApiKey) {
            toast.error('Please enter your OpenAI API Key.');
            return;
        }

        const isValid = await validateOpenAIKey(formData.openaiApiKey);
        if (!isValid) {
            toast.error('Invalid OpenAI API Key. Please check your key and try again.');
            return;
        }

        if (!formData.contentstackEnvironment) {
            toast.error('Please select a Contentstack environment.');
            return;
        }

        updateConfig(formData);
        setStep(2);
        toast.success('Configuration saved! Starting workflow...');
    };

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
                        <span className="text-xs text-gray-500">Data is stored locally in your browser session.</span>
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

                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold border-b pb-2">OpenAI Configuration</h3>
                            <div className="grid grid-cols-1 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="openaiApiKey">OpenAI API Key</Label>
                                    <Input
                                        id="openaiApiKey"
                                        name="openaiApiKey"
                                        type="password"
                                        placeholder="sk-..."
                                        value={formData.openaiApiKey}
                                        onChange={handleChange}
                                        required
                                    />
                                    <p className="text-xs text-muted-foreground">Required for generating Alt tags.</p>
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
}
