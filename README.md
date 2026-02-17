# SURF

[![Build Status](https://ci.berkan.cc/api/badges/2/status.svg)](https://ci.berkan.cc/repos/2)
[![Coverage Status](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)](https://github.com/berkan-cetinkaya/surf)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

HTML-first, server-driven UI framework with local client-side state.

> **Mental Model**: "Surface changes, Cell lives."

## Philosophy

- **Server is the source of truth** — All data and validation lives on the server
- **Client handles local motion** — Only temporary, interactive state on the client
- **HTML is the data format** — UI changes through HTML patches, not JSON APIs
- **No build step required** — Works directly in the browser, no transpilation needed
- **Progressive enhancement** — Works without JS, enhanced with JS

## Non-Goals

- ❌ Global client-side store
- ❌ Virtual DOM
- ❌ Mandatory JSON APIs
- ❌ Hidden magic or implicit behavior

## Installation

```html
<script src="https://unpkg.com/surf-core@latest/dist/surf.min.js"></script>
```

Or install via npm:

```bash
npm install surf-core
```

## Core Concepts

### Surface

Surface handles DOM replacement — any element targeted by `d-target` becomes a surface.

```html
<main id="main" d-swap="inner">
  <!-- Content that can be replaced -->
</main>
```

**Swap Strategies (`d-swap`):**

- `inner` (default): Replaces children.
- `outer`: Replaces the element itself.
- `prepend`: Adds to start of content.
- `append`: Adds to end of content.

### Cell

A Cell is a local, client-side state container. Cells survive Surface updates.

```html
<div d-cell="{ count: 0 }" d-id="counter">
  <span d-text="count"></span>
  <button d-signal="click: count = count + 1">+</button>
</div>
```

### Signal

Signals define reactive behavior inside a Cell.

| `d-signal` | Event handler | `d-signal="click: open = true"` |
| `d-text` | Text binding | `d-text="count"` |
| `d-show` | Conditional display | `d-show="open"` |
| `d-attr` | Attribute binding | `d-attr="disabled: loading"` |
| `d-attr` | Class toggling | `d-attr="class.active: isActive"` |

### Signal Features

**Form Resetting:**
Use the `reset` keyword to clear forms declaratively. Surf automatically ensures this happens _after_ submission data is captured.

```html
<form d-pulse="commit" d-signal="submit: reset">
  <input name="msg" />
</form>
```

**Native Methods (`this.method()`):**
Call native DOM methods on the element triggering the signal.

```html
<input type="text" d-signal="focus: this.select()" />
<video d-signal="mouseenter: this.play()"></video>
```

### Plugins

Surf supports a lightweight plugin system.

```javascript
import Surf from './surf.js';
import DragAndDrop from './plugins/drag-and-drop.js';

Surf.use(DragAndDrop);
```

**Drag & Drop Plugin:**
Enable drag-and-drop reordering with simple attributes.

```html
<div d-drag-zone="group-name" d-drag-url="/api/move">
  <div d-drag-handle>...</div>
</div>
```

### Pulse

A Pulse triggers server interaction.

```html
<!-- Navigation (GET) -->
<a href="/page" d-pulse="navigate" d-target="#main">Go to Page</a>

<!-- Action (POST) -->
<!-- Sends Cell state + data attributes -->
<button d-pulse="action" d-action="/api/like" data-id="123">Like</button>

<!-- Form submission (POST) -->
<form d-pulse="commit" d-target="#form">
  <input name="email" required />
  <button type="submit">Submit</button>
</form>

<!-- Refresh content -->
<button d-pulse="refresh" d-target="#main">Refresh</button>
```

### Auto-Refresh

(Requires `SurfAutoRefresh` plugin)

Surfaces can automatically poll the server for updates.

```html
<div d-auto-refresh="5000" d-auto-refresh-url="/api/news">
  <!-- Content updates every 5 seconds -->
</div>
```

### Patch

Server returns HTML patches to update Surfaces.

```html
<d-patch>
  <surface target="#main">
    <h1>Updated Content</h1>
  </surface>
  <surface target="#toast">
    <div class="toast">Saved!</div>
  </surface>
</d-patch>
```

## Plugins

Surf works best with its official plugins. Include them after the core script.

```html
<script src="/dist/plugins/clipboard.js"></script>
<script>
  Surf.use(SurfClipboard);
</script>
```

### Clipboard

Copy content to clipboard with `d-signal`. Automatically handles "Copied!" state.

```html
<button d-signal="click: Clipboard.copy(event)">Copy</button>
```

### Top Loader

YouTube-style progress bar for all Surf requests.

```javascript
Surf.use(SurfTopLoader, { color: '#29d', height: '3px' });
```

### Visual Debugger

Press **Shift + D** to inspect cells, signals, and network events.

```javascript
Surf.use(SurfDebug);
```

### Auto-Refresh

Poll a URL for updates.

```html
<div d-auto-refresh="5000" d-auto-refresh-url="/api/stats"></div>
```

### Debounce

Debounce inputs for search/filter (replaces `d-pulse` on input).

```html
<input d-input="/search" d-debounce="300" d-target="#results" />
```

## JavaScript API

```javascript
// Navigate to URL
Surf.go('/page', { target: '#main' });

// Refresh a surface
Surf.refresh('#main');

// Listen to events
Surf.on('before:pulse', (e) => console.log('Loading...'));
Surf.on('after:patch', (e) => console.log('Done!'));
Surf.on('error:network', (e) => console.error(e.error));

// Manual state access
Surf.getState('#my-cell');
Surf.setState('#my-cell', { count: 5 });

// Register custom signal modules
Surf.register('MyLogic', {
  doSomething: () => console.log('Done'),
});
// Usage: d-signal="click: MyLogic.doSomething()"

// Manually apply HTML patch
Surf.applyPatch('<d-patch>...</d-patch>');
```

## Echo Rule

> "Surface changes, Cell lives."

When a Surface is patched, Cell states are preserved. If a Cell with the same `d-id` exists in the new content, its state is restored automatically.

```html
<!-- Before patch: count = 5 -->
<div d-cell="{ count: 0 }" d-id="counter">
  <span d-text="count">5</span>
</div>

<!-- After patch: count still = 5 (preserved by Echo) -->
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Serve showcase
npm run serve
```

## License

MIT
