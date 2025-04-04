# Project Overview

**Document Version:** 1.0.0  
**Last Updated:** April 3, 2024  
**Compatible with:** 
- Next.js 15.0.0
- Node.js 20.x
- React 18.2.0
- TypeScript 5.3.3

## System Architecture

Debate-able is a Next.js application that enables users to generate debates between AI-powered experts on various topics. The application integrates several external APIs and services to provide a comprehensive debate experience.

### High-Level Architecture

```
                    ┌─────────────────┐
                    │     Client      │
                    │  (Next.js App)  │
                    └────────┬────────┘
                             │
               ┌─────────────┴─────────────┐
               │                           │
    ┌──────────▼─────────┐      ┌─────────▼────────┐
    │    Next.js API     │      │  External APIs   │
    │     Routes         │      │                  │
    └──────────┬─────────┘      └─────────┬────────┘
               │                           │
    ┌──────────▼─────────┐      ┌─────────▼────────┐
    │                    │      │                  │
    │   Firestore DB     │      │   OpenAI API     │
    │                    │      │                  │
    └────────────────────┘      └──────────────────┘
                                          │
                                 ┌────────▼─────────┐
                                 │                  │
                                 │ Perplexity API   │
                                 │                  │
                                 └──────────────────┘
```

## Tech Stack Overview

### Frontend
- **Next.js 15.0.0**: App Router for server-side and client-side rendering
- **React**: UI library
- **TanStack Query**: Data fetching and state management
- **Zustand**: State management
- **Tailwind CSS**: Styling
- **Shadcn UI**: UI component library

### Backend (API Routes)
- **Next.js API Routes**: Serverless functions for API endpoints
- **NextAuth.js**: Authentication
- **Firebase Admin SDK**: Server-side Firebase interactions

### External Services
- **OpenAI**: Debate content generation
- **Perplexity**: Research and citation data
- **Firestore**: Database for storing debates and user data
- **ElevenLabs**: Voice synthesis (optional)

### Development Tooling
- **TypeScript**: Static typing
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **Vitest**: Testing framework

## Code Directory Structure

```
debate-able/
├── src/
│   ├── app/                     # Next.js App Router pages
│   │   ├── api/                 # API routes
│   │   │   ├── auth/            # Authentication endpoints
│   │   │   ├── debate/          # Debate-related endpoints
│   │   │   └── ...              # Other API endpoints
│   │   ├── app/                 # Main application routes
│   │   │   ├── debate/          # Debate UI routes
│   │   │   └── ...              # Other app routes
│   │   └── ...                  # Root and shared layouts
│   ├── components/              # React components
│   │   ├── debate/              # Debate-specific components
│   │   ├── ui/                  # UI components
│   │   └── ...                  # Other components
│   ├── lib/                     # Utility libraries and hooks
│   │   ├── api/                 # API client utilities
│   │   ├── db/                  # Database utilities
│   │   ├── hooks/               # React hooks
│   │   └── ...                  # Other utilities
│   └── types/                   # TypeScript type definitions
├── public/                      # Static assets
└── docs/                        # Documentation
```

## Environment Setup

The application requires the following environment variables to be set:

```
# Basic configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_secret_key

# Auth providers
GITHUB_ID=your_github_client_id
GITHUB_SECRET=your_github_client_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# OpenAI API
OPENAI_API_KEY=your_openai_api_key

# Perplexity API
PERPLEXITY_API_KEY=your_perplexity_api_key

# Firebase configuration
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_SERVICE_ACCOUNT_KEY_PATH=./your-credentials.json

# Optional: ElevenLabs for voice synthesis
ELEVENLABS_API_KEY=your_elevenlabs_api_key
```

## Getting Started

1. Clone the repository
2. Install dependencies with `npm install`
3. Set up environment variables (.env.local)
4. Run the development server with `npm run dev`

## Related Documentation
- [Authentication](../features/Authentication.md)
- [Debate Engine](../features/Debate-Engine.md)
- [API Integration](../api/API-Integration.md)
- [Status](../Status.md) 