"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { retrieveBatch, downloadBatchResults, uploadBatchFile, createBatch } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Loader2, AlertTriangle, FileText, RefreshCw } from 'lucide-react';

import { BatchInfo } from '@/lib/types';

import { OPENAI_MODELS, calculateImageTokens, estimateCost } from '@/lib/openai';
import { DEFAULT_MASTER_PROMPT } from '@/lib/constants';
import dynamic from 'next/dynamic';
import '@mdxeditor/editor/style.css';
import '../../mdxeditor-custom.css';
import Image from 'next/image';

const MDXEditor = dynamic(
    () => import('@mdxeditor/editor').then((mod) => {
        const {
            MDXEditor,
            headingsPlugin,
            listsPlugin,
            quotePlugin,
            thematicBreakPlugin,
            markdownShortcutPlugin,
            toolbarPlugin,
            UndoRedo,
            BoldItalicUnderlineToggles,
            ListsToggle,
            BlockTypeSelect,
            linkPlugin,
            linkDialogPlugin,
        } = mod;

        return function MDXEditorWithPlugins({ markdown, onChange }: { markdown: string; onChange: (value: string) => void }) {
            return (
                <MDXEditor
                    markdown={markdown}
                    onChange={onChange}
                    contentEditableClassName="prose dark:prose-invert prose-sm max-w-none min-h-[300px] p-4"
                    plugins={[
                        headingsPlugin(),
                        listsPlugin(),
                        quotePlugin(),
                        thematicBreakPlugin(),
                        linkPlugin(),
                        linkDialogPlugin(),
                        markdownShortcutPlugin(),
                        toolbarPlugin({
                            toolbarContents: () => (
                                <>
                                    <UndoRedo />
                                    <BlockTypeSelect />
                                    <BoldItalicUnderlineToggles />
                                    <ListsToggle />
                                </>
                            )
                        }),
                    ]}
                />
            );
        };
    }),
    { ssr: false }
);

export default function Step4BatchProcessing() {
    const { state, setState, setStep } = useAppContext();

    const [preparing, setPreparing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [creatingBatch, setCreatingBatch] = useState(false);
    const [polling, setPolling] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [masterPrompt, setMasterPrompt] = useState(state.config.masterPrompt);
    const [brandName, setBrandName] = useState(state.config.brandName);
    const [openaiModel, setOpenaiModel] = useState(state.config.openaiModel);

    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const activeImages = state.images.filter(img => img.status === 'active');

    const stopPolling = useCallback(() => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
        setPolling(false);
    }, []);

    const handleDownloadResults = useCallback(async (outputFileId: string, batchInfo: BatchInfo) => {
        setDownloading(true);
        try {
            const content = await downloadBatchResults(state.config, outputFileId);
            const lines = content.trim().split('\n');
            const results = lines.map(line => JSON.parse(line));


            const resultMap = new Map<string, string>();
            results.forEach((res: { custom_id: string; response?: { body?: { choices?: { message?: { content: string } }[] } } }) => {
                const uid = res.custom_id.replace('image-', '');
                const altText = res.response?.body?.choices?.[0]?.message?.content?.trim() || '';
                resultMap.set(uid, altText);
            });

            setState(prev => ({
                ...prev,
                images: prev.images.map(img => {
                    if (resultMap.has(img.uid)) {
                        const altText = resultMap.get(img.uid);
                        return {
                            ...img,
                            generatedAltText: altText,
                        };
                    }
                    return img;
                }),
                batchInfo: { ...batchInfo, status: 'completed' }
            }));

            toast.success('Results downloaded and mapped!');
            setDownloading(false);
            setStep(5);

        } catch (error) {
            console.error('Error downloading results:', error);
            toast.error('Failed to download results.');
            setDownloading(false);
        }
    }, [state.config, setState, setStep, setDownloading]);

    const startPolling = useCallback((batchId: string) => {
        if (pollIntervalRef.current) return;

        setPolling(true);
        pollIntervalRef.current = setInterval(async () => {
            try {
                const batch = await retrieveBatch(state.config, batchId);

                const completed = batch.request_counts?.completed || 0;
                const failed = batch.request_counts?.failed || 0;
                const total = batch.request_counts?.total || 0;

                const newBatchInfo: BatchInfo = {
                    batchId: batch.id,
                    fileId: batch.input_file_id,
                    createdAt: new Date(batch.created_at * 1000).toISOString(),
                    status: batch.status as BatchInfo['status'],
                    totalRequests: total,
                    completedRequests: completed,
                    failedRequests: failed,
                    outputFileId: batch.output_file_id,
                    errorFileId: batch.error_file_id,
                };

                setState(prev => ({ ...prev, batchInfo: newBatchInfo }));

                if (['completed', 'failed', 'cancelled', 'expired'].includes(batch.status)) {
                    stopPolling();
                    if (batch.status === 'completed') {
                        toast.success('Batch processing completed!');
                        handleDownloadResults(batch.output_file_id!, newBatchInfo);
                    } else {
                        toast.error(`Batch ended with status: ${batch.status}`);
                    }
                }
            } catch (error) {
                console.error('Error polling batch:', error);
            }
        }, 10000);
    }, [state.config, setState, stopPolling, handleDownloadResults]);

    useEffect(() => {
        if (!state.batchInfo) {
            return;
        }

        const status = state.batchInfo.status;
        if (status === 'completed' || status === 'failed' || status === 'cancelled' || status === 'expired') {
            return;
        }

        startPolling(state.batchInfo.batchId);

        return () => {
            stopPolling();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.batchInfo?.batchId, state.batchInfo?.status]);

    const prepareRequests = () => {
        const instructions = masterPrompt;

        return activeImages.map((image) => {
            let userMessage = 'Generate an ALT tag for this image.';
            if (image.localeName) {
                userMessage += `\n\nGenerate the ALT tag in the language: ${image.localeName}`;
            }


            if (image.usages && image.usages.length > 0) {
                const context = image.usages.map(u => `Used in content type ${u.contentTypeTitle} named ${u.key.split(' - ')[1] || 'Unknown'}`).join('. ');
                userMessage += `\n\nContext: ${context}`;
            }


            if (brandName) {
                userMessage += `\n\nBrand: ${brandName}`;
            }


            const imageUrl = new URL(image.url);
            imageUrl.searchParams.set('height', '1080');
            imageUrl.searchParams.set('fit', 'scale-down');
            imageUrl.searchParams.set('quality', '85');

            return {
                custom_id: `image-${image.uid}`,
                method: 'POST',
                url: '/v1/chat/completions',
                body: {
                    model: openaiModel,
                    messages: [
                        { role: 'system', content: instructions },
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: userMessage },
                                { type: 'image_url', image_url: { url: imageUrl.toString() } }
                            ]
                        },
                    ],
                    max_tokens: 150,
                    temperature: 0.7,
                },
            };
        });
    };

    const handleStartBatch = async () => {
        if (!state.config.openaiApiKey) {
            toast.error('OpenAI API Key is required to start batch processing.');
            return;
        }

        const updatedConfig = {
            ...state.config,
            masterPrompt,
            brandName,
            openaiModel
        };

        setState(prev => ({
            ...prev,
            config: updatedConfig
        }));

        setPreparing(true);
        try {

            const requests = prepareRequests();
            const jsonlContent = requests.map(req => JSON.stringify(req)).join('\n');

            setPreparing(false);
            setUploading(true);


            const fileName = `batch-requests-${new Date().getTime()}.jsonl`;
            const fileId = await uploadBatchFile(updatedConfig, jsonlContent, fileName);

            setUploading(false);
            setCreatingBatch(true);


            const batchId = await createBatch(updatedConfig, fileId);

            const initialBatchInfo: BatchInfo = {
                batchId,
                fileId,
                createdAt: new Date().toISOString(),
                status: 'validating',
                totalRequests: requests.length,
                completedRequests: 0,
                failedRequests: 0,
            };

            setState(prev => ({ ...prev, batchInfo: initialBatchInfo }));
            setCreatingBatch(false);

            toast.success('Batch created successfully. Monitoring progress...');
            startPolling(batchId);

        } catch (error) {
            console.error('Error starting batch:', error);
            toast.error('Failed to start batch processing.');
            setPreparing(false);
            setUploading(false);
            setCreatingBatch(false);
        }
    };
    const progressValue = state.batchInfo
        ? (state.batchInfo.completedRequests / state.batchInfo.totalRequests) * 100
        : 0;

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <Card>
                <CardHeader>
                    <CardTitle>Batch Processing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {!state.batchInfo ? (
                        <>
                            <div className="space-y-3">
                                <h3 className="font-semibold text-lg">Images to Process ({activeImages.length})</h3>
                                <ScrollArea className="h-[200px] w-full rounded-md border p-3 bg-muted">
                                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                                        {activeImages.map((image) => (
                                            <div key={image.uid} className="aspect-square relative bg-card rounded border overflow-hidden">

                                                <Image
                                                    src={image.url}
                                                    alt={image.filename || "Image"}
                                                    width={150}
                                                    height={150}
                                                    className="object-contain w-full h-full p-1"
                                                    title={image.filename}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </div>

                            <div className="space-y-3">
                                <h3 className="font-semibold text-lg">OpenAI Configuration</h3>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Model & Estimated Cost</Label>
                                        <div className="border rounded-md divide-y">
                                            {OPENAI_MODELS.map((model) => {
                                                let totalInputTokens = 0;
                                                const totalOutputTokens = activeImages.length * 150;

                                                activeImages.forEach(img => {
                                                    const width = img.width || 800;
                                                    const height = img.height || 800;
                                                    totalInputTokens += calculateImageTokens(width, height);

                                                    const textContext = (masterPrompt.length + (brandName?.length || 0) + 200);
                                                    totalInputTokens += Math.ceil(textContext / 4);
                                                });

                                                const cost = estimateCost(model.id, totalInputTokens, totalOutputTokens);

                                                return (
                                                    <div key={model.id} className={`flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 ${openaiModel === model.id ? 'bg-muted' : ''}`} onClick={() => setOpenaiModel(model.id)}>
                                                        <div className="flex items-center gap-3">
                                                            <input
                                                                type="radio"
                                                                name="openaiModel"
                                                                value={model.id}
                                                                checked={openaiModel === model.id}
                                                                onChange={() => setOpenaiModel(model.id)}
                                                                className="h-4 w-4 text-primary"
                                                            />
                                                            <div className="flex flex-col">
                                                                <span className="font-medium">{model.name}</span>
                                                                <span className="text-xs text-muted-foreground">
                                                                    ${model.inputPrice.toFixed(2)} / ${model.outputPrice.toFixed(2)} per 1M tokens
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="font-semibold">
                                                            {cost < 0.01 ? '>$0.01' : `~ $${cost.toFixed(2)}`}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h3 className="font-semibold text-lg">Brand Name (Optional)</h3>
                                <Input
                                    id="brandName"
                                    name="brandName"
                                    placeholder="e.g., Origen"
                                    value={brandName}
                                    onChange={(e) => setBrandName(e.target.value)}
                                />
                                <p className="text-xs text-gray-500">Used to provide context to the AI.</p>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold text-lg">Master Prompt</h3>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setMasterPrompt(DEFAULT_MASTER_PROMPT)}
                                        disabled={masterPrompt === DEFAULT_MASTER_PROMPT}
                                    >
                                        Reset to default
                                    </Button>
                                </div>
                                <div className="border rounded-md overflow-hidden" key={masterPrompt.substring(0, 50)}>
                                    <MDXEditor markdown={masterPrompt} onChange={setMasterPrompt} />
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <div className="space-y-1">
                                    <h3 className="font-semibold text-lg">Batch Status: <span className="uppercase text-blue-600">{state.batchInfo.status.replace('_', ' ')}</span></h3>
                                    <p className="text-sm text-gray-500">ID: {state.batchInfo.batchId}</p>
                                </div>
                                {polling && <Loader2 className="h-5 w-5 animate-spin text-blue-500" />}
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>Progress</span>
                                    <span>{state.batchInfo.completedRequests} / {state.batchInfo.totalRequests}</span>
                                </div>
                                <Progress value={progressValue} className="h-3" />
                            </div>

                            {state.batchInfo.failedRequests > 0 && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>Failures Detected</AlertTitle>
                                    <AlertDescription>
                                        {state.batchInfo.failedRequests} requests failed.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                    {!state.batchInfo && (
                        <Button
                            onClick={handleStartBatch}
                            disabled={preparing || uploading || creatingBatch}
                            className="w-full"
                        >
                            {(preparing || uploading || creatingBatch) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            {preparing ? 'Preparing...' : uploading ? 'Uploading...' : creatingBatch ? 'Creating Batch...' : 'Start Batch Processing'}
                        </Button>
                    )}

                    {state.batchInfo && state.batchInfo.status === 'completed' && (
                        <Button
                            onClick={() => handleDownloadResults(state.batchInfo!.outputFileId!, state.batchInfo!)}
                            disabled={downloading}
                            className="w-full"
                        >
                            {downloading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                            Download Results & Review
                        </Button>
                    )}

                    {state.batchInfo && !['completed', 'failed', 'cancelled', 'expired'].includes(state.batchInfo.status) && (
                        <Button variant="outline" onClick={() => startPolling(state.batchInfo!.batchId)} disabled={polling}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${polling ? 'animate-spin' : ''}`} />
                            {polling ? 'Monitoring...' : 'Refresh Status'}
                        </Button>
                    )}
                </CardFooter>
            </Card>
        </div>
    );
}
