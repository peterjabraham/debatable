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
        callbackUrl: {
            name: `next-auth.callback-url`,
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production',
            }
        },
        csrfToken: {
            name: `next-auth.csrf-token`,
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production',
            }
        }
    },
    secret: process.env.NEXTAUTH_SECRET,
    pages: {
        signIn: '/auth/signin',
        signOut: '/auth/sign-out',
        error: '/auth/error',
        verifyRequest: '/auth/verify-request',
    },
    callbacks: {
        async session({ session, token }) {
            try {
                // Safe default session if none provided
                if (!session) {
                    console.warn("Session callback received null session");
                    return { user: {} };
                }

                // Ensure session.user exists
                if (!session.user) {
                    session.user = {};
                }

                // Copy values from token to session if they exist
                if (token) {
                    if (token.sub) session.user.id = token.sub;
                    if (token.name) session.user.name = token.name;
                    if (token.email) session.user.email = token.email;
                    if (token.picture) session.user.image = token.picture;
                }

                // Set fallback values for critical fields
                session.user.name = session.user.name || 'Anonymous User';
                session.user.email = session.user.email || 'anonymous@example.com';
                session.user.id = session.user.id || 'anonymous';

                return session;
            } catch (error) {
                console.error("Error in session callback:", error);
                // Return a minimal valid session object to prevent crashes
                return { user: { id: 'error', name: 'Error User', email: 'error@example.com' } };
            }
        },
        async jwt({ token, user, account, profile }) {
            try {
                // Handle null or undefined token
                if (!token) {
                    console.warn("JWT callback received null token");
                    token = {};
                }

                // Ensure sub exists on token
                if (!token.sub) {
                    token.sub = 'anonymous';
                }

                // Add data from user object when available (usually on sign-in)
                if (user) {
                    token.sub = user.id || 'anonymous';
                    token.name = user.name;
                    token.email = user.email;
                    token.picture = user.image;
                }

                // Add data from OAuth profile when available
                if (profile) {
                    if (profile.name) token.name = profile.name;
                    if (profile.email) token.email = profile.email;
                    if (profile.picture) token.picture = profile.picture;
                }

                // Add data from OAuth account when available
                if (account) {
                    token.provider = account.provider;
                }

                return token;
            } catch (error) {
                console.error("Error in JWT callback:", error);
                // Return a minimal valid token to prevent crashes
                return { sub: 'error', error: 'token_error' };
            }
        },
    },
    debug: process.env.NODE_ENV === 'development',
};

// Helper to access auth options throughout the app
export function getAuthOptions() {
    return authOptions;
} 