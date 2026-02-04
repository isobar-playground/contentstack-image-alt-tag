"use client";

import { useAppContext } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Trash2, Download, X, Loader2 } from 'lucide-react';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import Image from 'next/image';
import { useState, useEffect } from 'react';

import { ImageAsset } from '@/lib/types';
import { downloadSessionKey } from '@/lib/sessionKey';

export default function Step5ResultReview() {
    const { state, setState, setStep, getSessionKey } = useAppContext();
    const confirmDialog = useConfirmDialog();
    const [lightboxImage, setLightboxImage] = useState<ImageAsset | null>(null);
    const [imageLoading, setImageLoading] = useState(false);

    // Handle ESC key to close lightbox
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && lightboxImage) {
                setLightboxImage(null);
                setImageLoading(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [lightboxImage]);


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

    const handleExportHtml = () => {
        const now = new Date();
        const timestamp = now.toISOString().replace(/[-:.]/g, '').slice(0, 15);
        const filename = `alt_tag_review_${timestamp}.html`;

        const generateUserPrompt = (image: ImageAsset) => {
            let userMessage = 'Generate an ALT tag for this image.';
            if (image.localeName) {
                userMessage += `

Generate the ALT tag in the language: ${image.localeName}`;
            }
            if (image.usages && image.usages.length > 0) {
                const context = image.usages.map(u => `Used in content type ${u.contentTypeTitle} named ${u.key.split(' - ')[1] || 'Unknown'}`).join('. ');
                userMessage += `

Context: ${context}`;
            }
            if (state.config.brandName) {
                userMessage += `

Brand: ${state.config.brandName}`;
            }
            return userMessage;
        };

        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Alt Tag Review - ${timestamp}</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: sans-serif; margin: 0; padding: 2em; background-color: #f8f9fa; color: #212529; }
        h1 { color: #343a40; }
        .gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(450px, 1fr)); gap: 20px; }
        .card { background: #fff; border: 1px solid #dee2e6; border-radius: 8px; padding: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); display: flex; flex-direction: column; }
        .card img { max-width: 100%; height: auto; border-radius: 4px; margin-bottom: 15px; }
        .card p { font-size: 0.9em; margin: 5px 0; }
        .card pre { flex-grow: 1; background-color: #e9ecef; padding: 10px; border-radius: 4px; white-space: pre-wrap; word-wrap: break-word; font-size: 0.85em; margin-bottom: 10px; }
        .label { font-weight: bold; color: #007bff; }
        .alt-text { background-color: #d4edda; color: #155724; padding: 10px; border-radius: 4px; border-left: 5px solid #28a745;}
        .empty-alt-text { background-color: #fff3cd; color: #856404; padding: 10px; border-radius: 4px; border-left: 5px solid #ffc107;}
        .error-text { background-color: #f8d7da; color: #721c24; padding: 10px; border-radius: 4px; border-left: 5px solid #dc3545;}
        .no-data { font-size: 1.2em; color: #6c757d; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Batch Request & Result Review (${state.images.length} items)</h1>
        <div class="gallery">
        ${state.images.map(image => `
            <div class="card">
                <img src="${image.url}" alt="${image.generatedAltText || image.filename || 'Image preview'}" loading="lazy">
                <p class="label">User Prompt:</p>
                <pre>${generateUserPrompt(image)}</pre>
                <p class="label">Generated ALT Tag:</p>
                <div class="${image.generatedAltText === '' ? 'empty-alt-text' : 'alt-text'}">
                    ${image.generatedAltText === '' ? '"" (Empty Alt Tag - prompt instructed no alt)' : image.generatedAltText}
                </div>
            </div>
        `).join('')}
        </div>
    </div>
</body>
</html>
        `;

        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('HTML report exported successfully!');
    };

    const handleExportSessionKey = () => {
        const key = getSessionKey();
        downloadSessionKey(key);
        toast.success('Session key saved to file');
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

                    <ScrollArea className="h-[600px] w-full rounded-md border p-4 bg-card">
                        {activeImages.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-gray-400">
                                No images to review.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-6">
                                {activeImages.map((image) => (
                                    <div key={image.uid} className="bg-card border rounded-lg p-4 shadow-sm flex flex-col md:flex-row gap-4">
                                        <div className="w-full md:w-1/3 lg:w-1/4 flex-shrink-0">
                                            <div
                                                className="aspect-square relative bg-muted rounded-md overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity"
                                                onClick={() => {
                                                    setImageLoading(true);
                                                    setLightboxImage(image);
                                                }}
                                            >
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
                                                    <Trash2 className="h-4 w-4 mr-1" /> Delete
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
                        onClick={handleExportSessionKey}
                        className="flex-1"
                    >
                        <Download className="mr-2 h-4 w-4" />
                        Export Session Key
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleRegenerate}
                        className="flex-1"
                    >
                        Regenerate Alt Tags
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleExportHtml}
                        className="flex-1"
                    >
                        Export HTML Report
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

            {lightboxImage && (
                <div
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                    onClick={() => {
                        setLightboxImage(null);
                        setImageLoading(false);
                    }}
                >
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-4 right-4 text-white hover:bg-white/20"
                        onClick={() => {
                            setLightboxImage(null);
                            setImageLoading(false);
                        }}
                    >
                        <X className="h-6 w-6" />
                    </Button>

                    <div
                        className="max-w-7xl max-h-[90vh] flex flex-col items-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="relative mb-4 max-h-[calc(90vh-120px)] min-h-[400px] flex items-center justify-center">
                            {imageLoading && (
                                <div className="absolute inset-0 flex items-center justify-center z-10">
                                    <Loader2 className="h-12 w-12 text-white animate-spin" />
                                </div>
                            )}
                            <Image
                                src={lightboxImage.url}
                                alt={lightboxImage.generatedAltText || lightboxImage.filename || "Image"}
                                width={1200}
                                height={1200}
                                className={`object-contain max-h-[calc(90vh-120px)] w-auto transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                                priority
                                onLoadingComplete={() => setImageLoading(false)}
                                onLoad={() => setImageLoading(false)}
                            />
                        </div>

                        {!imageLoading && (
                            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 max-w-3xl w-full animate-in fade-in duration-300">
                                <p className="text-base text-gray-900 dark:text-white">
                                    {lightboxImage.generatedAltText || '(No alt text generated)'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
