"use client";

import { useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getLanguages, getContentTypes, getAssets } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { Language, ContentType, ImageAsset } from '@/lib/types';

export default function Step2Discovery() {
    const { state, setState, setStep } = useAppContext();

    const [languages, setLanguages] = useState<Language[]>([]);
    const [contentTypes, setContentTypes] = useState<ContentType[]>([]);

    const [loadingLanguages, setLoadingLanguages] = useState(false);
    const [loadingContentTypes, setLoadingContentTypes] = useState(false);
    const [loadingImages, setLoadingImages] = useState(false);

    // Load languages on mount if not already loaded
    useEffect(() => {
        const fetchLanguages = async () => {
            setLoadingLanguages(true);
            try {
                const langs = await getLanguages(state.config);
                setLanguages(langs);

                // Automatically select all languages
                setState(prev => ({
                    ...prev,
                    selectedLanguages: langs
                }));
            } catch (error) {
                toast.error('Failed to fetch languages. Check your API keys.');
                console.error(error);
            } finally {
                setLoadingLanguages(false);
            }
        };

        if (languages.length === 0) {
            fetchLanguages();
        }
    }, [state.config, languages.length]);

    // Handle Language Selection
    const toggleLanguage = (lang: Language) => {
        setState(prev => {
            const exists = prev.selectedLanguages.some(l => l.code === lang.code);
            if (exists) {
                return { ...prev, selectedLanguages: prev.selectedLanguages.filter(l => l.code !== lang.code) };
            } else {
                return { ...prev, selectedLanguages: [...prev.selectedLanguages, lang] };
            }
        });
    };

    // Fetch Content Types when languages are selected
    const handleDiscoverContentTypes = async () => {
        if (state.selectedLanguages.length === 0) {
            setContentTypes([]);
            return;
        }

        setLoadingContentTypes(true);
        try {
            const allTypes = new Map<string, ContentType>();

            for (const lang of state.selectedLanguages) {
                const types = await getContentTypes(state.config, lang.code);
                types.forEach(t => allTypes.set(t.uid, t));
            }

            const uniqueTypes = Array.from(allTypes.values()).sort((a, b) => a.uid.localeCompare(b.uid));
            setContentTypes(uniqueTypes);

            // Auto-select image types if not already selected
            const imageTypes = uniqueTypes.filter(t => t.uid.startsWith('image/'));

            // Only update if different to avoid loops/unnecessary updates
            // But here we want to ensure image types are selected by default when discovered
            // We can just add them to existing selection if not present? 
            // Or just reset selection to image types? The original logic was replacing selection.
            // Let's stick to original logic: auto-select image types.
            setState(prev => ({ ...prev, selectedContentTypes: imageTypes }));

        } catch (error) {
            toast.error('Failed to discover content types.');
            console.error(error);
        } finally {
            setLoadingContentTypes(false);
        }
    };

    // Auto-discovery effect with debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            handleDiscoverContentTypes();
        }, 500);

        return () => clearTimeout(timer);
    }, [state.selectedLanguages]);


    // Handle Content Type Selection
    const toggleContentType = (type: ContentType) => {
        setState(prev => {
            const exists = prev.selectedContentTypes.some(t => t.uid === type.uid);
            if (exists) {
                return { ...prev, selectedContentTypes: prev.selectedContentTypes.filter(t => t.uid !== type.uid) };
            } else {
                return { ...prev, selectedContentTypes: [...prev.selectedContentTypes, type] };
            }
        });
    };

    // Fetch Images
    const handleFetchImages = async () => {
        if (state.selectedContentTypes.length === 0) {
            toast.error('Please select at least one content type.');
            return;
        }

        setLoadingImages(true);
        try {
            let allImages: ImageAsset[] = [];
            const typeUids = state.selectedContentTypes.map(t => t.uid);

            for (const lang of state.selectedLanguages) {
                const images = await getAssets(state.config, lang.code, typeUids);
                // Add locale info to images
                const imagesWithLocale = images.map((img) => ({
                    ...img,
                    locale: lang.code,
                    localeName: lang.name,
                    status: 'active', // Default status
                })) as ImageAsset[];
                allImages = [...allImages, ...imagesWithLocale];
            }

            setState(prev => ({ ...prev, images: allImages }));

            if (allImages.length === 0) {
                toast.info('No images found without description.');
            } else {
                toast.success(`Found ${allImages.length} images.`);
                setStep(3); // Move to next step
            }
        } catch (error) {
            toast.error('Failed to fetch images.');
            console.error(error);
        } finally {
            setLoadingImages(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Discovery</CardTitle>
                    <CardDescription>Select languages to automatically discover content types.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Languages Section */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-medium leading-none">Languages</h3>
                        {loadingLanguages ? (
                            <div className="flex items-center p-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading languages...
                            </div>
                        ) : (
                            <ScrollArea className="h-[200px] w-full rounded-md border p-4">
                                <div className="space-y-1">
                                    {languages.map((lang, index) => (
                                        <div
                                            key={lang.code}
                                            className={`flex items-center space-x-3 p-2 rounded-md cursor-pointer transition-colors ${state.selectedLanguages.some(l => l.code === lang.code)
                                                ? 'bg-primary/10 text-primary font-medium'
                                                : 'hover:bg-muted'
                                                }`}
                                            onClick={() => toggleLanguage(lang)}
                                        >
                                            <span className="text-sm text-muted-foreground w-6">{index + 1}.</span>
                                            <span className="flex-1">{lang.name} ({lang.code})</span>
                                            {state.selectedLanguages.some(l => l.code === lang.code) && (
                                                <CheckCircle2 className="h-4 w-4 text-primary" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        )}
                    </div>

                    {/* Content Types Section */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium leading-none">Content Types</h3>
                            {loadingContentTypes && (
                                <span className="flex items-center text-xs text-muted-foreground">
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" /> Discovering...
                                </span>
                            )}
                        </div>

                        {!loadingContentTypes && contentTypes.length === 0 && state.selectedLanguages.length > 0 && (
                            <div className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/50">
                                No content types found for selected languages.
                            </div>
                        )}

                        {!loadingContentTypes && state.selectedLanguages.length === 0 && (
                            <div className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/50">
                                Select a language to see content types.
                            </div>
                        )}

                        {contentTypes.length > 0 && (
                            <ScrollArea className="h-[200px] w-full rounded-md border p-4">
                                <div className="space-y-1">
                                    {contentTypes.map((type, index) => (
                                        <div
                                            key={type.uid}
                                            className={`flex items-center space-x-3 p-2 rounded-md cursor-pointer transition-colors ${state.selectedContentTypes.some(t => t.uid === type.uid)
                                                ? 'bg-primary/10 text-primary font-medium'
                                                : 'hover:bg-muted'
                                                }`}
                                            onClick={() => toggleContentType(type)}
                                        >
                                            <span className="text-sm text-muted-foreground w-6">{index + 1}.</span>
                                            <span className="flex-1">{type.title}</span>
                                            {state.selectedContentTypes.some(t => t.uid === type.uid) && (
                                                <CheckCircle2 className="h-4 w-4 text-primary" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        )}
                    </div>
                </CardContent>
                <CardFooter>
                    <Button
                        onClick={handleFetchImages}
                        disabled={loadingImages || state.selectedContentTypes.length === 0}
                        className="w-full"
                    >
                        {loadingImages ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Fetch Images & Proceed
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
