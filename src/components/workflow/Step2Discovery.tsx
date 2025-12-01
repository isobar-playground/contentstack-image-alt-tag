"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getLanguages, getContentTypes, getAssets } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { Language, ContentType, ImageAsset } from '@/lib/types';

export default function Step2Discovery() {
    const { state, setState, setStep } = useAppContext();

    const [languages, setLanguages] = useState<Language[]>([]);
    const [contentTypes, setContentTypes] = useState<ContentType[]>([]);

    const [discoveredImages, setDiscoveredImages] = useState<ImageAsset[]>([]);
    const [selectedImageUids, setSelectedImageUids] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [hasDiscoveredImages, setHasDiscoveredImages] = useState(false);

    const [loadingLanguages, setLoadingLanguages] = useState(false);
    const [loadingContentTypes, setLoadingContentTypes] = useState(false);
    const [loadingImages, setLoadingImages] = useState(false);


    useEffect(() => {
        const fetchLanguages = async () => {
            setLoadingLanguages(true);
            try {
                const langs = await getLanguages(state.config);
                setLanguages(langs);


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
    }, [state.config, languages.length, setState]);


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


    const handleDiscoverContentTypes = useCallback(async () => {
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


            const imageTypes = uniqueTypes.filter(t => t.uid.startsWith('image/'));


            setState(prev => ({ ...prev, selectedContentTypes: imageTypes }));

        } catch (error) {
            toast.error('Failed to discover content types.');
            console.error(error);
        } finally {
            setLoadingContentTypes(false);
        }
    }, [state.selectedLanguages, setContentTypes, setLoadingContentTypes, state.config, setState]);


    useEffect(() => {
        const timer = setTimeout(() => {
            handleDiscoverContentTypes();
        }, 500);

        return () => clearTimeout(timer);
    }, [state.selectedLanguages, handleDiscoverContentTypes]);



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

    const handleDiscoverImages = useCallback(async () => {
        if (state.selectedContentTypes.length === 0) {
            return;
        }

        setLoadingImages(true);
        setHasDiscoveredImages(false);

        try {
            let allImages: ImageAsset[] = [];
            const typeUids = state.selectedContentTypes.map(t => t.uid);

            for (const lang of state.selectedLanguages) {
                const images = await getAssets(state.config, lang.code, typeUids);
                const imagesWithLocale = images.map((img) => ({
                    ...img,
                    locale: lang.code,
                    localeName: lang.name,
                    status: 'active',
                })) as ImageAsset[];
                allImages = [...allImages, ...imagesWithLocale];
            }

            setDiscoveredImages(allImages);
            setSelectedImageUids(new Set(allImages.map(img => img.uid)));
            setHasDiscoveredImages(true);

            if (allImages.length === 0) {
                toast.info('No images found without description.');
            }
        } catch (error) {
            toast.error('Failed to fetch images.');
            console.error(error);
        } finally {
            setLoadingImages(false);
        }
    }, [state.selectedContentTypes, state.selectedLanguages, state.config, setLoadingImages, setHasDiscoveredImages, setDiscoveredImages, setSelectedImageUids]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (state.selectedContentTypes.length > 0) {
                handleDiscoverImages();
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [state.selectedContentTypes, state.selectedLanguages, handleDiscoverImages]);

    const filteredImages = discoveredImages.filter(img =>
        img.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
        img.uid.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const uniqueDisplayImages = Array.from(
        new Map(filteredImages.map(img => [img.uid, img])).values()
    );

    const toggleImageSelection = (uid: string) => {
        const newSelection = new Set(selectedImageUids);
        if (newSelection.has(uid)) {
            newSelection.delete(uid);
        } else {
            newSelection.add(uid);
        }
        setSelectedImageUids(newSelection);
    };

    const handleSelectAll = () => {
        const newSelection = new Set(selectedImageUids);
        discoveredImages.forEach(img => newSelection.add(img.uid));
        setSelectedImageUids(newSelection);
    };

    const handleDeselectAll = () => {
        const newSelection = new Set(selectedImageUids);
        discoveredImages.forEach(img => newSelection.delete(img.uid));
        setSelectedImageUids(newSelection);
    };

    const handleProceed = () => {
        const finalImages = discoveredImages.filter(img => selectedImageUids.has(img.uid));

        if (finalImages.length === 0) {
            toast.error('Please select at least one image to proceed.');
            return;
        }

        setState(prev => ({ ...prev, images: finalImages }));
        setStep(3);
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Discovery</CardTitle>
                    <CardDescription>Select languages and content types to discover images.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <h3 className="text-sm font-medium leading-none">Languages</h3>
                            {loadingLanguages ? (
                                <div className="flex items-center p-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading languages...
                                </div>
                            ) : (
                                <ScrollArea className="h-[150px] w-full rounded-md border p-4">
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
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-medium leading-none">Content Types</h3>
                                {loadingContentTypes && (
                                    <span className="flex items-center text-xs text-muted-foreground">
                                        <Loader2 className="h-3 w-3 animate-spin mr-1" /> Discovering...
                                    </span>
                                )}
                            </div>

                            {loadingContentTypes ? (
                                <div className="h-[150px] w-full rounded-md border p-4 flex items-center justify-center">
                                    <div className="flex items-center text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading content types...
                                    </div>
                                </div>
                            ) : contentTypes.length === 0 && state.selectedLanguages.length > 0 ? (
                                <div className="h-[150px] w-full rounded-md border p-4 flex items-center justify-center">
                                    <div className="text-sm text-muted-foreground">
                                        No content types found for selected languages.
                                    </div>
                                </div>
                            ) : state.selectedLanguages.length === 0 ? (
                                <div className="h-[150px] w-full rounded-md border p-4 flex items-center justify-center">
                                    <div className="text-sm text-muted-foreground">
                                        Select a language to see content types.
                                    </div>
                                </div>
                            ) : (
                                <ScrollArea className="h-[150px] w-full rounded-md border p-4">
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
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium leading-none">Content</h3>
                            {loadingImages ? (
                                <span className="flex items-center text-xs text-muted-foreground">
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" /> Loading images...
                                </span>
                            ) : hasDiscoveredImages ? (
                                <span className="text-xs text-muted-foreground">
                                    {selectedImageUids.size} selected / {uniqueDisplayImages.length} total
                                </span>
                            ) : null}
                        </div>

                        {loadingImages ? (
                            <div className="h-[300px] w-full rounded-md border p-4 flex items-center justify-center">
                                <div className="flex items-center text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading images...
                                </div>
                            </div>
                        ) : !hasDiscoveredImages && state.selectedContentTypes.length === 0 ? (
                            <div className="h-[300px] w-full rounded-md border p-4 flex items-center justify-center">
                                <div className="text-sm text-muted-foreground">
                                    Select content types to see images.
                                </div>
                            </div>
                        ) : !hasDiscoveredImages ? (
                            <div className="h-[300px] w-full rounded-md border p-4 flex items-center justify-center">
                                <div className="text-sm text-muted-foreground">
                                    No images found without description.
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="text"
                                        placeholder="Search by filename or ID..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                    <Button variant="outline" size="sm" onClick={handleSelectAll}>All</Button>
                                    <Button variant="outline" size="sm" onClick={handleDeselectAll}>None</Button>
                                </div>

                                <ScrollArea className="h-[300px] w-full rounded-md border p-4">
                                    <div className="space-y-1">
                                        {uniqueDisplayImages.length === 0 ? (
                                            <div className="text-sm text-muted-foreground text-center py-4">
                                                No images match your search.
                                            </div>
                                        ) : (
                                            uniqueDisplayImages.map((img) => (
                                                <div
                                                    key={img.uid}
                                                    className={`flex items-center space-x-3 p-2 rounded-md cursor-pointer transition-colors ${selectedImageUids.has(img.uid)
                                                        ? 'bg-primary/10 text-primary font-medium'
                                                        : 'hover:bg-muted'
                                                        }`}
                                                    onClick={() => toggleImageSelection(img.uid)}
                                                >
                                                    <div className="shrink-0">
                                                        <img src={img.url} alt={img.filename} className="h-10 w-10 object-cover rounded" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm truncate">{img.filename}</p>
                                                        <p className="text-xs text-muted-foreground truncate">{img.title}</p>
                                                    </div>
                                                    {selectedImageUids.has(img.uid) && (
                                                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </ScrollArea>
                            </>
                        )}
                    </div>


                </CardContent>
                <CardFooter>
                    <Button
                        onClick={handleProceed}
                        disabled={selectedImageUids.size === 0 || loadingImages}
                        className="w-full"
                    >
                        Proceed with {selectedImageUids.size} Images
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
