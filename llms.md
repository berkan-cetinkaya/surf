# SURF – LLM Reference

> **Version**: 0.3.2  
> **Mental Model**: "Surface changes, Cell lives."  
> **Philosophy**: The server is the source of truth. The client handles only temporary, local interactions. HTML is the primary data format. UI changes happen through HTML patches, not JSON APIs.

This document contains the complete reference for the SURF framework, optimised for use with large language models (LLMs).

---

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Core Concepts](#core-concepts)
   - [Surface](#surface)
   - [Cell](#cell)
   - [Signal](#signal)
   - [Pulse](#pulse)
   - [Patch](#patch)
   - [Echo](#echo)
   - [MCP (Model Context Protocol)](#mcp-model-context-protocol)
4. [HTML Attributes Reference](#html-attributes-reference)
5. [Signal Expressions](#signal-expressions)
6. [Plugins](#plugins)
7. [JavaScript API](#javascript-api)
8. [Events](#events)
9. [Server-Side Integration](#server-side-integration)
10. [Patterns & Examples](#patterns--examples)
11. [Architecture](#architecture)

---

## Overview

SURF is an HTML-first, server-driven UI framework with local client-side state. It requires **no build step** and works directly in the browser. It is designed for applications where the server is the source of truth, and the UI is updated by the server returning HTML fragments.

**Non-Goals:**
- No global client-side store
- No Virtual DOM
- No mandatory JSON APIs
- No hidden magic or implicit behavior

---

## Installation

### CDN (script tag)

```html
<script src="https://unpkg.com/surf-core@latest/dist/surf.min.js"></script>
```

### npm

```bash
npm install surf-core
```

### ESM import

```javascript
import Surf from 'surf-core';
```

Surf automatically initialises when the DOM is ready (`DOMContentLoaded`). No manual `init()` call is needed.

---

## Core Concepts

### Surface

A **Surface** is any DOM region that can be replaced by the server. Any element targeted by `d-target` becomes a Surface. Surfaces are the "view layer" that the server updates.

#### Swap Strategies (`d-swap`)

Control how the new HTML is inserted into the Surface:

| Value | Behaviour |
|-------|-----------|
| `inner` (default) | Replaces the element's children |
| `outer` | Replaces the element itself |
| `append` | Appends to the end of the element's children |
| `prepend` | Adds to the start of the element's children |
| `delete` | Removes the element from the DOM |

```html
<!-- Surface that replaces its inner content -->
<main id="main" d-swap="inner">
  <!-- Content replaced by server -->
</main>

<!-- Surface that appends new items -->
<ul id="list" d-swap="append">
  <li>Existing item</li>
</ul>
```

The `d-swap` attribute can be set on the Surface element itself, on the triggering Pulse element (via `d-swap`), or on a `<surface>` tag within a `<d-patch>` response. Priority: `<surface swap="...">` > Pulse element `d-swap` > Surface element `d-swap` > `'inner'` default.

---

### Cell

A **Cell** is a small, local, client-side state container. Cells survive Surface updates (Echo rule). They hold temporary, interactive state like toggle flags, counters, form field values, etc.

#### Defining a Cell

```html
<!-- Full object syntax -->
<div d-cell="{ count: 0, open: false }" d-id="my-counter">
  <!-- Cell content -->
</div>

<!-- Shorthand syntax (auto-wrapped in braces) -->
<div d-cell="count: 0" d-id="counter">
  <!-- Cell content -->
</div>
```

#### Cell Attributes

| Attribute | Description |
|-----------|-------------|
| `d-cell="{ key: value }"` | Defines the cell and its initial state (seed) |
| `d-id="name"` | Unique identifier for Echo preservation. Required for state to survive Surface updates |
| `d-cell-strategy="reset"` | Force the cell to reset its state on every Surface update instead of preserving it |

#### Cell Nesting

Cells can be nested. The Signal system resolves the **nearest parent cell** for each element, so nested cells are isolated.

```html
<div d-cell="{ outer: 1 }" d-id="outer">
  <div d-cell="{ inner: 0 }" d-id="inner">
    <!-- Signals here use the "inner" cell's state -->
    <span d-text="inner"></span>
  </div>
  <!-- Signals here use the "outer" cell's state -->
  <span d-text="outer"></span>
</div>
```

---

### Signal

Signals define reactive behavior inside a Cell. They respond to DOM events and update Cell state.

#### Signal Attributes

| Attribute | Format | Description |
|-----------|--------|-------------|
| `d-signal` | `event: expression` | Attaches an event listener that evaluates an expression and updates state |
| `d-text` | `expression` | Binds element `textContent` to a state value |
| `d-show` | `expression` | Shows/hides element (`display: none`) based on a boolean expression |
| `d-attr` | `attr: expression` or `class.name: expr` | Binds an HTML attribute or CSS class to an expression |

#### Multiple Signals

Separate multiple signals with `;`:

```html
<input
  d-signal="focus: active = true; blur: active = false"
/>
```

---

### Pulse

A **Pulse** represents user intent that triggers a server interaction. Pulses are defined declaratively with `d-pulse`.

#### Pulse Types

| Type | HTTP Method | Triggered By | Use Case |
|------|-------------|--------------|----------|
| `navigate` | GET | Click on `<a>` | SPA-style navigation |
| `commit` | POST (or form method) | Form submit | Form submissions |
| `refresh` | GET | Click | Refresh a surface's content |
| `action` | POST | Click | Submit data from `data-*` attributes and Cell state |

#### Pulse Attributes

| Attribute | Description |
|-----------|-------------|
| `d-pulse="navigate\|commit\|refresh\|action"` | Declares the pulse type |
| `d-target="#selector"` | CSS selector of the Surface to update with the response |
| `d-action="/url"` | Server URL for `action` pulse |
| `d-swap="inner\|append\|prepend"` | Override swap strategy for this pulse |
| `data-*` | Key-value pairs sent as JSON body for `action` pulse |

#### Navigation Pulse

```html
<!-- GET /page, replace #main -->
<a href="/page" d-pulse="navigate" d-target="#main">Go to Page</a>

<!-- Navigate to full URL (replaces entire HTML document) -->
<a href="/dashboard" d-pulse="navigate">Dashboard</a>
```

#### Commit Pulse (Form)

```html
<!-- POST form data to form's action URL -->
<form d-pulse="commit" d-target="#form-area" action="/submit" method="POST">
  <input name="email" type="email" required />
  <button type="submit">Submit</button>
</form>

<!-- GET form (appends params to URL) -->
<form d-pulse="commit" d-target="#results" method="GET" action="/search">
  <input name="q" type="search" />
  <button type="submit">Search</button>
</form>
```

#### Action Pulse

Sends `data-*` attributes and parent Cell state as a JSON POST body:

```html
<button
  d-pulse="action"
  d-action="/api/like"
  d-target="#post-123"
  data-id="123"
>Like</button>
```

The server receives: `{ "id": "123", ...cellState }`.

#### Refresh Pulse

```html
<!-- Re-fetch the current URL and replace #feed -->
<button d-pulse="refresh" d-target="#feed">Refresh</button>
```

---

### Patch

A **Patch** is the server response format that updates one or more Surfaces in a single response.

#### Patch Format (server returns)

```html
<d-patch>
  <surface target="#main">
    <h1>New content for main</h1>
  </surface>
  <surface target="#toast">
    <div class="toast">Saved!</div>
  </surface>
</d-patch>
```

#### Patch with Swap Strategy

```html
<d-patch>
  <!-- Append a new item to a list -->
  <surface target="#list" swap="append">
    <li>New item</li>
  </surface>
  <!-- Delete an element -->
  <surface target="#item-42" swap="delete"></surface>
</d-patch>
```

#### Patch with Template (avoid browser parsing side-effects)

Wrap content in a `<template>` tag inside a `<surface>` to prevent the browser from prematurely parsing table rows, images, etc.:

```html
<d-patch>
  <surface target="#tbody">
    <template>
      <tr><td>Row data</td></tr>
    </template>
  </surface>
</d-patch>
```

#### Simple HTML Response (single surface)

When there is only one surface to update and the response is not a `<d-patch>`, Surf treats the entire response as the content for the element targeted by `d-target`:

```html
<!-- Pulse: d-target="#main" -->
<!-- Server can respond with plain HTML -->
<article>
  <h2>Article Title</h2>
  <p>Content...</p>
</article>
```

---

### Echo

**Echo** is the mechanism that preserves Cell state across Surface patches. When a Surface is updated, Echo:

1. Snapshots all Cell states within the Surface (keyed by `d-id`)
2. Performs the replacement
3. Restores state into any Cell with a matching `d-id` in the new content
4. Re-initialises signals on the new content

This means Cell state (e.g. a counter at `5`) survives full Surface replacements as long as the Cell keeps the same `d-id`.

```html
<!-- Before patch: count = 5 -->
<div d-cell="{ count: 0 }" d-id="counter">
  <span d-text="count">5</span>
</div>

<!-- After server patches the parent surface: count remains 5 -->
```

---

### MCP (Model Context Protocol)

The **Model Context Protocol (MCP)** is an open standard designed to standardize how AI systems integrate with external tools and data. Go is one of the premier languages for building MCP servers due to its lightweight binaries and excellent concurrency handling.

#### Why Go for MCP?

- **Concurrency**: Goroutines are perfect for handling simultaneous AI interactions and external tool calls.
- **Single Binaries**: Easy deployment and distribution of MCP servers.
- **Performance**: High-throughput communication over JSON-RPC 2.0.
- **Strong SDKs**: Robust ecosystem with libraries like `mcp-go`.

#### Comparison with Java

While **Java** is also a top-tier choice for MCP (especially in enterprise environments with official SDK support for Spring AI), **Go** offers a more "bare-metal" simplicity that many developers prefer for building fast, individual MCP components.

[Anthropic's MCP Documentation](https://modelcontextprotocol.io/)

---

## HTML Attributes Reference

### Full Attribute Table

| Attribute | Element | Description |
|-----------|---------|-------------|
| `d-cell="{ ... }"` | Any | Declares a local state container with an initial seed |
| `d-id="name"` | Cell | Unique ID for Echo state preservation |
| `d-cell-strategy="reset"` | Cell | Forces state reset on each patch instead of preserving it |
| `d-signal="event: expr"` | Inside Cell | Attaches event listener(s); updates cell state |
| `d-text="expr"` | Inside Cell | Reactively binds `textContent` to an expression |
| `d-show="expr"` | Inside Cell | Toggles `display: none` based on boolean expression |
| `d-attr="attr: expr"` | Inside Cell | Reactively sets an HTML attribute |
| `d-attr="class.name: expr"` | Inside Cell | Reactively toggles a CSS class |
| `d-pulse="type"` | Any | Declares a server interaction trigger |
| `d-target="#selector"` | Pulse element | Target Surface selector for the response |
| `d-action="/url"` | Pulse element | Server endpoint for `action` pulse |
| `d-swap="mode"` | Surface or Pulse | Swap strategy override |
| `d-auto-refresh="ms"` | Any | Polls the server every `ms` milliseconds (requires `SurfAutoRefresh` plugin) |
| `d-auto-refresh-url="/url"` | Auto-refresh | URL to poll (defaults to `window.location.href`) |
| `d-input="/url"` | Form input | Triggers a debounced pulse on input (requires `SurfDebounce` plugin) |
| `d-debounce="ms"` | `d-input` element | Debounce wait time in milliseconds |
| `d-drag-zone="group"` | Any | Marks a drag-and-drop container (requires `SurfDragAndDrop` plugin) |
| `d-drag-url="/url"` | Drag zone | Server endpoint called after reorder |
| `d-drag-handle` | Inside drag zone | Element that acts as the drag handle |

---

## Signal Expressions

Signal expressions are evaluated within the context of the parent Cell's state. They are **not** full JavaScript; they are a safe, limited expression language.

### Supported Expression Types

#### State Access

```html
<!-- Read a property -->
<span d-text="count"></span>

<!-- Read a nested property -->
<span d-text="user.name"></span>
```

#### Literals

```html
<!-- String -->
d-signal="click: status = 'active'"

<!-- Number -->
d-signal="click: count = 0"

<!-- Boolean -->
d-signal="click: open = true"
d-signal="click: open = false"
```

#### Boolean Toggle

```html
d-signal="click: open = !open"
```

#### Arithmetic

```html
<!-- Increment -->
d-signal="click: count = count + 1"

<!-- Decrement -->
d-signal="click: count = count - 1"

<!-- Clamp to minimum (0) -->
d-signal="click: count = Math.max(count - 1, 0)"

<!-- Clamp to maximum (10) -->
d-signal="click: count = Math.min(count + 1, 10)"
```

#### Comparisons (for `d-show` / `d-attr`)

```html
<!-- Equality -->
<div d-show="status == 'active'"></div>

<!-- Inequality -->
<div d-show="status != 'idle'"></div>

<!-- Negation -->
<div d-show="!loading"></div>

<!-- Greater than -->
<div d-show="count > 0"></div>

<!-- Less than -->
<div d-show="count < 10"></div>
```

#### Property Copy

```html
d-signal="click: selected = id"
```

#### Reset Form

```html
<!-- Resets the closest ancestor <form> (deferred so Pulse reads data first) -->
<form d-pulse="commit" d-signal="submit: reset">
  <input name="msg" />
</form>
```

#### Submit Form

```html
<!-- Programmatically submit the closest ancestor <form> -->
<button d-signal="click: submit">Save</button>
```

#### Native DOM Methods (`this.method()`)

Call native DOM methods on the element itself:

```html
<!-- Select all text in input on focus -->
<input d-signal="focus: this.select()" />

<!-- Play video on hover -->
<video d-signal="mouseenter: this.play(); mouseleave: this.pause()"></video>
```

#### Module Methods

Call methods on registered modules:

```html
<!-- Built-in: Pulse module -->
<button d-signal="click: Pulse.go('/page', { target: '#main' })">Navigate</button>

<!-- Custom registered module -->
<button d-signal="click: MyModule.doSomething()">Action</button>
```

### `d-attr` Examples

```html
<!-- Disable button while loading -->
<button d-attr="disabled: loading">Submit</button>

<!-- Toggle active class -->
<div d-attr="class.active: isActive"></div>

<!-- Multiple bindings -->
<input d-attr="disabled: loading; class.error: hasError" />

<!-- Dynamic href -->
<a d-attr="href: url">Link</a>
```

---

## Plugins

Surf has a lightweight plugin system. Plugins are loaded after the core script.

### Installing a Plugin

#### Script tag (CDN)

```html
<script src="/dist/surf.min.js"></script>
<script src="/dist/plugins/clipboard.js"></script>
<script>
  Surf.use(SurfClipboard);
</script>
```

#### ES module

```javascript
import Surf from './surf.js';
import DragAndDrop from './plugins/drag-and-drop.js';

Surf.use(DragAndDrop);
// With options:
Surf.use(SurfTopLoader, { color: '#29d', height: '3px' });
```

Duplicate plugin installation is automatically prevented (keyed by plugin name).

---

### Clipboard Plugin (`SurfClipboard`)

Copy text or element content to the clipboard. Automatically shows a "Copied!" state.

```html
<script src="/dist/plugins/clipboard.js"></script>
<script>Surf.use(SurfClipboard);</script>
```

```html
<!-- Copy the text content of a sibling/parent element -->
<button d-signal="click: Clipboard.copy(event)">Copy</button>

<!-- Copy a specific value -->
<button d-signal="click: Clipboard.copy(event)" data-copy="text to copy">Copy</button>
```

---

### Top Loader Plugin (`SurfTopLoader`)

Displays a slim YouTube-style progress bar at the top of the page during every Pulse request.

```javascript
Surf.use(SurfTopLoader, {
  color: '#29d',      // Bar color (default: '#29d')
  height: '3px',     // Bar height (default: '3px')
});
```

No HTML attributes required. Works automatically on `pulse:start` / `pulse:end` events.

---

### Visual Debugger Plugin (`SurfDebug`)

A developer overlay showing Cell states, Surface boundaries, and Signal bindings in real-time.

```javascript
Surf.use(SurfDebug);
```

Activate by pressing **Shift + D** in the browser. Useful during development.

---

### Auto-Refresh Plugin (`SurfAutoRefresh`)

Automatically polls the server and updates a Surface at a regular interval.

```javascript
Surf.use(SurfAutoRefresh);
```

```html
<!-- Refresh #stats every 5 seconds -->
<div d-auto-refresh="5000" d-auto-refresh-url="/api/stats">
  <!-- Content updated automatically -->
</div>

<!-- Refresh current URL every 10 seconds -->
<div d-auto-refresh="10000">
  <!-- Uses window.location.href by default -->
</div>
```

---

### Debounce Plugin (`SurfDebounce`)

Replaces `d-pulse` on inputs to trigger debounced server requests while the user types.

```javascript
Surf.use(SurfDebounce);
```

```html
<!-- Trigger GET /search?q=... 300ms after typing stops, update #results -->
<input
  d-input="/search"
  d-debounce="300"
  d-target="#results"
  name="q"
/>
```

---

### Drag and Drop Plugin (`SurfDragAndDrop`)

Enable drag-and-drop reordering within a zone, with server notification after reorder.

```javascript
Surf.use(SurfDragAndDrop);
```

```html
<ul d-drag-zone="tasks" d-drag-url="/api/tasks/reorder">
  <li data-id="1">
    <span d-drag-handle>⠿</span>
    Task One
  </li>
  <li data-id="2">
    <span d-drag-handle>⠿</span>
    Task Two
  </li>
</ul>
```

After a user reorders items, a POST is sent to `d-drag-url` with the new order as JSON.

---

## JavaScript API

The global `Surf` object exposes a public API for programmatic control.

### Navigation

```javascript
// Navigate to URL (GET), replace #main
Surf.go('/page', { target: '#main' });

// Navigate replacing the entire page
Surf.go('/dashboard');

// With swap strategy
Surf.go('/more-items', { target: '#list', swap: 'append' });
```

### Refresh

```javascript
// Re-fetch current URL and replace #content
Surf.refresh('#content');
```

### State Management

```javascript
// Get current state of a cell
const state = Surf.getState('#my-cell');
// or with element reference:
const state = Surf.getState(myElement);

// Set (merge) state into a cell and update bindings
Surf.setState('#my-cell', { count: 10 });
Surf.setState('#my-cell', { open: true, label: 'Done' });
```

### Applying Patches Manually

```javascript
// Apply a <d-patch> HTML string directly (no fetch)
Surf.applyPatch('<d-patch><surface target="#toast"><p>Hello!</p></surface></d-patch>');
```

### Events

```javascript
// Subscribe
Surf.on('pulse:start', ({ url, target }) => {
  console.log('Loading:', url, '->', target);
});

Surf.on('pulse:end', ({ url, status, body }) => {
  console.log('Done:', status);
});

Surf.on('pulse:error', ({ url, error }) => {
  console.error('Failed:', error);
});

Surf.on('cell:change', ({ element, state, cellId }) => {
  console.log('Cell state changed:', cellId, state);
});

Surf.on('cell:init', ({ element, state, cellId }) => {
  console.log('Cell initialised:', cellId);
});

Surf.on('signal:update', ({ cellElement }) => {
  // Called after reactive bindings are updated
});

Surf.on('echo:before', ({ surface, snapshot }) => {
  // Before a surface is patched
});

Surf.on('echo:after', ({ surface }) => {
  // After a surface is patched and cells are restored
});

// Unsubscribe
Surf.off('pulse:end', myHandler);

// Emit a custom event
Surf.emit('my:event', { data: 'payload' });
```

### Module Registration

Register a custom module so its methods can be called from Signal expressions:

```javascript
Surf.register('MyHelper', {
  format(value) {
    return value.toUpperCase();
  },
  toggle(element) {
    element.classList.toggle('active');
  }
});
```

```html
<!-- In HTML -->
<button d-signal="click: MyHelper.toggle(this)">Toggle</button>
```

### Form Submission

```javascript
// Programmatically submit a form (respects d-pulse="commit" if present)
Surf.submit(formElement);

// Commit form data to a target
Surf.commit(formElement, '#result-surface');
```

### Plugin Installation

```javascript
// Install a plugin (with optional config)
Surf.use(MyPlugin, { option: 'value' });

// Inspect installed plugins
console.log(Surf.plugins); // Array of { name, plugin, options }
```

### Core Module Access (for plugin authors)

```javascript
// Core modules are exposed for advanced integrations
Surf.Surface  // DOM replacement logic
Surf.Cell     // State management
Surf.Signal   // Reactive bindings
Surf.Pulse    // Server interaction
Surf.Patch    // Patch parsing
Surf.Echo     // State preservation
```

---

## Events

All Surf events are dispatched through the internal `Events` bus (not the DOM). Subscribe with `Surf.on()`.

| Event | Payload | Description |
|-------|---------|-------------|
| `pulse:start` | `{ url, options, target }` | Fires before a fetch request |
| `pulse:end` | `{ url, target, status, statusText, headers, body }` | Fires after a successful fetch |
| `pulse:error` | `{ url, target, error }` | Fires on fetch error |
| `cell:init` | `{ element, state, cellId }` | Fires when a cell is initialised |
| `cell:change` | `{ element, state, cellId }` | Fires when cell state changes |
| `cell:warn` | `{ cell, message, type }` | Fires on non-fatal cell warnings (e.g. missing `d-id`) |
| `signal:update` | `{ cellElement }` | Fires after reactive bindings are updated |
| `echo:before` | `{ surface, snapshot }` | Fires before a surface is replaced |
| `echo:after` | `{ surface }` | Fires after a surface is replaced and state restored |

---

## Server-Side Integration

SURF is backend-agnostic. The server must:

1. Detect Surf requests via the `X-Surf-Request: true` header.
2. Return partial HTML (not a full page) for surface updates, or a `<d-patch>` for multiple surfaces.
3. Set `Content-Type: text/html`.

### Request Detection

```
GET /page HTTP/1.1
Accept: text/html
X-Surf-Request: true
```

### Minimal Server Response (partial HTML)

```html
<!-- Server returns only the partial content, not a full HTML document -->
<article>
  <h2>Hello World</h2>
  <p>Server-rendered HTML</p>
</article>
```

### Multi-Surface Response (`<d-patch>`)

```html
<d-patch>
  <surface target="#main">
    <p>Main content updated.</p>
  </surface>
  <surface target="#sidebar">
    <p>Sidebar also updated.</p>
  </surface>
</d-patch>
```

### Full Page Navigation

If the Pulse does not have a `d-target`, Surf replaces the entire HTML document (similar to full-page navigation, but without a browser reload). The server should return a full HTML document in this case. Surf intelligently diffs the `<head>` to avoid CSS flicker.

---

## Patterns & Examples

### Counter

```html
<div d-cell="{ count: 0 }" d-id="counter">
  <span d-text="count">0</span>
  <button d-signal="click: count = count + 1">+</button>
  <button d-signal="click: count = Math.max(count - 1, 0)">-</button>
</div>
```

### Toggle / Accordion

```html
<div d-cell="{ open: false }" d-id="accordion">
  <button d-signal="click: open = !open">Toggle</button>
  <div d-show="open">
    <p>Hidden content revealed on toggle.</p>
  </div>
</div>
```

### Tabs

```html
<div d-cell="{ tab: 'home' }" d-id="tabs">
  <nav>
    <button d-signal="click: tab = 'home'" d-attr="class.active: tab == 'home'">Home</button>
    <button d-signal="click: tab = 'profile'" d-attr="class.active: tab == 'profile'">Profile</button>
  </nav>
  <div d-show="tab == 'home'"><p>Home tab content</p></div>
  <div d-show="tab == 'profile'"><p>Profile tab content</p></div>
</div>
```

### Form with Loading State

```html
<div d-cell="{ loading: false }" d-id="form-wrapper">
  <form
    d-pulse="commit"
    d-target="#result"
    action="/api/submit"
    d-signal="submit: loading = true"
  >
    <input name="email" type="email" required />
    <button type="submit" d-attr="disabled: loading">
      <span d-show="!loading">Submit</span>
      <span d-show="loading">Submitting...</span>
    </button>
  </form>
  <div id="result"></div>
</div>
```

### Live Search

```html
<!-- Requires SurfDebounce plugin -->
<div>
  <input
    d-input="/api/search"
    d-debounce="300"
    d-target="#results"
    name="q"
    placeholder="Search..."
    type="search"
  />
  <div id="results"></div>
</div>
```

### SPA-style Navigation

```html
<nav>
  <a href="/" d-pulse="navigate" d-target="#app">Home</a>
  <a href="/about" d-pulse="navigate" d-target="#app">About</a>
  <a href="/contact" d-pulse="navigate" d-target="#app">Contact</a>
</nav>

<main id="app">
  <!-- Content replaced on navigation, browser URL is updated -->
</main>
```

Back/forward browser buttons work automatically.

### Like / Action Button

```html
<div d-cell="{ liked: false }" d-id="post-42">
  <button
    d-pulse="action"
    d-action="/api/posts/42/like"
    d-target="#post-42"
    d-signal="click: liked = !liked"
    d-attr="class.liked: liked"
    data-id="42"
  >
    <span d-show="!liked">♡ Like</span>
    <span d-show="liked">♥ Liked</span>
  </button>
</div>
```

### Kanban Board (Drag and Drop)

```html
<!-- Requires SurfDragAndDrop plugin -->
<div class="columns">
  <div d-drag-zone="kanban" d-drag-url="/api/kanban/reorder" data-column="todo">
    <div data-id="1"><span d-drag-handle>⠿</span> Task 1</div>
    <div data-id="2"><span d-drag-handle>⠿</span> Task 2</div>
  </div>
</div>
```

### Custom Module Integration

```javascript
// Register a module once (e.g., in app.js)
Surf.register('Toast', {
  show(message) {
    Surf.applyPatch(
      `<d-patch><surface target="#toast"><div class="toast">${message}</div></surface></d-patch>`
    );
  }
});
```

```html
<!-- Use from any signal -->
<button d-signal="click: Toast.show('Saved!')">Save</button>
```

### Writing a Plugin

```javascript
const MyPlugin = {
  name: 'MyPlugin',
  install(Surf, options = {}) {
    // Access core modules via Surf.Surface, Surf.Cell, etc.
    Surf.on('pulse:start', () => {
      document.body.classList.add('loading');
    });
    Surf.on('pulse:end', () => {
      document.body.classList.remove('loading');
    });
    Surf.on('pulse:error', () => {
      document.body.classList.remove('loading');
    });
  }
};

Surf.use(MyPlugin, { /* options */ });
```

---

## Architecture

### Module Overview

```
surf.js          — Public API singleton. Assembles all modules. Auto-initialises.
surface.js       — DOM replacement: replace, append, prepend, remove. Smart <head> diffing.
cell.js          — State management: init, getState, setState, snapshot, restore.
signal.js        — Reactive bindings: d-signal, d-text, d-show, d-attr. Expression evaluator.
pulse.js         — Server interaction: navigate, commit, action, refresh. Fetch + history API.
patch.js         — Patch parsing: parse <d-patch> responses, isPatch(), create().
echo.js          — State preservation: before/after surface replacement. Calls Cell.snapshot + restore.
events.js        — Internal pub/sub event bus used by all modules.
```

### Plugin Files

```
plugins/clipboard.js       — SurfClipboard
plugins/top-loader.js      — SurfTopLoader
plugins/debug-plugin.js    — SurfDebug (+ debug-plugin.css)
plugins/auto-refresh.js    — SurfAutoRefresh
plugins/debounce.js        — SurfDebounce
plugins/drag-and-drop.js   — SurfDragAndDrop
```

### Request / Response Lifecycle

```
User interaction
  → Pulse (d-pulse attribute or Surf.go())
    → fetch(url, { X-Surf-Request: true })
      → pulse:start event
      → Server returns HTML or <d-patch>
      → Echo.before() — snapshot Cell states
      → Surface.replace() / append() / prepend()
      → Echo.after() — restore Cell states, re-init Cells & Signals
      → pulse:end event
```

### State Preservation (Echo) Lifecycle

```
Surface about to be replaced
  → Signal.cleanup(surface)         — remove old event listeners
  → Cell.snapshot(surface)          — capture all Cell states by d-id
    ↓
  Surface is replaced with new HTML
    ↓
  → Cell.restore(snapshot)          — write states into cellIdStates map
  → Cell.initAll(surface)           — init cells, restoring from map if d-id matches
  → Signal.initAll(surface)         — bind signals, update reactive bindings
```

### Expression Evaluator (Signal)

Expressions in `d-signal`, `d-text`, `d-show`, `d-attr` are evaluated by a custom, sandboxed mini-evaluator (not `eval`). Supported operations:

- Literals: `true`, `false`, `null`, numbers, quoted strings
- Property read: `count`, `user.name`
- Boolean negation: `!open`
- Toggle: `open = !open`
- Arithmetic: `count + 1`, `count - 1`, `Math.max(...)`, `Math.min(...)`
- Comparison: `==`, `===`, `!=`, `!==`, `>`, `<`
- Assignment: `prop = value`
- Module calls: `ModuleName.method(args)`
- Native calls: `this.method()`, `event.method()`
- Commands: `reset`, `submit`

---

*This document covers SURF v0.3.2. Generated for LLM consumption.*
