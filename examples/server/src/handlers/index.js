import { NewsUseCase } from '../usecases/news_usecase.js';
import { SeatUseCase } from '../usecases/seat_usecase.js';
import * as KanbanUseCase from '../usecases/kanban_usecase.js';
import { FormUseCase } from '../usecases/form_usecase.js';
import { createPatch } from '#helpers/node/patch.js';

const newsUC = new NewsUseCase();
const seatUC = new SeatUseCase();
const formUC = new FormUseCase();
// Kanban uses functional exports, no instantiation needed

export async function handleNews(req, reply) {
    const data = newsUC.getFeed();
    
    // We can use EJS here via reply.view, or build the HTML string manually as in the original example.
    // To stick to the "server-driven" philosophy and show how templates work:
    const html = await reply.view('templates/news_feed.ejs', data);
    
    return createPatch().addSurface('#news-surface', html).render();
}

export async function handleNewsRead(req, reply) {
    const { id } = req.params;
    newsUC.toggleReadStatus(id);
    
    return { success: true, id, read: true }; // Simple JSON ack
}

export async function handleSeats(req, reply) {
    const data = seatUC.getAvailability();
    const html = await reply.view('templates/seat_availability.ejs', data);
    return createPatch().addSurface('#availability-surface', html).render();
}

export async function handleBookSeats(req, reply) {
    const { count } = req.body;
    const result = seatUC.book(parseInt(count) || 1);
    
    let html;
    if (!result.success) {
        html = await reply.view('templates/seat_failed.ejs', { available: result.remaining });
    } else {
        html = await reply.view('templates/seat_success.ejs', result);
    }
    
    return createPatch().addSurface('.selector-card', html).render();
}

export async function handleForm(req, reply) {
    const { name, email, password } = req.body;
    const result = formUC.validate(req.body);
    
    if (!result.isValid) {
        const html = await reply.view('templates/form_fields.ejs', { 
            name, email, 
            errors: result.errors,
            getError: (field) => result.errors.find(e => e.field === field)
        });
        return createPatch().addSurface('#form-surface', html).render();
    }
    
    const html = await reply.view('templates/form_success.ejs', { name, email });
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
    deleteComment as handleKanbanDeleteComment
} from '../usecases/kanban_usecase.js';
