import { useState, useEffect, useCallback, useRef } from 'react';
import { Message } from '@/types/message';
import { useDebateStore } from '@/lib/store';
import { SavedDebate } from '@/lib/db/models/debate';

// Optimal batch size for message fetching
const DEFAULT_BATCH_SIZE = 20;
const MESSAGE_FETCH_INTERVAL = 5000; // 5 seconds, increased from 3s to reduce frequency
const MAX_POLL_COUNT = 10; // Maximum number of consecutive polls with no new messages

interface MessageBatchingOptions {
    debateId: string | null;
    batchSize?: number;
    enabled?: boolean;
    initialMessages?: Message[];
    onMessagesLoaded?: (messages: Message[]) => void;
}

/**
 * Custom hook for efficient message loading with batch processing
 * This reduces Firebase reads by batching requests and implementing
 * client-side pagination
 */
export function useMessageBatching({
    debateId,
    batchSize = DEFAULT_BATCH_SIZE,
    enabled = true,
    initialMessages = [],
    onMessagesLoaded
}: MessageBatchingOptions) {
    // State for messages and loading
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<Error | null>(null);
    const [hasMoreMessages, setHasMoreMessages] = useState<boolean>(true);
    const lastTimestampRef = useRef<string | null>(null);
    const isMountedRef = useRef<boolean>(true);
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Cache to prevent duplicate fetches
    const messagesCache = useRef<Map<string, Message>>(new Map());

    // Track the most recent message ID we've seen
    const mostRecentMessageIdRef = useRef<string | null>(null);

    // Track consecutive polls with no new messages
    const emptyPollCountRef = useRef<number>(0);

    // Track whether we should be polling
    const shouldPollRef = useRef<boolean>(true);

    // Initialize cache with initial messages
    useEffect(() => {
        if (initialMessages.length > 0) {
            const newCache = new Map<string, Message>();
            initialMessages.forEach(msg => {
                if (msg.id) {
                    newCache.set(msg.id, msg);
                }
            });
            messagesCache.current = newCache;

            // Find most recent message
            const sortedMessages = [...initialMessages].sort((a, b) => {
                const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                return bTime - aTime;
            });

            if (sortedMessages.length > 0 && sortedMessages[0].id) {
                mostRecentMessageIdRef.current = sortedMessages[0].id;
            }

            // Set initial messages
            setMessages(initialMessages);
        }
    }, [initialMessages]);

    // Clean up on unmount
    useEffect(() => {
        return () => {
            isMountedRef.current = false;
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
        };
    }, []);

    // Fetch messages in batches
    const fetchMessageBatch = useCallback(async (refresh = false) => {
        if (!debateId || !enabled || (isLoading && !refresh)) return;

        try {
            setIsLoading(true);
            setError(null);

            // If refreshing, reset the timestamp
            if (refresh) {
                lastTimestampRef.current = null;
            }

            // For now, we'll avoid real API calls and use the store directly instead
            const storeMessages = useDebateStore.getState().messages || [];

            // Simulate the API response
            if (!isMountedRef.current) return;

            // Reset empty poll count on a manual refresh
            if (refresh) {
                emptyPollCountRef.current = 0;
            }

            setHasMoreMessages(false); // We're not implementing true pagination yet

            if (storeMessages.length > 0) {
                const newMessages: Message[] = [];

                // Filter messages we haven't seen yet
                storeMessages.forEach(msg => {
                    if (msg.id && !messagesCache.current.has(msg.id)) {
                        messagesCache.current.set(msg.id, msg);
                        newMessages.push(msg);
                    }
                });

                if (newMessages.length > 0) {
                    // Reset empty poll count since we got new messages
                    emptyPollCountRef.current = 0;

                    // Sort by timestamp
                    const sortedNewMessages = newMessages.sort((a, b) => {
                        const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                        const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                        return aTime - bTime; // Ascending order
                    });

                    // Update the most recent message ID
                    if (refresh && sortedNewMessages.length > 0) {
                        const latestMessage = [...sortedNewMessages].sort((a, b) => {
                            const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                            const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                            return bTime - aTime; // Latest first
                        })[0];

                        if (latestMessage && latestMessage.id) {
                            mostRecentMessageIdRef.current = latestMessage.id;
                        }
                    }

                    // Update messages state
                    setMessages(prev => {
                        // Combine and sort
                        const combined = [...prev, ...sortedNewMessages];
                        return combined.sort((a, b) => {
                            const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                            const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                            return aTime - bTime; // Ascending order
                        });
                    });

                    // Callback if provided
                    if (onMessagesLoaded) {
                        onMessagesLoaded(sortedNewMessages);
                    }
                } else {
                    // Increment empty poll count
                    emptyPollCountRef.current++;

                    // If we've had too many empty polls, slow down polling
                    if (emptyPollCountRef.current > MAX_POLL_COUNT) {
                        shouldPollRef.current = false;
                        console.log("Too many empty polls, suspending automatic polling");
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching messages:', err);
            setError(err instanceof Error ? err : new Error('Unknown error fetching messages'));
            // Increment empty poll count on error to eventually pause polling
            emptyPollCountRef.current++;
        } finally {
            if (isMountedRef.current) {
                setIsLoading(false);
            }
        }
    }, [debateId, batchSize, isLoading, enabled, onMessagesLoaded]);

    // Setup polling for new messages
    useEffect(() => {
        if (!debateId || !enabled) return;

        // Initial fetch
        fetchMessageBatch(true);
        shouldPollRef.current = true; // Reset polling flag on mount or debateId change

        // Setup polling with a cleanup on early return
        const intervalId = setInterval(() => {
            // Skip polling if disabled
            if (!shouldPollRef.current) return;

            // Poll for new messages
            fetchMessageBatch();
        }, MESSAGE_FETCH_INTERVAL);

        pollingIntervalRef.current = intervalId;

        return () => {
            clearInterval(intervalId);
            pollingIntervalRef.current = null;
        };
    }, [debateId, enabled, fetchMessageBatch]);

    // Load more messages function - used for pagination
    const loadMoreMessages = useCallback(() => {
        if (!isLoading && hasMoreMessages) {
            fetchMessageBatch();
        }
    }, [fetchMessageBatch, isLoading, hasMoreMessages]);

    // Refresh messages function - used to force a refresh
    const refreshMessages = useCallback(() => {
        // Re-enable polling when user manually refreshes
        shouldPollRef.current = true;
        emptyPollCountRef.current = 0;
        fetchMessageBatch(true);
    }, [fetchMessageBatch]);

    return {
        messages,
        isLoading,
        error,
        hasMoreMessages,
        loadMoreMessages,
        refreshMessages,
    };
}

export default useMessageBatching; 