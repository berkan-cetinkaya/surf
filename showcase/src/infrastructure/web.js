import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyView from '@fastify/view';
import fastifyFormbody from '@fastify/formbody';
import ejs from 'ejs';
import { join, dirname } from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

import * as handlers from '../handlers/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..', '..', '..'); // project root based on file loc

// Category metadata
const CATEGORIES = {
  '01-interaction': { emoji: '🧱', title: 'I. Interaction & Local State' },
  '02-server-data': { emoji: '📡', title: 'II. Server Data & Patch Flow' },
  '03-navigation': { emoji: '🧭', title: 'III. Navigation & History' },
  '04-forms': { emoji: '📝', title: 'IV. Forms & Validation' },
  '05-state-survival': { emoji: '💾', title: 'V. State Survival' },
  '06-layout': { emoji: '🖼️', title: 'VI. Layout & Composition' },
  '07-failure': { emoji: '⚠️', title: 'VII. Failure & Edge Cases' },
  '08-performance': { emoji: '⚡', title: 'VIII. Performance & Scale' },
};

function getCategoryEmoji(category) {
  return CATEGORIES[category]?.emoji || '🧩';
}

function getCategoryTitle(category) {
  return CATEGORIES[category]?.title || category;
}

function getExampleTitle(example) {
  // Convert "02-counter" to "Counter"
  return example
    .replace(/^[0-9]+-/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getCategoryExamples(category) {
  // This would ideally scan the directory, but for now return known examples
  const examples = {
    '01-interaction': [
      { id: '01-toggle-state', title: 'Toggle State' },
      { id: '02-counter', title: 'Counter' },
      { id: '03-nested-components', title: 'Nested Components (Isolation)' },
    ],
    '02-server-data': [{ id: '16-get-request', title: 'GET Request Updates Surface' }],
    '03-navigation': [
      { id: '31-navigate', title: 'Navigate Without Reload' },
      { id: '36-pagination', title: 'Pagination with URLs' },
    ],
    '04-forms': [{ id: '46-simple-form', title: 'Simple Form Submission' }],
    '05-state-survival': [{ id: '61-local-state', title: 'Local State Survives Patch' }],
    '06-layout': [{ id: '75-tabbed-interface', title: 'Tabbed Interface' }],
    '07-failure': [],
    '08-performance': [],
  };
  return examples[category] || [];
}

// Articles metadata
const ARTICLES = JSON.parse(readFileSync(join(__dirname, 'data', 'articles.json'), 'utf-8'));

function getArticle(slug) {
  return ARTICLES.find((p) => p.slug === slug);
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
    root: join(rootDir, 'showcase'), // templates are in showcase/templates
  });

  // Pre-load CSS for inlining (FOUC prevention)
  const cssPath = join(rootDir, 'css', 'app.css');
  let cssContent = '';
  try {
    cssContent = readFileSync(cssPath, 'utf-8');
  } catch (e) {
    console.error('Failed to load CSS for inlining:', e);
  }

  // Load package.json once to get the current version
  let pkgVersion = '0.0.0';
  try {
    const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
    pkgVersion = pkg.version;
  } catch (e) {
    console.error('Failed to read package.json version:', e);
  }

  // Global Content-Type and CSS/Version Injection
  fastify.addHook('preHandler', (req, reply, done) => {
    reply.locals = {
      css: cssContent,
      version: pkgVersion,
      ...reply.locals,
    };
    done();
  });

  // Routes

  // Favicon
  fastify.get('/favicon.ico', (req, reply) => {
    return reply.sendFile('brand/favicon/favicon.ico');
  });

  // Landing Page (Homepage) - default version
  fastify.get('/', async (req, reply) => {
    return reply.view('templates/landing.ejs', {
      title: 'SURF - Surface Changes, Cell Lives',
    });
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

  // Internal Roadmap
  fastify.get('/roadmap', async (req, reply) => {
    try {
      const mdPath = join(rootDir, 'ROADMAP.md');
      const md = readFileSync(mdPath, 'utf-8');

      const sections = [];
      let currentSection = null;

      md.split('\n').forEach((line) => {
        const headerMatch = line.match(/^##\s+(.*)/);
        if (headerMatch) {
          if (currentSection) sections.push(currentSection);
          currentSection = { title: headerMatch[1], items: [] };
        } else if (currentSection) {
          const itemMatch = line.match(/^-\s+\[([ x])\]\s+(.*)/);
          if (itemMatch) {
            currentSection.items.push({
              done: itemMatch[1].toLowerCase() === 'x',
              text: itemMatch[2],
            });
          }
        }
      });
      if (currentSection) sections.push(currentSection);

      return reply.view('templates/roadmap.ejs', { sections });
    } catch (err) {
      console.error('Roadmap error:', err);
      return reply.callNotFound();
    }
  });

  // Showcase Index
  const handleShowcase = async (req, reply) => {
    return reply.view('templates/showcase/index.ejs', {
      title: 'SURF Showcase Gallery',
      articles: ARTICLES,
    });
  };
  fastify.get('/showcase', handleShowcase);
  fastify.get('/showcase/', handleShowcase);

  // Kanban Board Example
  fastify.get('/showcase/kanban', handlers.handleKanbanBoard);
  fastify.get('/showcase/kanban/backlog', handlers.handleKanbanBacklog);
  fastify.post('/showcase/kanban/add', handlers.handleKanbanAdd);
  fastify.post('/showcase/kanban/move', handlers.handleKanbanMove);
  fastify.post('/showcase/kanban/delete', handlers.handleKanbanDelete);

  fastify.get('/showcase/kanban/task/:taskId/modal', handlers.handleKanbanGetTaskModal);
  fastify.get('/showcase/kanban/task/:taskId', handlers.handleKanbanGetTaskPage);
  fastify.post('/showcase/kanban/task/:taskId', handlers.handleKanbanUpdateTaskDetails);
  fastify.get('/showcase/kanban/search', handlers.handleKanbanSearch);
  fastify.post('/showcase/kanban/task/:taskId/comments', handlers.handleKanbanAddComment);
  fastify.post('/showcase/kanban/comments/:commentId/delete', handlers.handleKanbanDeleteComment);
  fastify.post('/showcase/kanban/sprint/create', handlers.handleKanbanCreateSprint);
  fastify.post('/showcase/kanban/sprint/delete', handlers.handleKanbanDeleteSprint);
  fastify.post('/showcase/kanban/sprint/reorder', handlers.handleKanbanReorderSprint);

  // Category Index (e.g., /showcase/01-interaction)
  fastify.get('/showcase/:category', async (req, reply) => {
    const { category } = req.params;

    // Validate category format
    if (!/^0[1-8]-[a-z-]+$/.test(category)) {
      return reply.callNotFound();
    }

    const data = {
      title: getCategoryTitle(category),
      emoji: getCategoryEmoji(category),
      activeCategory: category,
      items: getCategoryExamples(category),
    };
    return reply.view('templates/showcase/category.ejs', data);
  });

  // Pagination Example (dedicated route with actual pagination logic)
  const PAGINATION_ITEMS = Array.from({ length: 12 }, (_, i) => {
    const titles = [
      'Interactive Surface Routing',
      'State Persistence Protocol',
      'Reactive DOM Patching',
      'Cell Isolation Patterns',
      'Server-Side Rendering',
      'Signal Propagation',
      'Navigation Architecture',
      'Error Boundary Design',
      'Lazy Surface Loading',
      'Incremental Hydration',
      'Edge-Side Composition',
      'Streaming HTML Delivery',
    ];
    const descs = [
      'Demonstrating precise DOM updates across navigation nodes.',
      'Ensuring local cell data survives cross-page transitions.',
      'Efficient tree-diffing for minimal repaints.',
      'Preventing state leaks between sibling components.',
      'Pre-rendering HTML on the server for instant first paint.',
      'Unidirectional data flow through the component tree.',
      'Deep linking and URL-driven state management.',
      'Graceful degradation when components fail.',
      'Loading surfaces on-demand for better performance.',
      'Progressively adding interactivity to static HTML.',
      'Composing pages at the CDN edge layer.',
      'Sending HTML chunks as they become ready.',
    ];
    return { number: String(i + 1).padStart(2, '0'), title: titles[i], desc: descs[i] };
  });
  const ITEMS_PER_PAGE = 4;
  const TOTAL_PAGES = Math.ceil(PAGINATION_ITEMS.length / ITEMS_PER_PAGE);

  fastify.get('/showcase/03-navigation/36-pagination', async (req, reply) => {
    const page = Math.max(1, Math.min(TOTAL_PAGES, parseInt(req.query.page) || 1));
    const start = (page - 1) * ITEMS_PER_PAGE;
    const items = PAGINATION_ITEMS.slice(start, start + ITEMS_PER_PAGE);

    const data = {
      title: 'Pagination With Urls',
      activeCategory: '03-navigation',
      activeExample: '36-pagination',
      now: new Date().toLocaleTimeString(),
      currentPage: page,
      totalPages: TOTAL_PAGES,
      items,
    };

    return reply.view('templates/showcase/03-navigation/36-pagination.ejs', data);
  });

  // Individual Example (e.g., /showcase/01-interaction/02-counter)
  fastify.get('/showcase/:category/:example', async (req, reply) => {
    const { category, example } = req.params;

    // Validate format
    if (!/^0[1-8]-[a-z-]+$/.test(category)) return reply.callNotFound();
    if (!/^[0-9]+-[a-z-]+$/.test(example)) return reply.callNotFound();

    try {
      const data = {
        title: getExampleTitle(example),
        activeCategory: category,
        activeExample: example,
        now: new Date().toLocaleTimeString(),
      };
      return reply.view(`templates/showcase/${category}/${example}.ejs`, data);
    } catch {
      return reply.callNotFound();
    }
  });

  // Articles listing
  fastify.get('/articles', async (req, reply) => {
    const html = await req.server.view('templates/articles/index.ejs', {
      title: 'Articles',
      posts: ARTICLES,
      ...reply.locals,
    });

    return reply.type('text/html').send(html);
  });

  // Article post
  fastify.get('/articles/:slug', async (req, reply) => {
    const { slug } = req.params;
    const post = getArticle(slug);
    if (!post) return reply.callNotFound();

    try {
      const html = await req.server.view(`templates/articles/${slug}.ejs`, {
        ...post,
        activePost: slug,
        ...reply.locals,
      });

      return reply.type('text/html').send(html);
    } catch (err) {
      console.error('Render error:', err);
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
  fastify.get('/api/seat-selector', handlers.handleSeatSelector);

  fastify.post('/api/form', handlers.handleForm);

  return fastify;
}
