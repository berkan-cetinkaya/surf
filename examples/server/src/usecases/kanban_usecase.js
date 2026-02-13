import { Kanban } from '../domain/kanban.js';
import { createPatch } from '#helpers/node/patch.js';

export async function getBoard(req, reply) {
  const sprints = Kanban.getSprints();
  let activeSprintId = req.query.sprintId;

  // Default to first sprint if available and none selected?
  // Or prefer empty state? User said "Select Sprint to view".
  // Let's default to first active sprint if possible, or just first sprint.
  if (!activeSprintId && sprints.length > 0) {
    activeSprintId = sprints[0].id;
  }

  const board = Kanban.getBoardTasks(activeSprintId);
  // No backlog buckets needed here anymore

  return reply.view('templates/examples/kanban/board.ejs', {
    board,
    sprints,
    activeSprintId,
  });
}

export async function getBacklogPage(req, reply) {
  const backlogBuckets = Kanban.getBacklogBuckets();
  // We might need sprints list for metadata/status
  const sprints = Kanban.getSprints();

  return reply.view('templates/examples/kanban/backlog_page.ejs', {
    backlogBuckets,
    sprints,
  });
}

export async function createSprint(req, reply) {
  const { title } = req.body;
  Kanban.createSprint(title);

  // Re-render the whole page or just the backlog list + selector?
  // Updating selector via patch is tricky if it's in the header.
  // For simplicity, let's refresh the page via client-side redirect or just replace body?
  // Surf patch can replace broad targets.

  // Better: Render the backlog list (which contains new sprint bucket)
  // AND update the sprint selector if possible.

  const backlogBuckets = Kanban.getBacklogBuckets();

  // We assume there's a reference to the active sprint from the previous GET,
  // but here we might default or keep current.
  // Let's just patch the backlog buckets for now.
  // User will see new sprint in backlog area.
  // To update selector, we need a surface for it.

  reply.type('text/html');
  const html = await req.server.view('templates/examples/kanban/partials/backlog.ejs', {
    backlogBuckets,
  });

  return (
    createPatch()
      .addSurface('#backlog-section', html)
      // Ideally update selector too, will add .sprint-selector surface later
      .render()
  );
}

export async function deleteSprint(req, reply) {
  const { sprintId } = req.body;
  Kanban.deleteSprint(sprintId);

  const backlogBuckets = Kanban.getBacklogBuckets();

  reply.type('text/html');
  const html = await req.server.view('templates/examples/kanban/partials/backlog.ejs', {
    backlogBuckets,
  });

  return createPatch().addSurface('#backlog-section', html).render();
}

export async function reorderSprint(req, reply) {
  const { sprintId, direction } = req.body;
  Kanban.moveSprint(sprintId, direction);

  const backlogBuckets = Kanban.getBacklogBuckets();

  reply.type('text/html');
  const html = await req.server.view('templates/examples/kanban/partials/backlog.ejs', {
    backlogBuckets,
  });

  return createPatch().addSurface('#backlog-section', html).render();
}

export async function addTask(req, reply) {
  const { title, description, urgent, columnId, sprintId } = req.body; // sprintId from form input

  Kanban.addTask(columnId, title, description, urgent === 'on', sprintId || null);

  reply.type('text/html');

  if (columnId === 'backlog') {
    // Find which bucket we added to.
    // If sprintId is null, it's general backlog.
    // If sprintId is set, it's that sprint's backlog bucket.
    const bucketId = sprintId || 'general'; // Using 'general' as ID for null sprint

    const buckets = Kanban.getBacklogBuckets();
    const bucket = buckets.find((b) => (b.sprintId || 'general') === bucketId);

    const html = await req.server.view('templates/examples/kanban/partials/backlog_content.ejs', {
      tasks: bucket.tasks,
      sprintId: bucket.sprintId,
    });

    return createPatch()
      .addSurface(`#backlog-content-${bucketId}`, html)
      .addSurface(`#badge-${bucketId}`, String(bucket.tasks.length))
      .render();
  }

  if (req.body.view === 'planning') {
    // Added to a sprint (todo) from Planning view. Update the sprint bucket in planning list.
    const bucketId = sprintId || 'general';
    const buckets = Kanban.getBacklogBuckets();
    const bucket = buckets.find((b) => (b.sprintId || 'general') === bucketId);

    const html = await req.server.view('templates/examples/kanban/partials/backlog_content.ejs', {
      tasks: bucket.tasks,
      sprintId: bucket.sprintId,
    });

    return createPatch()
      .addSurface(`#backlog-content-${bucketId}`, html)
      .addSurface(`#badge-${bucketId}`, String(bucket.tasks.length))
      .render();
  }

  // Board Column
  // We assume we are looking at the sprint we added to.
  const column = Kanban.getColumnForSprint(columnId, sprintId);

  // Pass activeSprintId so the re-rendered column knows which sprint it is
  const html = await req.server.view('templates/examples/kanban/partials/column_content.ejs', {
    column,
    activeSprintId: sprintId,
  });

  return createPatch().addSurface(`#col-${columnId}`, html).render();
}

export async function moveTask(req, reply) {
  const { taskId, fromCol, fromSprintId, toCol, toSprintId } = req.body;

  reply.type('text/html');

  if (fromCol === toCol && fromSprintId === toSprintId) return ''; // No op

  Kanban.moveTask(taskId, toCol, toSprintId || null);

  const patch = createPatch();

  // Render Source
  if (fromCol === 'backlog') {
    const bucketId = fromSprintId || 'general';
    // Re-fetch bucket tasks
    const buckets = Kanban.getBacklogBuckets();
    const bucket = buckets.find((b) => (b.sprintId || 'general') === bucketId);

    const html = await req.server.view('templates/examples/kanban/partials/backlog_content.ejs', {
      tasks: bucket.tasks,
      sprintId: bucket.sprintId,
    });
    patch.addSurface(`#backlog-content-${bucketId}`, html);
    patch.addSurface(`#badge-${bucketId}`, String(bucket.tasks.length));
  } else {
    // Source is a board column. It belongs to `fromSprintId`.
    const sourceCol = Kanban.getColumnForSprint(fromCol, fromSprintId);
    const html = await req.server.view('templates/examples/kanban/partials/column_content.ejs', {
      column: sourceCol,
      activeSprintId: fromSprintId,
    });
    patch.addSurface(`#col-${fromCol}`, html);
  }

  // Render Target
  // If we are in Planning view, we ALWAYS render a backlog bucket, regardless of toCol being 'todo'
  if (toCol === 'backlog' || req.body.view === 'planning') {
    const bucketId = toSprintId || 'general';
    const buckets = Kanban.getBacklogBuckets();
    const bucket = buckets.find((b) => (b.sprintId || 'general') === bucketId);

    const html = await req.server.view('templates/examples/kanban/partials/backlog_content.ejs', {
      tasks: bucket.tasks,
      sprintId: bucket.sprintId,
    });
    patch.addSurface(`#backlog-content-${bucketId}`, html);
    patch.addSurface(`#badge-${bucketId}`, String(bucket.tasks.length));
  } else {
    // Target is board column.
    // IMPORTANT: Only update if the board is actively showing this sprint!
    // The client usually only allows drop if valid.
    const targetCol = Kanban.getColumnForSprint(toCol, toSprintId);
    const html = await req.server.view('templates/examples/kanban/partials/column_content.ejs', {
      column: targetCol,
      activeSprintId: toSprintId,
    });
    patch.addSurface(`#col-${toCol}`, html);
  }

  return patch.render();
}

export async function deleteTask(req, reply) {
  const { taskId, columnId, sprintId } = req.body;

  Kanban.deleteTask(taskId);

  reply.type('text/html');

  if (columnId === 'backlog') {
    const bucketId = sprintId || 'general';
    const buckets = Kanban.getBacklogBuckets();
    const bucket = buckets.find((b) => (b.sprintId || 'general') === bucketId);

    const html = await req.server.view('templates/examples/kanban/partials/backlog_content.ejs', {
      tasks: bucket.tasks,
      sprintId: bucket.sprintId,
    });
    return createPatch()
      .addSurface(`#backlog-content-${bucketId}`, html)
      .addSurface(`#badge-${bucketId}`, String(bucket.tasks.length))
      .render();
  }

  const column = Kanban.getColumnForSprint(columnId, sprintId);
  const html = await req.server.view('templates/examples/kanban/partials/column_content.ejs', {
    column,
    activeSprintId: sprintId,
  });

  return createPatch().addSurface(`#col-${columnId}`, html).render();
}

export async function getTaskModal(req, reply) {
  const { taskId } = req.params;
  const task = Kanban.getTask(taskId);

  if (!task) return reply.code(404).send('Task not found');

  return reply.view('templates/examples/kanban/partials/task_modal.ejs', { task });
}

export async function getTaskPage(req, reply) {
  const { taskId } = req.params;
  const task = Kanban.getTask(taskId);
  const sprints = Kanban.getSprints();

  if (!task) return reply.code(404).send('Task not found');

  return reply.view('templates/examples/kanban/task_detail.ejs', { task, sprints });
}

export async function updateTaskDetails(req, reply) {
  const { taskId } = req.params;
  const { title, content, status, sprintId, priority, type, assignee_avatar, tags } = req.body;

  const updates = {};

  if (title !== undefined) updates.title = title;
  // For type, only update if valid/present
  if (type !== undefined) updates.type = type;

  // Use empty string check for content to allow clearing it,
  // but only if the field was actually sent.
  if (content !== undefined)
    updates.content = typeof content === 'string' ? content.trim() : content;

  if (status !== undefined) updates.columnId = status;

  // Distinguish between "field missing" (undefined) and "General Backlog" (empty string)
  if (sprintId !== undefined) {
    updates.sprintId = sprintId || null;
  }

  if (priority !== undefined) updates.priority = priority;
  if (assignee_avatar !== undefined) updates.assignee_avatar = assignee_avatar;

  if (tags !== undefined) {
    updates.tags = tags
      ? tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
  }

  Kanban.updateTask(taskId, updates);

  // Redirect back to the task page to show updated details
  return reply.redirect(`/examples/kanban/task/${taskId}`);
}

export async function searchTasks(req, reply) {
  const { q } = req.query;

  if (!q || q.length < 2) {
    return reply.send(''); // Return empty if query is too short
  }

  const tasks = Kanban.searchTasks(q);

  return reply.view('templates/examples/kanban/partials/search_results.ejs', { tasks });
}

export async function addComment(req, reply) {
  const { taskId } = req.params;
  const { content } = req.body;

  if (!content || !content.trim()) {
    reply.code(400).send('Comment content is required');
    return;
  }

  // In a real app, author would come from session
  const author = {
    name: 'Current User',
    avatar: 'https://i.pravatar.cc/150?u=me',
  };

  const comment = Kanban.addComment(taskId, content.trim(), author);

  // Render just the new comment to prepend to the list
  return reply.view('examples/kanban/partials/comment.ejs', { comment });
}

export async function deleteComment(req, reply) {
  const { commentId } = req.params;

  const result = Kanban.deleteComment(commentId);

  if (result) {
    // Return empty content to remove the element from DOM
    return '';
  }

  reply.code(404).send('Comment not found');
}
