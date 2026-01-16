// This code is used in db/prisma-setup-vitest.ts to run test code in the context of a rollbacked transaction.
// It is an improvement of:
//    https://github.com/prisma/prisma-client-extensions/tree/main/callback-free-itx
//
// The main idea is to return a single client object that knows whether a transaction is active.
// If a transaction is active, it routes all calls to that transaction client.
// If no transaction is active, it routes all calls to the original client.
// To activate a transaction, use $begin().
//
// See:
//    https://github.com/prisma/prisma/issues/12458
//    https://github.com/prisma/prisma-client-extensions/pull/52
//    https://www.prisma.io/docs/orm/more/help-and-troubleshooting/help-articles/nextjs-prisma-client-dev-practices
//
import { Prisma, PrismaClient } from '@prisma/client';

const ROLLBACK = { [Symbol.for('prisma.client.extension.rollback')]: true };

export const prismaClientSingleton = () => {
  let _txClient: FlatTransactionClient | null = null;
  const prismaClientOptions = process.env['PRISMA_DEBUG']
    ? { log: ['query' as const] }
    : undefined;

  const extendedClient = new PrismaClient(prismaClientOptions).$extends({
    client: {
      async $begin() {
        const prisma = Prisma.getExtensionContext(this);
        let setTxClient: (txClient: Prisma.TransactionClient) => void;
        let commit: () => void;
        let rollback: () => void;

        // a promise for getting the tx inner client
        const txClient = new Promise<Prisma.TransactionClient>((res) => {
          setTxClient = (txClient) => res(txClient);
        });

        // a promise for controlling the transaction
        const txPromise = new Promise((_res, _rej) => {
          commit = () => _res(undefined);
          rollback = () => _rej(ROLLBACK);
        });

        // opening a transaction to control externally
        if (
          '$transaction' in prisma &&
          typeof prisma.$transaction === 'function'
        ) {
          // [AA] Note the change from the github repo to actually make rollbacks work
          const tx = prisma
            .$transaction((txClient: unknown) => {
              setTxClient(txClient as unknown as Prisma.TransactionClient);
              return txPromise;
            })
            .catch((e: unknown) => {
              if (e === ROLLBACK) return;
              throw e;
            });

          // return a proxy TransactionClient with `$commit` and `$rollback` methods
          _txClient = new Proxy(await txClient, {
            get(target, prop) {
              if (prop === '$commit') {
                return () => {
                  _txClient = null;
                  commit();
                  return tx;
                };
              }
              if (prop === '$rollback') {
                return () => {
                  _txClient = null;
                  rollback();
                  return tx;
                };
              }
              if (prop === '$transaction') {
                return async (fn: CallableFunction) => {
                  return fn(target);
                };
              }
              return target[prop as keyof typeof target];
            },
          }) as FlatTransactionClient;

          return _txClient;
        }

        throw new Error('Transactions are not supported by this client');
      },
    },
  });

  /* eslint-disable */
  // @ts-ignore
  const client = new Proxy(extendedClient, {
    get(_target, prop) {
      if (_txClient) {
        return _txClient[prop as keyof typeof _txClient];
      } else {
        return extendedClient[prop as keyof typeof extendedClient];
      }
    },
  });
  /* eslint-enable */

  return client as unknown as ExtendedTransactionClient | FlatTransactionClient;
};

// Use the same global singleton key as db-client.ts (prismaGlobal)
// This ensures all code importing from "db" uses the same transactional client
declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal:
    | ExtendedTransactionClient
    | FlatTransactionClient
    | undefined;
}

export type ExtendedTransactionClient = Prisma.TransactionClient & {
  $begin: () => Promise<FlatTransactionClient>;
};

export type FlatTransactionClient = Prisma.TransactionClient & {
  $commit: () => Promise<void>;
  $rollback: () => Promise<void>;
};

const prisma: ExtendedTransactionClient | FlatTransactionClient =
  globalThis.prismaGlobal ?? prismaClientSingleton();

globalThis.prismaGlobal = prisma;

export { prisma };

export async function startTx() {
  await (prisma as ExtendedTransactionClient).$begin();
}

export async function rollbackTx() {
  await (prisma as FlatTransactionClient).$rollback();
}
