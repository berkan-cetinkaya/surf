import { NewsUseCase } from '../usecases/news_usecase.js';
import { SeatUseCase } from '../usecases/seat_usecase.js';
import { FormUseCase } from '../usecases/form_usecase.js';
import { createPatch } from '#helpers/node/patch.js';

const newsUC = new NewsUseCase();
const seatUC = new SeatUseCase();
const formUC = new FormUseCase();
// Kanban uses functional exports, no instantiation needed

export async function handleNews(req, _reply) {
  const data = newsUC.getFeed();

  // Use req.server.view to get the rendered HTML as a string
  const html = await req.server.view('templates/news_feed.ejs', data);

  // Set the correct content type for SURF patches
  return createPatch().addSurface('#news-surface', html).render();
}

export async function handleNewsRead(req, _reply) {
  const { id } = req.params;
  newsUC.toggleReadStatus(id);

  return createPatch().render();
}

export async function handleSeats(req, _reply) {
  const data = seatUC.getAvailability();
  const html = await req.server.view('templates/seat_availability.ejs', data);

  return createPatch().addSurface('#availability-surface', html).render();
}

export async function handleBookSeats(req, _reply) {
  // Safely extract 'count' falling back to 1 if req.body or count is undefined
  const count = req.body && req.body.count ? parseInt(req.body.count) : 1;
  const result = seatUC.book(count || 1);

  let html;
  if (!result.success) {
    html = await req.server.view('templates/seat_failed.ejs', { available: result.remaining });
  } else {
    html = await req.server.view('templates/seat_success.ejs', result);
  }

  return createPatch().addSurface('.selector-card', html).render();
}

export async function handleSeatSelector(req, _reply) {
  const html = await req.server.view('templates/partials/seat_selector.ejs', {});
  return createPatch().addSurface('.selector-card', html).render();
}

export async function handleForm(req, _reply) {
  const { name, email } = req.body;
  const result = formUC.validate(req.body);

  if (!result.isValid) {
    const html = await req.server.view('templates/form_fields.ejs', {
      name,
      email,
      errors: result.errors,
      getError: (field) => result.errors.find((e) => e.field === field),
    });

    return createPatch().addSurface('#form-surface', html).render();
  }

  const html = await req.server.view('templates/form_success.ejs', { name, email });

  return createPatch().addSurface('#form-surface', html).render();
}

// Kanban
export {
  getBoard as handleKanbanBoard,
  getBacklogPage as handleKanbanBacklog,
  createSprint as handleKanbanCreateSprint,
  deleteSprint as handleKanbanDeleteSprint,
  reorderSprint as handleKanbanReorderSprint,
  getTaskModal as handleKanbanGetTaskModal,
  getTaskPage as handleKanbanGetTaskPage,
  updateTaskDetails as handleKanbanUpdateTaskDetails,
  addTask as handleKanbanAdd,
  moveTask as handleKanbanMove,
  deleteTask as handleKanbanDelete,
  searchTasks as handleKanbanSearch,
  addComment as handleKanbanAddComment,
  deleteComment as handleKanbanDeleteComment,
} from '../usecases/kanban_usecase.js';
