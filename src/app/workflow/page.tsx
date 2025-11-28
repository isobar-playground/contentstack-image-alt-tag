"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, RotateCcw } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

// Step Components
import Step2Discovery from '@/components/workflow/Step2Discovery';
import Step3ImageReview from '@/components/workflow/Step3ImageReview';
import Step4BatchProcessing from '@/components/workflow/Step4BatchProcessing';
import Step5ResultReview from '@/components/workflow/Step5ResultReview';
import Step6Update from '@/components/workflow/Step6Update';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

export default function WorkflowPage() {
    const router = useRouter();
    const { state, resetWorkflow, resetToImageReview, fullReset } = useAppContext();
    const confirmDialog = useConfirmDialog();

    // Redirect to home if no config
    useEffect(() => {
        if (!state.config.contentstackApiKey) {
            router.push('/');
        }
    }, [state.config.contentstackApiKey, router]);

    if (!state.config.contentstackApiKey) {
        return null;
    }

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
                router.push('/');
            }
        });
    };

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
