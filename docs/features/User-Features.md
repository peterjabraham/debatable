# User Features

**Document Version:** 1.0.0  
**Last Updated:** April 3, 2024  
**Compatible with:** 
- Next.js 15.0.0
- React 18.2.0
- NextAuth.js 4.24.11
- TanStack Query 5.68.0

## Overview

The User Features system provides a range of functionalities for user-specific interactions and persistence in the Debate-able application. This includes debate history management, user preferences, profile settings, and content management. These features enhance user experience by providing personalization and continuity across sessions.

## Architecture

```
┌──────────────┐       ┌───────────────┐       ┌─────────────────┐
│              │       │               │       │                 │
│  User Auth   │──────▶│  User Profile │──────▶│  User Settings  │
│              │       │               │       │                 │
└──────────────┘       └───────┬───────┘       └─────────────────┘
                               │
                               │
             ┌─────────────────┴───────────────┐
             │                                 │
             ▼                                 ▼
┌────────────────────┐               ┌──────────────────┐
│                    │               │                  │
│   Debate History   │               │   Favorites      │
│                    │               │                  │
└────────────────────┘               └──────────────────┘
```

## Key Files

- `src/app/profile/page.tsx`: User profile management page
- `src/app/history/page.tsx`: Debate history page
- `src/lib/hooks/useUser.ts`: Hook for accessing user data
- `src/lib/hooks/useSettings.ts`: Hook for managing user settings
- `src/app/api/user/profile/route.ts`: API for user profile operations
- `src/app/api/user/preferences/route.ts`: API for user preferences
- `src/app/api/debate/history/route.ts`: API for debate history

## Core Functions

### User Profile Management

Users can view and update their profile information:

```typescript
// src/lib/hooks/useUser.ts
export function useUser() {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();

  // Fetch user profile data
  const {
    data: profile,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['userProfile', session?.user?.id],
    queryFn: async (): Promise<UserProfile> => {
      const response = await fetch('/api/user/profile');
      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }
      return response.json();
    },
    enabled: status === 'authenticated',
  });

  // Mutation for updating profile
  const { mutateAsync: updateProfile, isPending: isUpdating } = useMutation({
    mutationFn: async (newData: Partial<UserProfile>) => {
      const response = await fetch('/api/user/profile/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newData),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      return response.json();
    },
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(['userProfile', session?.user?.id], (oldData: UserProfile | undefined) => {
        if (!oldData) return updatedProfile;
        return { ...oldData, ...updatedProfile.profile };
      });
    },
  });

  return {
    profile,
    isLoading,
    isUpdating,
    error,
    updateProfile,
    refetchProfile: refetch,
    isAuthenticated: status === 'authenticated',
    isAnonymous: status === 'unauthenticated',
  };
}
```

### User Preferences

Users can customize their debate experience:

```typescript
// Example preferences structure
interface UserPreferences {
  preferredLanguage: string;
  theme: 'light' | 'dark' | 'system';
  notifications: boolean;
  expertTypes: string[];
  preferredTopics: string[];
}

// Settings context example
export const SettingsContext = createContext<{
  preferences: UserPreferences;
  updatePreferences: (newPrefs: Partial<UserPreferences>) => Promise<void>;
}>({
  preferences: DEFAULT_PREFERENCES,
  updatePreferences: async () => {},
});

// Settings provider component
export function SettingsProvider({ children }: { children: ReactNode }) {
  const { profile, isAuthenticated } = useUser();
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  
  // Load preferences from profile when available
  useEffect(() => {
    if (profile?.settings) {
      setPreferences({
        ...DEFAULT_PREFERENCES,
        ...profile.settings
      });
    }
  }, [profile]);
  
  // Update preferences in backend
  const updatePreferences = async (newPrefs: Partial<UserPreferences>) => {
    const updatedPrefs = { ...preferences, ...newPrefs };
    setPreferences(updatedPrefs);
    
    if (isAuthenticated) {
      try {
        await fetch('/api/user/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedPrefs),
        });
      } catch (error) {
        console.error('Failed to save preferences:', error);
      }
    }
  };
  
  return (
    <SettingsContext.Provider value={{ preferences, updatePreferences }}>
      {children}
    </SettingsContext.Provider>
  );
}
```

### Debate History

Users can view, filter, and continue past debates:

```typescript
// src/app/history/page.tsx (simplified)
export default function HistoryPage() {
  const { data: session } = useSession();
  const [debates, setDebates] = useState<SavedDebate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Fetch debate history
  useEffect(() => {
    async function fetchDebateHistory() {
      if (!session?.user?.id) return;
      
      setIsLoading(true);
      try {
        const response = await fetch(`/api/debate/history?userId=${session.user.id}`);
        const data = await response.json();
        setDebates(data.debates || []);
      } catch (err) {
        console.error('Error fetching debate history:', err);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchDebateHistory();
  }, [session]);
  
  // Continue debate function
  const continueDebate = (debateId: string) => {
    router.push(`/app/debate/${debateId}`);
  };
  
  // Delete debate function
  const deleteDebate = async (debateId: string) => {
    try {
      await fetch(`/api/debate/${debateId}`, { method: 'DELETE' });
      setDebates(prev => prev.filter(d => d.id !== debateId));
    } catch (err) {
      console.error('Error deleting debate:', err);
    }
  };
  
  // Render debate history UI
  return (
    <div>
      {/* Render debates with filter, search, and sorting options */}
      {debates.map(debate => (
        <DebateCard 
          key={debate.id}
          debate={debate}
          onContinue={() => continueDebate(debate.id)}
          onDelete={() => deleteDebate(debate.id)}
        />
      ))}
    </div>
  );
}
```

### Favorites

Users can mark debates as favorites for quick access:

```typescript
// Toggle favorite status
const toggleFavorite = async (debateId: string, isFavorite: boolean) => {
  try {
    const response = await fetch(`/api/debate/${debateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isFavorite }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to update favorite status');
    }
    
    // Update local state
    setDebates(prev => 
      prev.map(d => d.id === debateId ? { ...d, isFavorite } : d)
    );
  } catch (err) {
    console.error('Error toggling favorite:', err);
  }
};
```

## Data Flow

1. **User Authentication**:
   - User signs in with OAuth provider
   - User profile is retrieved or created
   - User preferences are loaded

2. **Profile Management**:
   - User can view and edit profile details
   - Changes are persisted to the database
   - Profile is used throughout the application

3. **Debate History**:
   - User's past debates are retrieved from Firestore
   - User can filter, search, and sort their debates
   - User can continue or delete past debates

4. **Preferences**:
   - User can set and modify preferences
   - Preferences affect debate experience (expert types, UI theme)
   - Preferences are persisted across sessions

## Storage

User data is stored in Firestore with the following structure:

```typescript
// User profile structure
interface UserProfile {
  id: string;             // Matches auth provider ID
  email: string;          // User email
  name?: string;          // Display name
  profilePicture?: string; // Profile image URL
  createdAt: string;      // ISO timestamp
  updatedAt: string;      // ISO timestamp
  lastLoginAt: string;    // ISO timestamp
  preferences: {
    preferredLanguage: string;
    theme: string;
    notifications: boolean;
    expertTypes: string[];
    preferredTopics: string[];
  };
}

// Debates collection structure
interface SavedDebate {
  id: string;             // Unique debate ID
  userId: string;         // References user ID
  topic: string;          // Debate topic
  experts: Expert[];      // Expert participants
  messages: Message[];    // Debate messages
  expertType: string;     // Expert type used
  createdAt: string;      // Creation timestamp
  updatedAt: string;      // Last update timestamp
  isFavorite: boolean;    // Favorite status
  tags?: string[];        // User-defined tags
}
```

## Common Issues & Solutions

### Profile Not Loading
- Check authentication status with NextAuth
- Verify Firestore connectivity
- Ensure user ID is correctly passed to queries

### Debate History Empty
- Verify user has created debates previously
- Check Firestore permissions for the user
- Add debugging logs to track API responses

### Preference Sync Issues
- Implement local caching with optimistic updates
- Add retry logic for failed preference updates
- Consider implementing a conflict resolution strategy

## Related Components
- [Authentication](./Authentication.md)
- [Debate Engine](./Debate-Engine.md)
- [API Integration](../api/API-Integration.md) 