"use client";

import { useAppContext } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import Image from 'next/image';

export default function Step5ResultReview() {
    const { state, setState, setStep } = useAppContext();
    const confirmDialog = useConfirmDialog();


    const activeImages = state.images.filter(img => img.status === 'active' && img.generatedAltText !== undefined);

    const handleUpdateAltText = (uid: string, newText: string) => {
        setState(prev => ({
            ...prev,
            images: prev.images.map(img => {
                if (img.uid === uid) {
                    return { ...img, generatedAltText: newText };
                }
                return img;
            })
        }));
    };

    const handleRemoveImage = (uid: string) => {
        confirmDialog.confirm({
            title: 'Skip Image',
            description: 'Are you sure you want to skip this image? It will not be updated in Contentstack.',
            onConfirm: () => {
                setState(prev => ({
                    ...prev,
                    images: prev.images.map(img => {
                        if (img.uid === uid) {
                            return { ...img, status: 'ignored' };
                        }
                        return img;
                    })
                }));
                toast.info('Image skipped.');
            }
        });
    };

    const handleProceed = () => {
        const imagesToUpdate = state.images.filter(img => img.status === 'active' && img.generatedAltText);
        if (imagesToUpdate.length === 0) {
            toast.error('No images to update.');
            return;
        }
        setStep(6);
    };

    const handleRegenerate = () => {
        confirmDialog.confirm({
            title: 'Regenerate Alt Tags',
            description: 'Are you sure you want to regenerate alt tags? This will discard the current results and start a new batch.',
            onConfirm: () => {

                setState(prev => ({
                    ...prev,
                    batchInfo: null,
                    images: prev.images.map(img => ({
                        ...img,
                        generatedAltText: undefined,
                    }))
                }));
                setStep(4);
                toast.info('Returning to batch processing...');
            }
        });
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Review Results</CardTitle>
                    <CardDescription>
                        Review and edit the generated Alt tags. Click &quot;Delete&quot; to skip an image.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-between items-center mb-4">
                        <div className="text-sm text-gray-500">
                            Images to update: {activeImages.length}
                        </div>
                    </div>

                    <ScrollArea className="h-[600px] w-full rounded-md border p-4 bg-gray-50">
                        {activeImages.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-gray-400">
                                No images to review.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-6">
                                {activeImages.map((image) => (
                                    <div key={image.uid} className="bg-card border rounded-lg p-4 shadow-sm flex flex-col md:flex-row gap-4">
                                        <div className="w-full md:w-1/3 lg:w-1/4 flex-shrink-0">
                                            <div className="aspect-square relative bg-muted rounded-md overflow-hidden border">
                                                    <Image
                                                      src={image.url}
                                                      alt={image.filename || "Image"}
                                                      width={150}
                                                      height={150}
                                                      className="object-contain w-full h-full"
                                                      loading="lazy"
                                                    />
                                            </div>
                                            <div className="mt-2 text-xs text-gray-500 truncate" title={image.filename}>
                                                {image.filename}
                                            </div>
                                            {image.usages && image.usages.length > 0 && (
                                                <div className="mt-1">
                                                    <Badge variant="outline" className="text-xs truncate max-w-full">
                                                        {image.usages[0].contentTypeTitle}
                                                    </Badge>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 flex flex-col gap-2">
                                            <div className="flex justify-between items-start">
                                                <label className="text-sm font-medium text-gray-700">Generated Alt Text</label>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => handleRemoveImage(image.uid)}
                                                >
                                                    <Trash2 className="h-4 w-4 mr-1" /> Skip
                                                </Button>
                                            </div>
                                            <Textarea
                                                value={image.generatedAltText || ''}
                                                onChange={(e) => handleUpdateAltText(image.uid, e.target.value)}
                                                className="flex-1 min-h-[100px] font-sans text-base"
                                            />
                                            <div className="text-xs text-gray-400 text-right">
                                                {image.generatedAltText?.length || 0} chars
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </CardContent>
                <CardFooter className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={handleRegenerate}
                        className="flex-1"
                    >
                        Regenerate Alt Tags
                    </Button>
                    <Button
                        onClick={handleProceed}
                        disabled={activeImages.length === 0}
                        className="flex-1"
                    >
                        Proceed to Update Contentstack ({activeImages.length} images)
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
