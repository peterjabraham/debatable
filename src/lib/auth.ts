import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/db/prisma';
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: 'credentials',
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error('Email and password required');
                }

                // Check for demo account (for testing without database)
                if (credentials.email === 'demo@debate-able.com' && credentials.password === 'demo123') {
                    return {
                        id: 'demo-user',
                        email: 'demo@debate-able.com',
                        name: 'Demo User',
                    };
                }

                try {
                    // Try to find user in database
                    const user = await prisma.user.findUnique({
                        where: { email: credentials.email }
                    });

                    if (!user || !user.password) {
                        throw new Error('Invalid email or password');
                    }

                    const isValid = await bcrypt.compare(credentials.password, user.password);
                    
                    if (!isValid) {
                        throw new Error('Invalid email or password');
                    }

                    return {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        image: user.image,
                    };
                } catch (error) {
                    // If database fails, only allow demo account
                    if (credentials.email === 'demo@debate-able.com' && credentials.password === 'demo123') {
                        return {
                            id: 'demo-user',
                            email: 'demo@debate-able.com',
                            name: 'Demo User',
                        };
                    }
                    throw new Error('Invalid email or password');
                }
            }
        }),
    ],
    session: {
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    secret: process.env.NEXTAUTH_SECRET,
    pages: {
        signIn: '/auth/signin',
        error: '/auth/error',
    },
    callbacks: {
        async session({ session, token }) {
            if (session?.user && token?.sub) {
                session.user.id = token.sub;
            }
            return session;
        },
        async jwt({ token, user }) {
            if (user) {
                token.sub = user.id;
            }
            return token;
        },
    },
    debug: process.env.NODE_ENV === 'development',
};

export function getAuthOptions() {
    return authOptions;
}
