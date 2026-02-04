import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyView from '@fastify/view';
import fastifyFormbody from '@fastify/formbody';
import ejs from 'ejs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import * as handlers from '../handlers/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..', '..', '..', '..'); // project root based on file loc

// Category metadata
const CATEGORIES = {
    '01-interaction': { title: '🧱 I. Interaction & Local State', count: 15 },
    '02-server-data': { title: '📡 II. Server Data & Patch Flow', count: 15 },
    '03-navigation': { title: '🧭 III. Navigation & History', count: 15 },
    '04-forms': { title: '📝 IV. Forms & Validation', count: 15 },
    '05-state-survival': { title: '💾 V. State Survival', count: 10 },
    '06-layout': { title: '🖼️ VI. Layout & Composition', count: 10 },
    '07-failure': { title: '⚠️ VII. Failure & Edge Cases', count: 10 },
    '08-performance': { title: '⚡ VIII. Performance & Scale', count: 10 }
};

function getCategoryTitle(category) {
    return CATEGORIES[category]?.title || category;
}

function getExampleTitle(example) {
    // Convert "02-counter" to "Counter"
    return example.replace(/^[0-9]+-/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getCategoryExamples(category) {
    // This would ideally scan the directory, but for now return known examples
    const examples = {
        '01-interaction': [
            { id: '01-toggle-state', title: 'Toggle State' },
            { id: '02-counter', title: 'Counter' }
        ],
        '02-server-data': [
            { id: '16-get-request', title: 'GET Request Updates Surface' }
        ],
        '03-navigation': [
            { id: '31-navigate', title: 'Navigate Without Reload' },
            { id: '36-pagination', title: 'Pagination with URLs' }
        ],
        '04-forms': [
            { id: '46-simple-form', title: 'Simple Form Submission' }
        ],
        '05-state-survival': [
            { id: '61-local-state', title: 'Local State Survives Patch' }
        ],
        '06-layout': [
            { id: '75-tabbed-interface', title: 'Tabbed Interface' }
        ],
        '07-failure': [],
        '08-performance': []
    };
    return examples[category] || [];
}

export async function createServer() {
    const fastify = Fastify({ logger: true });

    // Core plugins
    await fastify.register(fastifyFormbody);
    
    // Static files (Surf dist, CSS, etc.)
    await fastify.register(fastifyStatic, {
        root: rootDir,
        prefix: '/', 
        // We serve root so /dist/surf.min.js works. 
        // Care must be taken not to expose server code, but this is a demo repo.
    });

    // Templates
    await fastify.register(fastifyView, {
        engine: {
            ejs: ejs,
        },
        root: join(rootDir, 'examples', 'server') // templates are in examples/server/templates
    });

    // Routes
    
    // Landing Page (Homepage) - default version
    fastify.get('/', async (req, reply) => {
        return reply.view('templates/landing.ejs', {
            title: 'SURF - Surface Changes, Cell Lives'
        });
    });

    // Landing page variations for preview
    fastify.get('/v1', async (req, reply) => {
        return reply.view('templates/landing-v1-minimal.ejs', { title: 'SURF - V1 Minimal' });
    });
    fastify.get('/v2', async (req, reply) => {
        return reply.view('templates/landing-v2-split.ejs', { title: 'SURF - V2 Split' });
    });
    fastify.get('/v3', async (req, reply) => {
        return reply.view('templates/landing-v3-terminal.ejs', { title: 'SURF - V3 Terminal' });
    });
    fastify.get('/v4', async (req, reply) => {
        return reply.view('templates/landing-v4-glass.ejs', { title: 'SURF - V4 Glass' });
    });
    
    // Alternative landing pages
    fastify.get('/alt-a', async (req, reply) => {
        return reply.view('templates/landing-alt-a.ejs', { title: 'SURF - Vercel Style' });
    });
    fastify.get('/alt-b', async (req, reply) => {
        return reply.view('templates/landing-alt-b.ejs', { title: 'SURF - Linear Style' });
    });
    fastify.get('/alt-c', async (req, reply) => {
        return reply.view('templates/landing-alt-c.ejs', { title: 'SURF - Stripe Style' });
    });

    // API: Server time for Surface demo
    fastify.get('/api/time', async (req, reply) => {
        reply.header('Content-Type', 'text/html');
        const time = new Date().toLocaleTimeString('tr-TR');
        return `
            <div class="time-display">${time}</div>
            <div class="time-label">Server Time (just fetched!)</div>
            <form action="/api/time" method="GET" d-pulse="commit" d-target="#server-time">
                <button type="submit" class="refresh-btn">↻ Fetch from Server</button>
            </form>
        `;
    });

    // Examples Index
    fastify.get('/examples', async (req, reply) => {
        return reply.view('templates/examples/index.ejs', {
            title: 'SURF Examples'
        });
    });

    // Category Index (e.g., /examples/01-interaction)
    fastify.get('/examples/:category', async (req, reply) => {
        const { category } = req.params;
        
        // Validate category format
        if (!/^0[1-8]-[a-z-]+$/.test(category)) {
            return reply.callNotFound();
        }

        const data = {
            title: getCategoryTitle(category),
            activeCategory: category,
            examples: getCategoryExamples(category)
        };
        return reply.view('templates/examples/category.ejs', data);
    });

    // Individual Example (e.g., /examples/01-interaction/02-counter)
    fastify.get('/examples/:category/:example', async (req, reply) => {
        const { category, example } = req.params;
        
        // Validate format 
        if (!/^0[1-8]-[a-z-]+$/.test(category)) return reply.callNotFound();
        if (!/^[0-9]+-[a-z-]+$/.test(example)) return reply.callNotFound();

        try {
            const data = {
                title: getExampleTitle(example),
                activeCategory: category,
                activeExample: example,
                now: new Date().toLocaleTimeString()
            };
            return reply.view(`templates/examples/${category}/${example}.ejs`, data);
        } catch (err) {
            return reply.callNotFound();
        }
    });
    
    // Porting the Page routes for consistent SURF behavior
    fastify.get('/page/:name', async (req, reply) => {
        const { name } = req.params;
        const validPages = ['home', 'about', 'products', 'contact'];
        
        if (!validPages.includes(name)) return reply.callNotFound();

        const isSurf = req.headers['x-surf-request'] === 'true';
        const data = { now: new Date().toLocaleTimeString() };
        
        // Render the specific template for the page
        const content = await reply.view(`templates/pages/${name}.ejs`, data);

        if (isSurf) {
            const { createPatch } = await import('#helpers/node/patch.js');
            reply.type('text/html');
            return createPatch().addSurface('#main', content).render();
        } else {
            reply.type('text/html');
            // In a real app we'd wrap this in a layout
            return content;
        }
    });

    // API Routes for SURF
    fastify.get('/api/news', handlers.handleNews);
    fastify.post('/api/news/:id/read', handlers.handleNewsRead);
    fastify.post('/api/news/breaking/read', handlers.handleNewsRead);
    
    fastify.get('/api/seats', handlers.handleSeats);
    fastify.post('/api/book-seats', handlers.handleBookSeats);
    
    fastify.post('/api/form', handlers.handleForm);

    return fastify;
}
