import pytest_asyncio
from prisma import Prisma
from contextlib import asynccontextmanager

"""Usage:
    Add the file tests/conftest.py with the following content:

    from db.db_client_test import *
"""

# To open ipython at a particular point, do this:
#
# Add imports:
#   from IPython import embed
#   import nest_asyncio
#
# Insert this to the right position in the code:
#   nest_asyncio.apply() 
#   embed()

class RollbackTransaction(Exception): pass

class TransactionProxy:
    def __init__(self, transaction):
        self._transaction = transaction
    
    def __getattr__(self, name):
        return getattr(self._transaction, name)

    @asynccontextmanager
    async def tx(self):
        yield self._transaction

@pytest_asyncio.fixture(scope='function')
async def db_connection():
    db = Prisma()
    await db.connect()
    try:
        async with db.tx() as transaction:
            tx = TransactionProxy(transaction)
            yield tx
            raise RollbackTransaction('rollback')
    except RollbackTransaction:
        pass
    finally:
        await db.disconnect()