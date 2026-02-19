/**
 * Surf Visual Debugger Plugin
 *
 * Shift + D to toggle.
 */

import cssText from './debug-plugin.css';

// Polyfill CSS.escape for test environments (JSDOM)
if (typeof window !== 'undefined' && !window.CSS) {
  window.CSS = {
    escape: (s) => s.replace(/([^\w-])/g, '\\$1'),
  };
}

export const VisualDebugger = {
  name: 'VisualDebugger',

  install(Surf) {
    // Prevent multiple keydown listeners
    if (window.__SURF_DEBUG_INSTALLED__) return;
    window.__SURF_DEBUG_INSTALLED__ = true;

    let isActive = false;
    let container = null;
    let panel = null;
    let content = null;
    let overlay = null;
    let shadow = null;
    let fab = null;

    // Internal logs
    const logs = [];
    let activePulse = null;
    const collapsedSections = new Set();
    const editingCells = new Set();
    const logElements = new Map();

    const toggle = () => {
      isActive = !isActive;
      if (!container) initUI();

      if (isActive) {
        panel.classList.add('active');
        document.body.style.overflow = 'hidden';
        refreshAll();
      } else {
        panel.classList.remove('active');
        document.body.style.overflow = '';
      }
    };

    const highlightElement = (el) => {
      if (!el) return;
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          el.classList.remove('surf-highlight-signal');
          void el.offsetWidth;
          el.classList.add('surf-highlight-signal');
          setTimeout(() => el.classList.remove('surf-highlight-signal'), 2000);
        }, 600);
      } catch (err) {
        console.error('[Surf] Highlight error:', err);
      }
    };

    const highlightCell = (cellId) => {
      try {
        const safeId = CSS.escape(cellId);
        let el = document.querySelector(`[d-id="${safeId}"]`) || document.getElementById(cellId);
        if (!el) el = document.querySelector(`[d-cell][d-id="${safeId}"]`);

        if (!el) {
          addLog('warn', `Cell not found: ${cellId}`, {
            description: `The search for cell ID "${cellId}" in the document returned no results.`,
            action: `1. Check if "d-id='${cellId}'" exists.\n2. Verify if it was removed from DOM.`,
          });
          return;
        }
        highlightElement(el);
      } catch (err) {
        console.error('[Surf] Target error:', err);
        addLog('error', `Failed to target cell: ${cellId}`);
      }
    };

    const initUI = () => {
      if (document.getElementById('surf-debugger-host')) {
        if (!container) {
          container = document.getElementById('surf-debugger-host');
          shadow = container.shadowRoot;
          const wrapper = shadow.querySelector('.surf-debug-wrapper');
          overlay = wrapper.querySelector('.surf-debug-overlay');
          panel = wrapper.querySelector('.surf-debug-panel');
          fab = wrapper.querySelector('.surf-debug-fab');
          content = panel.querySelector('.surf-debug-content');
        }
        return;
      }

      container = document.createElement('div');
      container.id = 'surf-debugger-host';
      shadow = container.attachShadow({ mode: 'open' });

      const style = document.createElement('style');
      style.textContent = cssText;
      shadow.appendChild(style);

      if (!document.getElementById('surf-debug-flash-style')) {
        const flashStyle = document.createElement('style');
        flashStyle.id = 'surf-debug-flash-style';
        flashStyle.textContent = `
          .surf-highlight-signal {
            outline: 2px solid #38bdf8 !important;
            outline-offset: 2px !important;
            transition: outline 0.2s ease-out;
            z-index: 10000 !important;
          }
        `;
        document.head.appendChild(flashStyle);
      }

      const wrapper = document.createElement('div');
      wrapper.className = 'surf-debug-wrapper';
      shadow.appendChild(wrapper);

      overlay = document.createElement('div');
      overlay.className = 'surf-debug-overlay';
      wrapper.appendChild(overlay);

      panel = document.createElement('div');
      panel.className = 'surf-debug-panel';
      panel.innerHTML = `
        <div class="surf-debug-header">
          <h3>Surf Visual Debugger</h3>
          <span style="font-size: 10px; color: #64748b;">v${Surf.version}</span>
        </div>
        <div class="surf-debug-content"></div>
      `;
      wrapper.appendChild(panel);

      fab = document.createElement('div');
      fab.className = 'surf-debug-fab';
      fab.innerHTML = `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41M12 7a5 5 0 100 10 5 5 0 000-10z"/>
        </svg>
      `;
      fab.onclick = (e) => {
        e.stopPropagation();
        toggle();
      };
      wrapper.appendChild(fab);
      content = panel.querySelector('.surf-debug-content');

      document.body.appendChild(container);
      setupInteractions();

      shadow.addEventListener('surf-debug-clear', (e) => {
        e.stopPropagation();
        logs.length = 0;
        logElements.clear();
        refreshAll();
      });

      shadow.addEventListener('surf-debug-target', (e) => {
        e.stopPropagation();
        if (e.detail.type === 'cell') {
          highlightCell(e.detail.id);
        } else if (e.detail.type === 'log') {
          const el = logElements.get(e.detail.id);
          if (el) highlightElement(el);
        }
      });

      shadow.addEventListener('surf-debug-edit', (e) => {
        e.stopPropagation();
        editingCells.add(e.detail);
        refreshAll();
      });

      shadow.addEventListener('surf-debug-cancel', (e) => {
        e.stopPropagation();
        editingCells.delete(e.detail);
        refreshAll();
      });

      shadow.addEventListener('surf-debug-save', (e) => {
        e.stopPropagation();
        const item = shadow.querySelector(`.cell-item[data-cell-id="${e.detail}"]`);
        if (item) saveCellState(e.detail, item);
      });

      shadow.addEventListener('click', (e) => {
        const toggleBtn = e.target.closest('.log-toggle');
        if (toggleBtn) {
          const logItem = toggleBtn.closest('.timeline-item');
          logItem.classList.toggle('expanded');
          return;
        }

        const sectionHeader = e.target.closest('.section-header');
        if (sectionHeader) {
          const sectionId = sectionHeader.getAttribute('data-section');
          if (collapsedSections.has(sectionId)) {
            collapsedSections.delete(sectionId);
          } else {
            collapsedSections.add(sectionId);
          }
          refreshAll();
          return;
        }

        const targetBtn = e.target.closest('.target-btn');
        if (targetBtn) {
          const cellId = targetBtn.dataset.detail;
          const logId = targetBtn.dataset.logId;
          if (cellId) {
            shadow.dispatchEvent(
              new CustomEvent('surf-debug-target', {
                bubbles: true,
                composed: true,
                detail: { type: 'cell', id: cellId },
              })
            );
          } else if (logId) {
            shadow.dispatchEvent(
              new CustomEvent('surf-debug-target', {
                bubbles: true,
                composed: true,
                detail: { type: 'log', id: logId },
              })
            );
          }
          return;
        }

        const actionBtn = e.target.closest('[data-action]');
        if (actionBtn) {
          const action = actionBtn.dataset.action;
          const id = actionBtn.dataset.id;
          if (action === 'edit') {
            shadow.dispatchEvent(
              new CustomEvent('surf-debug-edit', { bubbles: true, composed: true, detail: id })
            );
          } else if (action === 'save') {
            shadow.dispatchEvent(
              new CustomEvent('surf-debug-save', { bubbles: true, composed: true, detail: id })
            );
          }
          return;
        }

        const cancelBtn = e.target.closest('.cancel-btn');
        if (cancelBtn) {
          const id = cancelBtn.dataset.id;
          shadow.dispatchEvent(
            new CustomEvent('surf-debug-cancel', { bubbles: true, composed: true, detail: id })
          );
          return;
        }
      });
    };

    const saveCellState = (cellId, containerEl) => {
      try {
        const inputs = containerEl.querySelectorAll('.cell-edit-input');
        const originalState = Surf.Cell._cellIdStates.get(cellId) || {};
        const newState = {};

        inputs.forEach((input) => {
          const key = input.dataset.key;
          let value = input.value;
          const originalValue = originalState[key];

          if (typeof originalValue === 'number') {
            value = Number(value);
          } else if (typeof originalValue === 'boolean') {
            value = value === 'true';
          }
          newState[key] = value;
        });

        const safeId = CSS.escape(cellId);
        const el = document.querySelector(`[d-cell][d-id="${safeId}"], [d-cell]#${safeId}`);
        if (!el) {
          addLog('error', `Cannot save: Cell ${cellId} not found in DOM`);
          return;
        }

        Surf.setState(el, newState);
        editingCells.delete(cellId);
        refreshAll();
        highlightCell(cellId);
        addLog('debug', `Updated cell: ${cellId}`);
      } catch (err) {
        console.error('[Surf] Edit error:', err);
        addLog('error', `Failed to save cell: ${cellId}`);
      }
    };

    const escapeHtml = (str) => {
      if (!str || typeof str !== 'string') return str;
      return str.replace(
        /[&<>"']/g,
        (m) =>
          ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
          })[m]
      );
    };

    const addLog = (type, message, detail = null) => {
      const time = new Date().toLocaleTimeString();
      const logId = Math.random().toString(36).slice(2);

      const log = {
        type,
        message,
        time,
        detail: detail || {},
        id: logId,
        steps: [],
        completed: false,
      };

      if (detail?.cell) {
        logElements.set(logId, detail.cell);
      }

      if (type === 'warn' || type === 'error' || type === 'cell:warn' || type === 'pulse:error') {
        const origin = detail?.cellId || detail?.url || '';
        const index = logs.findIndex(
          (l) =>
            l.type === type &&
            l.message === message &&
            (l.detail?.cellId || l.detail?.url || '') === origin
        );
        if (index !== -1) {
          const removed = logs.splice(index, 1)[0];
          logElements.delete(removed.id);
        }
      }

      if (type === 'pulse:start') {
        activePulse = log;
        logs.unshift(log);
      } else if (
        activePulse &&
        (type === 'pulse:end' || type === 'pulse:error' || type.startsWith('echo:'))
      ) {
        activePulse.steps.push({ type, message, time });
        if (type === 'pulse:end' || type === 'pulse:error') {
          activePulse.status = detail?.status;
          activePulse.completed = true;
          Object.assign(activePulse.detail, detail);
          activePulse = null;
        }
      } else {
        logs.unshift(log);
      }

      if (isActive) refreshAll();
      return log;
    };

    const refreshAll = () => {
      if (!isActive) return;

      const states = Surf.Cell._cellIdStates;
      const warningLogs = logs.filter(
        (l) =>
          l.type === 'warn' ||
          l.type === 'error' ||
          l.type === 'cell:warn' ||
          l.type === 'pulse:error'
      );

      let html = '';

      const allCells = Array.from(document.querySelectorAll('[d-cell]'));
      
      html += renderSection(
        'Active Cells',
        'cells',
        allCells.length,
        () => {
          let cellsHtml = '';
          if (allCells.length === 0) {
            cellsHtml =
              '<div style="padding: 8px; font-size: 11px; opacity: 0.5;">No cells found in DOM.</div>';
          } else {
            allCells.forEach((el) => {
              const id = el.getAttribute('d-id') || el.id || `anon-${el.tagName.toLowerCase()}`;
              const state = Surf.getState(el);
              const isEditing = editingCells.has(id);
              cellsHtml += `
              <div class="cell-item ${isEditing ? 'editing' : ''}" data-cell-id="${id}">
                <div class="cell-header">
                  <div class="cell-id">#${id}</div>
                  <div class="cell-actions">
                    <button class="target-btn" data-detail="${id}">Target</button>
                    <button class="${isEditing ? 'save-btn' : 'edit-btn'}" data-action="${isEditing ? 'save' : 'edit'}" data-id="${id}">${isEditing ? 'Save' : 'Edit'}</button>
                    ${isEditing ? `<button class="cancel-btn" data-id="${id}">Cancel</button>` : ''}
                  </div>
                </div>
                ${isEditing ? renderCellEditor(id, state) : `<div class="cell-state">${JSON.stringify(state, null, 2)}</div>`}
              </div>`;
            });
          }
          return cellsHtml;
        },
        '',
        'cells-section'
      );

      // 2. Warns & Errors Section
      const errorCount = warningLogs.filter(
        (l) => l.type === 'error' || l.type === 'pulse:error'
      ).length;
      const badgeClass = errorCount > 0 ? 'error' : warningLogs.length > 0 ? 'warn' : '';

      html += renderSection(
        'Warns & Errors',
        'warnings',
        warningLogs.length,
        () => {
          if (warningLogs.length === 0) {
            return '<div style="padding: 8px; font-size: 11px; opacity: 0.5;">No warnings or errors.</div>';
          }
          return warningLogs.map((log) => renderLogItem(log)).join('');
        },
        badgeClass,
        'warnings-section'
      );

      // 3. Timeline Section
      const timelineLogs = logs.filter(
        (l) =>
          l.type !== 'warn' &&
          l.type !== 'error' &&
          l.type !== 'cell:warn' &&
          l.type !== 'pulse:error'
      );
      html += renderSection(
        'Timeline',
        'timeline',
        timelineLogs.length,
        () => {
          if (timelineLogs.length === 0) {
            return '<div style="padding: 8px; font-size: 11px; opacity: 0.5;">No activity yet.</div>';
          }
          return `
          <div style="display:flex; justify-content:flex-end; padding: 4px;">
            <button class="clear-btn">Clear</button>
          </div>
          ${timelineLogs.map((log) => renderLogItem(log)).join('')}
        `;
        },
        '',
        'timeline-section'
      );

      content.innerHTML = html;

      // Re-bind clear button (easier than delegated for this one-off)
      const clearBtn = shadow.querySelector('.clear-btn');
      if (clearBtn) {
        clearBtn.onclick = () => {
          shadow.dispatchEvent(
            new CustomEvent('surf-debug-clear', { bubbles: true, composed: true })
          );
        };
      }
    };

    const renderSection = (title, id, count, contentFn, badgeTheme = '', extraClass = '') => {
      const isCollapsed = collapsedSections.has(id);
      return `
        <div class="section-header ${isCollapsed ? 'collapsed' : ''}" data-section="${id}">
          <div class="section-title">
            <svg class="chevron" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
            ${title}
          </div>
          <span class="count-badge ${badgeTheme}">${count}</span>
        </div>
        <div class="section-content ${extraClass}">
          ${isCollapsed ? '' : contentFn()}
        </div>
      `;
    };

    const renderCellEditor = (id, state) => {
      let editorHtml = '<div class="cell-edit-fields">';
      Object.entries(state).forEach(([key, val]) => {
        const type = typeof val;
        editorHtml += `
          <div class="cell-edit-row">
            <div class="cell-edit-key">${key}</div>
            ${
              type === 'boolean'
                ? `<select class="cell-edit-input" data-key="${key}">
                  <option value="true" ${val ? 'selected' : ''}>true</option>
                  <option value="false" ${!val ? 'selected' : ''}>false</option>
                </select>`
                : `<input type="${type === 'number' ? 'number' : 'text'}" class="cell-edit-input" data-key="${key}" value="${val}">`
            }
          </div>`;
      });
      editorHtml += '</div>';
      return editorHtml;
    };

    const renderLogItem = (log) => {
      const isError = log.type === 'error' || log.type === 'pulse:error';
      const isWarn = log.type === 'warn' || log.type === 'cell:warn';
      const logClass = log.type.replace(':', '-');
      const hasDetail = log.detail && (Object.keys(log.detail).length > 0 || log.steps.length > 0);
      const canTarget = logElements.has(log.id);

      return `
        <div class="timeline-item ${logClass} ${isError ? 'error' : ''} ${isWarn ? 'warn' : ''}" data-id="${log.id}">
          <div class="log-main">
            <span class="time">${log.time}</span>
            <span class="step-type" style="font-size: 9px; min-width: 35px;">${log.type.includes(':') ? log.type.split(':')[0] : log.type}</span>
            <span class="log-msg ${isError ? 'error-msg' : ''}">${log.message}</span>
            <div class="log-actions">
              ${canTarget ? `<button class="target-btn" data-log-id="${log.id}">Target</button>` : ''}
              ${hasDetail ? '<button class="log-toggle">Detail</button>' : ''}
            </div>
          </div>
          <div class="log-detail">
            ${
              log.steps.length > 0
                ? `
              <div class="log-steps">
                ${log.steps
                  .map((step) => {
                    const isStepError = step.type.includes('error');
                    return `
                    <div class="log-step ${isStepError ? 'error' : ''}">
                      <span class="step-type" style="${isStepError ? 'color: #ef4444; font-weight: bold;' : ''}">
                        ${step.type.includes(':') ? step.type.split(':')[1] || step.type : step.type}
                      </span>
                      <span class="step-msg">${step.message}</span>
                    </div>
                  `;
                  })
                  .join('')}
              </div>
            `
                : ''
            }
            ${renderTimelineDetail(log)}
          </div>
        </div>
      `;
    };

    const renderTimelineDetail = (log) => {
      let detailHtml = '';
      if (log.detail.action || log.detail.description) {
        detailHtml += `
          <div class="detail-section warning-details ${log.detail.action ? 'action-section' : ''}">
            ${log.detail.description ? `<div class="description-text">${escapeHtml(log.detail.description)}</div>` : ''}
            ${
              log.detail.action
                ? `
              <strong>Recommended Action:</strong>
              <div class="action-box">${escapeHtml(log.detail.action).replace(/\n/g, '<br>')}</div>
            `
                : ''
            }
          </div>
        `;
      }

      if (log.detail.options) {
        detailHtml += `
          <div class="detail-section">
            <strong>Request:</strong>
            <div class="detail-row"><span>Method:</span> <span>${log.detail.options.method}</span></div>
            <div class="detail-row"><span>URL:</span> <span>${log.detail.url}</span></div>
            ${log.detail.options.headers ? `<div><span>Headers:</span> <pre>${JSON.stringify(log.detail.options.headers, null, 2)}</pre></div>` : ''}
            ${log.detail.options.body ? `<div><span>Body:</span> <pre>${escapeHtml(log.detail.options.body)}</pre></div>` : ''}
          </div>
        `;
      }

      if (log.detail.status || (log.detail.body && log.detail.body !== '')) {
        detailHtml += `
          <div class="detail-section">
            <strong>Response:</strong>
            <div class="detail-row"><span>Status:</span> <span>${log.detail.status || ''} ${log.detail.statusText || ''}</span></div>
            ${log.detail.headers ? `<div><span>Headers:</span> <pre>${JSON.stringify(log.detail.headers, null, 2)}</pre></div>` : ''}
            ${log.detail.body ? `<div><span>Body:</span> <pre>${escapeHtml(log.detail.body)}</pre></div>` : ''}
          </div>
        `;
      }

      if (log.detail.error) {
        detailHtml += `<div class="error-msg"><strong>Error:</strong> ${log.detail.error.message || log.detail.error}</div>`;
      }

      return detailHtml;
    };

    const drawBoundaries = () => {
      if (!isActive) return;
      overlay.innerHTML = '';
      const surfaces = document.querySelectorAll('[d-cell], [d-surface]');
      surfaces.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const boundary = document.createElement('div');
        boundary.className = 'surf-boundary';
        boundary.style.cssText = `
          top: ${rect.top + window.scrollY}px;
          left: ${rect.left + window.scrollX}px;
          width: ${rect.width}px;
          height: ${rect.height}px;
        `;
        const labelText = document.createElement('span');
        labelText.className = 'surf-label';
        const type = el.hasAttribute('d-cell') ? 'CELL' : 'SURFACE';
        const id = el.getAttribute('d-id') || el.id || 'anonymous';
        labelText.textContent = `${type}: ${id}`;
        boundary.appendChild(labelText);
        overlay.appendChild(boundary);
      });
    };

    const setupInteractions = () => {
      window.addEventListener('resize', drawBoundaries);
      window.addEventListener('scroll', drawBoundaries);
    };

    Surf.on('cell:init', (detail) => {
      if (isActive) refreshAll();
    });

    Surf.on('cell:change', (detail) => {
      const cellId = detail.cellId || `<${detail.element.tagName.toLowerCase()}>`;
      addLog('cell:change', `Cell ${cellId} updated`);
    });

    Surf.on('signal:update', (detail) => {
      if (!isActive || !detail.cellElement) return;
      const targets = detail.cellElement.querySelectorAll(
        '[d-signal], [d-text], [d-show], [d-attr]'
      );
      targets.forEach((el) => {
        el.classList.remove('surf-highlight-signal');
        void el.offsetWidth;
        el.classList.add('surf-highlight-signal');
        setTimeout(() => el.classList.remove('surf-highlight-signal'), 600);
      });
    });

    Surf.on('pulse:start', (detail) => {
      try {
        const method = detail?.options?.method || 'GET';
        const url = detail?.url || 'unknown';
        const target = detail?.target?.tagName
          ? `${detail.target.tagName}${detail.target.id ? '#' + detail.target.id : ''}`
          : detail?.target || 'body';
        addLog('pulse:start', `${method} ${url} -> ${target}`, detail);
      } catch (e) {
        console.error('[Surf] Debug plugin pulse:start listener error:', e);
      }
    });

    Surf.on('pulse:end', (detail) => {
      try {
        const target = detail?.target?.tagName
          ? `${detail.target.tagName}${detail.target.id ? '#' + detail.target.id : ''}`
          : detail?.target || 'body';
        addLog('pulse:end', `Request completed for ${target}`, detail);
        initUI();
      } catch (e) {
        console.error('[Surf] Debug plugin pulse:end listener error:', e);
      }
    });

    Surf.on('echo:before', (detail) => {
      addLog('echo:before', `Snapshotting surface ${detail.surface.id || 'anonymous'}`);
    });

    Surf.on('echo:after', (detail) => {
      addLog('echo:after', `Restored surface ${detail.surface.id || 'anonymous'}`);
      initUI();
      if (isActive) setTimeout(refreshAll, 100);
    });

    Surf.on('pulse:error', (detail) => {
      addLog('pulse:error', `Request failed: ${detail.error?.message || detail.error}`, detail);
    });

    Surf.on('cell:warn', (detail) => {
      const el = detail.cell || detail.element;
      if (!el) return;

      const cellId = el.getAttribute('d-id') || el.id || 'anonymous';
      const originKey =
        cellId === 'anonymous'
          ? `anon-${el.tagName.toLowerCase()}-${el.innerText?.slice(0, 20).replace(/\s+/g, '_') || Math.random().toString(36).slice(2, 6)}`
          : cellId;

      let action = 'Check component configuration.';
      if (detail.type === 'missing-id') {
        action = `1. Add a unique "d-id" to the <${el.tagName.toLowerCase()}> element.\n2. Example: <${el.tagName.toLowerCase()} d-cell d-id="my-cell-name">`;
      } else if (detail.type === 'orphaned-signal') {
        action = `1. Wrap this element (or a parent) in a "d-cell" attribute.\n2. Example: <div d-cell="{...}"> <${el.tagName.toLowerCase()} d-signal="..."> </div>`;
      }

      addLog('warn', `Framework Warning: ${detail.type}`, {
        cell: el,
        cellId: originKey,
        description: detail.message,
        action: action,
      });
    });

    window.addEventListener('keydown', (e) => {
      if (e.shiftKey && e.key === 'D') {
        e.preventDefault();
        toggle();
      }
    });

    initUI();

    this.__test = {
      reset: () => {
        isActive = false;
        container?.remove();
        container = null;
        logs.length = 0;
        activePulse = null;
        editingCells.clear();
        collapsedSections.clear();
        logElements.clear();
        document.body.style.overflow = '';
        window.__SURF_DEBUG_INSTALLED__ = false;
      },
    };

    console.log('[Surf] Visual Debugger installed. Press Shift + D to toggle.');
  },
};

export default VisualDebugger;
