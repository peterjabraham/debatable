'use client';

import { useState, useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogoutButton } from '@/components/auth';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Info } from 'lucide-react';

export default function AuthDebugPage() {
    const { data: session, status } = useSession();
    const [sessionCheck, setSessionCheck] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const checkSession = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/auth/session-check');
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            const data = await response.json();
            setSessionCheck(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error occurred');
            console.error('Session check error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // Check session on page load
    useEffect(() => {
        checkSession();
    }, []);

    return (
        <div className="container mx-auto py-10 max-w-4xl">
            <h1 className="text-3xl font-bold mb-6">Authentication Debugger</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <span>Session Status</span>
                            {status === 'loading' && <RefreshCw className="ml-2 h-4 w-4 animate-spin" />}
                            {status === 'authenticated' && <CheckCircle className="ml-2 h-5 w-5 text-green-500" />}
                            {status === 'unauthenticated' && <XCircle className="ml-2 h-5 w-5 text-red-500" />}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="mb-2"><span className="font-semibold">Current status:</span> {status}</p>
                        {session && (
                            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                                <p className="text-sm font-semibold mb-1">Session Data:</p>
                                <pre className="text-xs overflow-auto max-h-40">
                                    {JSON.stringify(session, null, 2)}
                                </pre>
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="flex justify-between">
                        <Button
                            variant="outline"
                            onClick={checkSession}
                            disabled={isLoading}
                        >
                            {isLoading ? 'Checking...' : 'Refresh Status'}
                        </Button>

                        {status === 'authenticated' ? (
                            <LogoutButton text="Sign Out" variant="destructive" />
                        ) : (
                            <Button onClick={() => signIn()}>
                                Sign In
                            </Button>
                        )}
                    </CardFooter>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <span>Session Check API</span>
                            <Info className="ml-2 h-4 w-4" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-[350px] overflow-auto">
                        {error && (
                            <Alert variant="destructive" className="mb-3">
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {sessionCheck && (
                            <div>
                                <div className="mb-3 flex items-center">
                                    <span className="font-semibold mr-2">Is Authenticated:</span>
                                    {sessionCheck.isAuthenticated ? (
                                        <CheckCircle className="h-5 w-5 text-green-500" />
                                    ) : (
                                        <XCircle className="h-5 w-5 text-red-500" />
                                    )}
                                </div>

                                <div className="mb-3 flex items-center">
                                    <span className="font-semibold mr-2">Session Exists:</span>
                                    {sessionCheck.sessionExists ? (
                                        <CheckCircle className="h-5 w-5 text-green-500" />
                                    ) : (
                                        <XCircle className="h-5 w-5 text-red-500" />
                                    )}
                                </div>

                                <div className="mb-3 flex items-center">
                                    <span className="font-semibold mr-2">Session Cookies:</span>
                                    {sessionCheck.hasCookies ? (
                                        <span className="text-sm bg-green-100 dark:bg-green-900 px-2 py-1 rounded-full">
                                            {sessionCheck.cookieCount} found
                                        </span>
                                    ) : (
                                        <span className="text-sm bg-red-100 dark:bg-red-900 px-2 py-1 rounded-full">
                                            None found
                                        </span>
                                    )}
                                </div>

                                <div className="mb-3">
                                    <span className="font-semibold">Token Status:</span>
                                    <div className="mt-1">
                                        {sessionCheck.tokenExpired && (
                                            <Alert variant="warning" className="mb-2">
                                                <AlertTriangle className="h-4 w-4" />
                                                <AlertTitle>Token Expired</AlertTitle>
                                            </Alert>
                                        )}

                                        {!sessionCheck.tokenExpired && sessionCheck.tokenExpiresAt && (
                                            <p className="text-sm">
                                                Expires: {new Date(sessionCheck.tokenExpiresAt).toLocaleString()}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <Tabs defaultValue="session">
                                    <TabsList className="grid w-full grid-cols-3">
                                        <TabsTrigger value="session">Session</TabsTrigger>
                                        <TabsTrigger value="cookies">Cookies</TabsTrigger>
                                        <TabsTrigger value="headers">Headers</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="session" className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md mt-2">
                                        <h4 className="text-sm font-semibold mb-2">Session Data:</h4>
                                        <pre className="text-xs overflow-auto max-h-40">
                                            {JSON.stringify(sessionCheck.session, null, 2)}
                                        </pre>
                                    </TabsContent>

                                    <TabsContent value="cookies" className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md mt-2">
                                        <h4 className="text-sm font-semibold mb-2">Cookies:</h4>
                                        <pre className="text-xs overflow-auto max-h-40">
                                            {JSON.stringify(sessionCheck.cookies, null, 2)}
                                        </pre>
                                    </TabsContent>

                                    <TabsContent value="headers" className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md mt-2">
                                        <h4 className="text-sm font-semibold mb-2">Request Headers:</h4>
                                        <pre className="text-xs overflow-auto max-h-40">
                                            {JSON.stringify(sessionCheck.headers, null, 2)}
                                        </pre>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        )}
                    </CardContent>
                    <CardFooter>
                        <Button
                            onClick={checkSession}
                            variant="secondary"
                            className="w-full"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Loading...' : 'Check Server Session'}
                        </Button>
                    </CardFooter>
                </Card>
            </div>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Authentication Tools</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Button
                            onClick={() => fetch('/api/auth/logout', { method: 'POST' })
                                .then(res => {
                                    if (res.ok) window.location.href = '/';
                                })}
                            variant="destructive"
                        >
                            Force Logout (Clear All Auth Cookies)
                        </Button>

                        <Button
                            onClick={() => {
                                // Clear all cookies
                                document.cookie.split(';').forEach(cookie => {
                                    const [name] = cookie.trim().split('=');
                                    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
                                });
                                window.location.reload();
                            }}
                            variant="outline"
                        >
                            Clear All Browser Cookies
                        </Button>

                        <Button
                            onClick={() => window.location.href = '/api/auth/signin'}
                            variant="default"
                        >
                            Go To Sign In Page
                        </Button>

                        <Button
                            onClick={() => window.location.reload()}
                            variant="secondary"
                        >
                            Refresh Page
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Common Auth Issues & Solutions</CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-4">
                        <li>
                            <h3 className="font-semibold">Redirect URI Mismatch</h3>
                            <p className="text-sm mb-1">Ensure the callback URL in your OAuth provider matches your NEXTAUTH_URL environment variable.</p>
                            <p className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded">
                                Example: <code>https://your-domain.com/api/auth/callback/google</code>
                            </p>
                        </li>

                        <li>
                            <h3 className="font-semibold">Session Not Persisting</h3>
                            <p className="text-sm mb-1">Check that cookies are being set and not blocked by browser settings or cross-domain issues.</p>
                        </li>

                        <li>
                            <h3 className="font-semibold">Cannot Sign Out</h3>
                            <p className="text-sm mb-1">If normal sign out doesn't work, try the Force Logout button above or clear cookies manually.</p>
                        </li>
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
} 