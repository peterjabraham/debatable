# Firebase Integration

**Document Version:** 1.0.0  
**Last Updated:** April 10, 2024  
**Compatible with:** 
- Next.js 15.0.0
- Firebase Admin SDK 13.1.0
- Firebase JS SDK 10.7.0
- Node.js 20.x

## Overview

The Debate-able application uses Firebase Firestore as its primary database for storing user profiles, debate data, and application state. This document details the Firebase integration architecture, implementation details, and best practices used in the application.

## Integration Architecture

```
┌──────────────────┐      ┌────────────────┐      ┌──────────────────┐
│                  │      │                │      │                  │
│  Next.js API     │─────▶│  Firebase      │─────▶│  Firebase        │
│  Routes          │◀─────│  Admin SDK     │◀─────│  Services        │
│                  │      │                │      │                  │
└──────────────────┘      └────────────────┘      └──────────────────┘
        ▲                                                  ▲
        │                                                  │
        │                                                  │
┌───────┴──────────┐                               ┌───────┴──────────┐
│                  │                               │                  │
│  React           │                               │  Firebase JS     │
│  Components      │───────────────────────────────▶  SDK (Client)    │
│                  │                               │                  │
└──────────────────┘                               └──────────────────┘
```

## Key Files

- `src/lib/db/firebase-admin.ts`: Server-side Firebase Admin SDK initialization
- `src/lib/db/firebase-client.ts`: Client-side Firebase JS SDK initialization
- `src/lib/db/firestore.ts`: Firestore database utility functions
- `src/lib/db/collections.ts`: Firestore collection references and types
- `src/lib/mock/firebase-mock.ts`: Mock implementation for development/testing

## Firebase Admin Setup

The Firebase Admin SDK is configured in a centralized file for server-side operations:

```typescript
// src/lib/db/firebase-admin.ts
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Check if Firebase Admin is already initialized
const apps = getApps();

// Initialize Firebase Admin if not already initialized
if (!apps.length) {
  try {
    // Get credentials from environment variables
    let serviceAccount;
    
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH) {
      // Load from file path
      serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH);
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      // Load from environment variable (JSON string)
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    } else {
      console.warn('Missing Firebase credentials. Using mock Firestore implementation.');
      serviceAccount = null;
    }
    
    if (serviceAccount) {
      initializeApp({
        credential: cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID,
        databaseURL: process.env.FIREBASE_DATABASE_URL,
      });
      
      console.log('Firebase Admin initialized successfully');
    } else {
      throw new Error('Missing required Firebase configuration');
    }
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
    console.warn('Using mock Firestore implementation');
  }
}

// Get Firestore instance
let db;
try {
  db = getFirestore();
} catch (error) {
  console.error('Error getting Firestore instance:', error);
  console.warn('Using mock Firestore implementation');
  // Use mock implementation
  db = require('../mock/firebase-mock').mockFirestore;
}

export default db;
```

## Firebase Client Setup

The Firebase JS SDK is configured for client-side operations:

```typescript
// src/lib/db/firebase-client.ts
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase if not already initialized
const apps = getApps();
const app = apps.length > 0 ? apps[0] : initializeApp(firebaseConfig);

// Initialize Firebase services
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
```

## Collection Structure

The Firestore database is organized into collections with specific schemas:

```typescript
// src/lib/db/collections.ts
import { collection, CollectionReference } from 'firebase/firestore';
import { db } from './firebase-client';
import { UserProfile, Debate, FavoriteDebate } from '@/types';

// Helper to strongly type collections
function createCollection<T = any>(collectionName: string) {
  return collection(db, collectionName) as CollectionReference<T>;
}

// Define collections with strong typing
export const usersCollection = createCollection<UserProfile>('users');
export const debatesCollection = createCollection<Debate>('debates');
export const favoritesCollection = createCollection<FavoriteDebate>('favorites');

// Collection schemas and paths
export const COLLECTIONS = {
  USERS: 'users',
  DEBATES: 'debates',
  FAVORITES: 'favorites',
};
```

## Database Access Utilities

Utility functions are provided for common database operations:

```typescript
// src/lib/db/firestore.ts
import { db } from './firebase-admin';
import { COLLECTIONS } from './collections';
import { UserProfile, Debate } from '@/types';

/**
 * Get a user by ID
 */
export async function getUserById(userId: string): Promise<UserProfile | null> {
  try {
    const userDoc = await db.collection(COLLECTIONS.USERS).doc(userId).get();
    
    if (!userDoc.exists) {
      return null;
    }
    
    return { id: userDoc.id, ...userDoc.data() } as UserProfile;
  } catch (error) {
    console.error('Error getting user by ID:', error);
    throw error;
  }
}

/**
 * Create or update a user profile
 */
export async function upsertUser(userId: string, userData: Partial<UserProfile>): Promise<UserProfile> {
  try {
    const userRef = db.collection(COLLECTIONS.USERS).doc(userId);
    const userDoc = await userRef.get();
    
    const now = new Date().toISOString();
    let updatedUserData: Partial<UserProfile>;
    
    if (!userDoc.exists) {
      // Create new user
      updatedUserData = {
        ...userData,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
      };
    } else {
      // Update existing user
      updatedUserData = {
        ...userData,
        updatedAt: now,
        lastLoginAt: now,
      };
    }
    
    await userRef.set(updatedUserData, { merge: true });
    
    // Return updated user data
    return { id: userId, ...updatedUserData } as UserProfile;
  } catch (error) {
    console.error('Error upserting user:', error);
    throw error;
  }
}

/**
 * Get debates by user ID
 */
export async function getDebatesByUserId(userId: string): Promise<Debate[]> {
  try {
    console.log(`Getting debates by user ID: ${userId}`);
    
    const debatesSnapshot = await db
      .collection(COLLECTIONS.DEBATES)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    
    console.log(`Querying documents in debates with 1 filters`);
    
    if (debatesSnapshot.empty) {
      return [];
    }
    
    return debatesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Debate[];
  } catch (error) {
    console.error('Error getting debates by user ID:', error);
    throw error;
  }
}

/**
 * Save a debate
 */
export async function saveDebate(debate: Omit<Debate, 'id'>): Promise<Debate> {
  try {
    const now = new Date().toISOString();
    const debateData = {
      ...debate,
      createdAt: now,
      updatedAt: now,
    };
    
    const debateRef = await db.collection(COLLECTIONS.DEBATES).add(debateData);
    
    return {
      id: debateRef.id,
      ...debateData,
    };
  } catch (error) {
    console.error('Error saving debate:', error);
    throw error;
  }
}

/**
 * Update a debate
 */
export async function updateDebate(debateId: string, data: Partial<Debate>): Promise<void> {
  try {
    const now = new Date().toISOString();
    
    await db.collection(COLLECTIONS.DEBATES).doc(debateId).update({
      ...data,
      updatedAt: now,
    });
  } catch (error) {
    console.error('Error updating debate:', error);
    throw error;
  }
}

/**
 * Delete a debate
 */
export async function deleteDebate(debateId: string): Promise<void> {
  try {
    await db.collection(COLLECTIONS.DEBATES).doc(debateId).delete();
  } catch (error) {
    console.error('Error deleting debate:', error);
    throw error;
  }
}
```

## Mock Implementation

For development and testing, a mock implementation is provided:

```typescript
// src/lib/mock/firebase-mock.ts
import { UserProfile, Debate, FavoriteDebate } from '@/types';

// Mock data
const mockUsers = new Map<string, UserProfile>();
const mockDebates = new Map<string, Debate>();
const mockFavorites = new Map<string, FavoriteDebate>();

// Mock Firestore implementation
export const mockFirestore = {
  collection: (collectionName: string) => {
    console.log(`Accessing mock collection: ${collectionName}`);
    
    let mockData: Map<string, any>;
    switch (collectionName) {
      case 'users':
        mockData = mockUsers;
        break;
      case 'debates':
        mockData = mockDebates;
        break;
      case 'favorites':
        mockData = mockFavorites;
        break;
      default:
        mockData = new Map();
    }
    
    return {
      doc: (id: string) => ({
        get: async () => {
          const data = mockData.get(id);
          return {
            id,
            exists: !!data,
            data: () => data,
          };
        },
        set: async (data: any, options: any = {}) => {
          if (options.merge) {
            const existing = mockData.get(id) || {};
            mockData.set(id, { ...existing, ...data });
          } else {
            mockData.set(id, data);
          }
          return true;
        },
        update: async (data: any) => {
          const existing = mockData.get(id);
          if (!existing) throw new Error('Document does not exist');
          mockData.set(id, { ...existing, ...data });
          return true;
        },
        delete: async () => {
          mockData.delete(id);
          return true;
        },
      }),
      add: async (data: any) => {
        const id = `mock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        mockData.set(id, data);
        return { id };
      },
      where: (field: string, operator: string, value: any) => {
        return {
          orderBy: (orderField: string, direction: string) => ({
            get: async () => {
              const filteredDocs = [...mockData.entries()]
                .filter(([_, doc]) => {
                  if (operator === '==') return doc[field] === value;
                  if (operator === '>') return doc[field] > value;
                  if (operator === '<') return doc[field] < value;
                  return false;
                })
                .sort((a, b) => {
                  if (direction === 'desc') {
                    return b[1][orderField].localeCompare(a[1][orderField]);
                  }
                  return a[1][orderField].localeCompare(b[1][orderField]);
                });
              
              return {
                empty: filteredDocs.length === 0,
                docs: filteredDocs.map(([id, data]) => ({
                  id,
                  data: () => data,
                })),
              };
            },
          }),
          get: async () => {
            const filteredDocs = [...mockData.entries()]
              .filter(([_, doc]) => {
                if (operator === '==') return doc[field] === value;
                if (operator === '>') return doc[field] > value;
                if (operator === '<') return doc[field] < value;
                return false;
              });
            
            return {
              empty: filteredDocs.length === 0,
              docs: filteredDocs.map(([id, data]) => ({
                id,
                data: () => data,
              })),
            };
          },
        };
      },
    };
  },
};

// Seed mock database with sample data
const seedMockDatabase = () => {
  // Add sample users
  mockUsers.set('user_1', {
    id: 'user_1',
    name: 'John Doe',
    email: 'john@example.com',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    lastLoginAt: '2024-04-01T00:00:00.000Z',
  });
  
  // Add sample debates
  mockDebates.set('debate_1', {
    id: 'debate_1',
    userId: 'user_1',
    topic: 'Climate Change',
    experts: [
      {
        id: 'exp_1',
        name: 'Climate Scientist',
        type: 'ai',
        background: 'Environmental researcher with 20 years experience',
        expertise: ['Climate science', 'Environmental policy'],
        stance: 'pro',
      },
      {
        id: 'exp_2',
        name: 'Industry Representative',
        type: 'ai',
        background: 'Energy industry consultant',
        expertise: ['Energy economics', 'Industrial policy'],
        stance: 'con',
      }
    ],
    messages: [
      {
        id: 'msg_1',
        role: 'system',
        content: 'The debate has begun.',
        timestamp: '2024-04-01T12:00:00.000Z',
      }
    ],
    expertType: 'ai',
    createdAt: '2024-04-01T12:00:00.000Z',
    updatedAt: '2024-04-01T12:30:00.000Z',
    isFavorite: false,
  });
};

// Seed the mock database
seedMockDatabase();
```

## Feature Implementation

### User Profiles

User profiles are managed through Firebase integration:

```typescript
// Example usage in API route
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }
  
  try {
    const userProfile = await getUserById(session.user.id);
    
    if (!userProfile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(userProfile);
  } catch (error: any) {
    console.error('Error fetching user profile:', error);
    
    return NextResponse.json(
      { error: error.message || 'Failed to fetch user profile' },
      { status: 500 }
    );
  }
}
```

### Debate History

Debate history is stored and retrieved from Firestore:

```typescript
// Example usage in API route
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }
  
  // Get search params for filtering
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId') || session.user.id;
  
  if (userId !== session.user.id) {
    return NextResponse.json(
      { error: 'Unauthorized to access other user debates' },
      { status: 403 }
    );
  }
  
  console.log(`Fetching debates for user ${userId}`);
  
  try {
    const debates = await getDebatesByUserId(userId);
    
    return NextResponse.json({ debates });
  } catch (error: any) {
    console.error('Error fetching debate history:', error);
    
    return NextResponse.json(
      { error: error.message || 'Failed to fetch debate history' },
      { status: 500 }
    );
  }
}
```

## Error Handling

Firebase integration includes specific error handling:

```typescript
// Example error handling for Firestore operations
try {
  // Firestore operation
} catch (error: any) {
  if (error.code === 'permission-denied') {
    // Handle permission issues
    console.error('Firebase permission denied:', error);
    // Return appropriate error response
  } else if (error.code === 'not-found') {
    // Handle missing document
    console.error('Firebase document not found:', error);
    // Return appropriate error response
  } else if (error.code === 'resource-exhausted') {
    // Handle quota issues
    console.error('Firebase quota exceeded:', error);
    // Implement backoff strategy
  } else {
    // Handle other errors
    console.error('Firebase error:', error);
    // Return generic error response
  }
}
```

## Testing and Development

For local development, the Firebase emulator can be used:

```typescript
// Configuration for Firebase emulator in development
if (process.env.NODE_ENV === 'development' && process.env.USE_FIREBASE_EMULATOR === 'true') {
  // Connect to local emulator
  const { connectFirestoreEmulator } = require('firebase/firestore');
  connectFirestoreEmulator(db, 'localhost', 8080);
  
  console.log('Connected to Firebase Emulator Suite');
}
```

## Configuration

Firebase integration is configured through environment variables:

```
# Firebase Admin SDK configuration (server-side)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_KEY_PATH=./your-service-account-key.json
# Alternative: Base64 encoded service account key
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# Firebase JS SDK configuration (client-side)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# Development settings
USE_FIREBASE_EMULATOR=false
USE_MOCK_FIREBASE=false
```

## Common Issues & Solutions

### Firebase Admin Initialization

The error message in the logs shows a common issue:

```
Missing required Firebase configuration
Using mock Firestore implementation
```

This happens when the Firebase service account credentials are missing or incorrect.

**Solution:**
- Check environment variables are properly set
- Verify the service account key file exists and is valid
- Use mock implementation for development and testing

### Firestore Rules

Firebase security rules can cause permission issues if not properly configured.

**Solution:**
- Review and update Firestore security rules
- Implement proper authentication checks
- Test rules in the Firebase Console

### Data Consistency

Firestore's eventual consistency model can lead to race conditions.

**Solution:**
- Use transactions for operations that require atomicity
- Implement optimistic UI updates with server validation
- Add proper error handling for concurrent modifications

## Related Documentation
- [API Integration](./API-Integration.md)
- [Authentication](../features/Authentication.md)
- [User Features](../features/User-Features.md)
- [GOOGLE_CLOUD_SETUP.md](../../GOOGLE_CLOUD_SETUP.md)

## OAuth Authentication with Firebase

NextAuth.js and Firebase can be used together to provide a seamless authentication experience. This section covers the integration between OAuth providers (via NextAuth.js) and Firebase authentication.

### Integration Architecture

```
┌────────────────┐      ┌────────────────┐      ┌────────────────┐
│                │      │                │      │                │
│  NextAuth.js   │─────▶│  OAuth         │─────▶│  NextAuth      │
│  Login         │      │  Provider      │      │  Callback      │
│                │      │  (Google/etc)  │      │                │
└────────────────┘      └────────────────┘      └────────────────┘
                                                       │
                                                       ▼
┌────────────────┐      ┌────────────────┐      ┌────────────────┐
│                │      │                │      │                │
│  Firebase      │◀─────│  Firebase      │◀─────│  Server-side   │
│  Firestore     │      │  Auth          │      │  Session       │
│  User Data     │      │  Integration   │      │  Creation      │
│                │      │                │      │                │
└────────────────┘      └────────────────┘      └────────────────┘
```

### NextAuth and Firebase Configuration

The key to integrating NextAuth with Firebase is using the NextAuth callbacks to synchronize user data with Firebase:

```typescript
// src/lib/auth.ts
import { NextAuthOptions } from 'next-auth';
import { createUserOrUpdateProfile } from './db/users';

export const authOptions: NextAuthOptions = {
  // ... existing NextAuth options
  
  callbacks: {
    async session({ session, token }) {
      // Existing session logic
      
      // Return the enhanced session
      return session;
    },
    
    async jwt({ token, user, account, profile }) {
      // Existing JWT logic
      
      // If this is a sign-in event with a user
      if (user && account) {
        try {
          // Create or update the user in Firestore
          await createUserOrUpdateProfile(token.sub, {
            provider: account.provider,
            name: user.name,
            email: user.email,
            image: user.image,
          });
        } catch (error) {
          console.error('Failed to sync user with Firebase:', error);
        }
      }
      
      return token;
    },
  },
};
```

### User Profile Synchronization

The Firebase user profile should be kept in sync with the OAuth provider's data. Here's an implementation for the Firestore function referenced above:

```typescript
// src/lib/db/users.ts
import db from './firebase-admin';
import { COLLECTIONS } from './collections';

export async function createUserOrUpdateProfile(userId, userData) {
  try {
    const userRef = db.collection(COLLECTIONS.USERS).doc(userId);
    const userDoc = await userRef.get();
    
    const timestamp = new Date().toISOString();
    
    // Default data for new users
    const defaultUserData = {
      createdAt: timestamp,
      updatedAt: timestamp,
      lastLoginAt: timestamp,
      preferences: {
        theme: 'light',
        notifications: true,
      },
      // Add any application-specific default fields
    };
    
    if (!userDoc.exists) {
      // Create a new user profile
      await userRef.set({
        ...defaultUserData,
        ...userData,
      });
      
      console.log(`Created new user profile for ${userId}`);
    } else {
      // Update existing user profile
      await userRef.update({
        ...userData,
        updatedAt: timestamp,
        lastLoginAt: timestamp,
      });
      
      console.log(`Updated existing profile for ${userId}`);
    }
    
    return { id: userId, ...userData };
  } catch (error) {
    console.error('Error creating/updating user profile:', error);
    throw error;
  }
}
```

### Troubleshooting OAuth with Firebase

When using OAuth with Firebase, several issues can arise:

#### 1. redirect_uri_mismatch Error

This common error appears when the OAuth provider's registered redirect URI doesn't match the actual callback URL.

**Solution:**
- Check NEXTAUTH_URL environment variable matches your deployment URL
- Verify OAuth provider (Google, GitHub, etc.) has the correct redirect URIs configured
- For Google, ensure the authorized redirect URI includes the exact path: `/api/auth/callback/google`

See [NextAuth-OAuth-Guide.md](./NextAuth-OAuth-Guide.md) for complete troubleshooting steps.

#### 2. Firebase Authentication Issues

If NextAuth.js works but Firebase isn't receiving user data:

**Solution:**
- Verify Firebase Admin SDK is properly initialized
- Check JWT callback is properly synchronizing user data
- Ensure environment variables for Firebase are correct
- Test Firestore write permissions

#### 3. Session Data Not Persisting

If session data doesn't persist between page refreshes:

**Solution:**
- Check NextAuth.js session configuration
- Verify the cookie settings are appropriate for your environment
- Make sure the NEXTAUTH_SECRET is properly set
- Check for secure cookie issues in development vs production

### Testing OAuth and Firebase Integration

Here's a utility function to test the integration between OAuth and Firebase:

```typescript
// src/lib/test-utils/auth-firebase-test.ts
import { getFirestore } from 'firebase-admin/firestore';

export async function verifyUserInFirestore(userId: string) {
  try {
    const db = getFirestore();
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      throw new Error(`User ${userId} not found in Firestore`);
    }
    
    const userData = userDoc.data();
    
    // Check essential fields are present
    const requiredFields = ['name', 'email', 'provider', 'createdAt', 'updatedAt'];
    const missingFields = requiredFields.filter(field => !userData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`User ${userId} is missing required fields: ${missingFields.join(', ')}`);
    }
    
    return {
      success: true,
      message: `User ${userId} verified in Firestore`,
      userData,
    };
  } catch (error) {
    console.error('Error verifying user in Firestore:', error);
    return {
      success: false,
      message: error.message,
      error,
    };
  }
}
```

### Best Practices for OAuth with Firebase

1. **Separate Environments**
   - Use separate Firebase projects for development and production
   - Configure different OAuth applications for each environment

2. **Security Rules**
   - Implement Firebase security rules to restrict data access
   - Use user IDs from JWT tokens to secure user-specific data

3. **Error Handling**
   - Add robust error handling for OAuth and Firebase operations
   - Implement fallback mechanisms for authentication failures

4. **Testing**
   - Write comprehensive tests for authentication flows
   - Test both the NextAuth.js and Firebase components

For a complete guide to troubleshooting OAuth issues with NextAuth.js, refer to the [NextAuth OAuth Integration Guide](./NextAuth-OAuth-Guide.md). 