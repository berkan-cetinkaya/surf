
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve('examples/server/kanban.db');
const db = new Database(dbPath);

const taskId = '1770400653460'; // ID appearing in logs
const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);

console.log('--- TASK DEBUG ---');
if (task) {
    console.log(`ID: ${task.id}`);
    console.log(`Content Raw: "${task.content}"`);
    console.log(`Content Length: ${task.content ? task.content.length : 0}`);
} else {
    console.log('Task not found');
}
