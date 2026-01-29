/**
 * Prisma Client Singleton
 * 
 * This module provides a singleton instance of the Prisma client.
 * In development, it prevents creating multiple instances during hot reload.
 * In production, it uses a single instance for the entire application.
 */

import { PrismaClient } from '@prisma/client';

// Declare global type for prisma instance
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Create Prisma client with logging in development
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['error', 'warn'] 
      : ['error'],
  });
};

// Use global instance in development to prevent multiple instances during hot reload
const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

export { prisma };
export default prisma;

// Export types from Prisma client
export type { 
  User, 
  Debate, 
  Message, 
  Expert, 
  Job,
  Session,
  Account,
} from '@prisma/client';

export { 
  DebateStatus,
  ExpertType,
  Stance,
  MessageRole,
  JobType,
  JobStatus
} from '@prisma/client';
