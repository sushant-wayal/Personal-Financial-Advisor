const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const token = await prisma.aIMemory.findFirst({
        where: { key: 'gmail_token' },
    });
    if (token) {
        console.log('Token found:', JSON.stringify(token, null, 2));
    } else {
        console.log('Token not found.');
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
