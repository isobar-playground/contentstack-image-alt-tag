import React, { useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Copy, Upload } from 'lucide-react';

export function SessionFooter() {
    const { getSessionKey, restoreSession } = useAppContext();
    const [isOpen, setIsOpen] = useState(false);
    const [sessionKeyInput, setSessionKeyInput] = useState('');

    const handleCopyKey = () => {
        const key = getSessionKey();
        navigator.clipboard.writeText(key);
        toast.success('Session key copied to clipboard');
    };

    const handleRestore = () => {
        if (!sessionKeyInput.trim()) return;

        const success = restoreSession(sessionKeyInput.trim());
        if (success) {
            toast.success('Session restored successfully');
            setIsOpen(false);
            setSessionKeyInput('');
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
                <Button variant="outline" size="sm" onClick={handleCopyKey}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Session Key
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
                                Paste your session key below to restore your previous work.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            <Textarea
                                placeholder="Paste session key here..."
                                value={sessionKeyInput}
                                onChange={(e) => setSessionKeyInput(e.target.value)}
                                className="min-h-[100px]"
                            />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                            <Button onClick={handleRestore}>Restore</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </footer>
    );
}
