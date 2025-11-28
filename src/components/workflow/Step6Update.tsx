"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { updateAssetDescription } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';

export default function Step6Update() {
    const router = useRouter();
    const { state, setState, resetWorkflow } = useAppContext();

    const [updating, setUpdating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [completed, setCompleted] = useState(false);

    // Filter images that need update
    const imagesToUpdate = state.images.filter(img => img.status === 'active' && img.generatedAltText);

    const handleStartUpdate = async () => {
        setUpdating(true);
        let successCount = 0;
        let failCount = 0;
        let processed = 0;
        const total = imagesToUpdate.length;

        // Process sequentially to avoid rate limits
        for (const image of imagesToUpdate) {
            try {
                setState(prev => ({
                    ...prev,
                    images: prev.images.map(img => img.uid === image.uid ? { ...img, updateStatus: 'pending' } : img)
                }));

                const result = await updateAssetDescription(state.config, image.uid, image.locale, image.generatedAltText!);

                if (result.success) {
                    successCount++;
                    setState(prev => ({
                        ...prev,
                        images: prev.images.map(img => img.uid === image.uid ? { ...img, updateStatus: 'success' } : img)
                    }));
                } else {
                    failCount++;
                    setState(prev => ({
                        ...prev,
                        images: prev.images.map(img => img.uid === image.uid ? { ...img, updateStatus: 'error', updateError: result.error } : img)
                    }));
                }
            } catch (error) {
                console.error(`Error updating image ${image.uid}:`, error);
                failCount++;
                setState(prev => ({
                    ...prev,
                    images: prev.images.map(img => img.uid === image.uid ? { ...img, updateStatus: 'error', updateError: 'Unknown error' } : img)
                }));
            } finally {
                processed++;
                setProgress(Math.round((processed / total) * 100));
                // Small delay to be nice to the API
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }

        setUpdating(false);
        setCompleted(true);

        if (failCount === 0) {
            toast.success(`Successfully updated all ${successCount} images!`);
        } else {
            toast.warning(`Updated ${successCount} images. Failed to update ${failCount} images.`);
        }
    };

    const handleFinish = () => {
        resetWorkflow();
        router.push('/');
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Update Contentstack</CardTitle>
                    <CardDescription>
                        Apply the generated Alt tags to your assets in Contentstack.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {!completed && !updating && (
                        <div className="text-center py-8">
                            <p className="text-lg mb-4">Ready to update <strong>{imagesToUpdate.length}</strong> images.</p>
                            <Button size="lg" onClick={handleStartUpdate}>Start Update</Button>
                        </div>
                    )}

                    {(updating || completed) && (
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>Progress</span>
                                    <span>{progress}%</span>
                                </div>
                                <Progress value={progress} />
                            </div>

                            <ScrollArea className="h-[400px] w-full rounded-md border p-4 bg-gray-50">
                                <div className="space-y-2">
                                    {imagesToUpdate.map((image) => (
                                        <div key={image.uid} className="flex items-center justify-between bg-card p-3 rounded border text-sm">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                {image.updateStatus === 'success' && <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />}
                                                {image.updateStatus === 'error' && <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />}
                                                {image.updateStatus === 'pending' && <Loader2 className="h-5 w-5 animate-spin text-blue-500 flex-shrink-0" />}
                                                {!image.updateStatus && <div className="h-5 w-5 rounded-full border-2 border-gray-200 flex-shrink-0" />}

                                                <div className="truncate">
                                                    <span className="font-medium">{image.filename}</span>
                                                    <span className="text-gray-400 mx-2">|</span>
                                                    <span className="text-gray-500 truncate">{image.generatedAltText}</span>
                                                </div>
                                            </div>
                                            {image.updateError && (
                                                <span className="text-red-500 text-xs ml-2">{image.updateError}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="justify-center">
                    {completed && (
                        <Button onClick={handleFinish} size="lg" variant="outline">
                            <RotateCcw className="mr-2 h-4 w-4" /> Start New Workflow
                        </Button>
                    )}
                </CardFooter>
            </Card>
        </div>
    );
}
