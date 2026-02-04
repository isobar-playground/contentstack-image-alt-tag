import React, { useRef, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from 'sonner';
import { Download, Upload } from 'lucide-react';
import { downloadSessionKey, readSessionKeyFile } from '@/lib/sessionKey';

export function SessionFooter() {
    const { getSessionKey, restoreSession } = useAppContext();
    const [isOpen, setIsOpen] = useState(false);
    const [selectedFileName, setSelectedFileName] = useState('');
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const handleExportKey = () => {
        const key = getSessionKey();
        downloadSessionKey(key);
        toast.success('Session key saved to file');
    };

    const handleRestoreFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setSelectedFileName(file.name);
        const key = await readSessionKeyFile(file);
        if (!key) {
            toast.error('Session key file is empty');
            return;
        }

        const success = restoreSession(key);
        if (success) {
            toast.success('Session restored successfully');
            setIsOpen(false);
            setSelectedFileName('');
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } else {
            toast.error('Invalid session key');
        }
    };

    return (
        <footer className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 flex justify-between items-center z-50 shadow-lg">
            <div className="text-sm text-muted-foreground">
                Session Management
            </div>
            <div className="flex gap-4">
                <Button variant="outline" size="sm" onClick={handleExportKey}>
                    <Download className="mr-2 h-4 w-4" />
                    Export Session Key
                </Button>

                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button variant="secondary" size="sm">
                            <Upload className="mr-2 h-4 w-4" />
                            Restore Session
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Restore Session</DialogTitle>
                            <DialogDescription>
                                Import a .key file to restore your previous work.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".key"
                                onChange={handleRestoreFile}
                                className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
                            />
                            {selectedFileName && (
                                <p className="mt-2 text-xs text-muted-foreground">
                                    Selected file: {selectedFileName}
                                </p>
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </footer>
    );
}
