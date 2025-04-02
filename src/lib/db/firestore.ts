import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuid } from 'uuid';

// Collections
export const COLLECTIONS = {
    USERS: process.env.FIRESTORE_USERS_COLLECTION || 'users',
    DEBATES: process.env.FIRESTORE_DEBATES_COLLECTION || 'debates',
    MESSAGES: process.env.FIRESTORE_MESSAGES_COLLECTION || 'messages',
    PROCESSED_MEDIA: process.env.FIRESTORE_PROCESSED_MEDIA_COLLECTION || 'processed_media'
};

// Track if Firestore has been initialized
let firestoreInitialized = false;
let firestoreInstance: ReturnType<typeof getFirestore> | null = null;

// Mock Firestore for development when credentials aren't available
class MockFirestore {
    private collections: Record<string, any> = {};

    collection(name: string) {
        if (!this.collections[name]) {
            this.collections[name] = new MockCollection(name);
        }
        return this.collections[name];
    }

    settings() {
        // No-op for mock
        return this;
    }
}

class MockCollection {
    private name: string;
    private documents: Record<string, any> = {};

    constructor(name: string) {
        this.name = name;
    }

    doc(id: string) {
        if (!this.documents[id]) {
            this.documents[id] = new MockDocument(id);
        }
        return this.documents[id];
    }

    where() {
        // Return self to allow chaining
        return this;
    }

    async get() {
        // Return empty array for queries
        return {
            forEach: (callback: (doc: any) => void) => { },
            empty: true,
            size: 0,
            docs: []
        };
    }
}

class MockDocument {
    private id: string;
    private data: any = null;

    constructor(id: string) {
        this.id = id;
    }

    async get() {
        return {
            exists: !!this.data,
            id: this.id,
            data: () => this.data
        };
    }

    async set(data: any) {
        this.data = data;
        return true;
    }

    async update(data: any) {
        this.data = { ...this.data, ...data };
        return true;
    }

    async delete() {
        this.data = null;
        return true;
    }

    collection(name: string) {
        return new MockCollection(name);
    }
}

// Only initialize on the server side
const initializeFirebaseAdmin = () => {
    if (typeof window === 'undefined') {
        try {
            if (getApps().length === 0) {
                const serviceAccountKeyPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH;
                const projectId = process.env.FIREBASE_PROJECT_ID;

                if (!serviceAccountKeyPath || !projectId) {
                    console.error('Missing required Firebase configuration');
                    console.warn('Using mock Firestore implementation');
                    return new MockFirestore() as any;
                }

                // Resolve the service account key path relative to the project root
                const absolutePath = path.resolve(process.cwd(), serviceAccountKeyPath);

                if (!fs.existsSync(absolutePath)) {
                    console.error(`Service account key file not found at: ${absolutePath}`);
                    console.warn('Using mock Firestore implementation');
                    return new MockFirestore() as any;
                }

                try {
                    // Read and parse the service account key file
                    const serviceAccount = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));

                    // Initialize Firebase with the service account
                    initializeApp({
                        credential: cert(serviceAccount),
                        projectId: projectId,
                    });

                    console.log('Firebase initialized successfully with service account key file');
                    const db = getFirestore();

                    // Test the connection
                    db.collection('test').doc('test').get()
                        .then(() => console.log('Firestore connection test successful'))
                        .catch(err => console.error('Firestore connection test failed:', err));

                    return db;
                } catch (error) {
                    console.error('Error reading or parsing service account key file:', error);
                    console.warn('Using mock Firestore implementation');
                    return new MockFirestore() as any;
                }
            }

            return getFirestore();
        } catch (error) {
            console.error('Error initializing Firebase Admin:', error);
            console.warn('Using mock Firestore implementation due to initialization error');
            return new MockFirestore() as any;
        }
    }
    return null;
};

// This will be null on the client side
let firestoreDb: ReturnType<typeof getFirestore> | MockFirestore | null = null;

// Only execute this on the server side
if (typeof window === 'undefined') {
    firestoreDb = initializeFirebaseAdmin();
}

// Initialize Firestore client and configure settings only once
if (!firestoreInstance) {
    try {
        firestoreInstance = firestoreDb;

        // Configure Firestore settings only if not already initialized
        if (firestoreInstance && !firestoreInitialized) {
            try {
                firestoreInstance.settings({
                    ignoreUndefinedProperties: true
                });
                firestoreInitialized = true;
            } catch (settingsError) {
                // If settings have already been initialized, just log a debug message
                console.debug('Firestore settings already initialized');
            }
        }
    } catch (initError) {
        const errorMessage = initError instanceof Error ? initError.message : 'Unknown error during Firestore initialization';
        console.error('Critical error initializing Firestore:', errorMessage);
        // Create a minimal placeholder so the app doesn't crash immediately
        firestoreInstance = new MockFirestore() as any;
    }
}

// Export the firestore instance
export const firestore = firestoreInstance;

/**
 * Get a document by ID
 */
export async function getDocument(collectionPath: string, documentId: string): Promise<any | null> {
    if (!collectionPath || !documentId) {
        console.error('getDocument called with invalid parameters:', { collectionPath, documentId });
        throw new Error('Invalid parameters for getDocument');
    }

    console.log(`Getting document from ${collectionPath}/${documentId}`);

    try {
        const docRef = firestore.collection(collectionPath).doc(documentId);
        const doc = await docRef.get();

        if (!doc.exists) {
            console.log(`Document not found: ${collectionPath}/${documentId}`);
            return null;
        }

        return { id: doc.id, ...doc.data() };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error getting document';
        console.error(`Error getting document ${collectionPath}/${documentId}:`, errorMessage);
        throw error;
    }
}

/**
 * Create a document with given data
 */
export async function createDocument(collectionPath: string, data: any, documentId?: string): Promise<any> {
    if (!collectionPath || !data) {
        console.error('createDocument called with invalid parameters:', { collectionPath, data });
        throw new Error('Invalid parameters for createDocument');
    }

    console.log(`Creating document in ${collectionPath}`);

    try {
        const docId = documentId || uuid();
        const docRef = firestore.collection(collectionPath).doc(docId);

        // Add metadata
        const timestamp = new Date().toISOString();
        const enhancedData = {
            ...data,
            createdAt: data.createdAt || timestamp,
            updatedAt: timestamp
        };

        await docRef.set(enhancedData);
        return { id: docId, ...enhancedData };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error creating document';
        console.error(`Error creating document in ${collectionPath}:`, errorMessage);
        throw error;
    }
}

/**
 * Update a document with given data
 */
export async function updateDocument(collectionPath: string, documentId: string, data: any): Promise<any> {
    if (!collectionPath || !documentId || !data) {
        console.error('updateDocument called with invalid parameters:', { collectionPath, documentId, data });
        throw new Error('Invalid parameters for updateDocument');
    }

    console.log(`Updating document ${collectionPath}/${documentId}`);

    try {
        const docRef = firestore.collection(collectionPath).doc(documentId);

        // Add updatedAt timestamp
        const enhancedData = {
            ...data,
            updatedAt: new Date().toISOString()
        };

        await docRef.update(enhancedData);

        // Get the updated document
        const updatedDoc = await docRef.get();
        if (!updatedDoc.exists) {
            throw new Error(`Document ${documentId} not found after update`);
        }

        return { id: updatedDoc.id, ...updatedDoc.data() };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error updating document';
        console.error(`Error updating document ${collectionPath}/${documentId}:`, errorMessage);
        throw error;
    }
}

/**
 * Delete a document
 */
export async function deleteDocument(collectionPath: string, documentId: string): Promise<boolean> {
    if (!collectionPath || !documentId) {
        console.error('deleteDocument called with invalid parameters:', { collectionPath, documentId });
        throw new Error('Invalid parameters for deleteDocument');
    }

    console.log(`Deleting document ${collectionPath}/${documentId}`);

    try {
        const docRef = firestore.collection(collectionPath).doc(documentId);
        await docRef.delete();
        return true;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error deleting document';
        console.error(`Error deleting document ${collectionPath}/${documentId}:`, errorMessage);
        throw error;
    }
}

/**
 * Query documents with filters
 */
export async function queryDocuments(collectionPath: string, filters: Array<{ field: string, op: string, value: any }>): Promise<any[]> {
    if (!collectionPath) {
        console.error('queryDocuments called with invalid parameters:', { collectionPath, filters });
        throw new Error('Invalid parameters for queryDocuments');
    }

    console.log(`Querying documents in ${collectionPath} with ${filters ? filters.length : 0} filters`);

    try {
        let query = firestore.collection(collectionPath);

        // Apply filters
        if (filters && filters.length > 0) {
            for (const filter of filters) {
                query = query.where(filter.field, filter.op as any, filter.value);
            }
        }

        const querySnapshot = await query.get();
        const results = [];

        querySnapshot.forEach(doc => {
            results.push({ id: doc.id, ...doc.data() });
        });

        return results;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error querying documents';
        console.error(`Error querying documents in ${collectionPath}:`, errorMessage);
        throw error;
    }
} 