import React from 'react';
import { Citation } from '@/types/message';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

interface CitationFooterProps {
    citations?: Citation[];
}

export function CitationFooter({ citations }: CitationFooterProps) {
    if (!citations || citations.length === 0) {
        return null;
    }

    return (
        <div className="mt-3 pt-2 border-t border-border">
            <h4 className="text-xs font-medium text-muted-foreground mb-2">Citations</h4>
            <div className="flex flex-col gap-2">
                {citations.map((citation, index) => (
                    <div key={index} className="text-xs">
                        <div className="flex items-start gap-1">
                            <span className="font-medium">[{index + 1}]</span>
                            <div>
                                <p className="text-foreground">{citation.title || 'Untitled Source'}</p>
                                {citation.author && (
                                    <p className="text-muted-foreground">{citation.author}</p>
                                )}
                                {citation.url && (
                                    <Button
                                        variant="link"
                                        size="sm"
                                        className="h-auto p-0 text-xs"
                                        onClick={() => window.open(citation.url, '_blank')}
                                    >
                                        <ExternalLink className="h-3 w-3 mr-1" />
                                        View Source
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
} 