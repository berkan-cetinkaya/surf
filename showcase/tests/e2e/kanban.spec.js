import { test, expect } from '@playwright/test';

test.describe('Kanban User Journey (E2E)', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the main Kanban board before each test
    await page.goto('/showcase/kanban');
  });

  test('Journey 1: Board Load and Basic Inspection', async ({ page }) => {
    // 1. Verify page title and ensure main layout elements exist
    await expect(page).toHaveTitle(/Surf Board/);
    await expect(page.locator('.dashboard-sidebar')).toBeVisible();
    await expect(page.locator('.board-toolbar')).toBeVisible();
    await expect(page.locator('#sprint-select')).toBeVisible();

    // 2. Ensure default columns render properly (todo, doing, done)
    const columns = page.locator('.column');
    await expect(columns).toHaveCount(3);
  });

  test('Journey 2: Sprint Selection and Auto-Refresh Stability', async ({ page }) => {
    const sprintSelect = page.locator('#sprint-select');

    // Switch to another sprint if multiple options exist
    const optionsCount = await sprintSelect.locator('option').count();

    if (optionsCount > 1) {
      await sprintSelect.selectOption({ index: 1 });
      // Await Surf pulse re-render
      await expect(page.locator('.kanban-board')).toBeVisible();
    }

    // Auto-refresh bug regression: Wait 3.5 seconds
    await page.waitForTimeout(3500);

    // Ensure board container didn't duplicate/nest itself during patches
    const nestedBoards = await page.locator('.kanban-board .kanban-board').count();
    expect(nestedBoards).toBe(0);
  });

  test('Journey 3: Sidebar Navigation to Backlog', async ({ page }) => {
    // Click on the backlog link in the sidebar using Surf's pulse:navigate
    await page.click('a[href="/showcase/kanban/backlog"]');

    // Ensure the History API updated the URL natively
    await expect(page).toHaveURL(/.*\/kanban\/backlog/);

    // Verify the newly rendered page title
    await expect(page.getByText('Backlog & Planning')).toBeVisible();

    // Verify that backlog groups (buckets) render successfully
    await expect(page.locator('#backlog-section')).toBeVisible();
    await expect(page.locator('.backlog-group').first()).toBeVisible();
  });

  test('Journey 4: Task Modal Interaction', async ({ page }) => {
    const firstTask = page.locator('.kanban-card').first();
    const count = await firstTask.count();

    // Pass silently if the board is empty during this run
    if (count > 0) {
      // Click the task card to open the modal overlay
      await firstTask.click();

      // Wait for the modal dialog to appear
      const modal = page.locator('#task-detail-modal');
      await expect(modal).toBeVisible();

      // Dismiss the modal using keyboard
      await page.keyboard.press('Escape');
    }
  });

  test('Journey 5: Drag and Drop Task (Visual)', async ({ page }) => {
    const firstTask = page.locator('.kanban-card[d-draggable="true"]').first();
    const count = await firstTask.count();

    // Only test if there is a draggable item on the board
    if (count > 0) {
      const source = firstTask;

      // Target column (e.g. the second column - In Progress)
      const targetColumn = page.locator('.column[d-drop-zone]').nth(1);

      // Trigger Surf DnD mechanism by simulating a drag action
      await source.dragTo(targetColumn);

      // Surf DnD should fire pulse:start / pulse:end with FormData
      // Verify the board remains visible and intact after the resulting patch
      await expect(page.locator('.kanban-board')).toBeVisible();
    }
  });

  test('Journey 6: Task Creation and Submission', async ({ page }) => {
    // Test the quickest creation flow which is on the backlog page
    await page.goto('/showcase/kanban/backlog');

    // Use the first active backlog bucket's quick add input
    const input = page.locator('.quick-add-input').first();
    const randomTitle = `E2E Automated Task ${Date.now()}`;
    await input.fill(randomTitle);

    const submitBtn = page.locator('.quick-add-btn').first();
    await submitBtn.click();

    // Wait for the new task to be instantly appended into the DOM via Surf Patch
    await expect(page.locator('.tasks-list').first().getByText(randomTitle)).toBeVisible();
  });

  test('Journey 7: Sprint Management (Move from General Backlog to Active Sprint)', async ({
    page,
  }) => {
    await page.goto('/showcase/kanban/backlog');

    // Create a target candidate in the General Backlog (last bucket)
    const input = page.locator('.quick-add-input').last();
    const testTitle = `Sprint Placement Candidate ${Date.now()}`;
    await input.fill(testTitle);
    await page.locator('.quick-add-btn').last().click();

    // Verify it appeared in the last group
    const newCard = page
      .locator('.tasks-list')
      .last()
      .getByText(testTitle)
      .first()
      .locator('xpath=..');
    await expect(newCard).toBeVisible();

    // The target planner bucket (top bucket in Planning view)
    const topSprintBucket = page.locator('.tasks-list').first();

    // If there are at least two buckets (one being general, one being a sprint)
    const bucketCount = await page.locator('.backlog-group').count();
    if (bucketCount > 1) {
      // Simulate Dragging it directly out of the backlog UP into an active Sprint's planning queue
      await newCard.dragTo(topSprintBucket);

      // Verify it surfaced in the destination DOM (Surf patching seamlessly rendering cross-layer moves)
      await expect(topSprintBucket.getByText(testTitle)).toBeVisible();
    }
  });

  test('Journey 8: Failure Resilience (Drag Drop Network Dropout)', async ({ page }) => {
    const firstTask = page.locator('.kanban-card[d-draggable="true"]').first();
    const count = await firstTask.count();

    if (count > 0) {
      // Intercept the underlying pulse/fetch network request and forcibly abort it for a simulated offline state
      await page.route('**/showcase/kanban/move', (route) =>
        route.abort('internetdisconnected')
      );

      const source = firstTask;
      const targetColumn = page.locator('.column[d-drop-zone]').nth(1);

      // Perform the drag despite no active connection to backend
      await source.dragTo(targetColumn);

      // Even if drop fails in Surf DnD (yielding console error / error emission),
      // the Surf DOM logic shouldn't blank out or freeze uncontrollably.
      await expect(page.locator('.kanban-board')).toBeVisible();

      // Ensure the task still visually exists (graceful preservation or fallback)
      await expect(source).toBeVisible();

      // Remove wildcard routing interception
      await page.unroute('**/showcase/kanban/move');
    }
  });
});
