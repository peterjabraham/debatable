# Authentication

**Document Version:** 1.0.0  
**Last Updated:** April 3, 2024  
**Compatible with:** 
- Next.js 15.0.0
- NextAuth.js 4.24.11
- Node.js 20.x
- Firebase Admin 13.1.0

## Overview

The Debate-able application uses NextAuth.js for user authentication, supporting multiple authentication providers including Google and GitHub. Authentication state is persisted through JWT sessions and integrated with Firebase for user data management.

## Architecture

```
┌──────────────┐      ┌────────────────┐      ┌──────────────────┐
│              │      │                │      │                  │
│   Browser    │─────▶│  NextAuth.js   │─────▶│  OAuth Provider  │
│              │◀─────│                │◀─────│  (Google/GitHub) │
└──────┬───────┘      └────────┬───────┘      └──────────────────┘
       │                       │
       │                       │
       │                       ▼
       │               ┌───────────────┐
       │               │               │
       └──────────────▶│   Firestore   │
                       │   Database    │
                       │               │
                       └───────────────┘
```

## Key Files

- `src/lib/auth.ts`: Main NextAuth.js configuration
- `src/app/api/auth/[...nextauth]/route.ts`: NextAuth.js API route handler
- `src/app/api/auth/session/route.ts`: Custom session endpoint
- `src/app/api/auth/reset/route.ts`: Auth reset endpoint for broken sessions
- `src/app/auth/signin/page.tsx`: Sign-in page
- `src/app/auth/sign-out/page.tsx`: Sign-out page
- `src/components/UserNavigation.tsx`: User account UI integration
- `src/lib/hooks/useUser.ts`: Hook for accessing user data

## Authentication Flow

1. User clicks "Sign In" in the UserNavigation component
2. User is redirected to NextAuth.js sign-in page (`/auth/signin`)
3. User selects an authentication provider (Google/GitHub)
4. OAuth flow is completed with the provider
5. User is redirected back to the application
6. NextAuth.js creates a JWT session
7. User profile is retrieved or created in Firestore
8. User is now authenticated and can use the application

## JWT Sessions

Sessions are managed via JWT tokens stored in HTTP-only cookies:

```typescript
// src/lib/auth.ts
session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
},
cookies: {
    sessionToken: {
        name: `next-auth.session-token`,
        options: {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 30 * 24 * 60 * 60 // 30 days
        }
    },
    // ...additional cookie configurations
}
```

## Session Callbacks

The session callback is used to enrich the session object with additional user data:

```typescript
// src/lib/auth.ts
callbacks: {
    async session({ session, token }) {
        // Copy values from token to session if they exist
        if (token) {
            if (token.sub) session.user.id = token.sub;
            if (token.name) session.user.name = token.name;
            if (token.email) session.user.email = token.email;
            if (token.picture) session.user.image = token.picture;
        }
        
        // Ensure session expires is set to avoid client-side errors
        if (!session.expires) {
            session.expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        }
        
        return session;
    },
    // ...JWT callback implementation
}
```

## User Profile Management

The `useUser` hook is used to fetch and manage user profile data:

```typescript
// Example usage in a component
const { profile, isLoading, updateProfile } = useUser();

// Update profile example
await updateProfile({
    name: "New Name",
    preferredLanguage: "en"
});
```

## Sign-Out Process

The sign-out process is handled through:

1. A custom sign-out API route (`/auth/signout`) to clear server-side cookies
2. NextAuth.js `signOut()` function to clear client-side state
3. Manual localStorage/sessionStorage cleaning for redundancy

## Error Recovery

For authentication errors, we provide:

1. A dedicated reset route (`/auth/reset`) to clear all auth state
2. Session validation in the session API endpoint to prevent invalid sessions
3. Fallback logic in the `UserNavigation` component with a "Fix Auth" button

## Firebase Integration

User profiles are stored in Firestore after successful authentication:

```typescript
// Firestore database schema for users
interface UserProfile {
    id: string;             // Matches OAuth provider ID
    email: string;          // User email
    name?: string;          // Display name
    createdAt: string;      // ISO timestamp
    updatedAt: string;      // ISO timestamp
    lastLoginAt: string;    // ISO timestamp
    // ...additional fields
}
```

## Security Considerations

1. HTTP-only cookies prevent client-side access to tokens
2. CSRF tokens protect against cross-site request forgery
3. JWT strategy enables stateless authentication
4. API routes validate session before returning user data

## Configuration

Authentication providers are configured in environment variables:

```
# NextAuth configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# GitHub OAuth
GITHUB_ID=your_github_client_id
GITHUB_SECRET=your_github_client_secret
```

## Common Issues & Solutions

### Session Not Persisting
- Check that cookies are being properly set
- Ensure NEXTAUTH_URL is correctly configured
- Verify environment matches cookie security settings

### Sign-Out Issues
- Use the `/auth/reset` endpoint to completely clear auth state
- Ensure the signOut function has the right options: `signOut({ callbackUrl: "/" })`

## Related Components
- [User Features](./User-Features.md)
- [API Integration](../api/API-Integration.md) 