# NextAuth OAuth Integration Guide

**Document Version:** 1.0.0  
**Last Updated:** April 10, 2024  
**Compatible with:**
- Next.js 15.0.0
- NextAuth.js 4.24.11
- Node.js 20.x

## Overview

This guide provides detailed instructions for setting up OAuth authentication with NextAuth.js in the Debate-able application, with a particular focus on avoiding the common "redirect_uri_mismatch" error that frequently occurs in production environments.

## Quick Reference: Fixing redirect_uri_mismatch Errors

If you're experiencing the "Error 400: redirect_uri_mismatch" error in production, check these common solutions:

1. **Update NEXTAUTH_URL Environment Variable**:
   ```
   NEXTAUTH_URL=https://your-production-domain.com
   ```

2. **Verify OAuth Provider Configuration**:
   - Make sure your Google OAuth Console has the correct redirect URIs 
   - The callback URL should be: `https://your-production-domain.com/api/auth/callback/google`

3. **Check for HTTP vs HTTPS mismatches**:
   - OAuth providers usually require HTTPS for production
   - The protocol in your NEXTAUTH_URL must match your server configuration

4. **Run Diagnostic Tool**:
   - Visit `/api/auth/test-redirect?debug_token=your_debug_token` in your production environment

## OAuth Configuration Architecture

NextAuth.js handles OAuth through this flow:

```
┌───────────────┐      ┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│               │      │               │      │               │      │               │
│  User Clicks  │─────▶│  NextAuth.js  │─────▶│  OAuth        │─────▶│  Provider     │
│  Login Button │      │  Redirects    │      │  Provider     │      │  Authenticates│
│               │      │               │      │  Login Page   │      │               │
└───────────────┘      └───────────────┘      └───────────────┘      └───────────────┘
                                                                            │
                                                                            ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│               │      │               │      │               │      │               │
│  Application  │◀─────│  NextAuth     │◀─────│  NextAuth     │◀─────│  Provider     │
│  Dashboard    │      │  Sets Cookies │      │  Callback     │      │  Redirects to │
│               │      │  & Session    │      │  Endpoint     │      │  Callback URL │
└───────────────┘      └───────────────┘      └───────────────┘      └───────────────┘
```

## Environment Configuration

### Development Environment

```env
# .env.local for development
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secure-secret-key

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth
GITHUB_ID=your-github-id
GITHUB_SECRET=your-github-secret
```

### Production Environment

```env
# .env for production
NEXTAUTH_URL=https://your-production-domain.com
NEXTAUTH_SECRET=your-secure-secret-key

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth
GITHUB_ID=your-github-id
GITHUB_SECRET=your-github-secret

# Optional: Debug token for testing in production
AUTH_DEBUG_TOKEN=your-secure-debug-token
```

## NextAuth.js Configuration

The core NextAuth configuration is in `src/lib/auth.ts`:

```typescript
// src/lib/auth.ts
import { NextAuthOptions } from 'next-auth';
import GitHubProvider from 'next-auth/providers/github';
import GoogleProvider from 'next-auth/providers/google';

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID || '',
      clientSecret: process.env.GITHUB_SECRET || '',
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authorization: {
        params: {
          prompt: "select_account"
        }
      }
    }),
  ],
  // Rest of configuration...
};
```

## Provider-Specific Setup

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Navigate to "APIs & Services" > "Credentials"
4. Create an "OAuth Client ID" of type "Web Application"
5. Add authorized JavaScript origins:
   - Development: `http://localhost:3000`
   - Production: `https://your-production-domain.com`
6. Add authorized redirect URIs:
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://your-production-domain.com/api/auth/callback/google`
7. Save and copy your Client ID and Client Secret

### GitHub OAuth Setup

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set the homepage URL:
   - Development: `http://localhost:3000`
   - Production: `https://your-production-domain.com`
4. Set the callback URL:
   - Development: `http://localhost:3000/api/auth/callback/github`
   - Production: `https://your-production-domain.com/api/auth/callback/github`
5. Save and copy your Client ID and Client Secret

## Testing OAuth Configurations

### Automated Tests

Run the OAuth configuration tests to verify your setup:

```bash
npm test src/lib/__tests__/auth.test.ts
```

These tests check that:
- OAuth providers are configured correctly
- Callback URLs are formed properly
- Environment variables are set correctly

### Manual Verification

Use the diagnostic endpoint to check your configuration:

```
# Development
http://localhost:3000/api/auth/test-redirect

# Production (requires debug token)
https://your-production-domain.com/api/auth/test-redirect?debug_token=your_debug_token
```

## Troubleshooting redirect_uri_mismatch Errors

### Common Causes

1. **NEXTAUTH_URL Mismatch**: The NEXTAUTH_URL environment variable doesn't match the actual deployment URL.
2. **Missing/Incorrect Provider Configuration**: The callback URL isn't properly registered in the OAuth provider's dashboard.
3. **Protocol Mismatch**: Using HTTP in NEXTAUTH_URL but HTTPS in the browser (or vice versa).
4. **Port Mismatch**: Including a port in one URL but not the other.
5. **Path Differences**: Extra or missing path segments between registered and actual URLs.

### Debugging Steps

1. **Verify Environment Variables**:
   ```bash
   # In your production environment
   echo $NEXTAUTH_URL
   ```

2. **Check Browser Requests**:
   - Open your browser's developer tools
   - Go to the Network tab
   - Look for the OAuth redirect request
   - Verify the actual URL being used

3. **Compare with Provider Settings**:
   - Open your OAuth provider dashboard
   - Check the exact registered redirect URIs
   - Make sure they match what NextAuth is using

4. **Test with Diagnostics Endpoint**:
   - Visit the `/api/auth/test-redirect` endpoint to get detailed diagnostics

## Best Practices for Multiple Environments

Managing authentication across multiple environments requires careful planning:

### Separate OAuth Applications

Create separate OAuth applications for each environment:
- Development
- Staging
- Production

This allows each environment to have its own callback URLs.

### Environment-Specific Configuration

Use environment-specific variables:

```js
// For Vercel deployments
{
  "env": {
    "NEXTAUTH_URL": "https://your-production-domain.com" 
  },
  "build": {
    "env": {
      "NEXTAUTH_URL": "https://your-production-domain.com"
    }
  }
}
```

### Using Base Path

If your application uses a base path, include it in your NEXTAUTH_URL:

```
NEXTAUTH_URL=https://your-domain.com/app-base-path
```

Then ensure this is registered in your OAuth provider dashboards.

## Implementation Checklist

Follow this checklist to ensure proper OAuth setup:

- [ ] Create OAuth applications in provider dashboards
- [ ] Configure the correct redirect URIs for each environment
- [ ] Set NEXTAUTH_URL in environment variables
- [ ] Implement the NextAuth configuration
- [ ] Test the authentication flow in development
- [ ] Configure production environment variables
- [ ] Test the authentication flow in production
- [ ] Set up automated tests for OAuth configuration
- [ ] Document all OAuth provider details for the team

## Conclusion

By following this guide, you can set up robust OAuth authentication for your Next.js application and avoid the common redirect_uri_mismatch errors that occur when deploying to production. The key is ensuring that your environment variables, OAuth provider configurations, and application settings are all perfectly aligned across all environments. 