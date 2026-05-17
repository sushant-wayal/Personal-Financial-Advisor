const { PrismaClient } = require('@prisma/client');

(async () => {
    const prisma = new PrismaClient();
    try {
        const count = await prisma.transaction.count();
        console.log('Transaction count:', count);
    } catch (e) {
        console.error('Prisma test error:', e);
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
})();
