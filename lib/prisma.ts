import { PrismaClient } from '@prisma/client';
import { resolveSqliteDbPath } from '@/lib/db-path';

function resolveDatabaseUrl(): string {
  const dbPath = resolveSqliteDbPath();
  process.env.DATABASE_URL = `file:${dbPath}`;
  return process.env.DATABASE_URL;
}

const databaseUrl = resolveDatabaseUrl();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

globalForPrisma.prisma = prisma;
