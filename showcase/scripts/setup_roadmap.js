import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '..', 'kanban.db');

const db = new Database(dbPath);

console.log('Initializing Surf Roadmap in Kanban DB...');

// Clear existing
db.exec('DELETE FROM tasks');
db.exec('DELETE FROM sprints');
db.exec('DELETE FROM comments');

// Create Initial Sprint
const sprintId = 'sprint-v0-2-0';
db.prepare('INSERT INTO sprints (id, title, sprint_order, status) VALUES (?, ?, ?, ?)').run(
  sprintId,
  'v0.2.0 Release',
  0,
  'active'
);

// Tasks
const tasks = [
  // Done
  {
    col: 'done',
    title: 'Logo Redesign',
    content: 'Update logo to SVG, add Beta badge.',
    type: 'design',
  },
  {
    col: 'done',
    title: 'Header Refactor',
    content: 'Extract header partial, fix layout shifts.',
    type: 'feature',
  },
  {
    col: 'done',
    title: 'Kanban Showcase',
    content: 'Add Kanban to featured section.',
    type: 'docs',
  },

  // Doing
  {
    col: 'doing',
    title: 'Landing Page Polish',
    content: 'Improve visuals and copy.',
    type: 'design',
  },

  // To Do
  {
    col: 'todo',
    title: 'Examples Documentation',
    content: 'Add detailed descriptions to all examples.',
    type: 'docs',
  },
  {
    col: 'todo',
    title: 'Unit Tests',
    content: 'Increase coverage for Core module.',
    type: 'feature',
  },

  // Backlog (No Sprint)
  {
    col: 'todo',
    sprint: null,
    title: 'v1.0 Launch',
    content: 'Public release preparations.',
    type: 'feature',
  },
];

const insert = db.prepare(`
    INSERT INTO tasks (id, title, content, columnId, sprintId, type, priority, assignee_avatar, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

tasks.forEach((t, i) => {
  insert.run(
    `task-${i}`,
    t.title,
    t.content,
    t.col,
    t.sprint === null ? null : sprintId,
    t.type,
    'medium',
    'https://i.pravatar.cc/150?u=surf',
    JSON.stringify(['surf'])
  );
});

console.log('Roadmap initialized with Surf tasks!');
