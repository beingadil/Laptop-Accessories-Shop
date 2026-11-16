import path from 'node:path';
import { PrismaClient } from '@prisma/client';

function resolveDatabaseUrl(): string {
  const configured = process.env.DATABASE_URL?.trim();
  if (configured) {
    if (configured.startsWith('file:./') || configured.startsWith('file:../')) {
      const rel = configured.slice('file:'.length);
      const abs = path.resolve(process.cwd(), 'prisma', rel);
      const normalized = `file:${abs}`;
      process.env.DATABASE_URL = normalized;
      return normalized;
    }
    return configured;
  }
  const fallbackPath = path.resolve(process.cwd(), 'prisma', 'dev.db');
  const fallbackUrl = `file:${fallbackPath}`;
  process.env.DATABASE_URL = fallbackUrl;
  return fallbackUrl;
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
