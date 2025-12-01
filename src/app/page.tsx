"use client";

import React, { lazy, Suspense } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ChevronDown, RotateCcw } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

const LazyStep1Configuration = lazy(() => import('@/components/workflow/Step1Configuration'));
const LazyStep2Discovery = lazy(() => import('@/components/workflow/Step2Discovery'));
const LazyStep3ImageReview = lazy(() => import('@/components/workflow/Step3ImageReview'));
const LazyStep4BatchProcessing = lazy(() => import('@/components/workflow/Step4BatchProcessing'));
const LazyStep5ResultReview = lazy(() => import('@/components/workflow/Step5ResultReview'));
const LazyStep6Update = lazy(() => import('@/components/workflow/Step6Update'));

export default function Home() {
    const { state, setStep, resetWorkflow, resetToImageReview, fullReset } = useAppContext();
    const confirmDialog = useConfirmDialog();

    const renderStep = () => {
        switch (state.step) {
            case 1:
                return <LazyStep1Configuration />;
            case 2:
                return <LazyStep2Discovery />;
            case 3:
                return <LazyStep3ImageReview />;
            case 4:
                return <LazyStep4BatchProcessing />;
            case 5:
                return <LazyStep5ResultReview />;
            case 6:
                return <LazyStep6Update />;
            default:
                return <LazyStep1Configuration />;
        }
    };

    const handleResetWorkflow = () => {
        confirmDialog.confirm({
            title: 'Reset Workflow',
            description: 'Are you sure you want to reset the workflow? This will clear current progress but keep your API keys.',
            onConfirm: () => {
                resetWorkflow();
                setStep(2);
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

    if (state.step === 1) {
        return (
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
                <LazyStep1Configuration />
            </Suspense>
        );
    }

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
                <Suspense fallback={<div>Loading workflow step...</div>}>
                    {renderStep()}
                </Suspense>
            </main>
        </div>
    );
}