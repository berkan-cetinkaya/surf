/**
 * Kanban Domain Model (SQLite)
 */
import Database from 'better-sqlite3';
import path from 'path';

import { fileURLToPath } from 'url';

// Initialize DB
// Fix: relative path resolution fails depending on where node is run.
// domain/kanban.js is in src/domain, so we go up two levels to get to showcase root
// Since kanban.db couldn't be moved from server/ due to permissions, we point to it there.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '..', '..', 'kanban.db');
const db = new Database(dbPath);

// Initialize Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS sprints (
    id TEXT PRIMARY KEY,
    title TEXT,
    status TEXT DEFAULT 'planned', -- planned, active, completed
    sprint_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT,
    content TEXT,
    columnId TEXT,
    sprintId TEXT, -- Null for general backlog

    urgent INTEGER DEFAULT 0,
    type TEXT DEFAULT 'feature',
    priority TEXT DEFAULT 'medium',
    comments_count INTEGER DEFAULT 0,
    assignee_avatar TEXT,
    tags TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    task_id TEXT,
    content TEXT,
    author_name TEXT,
    author_avatar TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );
`);

// Simple schema migration check
try {
  const check = db.prepare('SELECT sprintId FROM tasks LIMIT 1');
  check.get();
} catch (_e) {
  console.log('Migrating database schema for Sprints...');
  // Add sprintId to tasks if missing
  try {
    db.exec('ALTER TABLE tasks ADD COLUMN sprintId TEXT');
  } catch {
    // If table completely wrong, recreate (for demo simplicity)
    // In real app, strictly use ALTER or new table + copy
    console.log('Full recreation needed');
    db.exec('DROP TABLE IF EXISTS tasks');
    db.exec(`
          CREATE TABLE tasks (
            id TEXT PRIMARY KEY,
            title TEXT,
            content TEXT,
            columnId TEXT,
            sprintId TEXT,

            urgent INTEGER DEFAULT 0,
            type TEXT DEFAULT 'feature',
            priority TEXT DEFAULT 'medium',
            comments_count INTEGER DEFAULT 0,
            assignee_avatar TEXT,
            tags TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
  }
}

// Migration for sprint_order
try {
  const check = db.prepare('SELECT sprint_order FROM sprints LIMIT 1');
  check.get();
} catch (_e) {
  console.log('Adding sprint_order column...');
  try {
    db.exec('ALTER TABLE sprints ADD COLUMN sprint_order INTEGER DEFAULT 0');
    // Initialize order based on creation time
    const sprints = db.prepare('SELECT id FROM sprints ORDER BY created_at ASC').all();
    const update = db.prepare('UPDATE sprints SET sprint_order = ? WHERE id = ?');
    sprints.forEach((s, i) => update.run(i, s.id));
  } catch (err) {
    console.error('Failed to add sprint_order', err);
  }
}

// Sync comments_count with actual comments table
try {
  console.log('Synchronizing comment counts...');
  db.prepare(
    `
    UPDATE tasks 
    SET comments_count = (
      SELECT COUNT(*) FROM comments WHERE task_id = tasks.id
    )
  `
  ).run();
} catch (err) {
  console.error('Failed to sync comment counts', err);
}

// Static Columns Definition
const COLUMNS = {
  todo: { id: 'todo', title: 'To Do' },
  doing: { id: 'doing', title: 'In Progress' },
  done: { id: 'done', title: 'Done' },
  // Backlog is now handled separately via sprintId + columnId='backlog'
};

export const Kanban = {
  getAll() {
    // Legacy method, maybe unused or for debug
    return this.getBoardTasks(null);
  },

  getBoardTasks(sprintId) {
    // Fetch tasks for the main board (Active Sprint, columns != backlog)
    // If sprintId provided, filter by it. If not, maybe show all or empty?

    let query = 'SELECT * FROM tasks WHERE columnId != ?';
    const params = ['backlog'];

    if (sprintId) {
      query += ' AND sprintId = ?';
      params.push(sprintId);
    } else {
      // If no sprint selected, maybe show nothing or "No Sprint" tasks?
      // For now, let's require a sprintId or show everything if null (global view?)
      // User wants "Selected Sprint Only".
      // If no sprint passed, return empty for board columns to force selection?
      // let's return tasks with NO sprint if sprintId is null/undefined?
      // OR return all tasks? Let's assume passed sprintId is strictly filtered.
      if (sprintId === null) {
        query += ' AND sprintId IS NULL';
      }
    }

    query += ' ORDER BY created_at DESC';

    const tasks = db.prepare(query).all(...params);

    const result = Object.values(COLUMNS).map((col) => ({
      ...col,
      tasks: tasks.filter((t) => t.columnId === col.id).map(this._mapTask),
    }));

    return result;
  },

  getSprints() {
    return db.prepare('SELECT * FROM sprints ORDER BY sprint_order ASC, created_at ASC').all();
  },

  createSprint(title) {
    const id = 'sprint-' + Date.now();
    // Get min order to put it at the top
    const minOrder =
      db.prepare('SELECT MIN(sprint_order) as minOrder FROM sprints').get().minOrder || 0;
    db.prepare('INSERT INTO sprints (id, title, sprint_order) VALUES (?, ?, ?)').run(
      id,
      title,
      minOrder - 1
    );
    return { id, title, status: 'planned', sprint_order: minOrder - 1 };
  },

  deleteSprint(sprintId) {
    // Option 1: Delete tasks? Or move to backlog?
    // Let's move tasks to general backlog (sprintId=NULL) for safety.
    db.prepare('UPDATE tasks SET sprintId = NULL WHERE sprintId = ?').run(sprintId);
    db.prepare('DELETE FROM sprints WHERE id = ?').run(sprintId);
  },

  moveSprint(sprintId, direction) {
    const sprints = this.getSprints();
    const index = sprints.findIndex((s) => s.id === sprintId);
    if (index === -1) return;

    let swapIndex = -1;
    if (direction === 'up' && index > 0) swapIndex = index - 1;
    if (direction === 'down' && index < sprints.length - 1) swapIndex = index + 1;

    if (swapIndex !== -1) {
      const sprintA = sprints[index];
      const sprintB = sprints[swapIndex];

      // Swap orders
      const update = db.prepare('UPDATE sprints SET sprint_order = ? WHERE id = ?');
      update.run(sprintB.sprint_order, sprintA.id);
      update.run(sprintA.sprint_order, sprintB.id);
    }
  },

  getBacklogBuckets() {
    // Returns Sprints first, then General Backlog at the bottom
    const sprints = this.getSprints();
    const buckets = [];

    // 1. Sprint Backlogs
    sprints.forEach((sprint) => {
      // Fetch ALL tasks for this sprint (Todo, Doing, Done, Backlog)
      // This transforms the Planning view into a list view for Sprints
      const tasks = db
        .prepare('SELECT * FROM tasks WHERE sprintId = ? ORDER BY created_at DESC')
        .all(sprint.id)
        .map(this._mapTask);

      buckets.push({
        id: sprint.id,
        title: sprint.title,
        sprintId: sprint.id,
        tasks: tasks,
      });
    });

    // 2. General Backlog (No sprint) - Appended at the end
    const generalTasks = db
      .prepare(
        'SELECT * FROM tasks WHERE columnId = ? AND sprintId IS NULL ORDER BY created_at DESC'
      )
      .all('backlog')
      .map(this._mapTask);

    buckets.push({
      id: 'general',
      title: 'Backlog',
      sprintId: null,
      tasks: generalTasks,
    });

    return buckets;
  },

  _mapTask(row) {
    return {
      ...row,
      urgent: Boolean(row.urgent),
      tags: row.tags ? JSON.parse(row.tags) : [],
    };
  },

  // Legacy support for single backlog column call
  getBacklog() {
    return this.getBacklogBuckets()[0].tasks;
  },

  getColumn(colId) {
    if (!COLUMNS[colId]) return null;
    // This method usage needs context (sprint).
    // For now, it returns ALL tasks in that column.
    // Caution: UI might need filtering.
    // We'll update usecase to handle filtering.
    const tasks = db
      .prepare('SELECT * FROM tasks WHERE columnId = ? ORDER BY created_at DESC')
      .all(colId);

    return {
      ...COLUMNS[colId],
      tasks: tasks.map(this._mapTask),
    };
  },

  // New: Get Column Scoped by Sprint
  getColumnForSprint(colId, sprintId) {
    if (!COLUMNS[colId]) return null;

    let query = 'SELECT * FROM tasks WHERE columnId = ?';
    const params = [colId];

    if (sprintId) {
      query += ' AND sprintId = ?';
      params.push(sprintId);
    } else {
      query += ' AND sprintId IS NULL';
    }

    query += ' ORDER BY created_at DESC';
    const tasks = db.prepare(query).all(...params);

    return {
      ...COLUMNS[colId],
      tasks: tasks.map(this._mapTask),
    };
  },

  addTask(colId, title, content = '', urgent = false, sprintId = null) {
    const id = Date.now().toString();

    const types = ['feature', 'bug', 'design', 'docs'];
    const priorities = ['low', 'medium', 'high', 'critical'];
    const avatars = [
      'https://i.pravatar.cc/150?u=1',
      'https://i.pravatar.cc/150?u=2',
      'https://i.pravatar.cc/150?u=3',
    ];

    const type = types[Math.floor(Math.random() * types.length)];
    const priority = urgent
      ? 'critical'
      : priorities[Math.floor(Math.random() * priorities.length)];
    const avatar = avatars[Math.floor(Math.random() * avatars.length)];
    const comments = 0;
    const tags = JSON.stringify(['surf']);

    const stmt = db.prepare(`
            INSERT INTO tasks (
                id, title, content, columnId, sprintId, urgent, 
                type, priority, comments_count, assignee_avatar, tags
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

    stmt.run(
      id,
      title,
      content,
      colId,
      sprintId,
      urgent ? 1 : 0,
      type,
      priority,
      comments,
      avatar,
      tags
    );

    return {
      id,
      title,
      content,
      columnId: colId,
      sprintId,
      urgent: Boolean(urgent),
      type,
      priority,
      assignee_avatar: avatar,
      tags: tags ? JSON.parse(tags) : [],
    };
  },

  updateTask(taskId, updates) {
    const { title, content, columnId, sprintId, urgent, type, priority, assignee_avatar, tags } =
      updates;

    let query = 'UPDATE tasks SET ';
    const params = [];

    if (title !== undefined) {
      query += 'title = ?, ';
      params.push(title);
    }
    if (content !== undefined) {
      query += 'content = ?, ';
      params.push(content);
    }
    if (columnId !== undefined) {
      query += 'columnId = ?, ';
      params.push(columnId);
    }
    if (sprintId !== undefined) {
      query += 'sprintId = ?, ';
      params.push(sprintId || null);
    }
    if (urgent !== undefined) {
      query += 'urgent = ?, ';
      params.push(urgent ? 1 : 0);
    }
    if (type !== undefined) {
      query += 'type = ?, ';
      params.push(type);
    }
    if (priority !== undefined) {
      query += 'priority = ?, ';
      params.push(priority);
    }
    if (assignee_avatar !== undefined) {
      query += 'assignee_avatar = ?, ';
      params.push(assignee_avatar);
    }
    if (tags !== undefined) {
      query += 'tags = ?, ';
      params.push(JSON.stringify(tags));
    }

    // Stop if nothing to update
    if (params.length === 0) return this.getTask(taskId);

    // Remove trailing comma
    query = query.slice(0, -2);
    query += ' WHERE id = ?';
    params.push(taskId);

    db.prepare(query).run(...params);
    return this.getTask(taskId);
  },

  moveTask(taskId, targetColumnId, targetSprintId) {
    let updateQuery = 'UPDATE tasks SET ';
    const params = [];

    if (targetColumnId !== undefined) {
      updateQuery += 'columnId = ?, ';
      params.push(targetColumnId);
    }

    if (targetSprintId !== undefined) {
      updateQuery += 'sprintId = ?, ';
      // Ensure we treat 'null' string as actual null, if passed loosely
      params.push(targetSprintId);
    }

    // Remove trailing comma
    updateQuery = updateQuery.slice(0, -2);
    updateQuery += ' WHERE id = ?';
    params.push(taskId);

    const info = db.prepare(updateQuery).run(...params);
    return info.changes > 0;
  },

  deleteTask(taskId) {
    db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
  },

  getTask(taskId) {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    if (!task) return null;
    const mapped = this._mapTask(task);
    mapped.comments = this.getComments(taskId);
    // Use the actual count from the list as the source of truth
    mapped.comments_count = mapped.comments.length;
    return mapped;
  },

  searchTasks(query) {
    const sql = `
            SELECT * FROM tasks 
            WHERE title LIKE ? OR content LIKE ? 
            ORDER BY created_at DESC 
            LIMIT 10
        `;
    const pattern = `%${query}%`;
    const tasks = db.prepare(sql).all(pattern, pattern);
    return tasks.map(this._mapTask);
  },

  getComments(taskId) {
    return db
      .prepare('SELECT * FROM comments WHERE task_id = ? ORDER BY created_at DESC')
      .all(taskId);
  },

  addComment(taskId, content, author = { name: 'Me', avatar: 'https://i.pravatar.cc/150?u=me' }) {
    const id = Date.now().toString(); // Simple ID
    db.prepare(
      'INSERT INTO comments (id, task_id, content, author_name, author_avatar) VALUES (?, ?, ?, ?, ?)'
    ).run(id, taskId, content, author.name, author.avatar);

    // Update comment count
    db.prepare('UPDATE tasks SET comments_count = comments_count + 1 WHERE id = ?').run(taskId);

    return {
      id,
      task_id: taskId,
      content,
      author_name: author.name,
      author_avatar: author.avatar,
      created_at: new Date().toISOString(), // Approximate for immediate return
    };
  },

  deleteComment(commentId) {
    const stmt = db.prepare('DELETE FROM comments WHERE id = ? RETURNING task_id');
    const result = stmt.get(commentId);

    if (result) {
      // update task comment count
      db.prepare('UPDATE tasks SET comments_count = comments_count - 1 WHERE id = ?').run(
        result.task_id
      );
      return { id: commentId, taskId: result.task_id };
    }
    return null;
  },
};
