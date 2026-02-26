# Kanban Board - User Journey Map (E2E)

This document maps out the core user journeys covered by our Playwright E2E tests (`kanban.spec.js`). The goal is to ensure the **Surf** framework's patching, dragging, and navigation concepts remain completely stable during user interactions.

## 🧭 Active Journeys (Currently Tested)

### Journey 1: Board Load and Basic Inspection
* **Goal**: The user expects a working, recognizable Kanban interface upon initial entry.
* **Steps Covered**:
  - Open `/showcase/kanban`
  - Verify layout (Sidebar, Header, Toolbar) successfully renders.
  - Verify default Sprint details are present in the dropdown.
  - Check that the main columns (Todo, In Progress, Done) are initialized properly for the active sprint.

### Journey 2: Sprint Selection and Auto-Refresh Stability
* **Goal**: The user switches between active sprints and expects the board components to adapt dynamically without breaking or infinitely fetching. 
* **Steps Covered**:
  - Open the sprint dropdown (`#sprint-select`).
  - Select a different sprint option and trigger a `pulse:commit`.
  - Ensure the `.kanban-board` surface gets fully patched and re-rendered.
  - Wait `> 3000ms` (which triggers Surf's AutoRefresh).
  - Explicitly verify that AutoRefresh does NOT mistakenly duplicate or nest the `.kanban-board` container over itself. 

### Journey 3: Sidebar Navigation to Backlog
* **Goal**: The user routes seamlessly (SPA-style) to another part of the dashboard using Surf's `pulse:navigate`.
* **Steps Covered**:
  - Click on the Sidebar link pointing to `/showcase/kanban/backlog`.
  - Assert the History API effectively changes the URL natively without a full page refresh.
  - Assert the incoming HTML payload updates DOM surfaces appropriately, showing the `Backlog & Planning` headers.
  - Check that specific component groups (`.backlog-group`) render without errors.

### Journey 4: Task Modal Interaction
* **Goal**: The user interacts with individual tasks to see details overlaying the application.
* **Steps Covered**:
  - Look for any populated Task Card on the board (`.kanban-card`).
  - Native click event on the first detected card.
  - Trigger Surf's `pulse` event to fetch modal HTML and patch the `<dialog>` element.
  - Expect the modal (`#task-detail-modal`) to become visible over the UI.
  - Close the dialog using standard browser mechanics (pressing `Escape`).

### Journey 6: Task Creation and Submission
* **Goal**: Testing the "Add Task" quick-form submission and verifying the instant addition to the target column (Testing Surf form patches).
* **Steps Covered**:
  - Focus the `.quick-add-input` inside the Backlog or an Active Sprint grouping.
  - Submit the newly typed task via `.quick-add-btn`.
  - Assert that Surf `pulse` successfully fetched and dynamically injected the new snippet into `.tasks-list` flawlessly.

### Journey 7: Sprint Management (Move from General Backlog to Active Sprint)
* **Goal**: Simulating holistic board-to-planning management by moving tasks completely across structural views.
* **Steps Covered**:
  - Create a "Sprint Placement Candidate" inside the General Backlog bucket.
  - Locate that specific task on the DOM by text and assert existence.
  - Drag the newly rendered task container up into a disparate UI component (the `.tasks-list` belonging to an active sprint).
  - Verify it correctly surfaced in the destination component logic.

### Journey 8: Failure Resilience (Drag Drop Network Dropout)
* **Goal**: Simulating a network dropout during a drag & drop action. Defining error bounds to ensure the application reacts gracefully without desyncing the view.
* **Steps Covered**:
  - Identify a draggable task on the board.
  - Intentionally block backend connection using Playwright's `page.route` by forcing an `internetdisconnected` error state towards `/showcase/kanban/move`.
  - Perform drag and drop action against the disrupted backend.
  - Ensure the `.kanban-board` component remains stable and visual fidelity is partially recovered/saved without catastrophically breaking.

---

## 🏗️ Future Planned Journeys (To Be Added)

- **Deep Context Interactions**: Adding, reading, and destroying sub-components like real-time comments directly from within the `task-detail-modal`.
- **Search Filtration Integration**: Confirming that typing into the Quick Search bar correctly filters tasks on-screen using custom input dispatch events mixed with Surf rendering.
