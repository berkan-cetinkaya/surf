import { createServer } from './src/infrastructure/web.js';

const PORT = 3001;

const start = async () => {
  try {
    const server = await createServer();
    await server.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   SURF Showcase Server (Fastify + Clean Arch)      ║
║                                                   ║
║   Local:    http://localhost:${PORT}                 ║
║                                                   ║
║   Showcase:                                       ║
║   • http://localhost:${PORT}/showcase/              ║
║   • http://localhost:${PORT}/showcase/form.html     ║
║   • http://localhost:${PORT}/showcase/navigation.html║
║                                                   ║
╚═══════════════════════════════════════════════════╝
        `);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
