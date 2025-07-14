// See https://www.prisma.io/docs/orm/more/help-and-troubleshooting/help-articles/nextjs-prisma-client-dev-practices
import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

const prismaClientSingleton = () => {
  return new PrismaClient();
};

const prisma = (globalThis.prismaGlobal ??
  prismaClientSingleton()) as PrismaClient;

globalThis.prismaGlobal = prisma;

export { prisma };
export * from '@prisma/client';
