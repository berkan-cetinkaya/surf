import { createServer } from './src/infrastructure/web.js';

const PORT = 3000;

const start = async () => {
    try {
        const server = await createServer();
        await server.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   SURF Example Server (Fastify + Clean Arch)      ║
║                                                   ║
║   Local:    http://localhost:${PORT}                 ║
║                                                   ║
║   Examples:                                       ║
║   • http://localhost:${PORT}/examples/              ║
║   • http://localhost:${PORT}/examples/form.html     ║
║   • http://localhost:${PORT}/examples/navigation.html║
║                                                   ║
╚═══════════════════════════════════════════════════╝
        `);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

start();
