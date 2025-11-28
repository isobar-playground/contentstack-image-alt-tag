"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useAppContext } from '@/context/AppContext';
import { analyzeImageUsage } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react';
import { ImageAsset, ImageUsage } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function Step3ImageReview() {
    const { state, setState, setStep } = useAppContext();

    const [analyzing, setAnalyzing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string>('--:--');
    const analysisStartedRef = useRef(false);
    const startTimeRef = useRef<number>(0);

    // Check if we need to analyze usages
    useEffect(() => {
        // Prevent re-running if analysis has already started
        if (analysisStartedRef.current) {
            return;
        }

        const imagesToAnalyze = state.images.filter(img => img.usages === undefined);

        if (imagesToAnalyze.length === 0) {
            return;
        }

        // Mark that analysis has started
        analysisStartedRef.current = true;

        const analyze = async () => {
            setAnalyzing(true);
            startTimeRef.current = Date.now();
            let completed = 0;
            const total = imagesToAnalyze.length;

            // Process in chunks of 10 for faster processing
            const chunkSize = 10;
            for (let i = 0; i < total; i += chunkSize) {
                const chunk = imagesToAnalyze.slice(i, i + chunkSize);

                await Promise.all(chunk.map(async (img) => {
                    try {
                        const usages = await analyzeImageUsage(state.config, img.uid, img.locale);

                        setState(prev => ({
                            ...prev,
                            images: prev.images.map(pImg => {
                                if (pImg.uid === img.uid) {
                                    const hasUsages = usages && usages.length > 0;
                                    return {
                                        ...pImg,
                                        usages: usages as ImageUsage[],
                                        status: hasUsages ? 'active' : 'ignored' // Default to ignored if no usages
                                    };
                                }
                                return pImg;
                            })
                        }));
                    } catch (error) {
                        console.error(`Error analyzing image ${img.uid}:`, error);
                    } finally {
                        completed++;
                        const progressPercent = Math.round((completed / total) * 100);
                        setProgress(progressPercent);

                        // Calculate estimated time remaining
                        if (completed > 0 && completed < total) {
                            const elapsedTime = Date.now() - startTimeRef.current;
                            const avgTimePerImage = elapsedTime / completed;
                            const remainingImages = total - completed;
                            const estimatedMs = avgTimePerImage * remainingImages;

                            const minutes = Math.floor(estimatedMs / 60000);
                            const seconds = Math.floor((estimatedMs % 60000) / 1000);
                            setEstimatedTimeRemaining(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
                        } else if (completed === total) {
                            setEstimatedTimeRemaining('00:00');
                        }
                    }
                }));
            }

            setAnalyzing(false);
            toast.success('Image analysis complete.');
        };

        analyze();
    }, [setState, state.config, state.images]);

    // Toggle image status
    const toggleImageStatus = (uid: string) => {
        setState(prev => ({
            ...prev,
            images: prev.images.map(img => {
                if (img.uid === uid) {
                    return { ...img, status: img.status === 'active' ? 'ignored' : 'active' };
                }
                return img;
            })
        }));
    };

    // Toggle all images in a group
    const toggleGroupStatus = (images: ImageAsset[]) => {
        const allActive = images.every(img => img.status === 'active');
        const newStatus = allActive ? 'ignored' : 'active';

        setState(prev => ({
            ...prev,
            images: prev.images.map(img => {
                if (images.some(gImg => gImg.uid === img.uid)) {
                    return { ...img, status: newStatus };
                }
                return img;
            })
        }));

        toast.info(`${newStatus === 'active' ? 'Enabled' : 'Disabled'} ${images.length} images`);
    };

    // Group images by content type, then by usage key
    const groupedByContentType = useMemo(() => {
        const contentTypeGroups = new Map<string, Map<string, ImageAsset[]>>();

        state.images.forEach(image => {
            const contentType = image.usages && image.usages.length > 0
                ? image.usages[0].contentTypeTitle
                : 'No Usages';

            const usageKey = image.usages && image.usages.length > 0
                ? image.usages[0].key
                : 'No Usages';

            if (!contentTypeGroups.has(contentType)) {
                contentTypeGroups.set(contentType, new Map());
            }

            const subGroups = contentTypeGroups.get(contentType)!;
            if (!subGroups.has(usageKey)) {
                subGroups.set(usageKey, []);
            }
            subGroups.get(usageKey)!.push(image);
        });

        // Sort content types: "No Usages" last, others alphabetically
        const sortedEntries = Array.from(contentTypeGroups.entries()).sort((a, b) => {
            if (a[0] === 'No Usages') return 1;
            if (b[0] === 'No Usages') return -1;
            return a[0].localeCompare(b[0]);
        });

        return sortedEntries;
    }, [state.images]);

    const activeCount = state.images.filter(img => img.status === 'active').length;

    const handleProceed = () => {
        if (activeCount === 0) {
            toast.error('Please select at least one image to process.');
            return;
        }
        setStep(4);
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Review Images</CardTitle>
                    <CardDescription>
                        Click on an image to toggle its inclusion, or use the eye icon to toggle an entire group.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {analyzing && (
                        <div className="mb-6 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Analyzing image usages...</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-muted-foreground">ETA: {estimatedTimeRemaining}</span>
                                    <span className="font-medium">{progress}%</span>
                                </div>
                            </div>
                            <Progress value={progress} />
                        </div>
                    )}

                    <div className="flex justify-between items-center mb-4">
                        <div className="text-sm text-gray-500">
                            Total: {state.images.length} | Active: {activeCount} | Ignored: {state.images.length - activeCount}
                        </div>
                    </div>

                    <ScrollArea className="h-[450px] w-full rounded-md border p-4 bg-muted">
                        {state.images.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-gray-400">
                                No images found.
                            </div>
                        ) : (
                            <Accordion type="multiple" className="space-y-2">
                                {groupedByContentType.map(([contentType, subGroups]) => {
                                    const allImagesInContentType = Array.from(subGroups.values()).flat();
                                    const allActive = allImagesInContentType.every(img => img.status === 'active');
                                    const someActive = allImagesInContentType.some(img => img.status === 'active');
                                    const activeInContentType = allImagesInContentType.filter(img => img.status === 'active').length;

                                    return (
                                        <AccordionItem key={contentType} value={contentType} className="bg-card border rounded-lg">
                                            <AccordionTrigger className="px-4 hover:no-underline">
                                                <div className="flex items-center justify-between w-full pr-2">
                                                    <div className="flex items-center gap-3">
                                                        <Button
                                                            asChild
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleGroupStatus(allImagesInContentType);
                                                            }}
                                                            className="h-8 w-8 p-0"
                                                        >
                                                            <span>
                                                                {allActive ? (
                                                                    <Eye className="h-4 w-4 text-blue-500" />
                                                                ) : someActive ? (
                                                                    <Eye className="h-4 w-4 text-gray-400" />
                                                                ) : (
                                                                    <EyeOff className="h-4 w-4 text-gray-400" />
                                                                )}
                                                            </span>
                                                        </Button>
                                                        <div className="text-left">
                                                            <div className="font-semibold text-base">{contentType}</div>
                                                            <div className="text-xs text-gray-500">
                                                                {activeInContentType} / {allImagesInContentType.length} active
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Badge variant={allActive ? "default" : "secondary"}>
                                                        {allImagesInContentType.length}
                                                    </Badge>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="px-4 pb-4">
                                                <Accordion type="multiple" className="space-y-2 mt-2">
                                                    {Array.from(subGroups.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([usageKey, images]) => {
                                                        const allActiveInGroup = images.every(img => img.status === 'active');
                                                        const someActiveInGroup = images.some(img => img.status === 'active');
                                                        const activeInGroup = images.filter(img => img.status === 'active').length;

                                                        return (
                                                            <AccordionItem key={usageKey} value={usageKey} className="bg-muted border rounded">
                                                                <AccordionTrigger className="px-3 py-2 hover:no-underline">
                                                                    <div className="flex items-center justify-between w-full pr-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <Button
                                                                                asChild
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    toggleGroupStatus(images);
                                                                                }}
                                                                                className="h-6 w-6 p-0"
                                                                            >
                                                                                <span>
                                                                                    {allActiveInGroup ? (
                                                                                        <Eye className="h-3 w-3 text-blue-500" />
                                                                                    ) : someActiveInGroup ? (
                                                                                        <Eye className="h-3 w-3 text-gray-400" />
                                                                                    ) : (
                                                                                        <EyeOff className="h-3 w-3 text-gray-400" />
                                                                                    )}
                                                                                </span>
                                                                            </Button>
                                                                            <div className="text-left">
                                                                                <div className="text-sm font-medium">{usageKey}</div>
                                                                                <div className="text-xs text-gray-500">
                                                                                    {activeInGroup} / {images.length} active
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <Badge variant={allActiveInGroup ? "default" : "outline"} className="text-xs">
                                                                            {images.length}
                                                                        </Badge>
                                                                    </div>
                                                                </AccordionTrigger>
                                                                <AccordionContent className="px-3 pb-3">
                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-2">
                                                                        {images.map((image) => {
                                                                            const isActive = image.status === 'active';
                                                                            const hasUsages = image.usages && image.usages.length > 0;

                                                                            return (
                                                                                <div
                                                                                    key={image.uid}
                                                                                    onClick={() => toggleImageStatus(image.uid)}
                                                                                    className={cn(
                                                                                        "relative group cursor-pointer border-2 rounded-lg overflow-hidden transition-all duration-200 bg-card shadow-sm hover:shadow-md",
                                                                                        isActive ? "border-blue-500 ring-2 ring-blue-100" : "border-gray-200 opacity-60 grayscale hover:grayscale-0"
                                                                                    )}
                                                                                >
                                                                                    <div className="aspect-square relative bg-muted">
                                                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                                        <img
                                                                                            src={image.url}
                                                                                            alt={image.filename}
                                                                                            className="object-contain w-full h-full p-2"
                                                                                            loading="lazy"
                                                                                        />
                                                                                        <div className="absolute top-2 right-2">
                                                                                            {isActive ? (
                                                                                                <CheckCircle2 className="h-5 w-5 text-blue-500 bg-card rounded-full" />
                                                                                            ) : (
                                                                                                <XCircle className="h-5 w-5 text-gray-400 bg-card rounded-full" />
                                                                                            )}
                                                                                        </div>
                                                                                    </div>

                                                                                    <div className="p-2 text-xs space-y-1">
                                                                                        <p className="font-medium truncate" title={image.filename}>{image.filename}</p>
                                                                                        {hasUsages && image.usages!.length > 1 && (
                                                                                            <p className="text-blue-500 text-[10px]">+{image.usages!.length - 1} more usages</p>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </AccordionContent>
                                                            </AccordionItem>
                                                        );
                                                    })}
                                                </Accordion>
                                            </AccordionContent>
                                        </AccordionItem>
                                    );
                                })}
                            </Accordion>
                        )}
                    </ScrollArea>
                </CardContent>
                <CardFooter>
                    <Button
                        onClick={handleProceed}
                        disabled={analyzing || activeCount === 0}
                        className="w-full"
                    >
                        Proceed to Batch Generation ({activeCount} images)
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
