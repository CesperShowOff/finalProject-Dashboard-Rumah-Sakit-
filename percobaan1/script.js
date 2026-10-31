/**
 * script.js — Task List App
 *
 * Architecture:
 *  - State  : a single `tasks` array of task objects stored in localStorage.
 *  - Render : one `renderTasks()` function re-draws the entire list from state.
 *  - Events : delegated where sensible; direct listeners for form / modal.
 *
 * Task object shape:
 *  { id: string, text: string, completed: boolean, createdAt: number }
 */

'use strict';

/* ════════════════════════════════════════════
   1. STATE
════════════════════════════════════════════ */

/** @type {{ id: string, text: string, completed: boolean, createdAt: number }[]} */
let tasks = [];

/** Currently active filter: 'all' | 'active' | 'completed' */
let currentFilter = 'all';

/** ID of the task being edited (null when modal is closed) */
let editingTaskId = null;

/* ════════════════════════════════════════════
   2. PERSISTENCE (localStorage)
════════════════════════════════════════════ */

const STORAGE_KEY = 'tasklist_tasks';

/** Load tasks from localStorage into the `tasks` array. */
function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    tasks = raw ? JSON.parse(raw) : [];
  } catch {
    tasks = [];
  }
}

/** Save the current `tasks` array to localStorage. */
function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

/* ════════════════════════════════════════════
   3. CRUD OPERATIONS
════════════════════════════════════════════ */

/**
 * Create a new task and add it to the beginning of the list.
 * @param {string} text - Task description
 */
function addTask(text) {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const newTask = {
    id:        crypto.randomUUID(),
    text:      trimmed,
    completed: false,
    createdAt: Date.now(),
  };

  tasks.unshift(newTask); // newest first
  saveTasks();
  return true;
}

/**
 * Toggle the completed state of a task.
 * @param {string} id - Task ID
 */
function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (task) {
    task.completed = !task.completed;
    saveTasks();
  }
}

/**
 * Update the text of an existing task.
 * @param {string} id   - Task ID
 * @param {string} text - New task text
 */
function updateTask(id, text) {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const task = tasks.find(t => t.id === id);
  if (task) {
    task.text = trimmed;
    saveTasks();
  }
  return true;
}

/**
 * Remove a task by ID.
 * @param {string} id - Task ID
 */
function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
}

/** Remove all tasks that are marked completed. */
function clearCompleted() {
  tasks = tasks.filter(t => !t.completed);
  saveTasks();
}

/* ════════════════════════════════════════════
   4. FILTERING
════════════════════════════════════════════ */

/**
 * Return the subset of tasks matching the current filter.
 * @returns {typeof tasks}
 */
function getFilteredTasks() {
  switch (currentFilter) {
    case 'active':    return tasks.filter(t => !t.completed);
    case 'completed': return tasks.filter(t =>  t.completed);
    default:          return tasks;
  }
}

/* ════════════════════════════════════════════
   5. DOM HELPERS
════════════════════════════════════════════ */

/**
 * Build a single <li> element for a task.
 * @param {{ id: string, text: string, completed: boolean }} task
 * @returns {HTMLLIElement}
 */
function createTaskElement(task) {
  const li = document.createElement('li');
  li.className = 'task-item flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 group';
  li.dataset.id = task.id;

  /* ── Checkbox ── */
  const checkbox = document.createElement('input');
  checkbox.type      = 'checkbox';
  checkbox.className = 'task-checkbox';
  checkbox.checked   = task.completed;
  checkbox.setAttribute('aria-label', `Mark "${task.text}" as ${task.completed ? 'active' : 'completed'}`);

  /* ── Task text ── */
  const span = document.createElement('span');
  span.className = `flex-1 text-sm break-words min-w-0 transition-colors duration-200
    ${task.completed ? 'task-text-completed' : 'text-slate-700'}`;
  span.textContent = task.text;

  /* ── Edit button ── */
  const editBtn = document.createElement('button');
  editBtn.className  = 'btn-icon btn-edit opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-150';
  editBtn.dataset.action = 'edit';
  editBtn.setAttribute('aria-label', `Edit task: ${task.text}`);
  editBtn.innerHTML = `
    <svg class="w-4 h-4 text-brand-blueLight" fill="none" stroke="currentColor" stroke-width="2"
         viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round"
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5
           m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
    </svg>`;

  /* ── Delete button ── */
  const deleteBtn = document.createElement('button');
  deleteBtn.className  = 'btn-icon btn-delete opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-150';
  deleteBtn.dataset.action = 'delete';
  deleteBtn.setAttribute('aria-label', `Delete task: ${task.text}`);
  deleteBtn.innerHTML = `
    <svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" stroke-width="2"
         viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7
           m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
    </svg>`;

  li.appendChild(checkbox);
  li.appendChild(span);
  li.appendChild(editBtn);
  li.appendChild(deleteBtn);

  return li;
}

/* ════════════════════════════════════════════
   6. RENDER
════════════════════════════════════════════ */

/** Re-draw the task list and update counter / empty-state. */
function renderTasks() {
  const list       = document.getElementById('task-list');
  const emptyState = document.getElementById('empty-state');
  const counter    = document.getElementById('task-counter');

  const filtered = getFilteredTasks();

  // Clear current list
  list.innerHTML = '';

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');
    filtered.forEach(task => {
      list.appendChild(createTaskElement(task));
    });
  }

  // Update the "X task(s) left" counter (always counts active tasks, not filtered)
  const activeCount = tasks.filter(t => !t.completed).length;
  counter.textContent = `${activeCount} task${activeCount !== 1 ? 's' : ''} left`;
}

/* ════════════════════════════════════════════
   7. MODAL HELPERS
════════════════════════════════════════════ */

/** Open the edit modal pre-filled with the task's current text. */
function openEditModal(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  editingTaskId = taskId;

  const modal     = document.getElementById('edit-modal');
  const editInput = document.getElementById('edit-input');
  const editError = document.getElementById('edit-error');

  editInput.value = task.text;
  editError.classList.add('hidden');

  modal.classList.add('modal-open');   // CSS makes it flex
  editInput.focus();
  editInput.select();
}

/** Close the edit modal and clear editing state. */
function closeEditModal() {
  editingTaskId = null;
  const modal = document.getElementById('edit-modal');
  modal.classList.remove('modal-open');
}

/* ════════════════════════════════════════════
   8. EVENT LISTENERS
════════════════════════════════════════════ */

/** Attach all event listeners once the DOM is ready. */
function initEventListeners() {

  /* ── Add task form ── */
  const taskForm  = document.getElementById('task-form');
  const taskInput = document.getElementById('task-input');
  const formError = document.getElementById('form-error');

  taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = taskInput.value;

    if (!text.trim()) {
      formError.classList.remove('hidden');
      taskInput.focus();
      return;
    }

    formError.classList.add('hidden');
    addTask(text);
    taskInput.value = '';
    renderTasks();
    taskInput.focus();
  });

  // Hide error as soon as the user starts typing again
  taskInput.addEventListener('input', () => {
    formError.classList.add('hidden');
  });

  /* ── Filter buttons ── */
  const filterBtns = document.querySelectorAll('.filter-btn');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      currentFilter = btn.dataset.filter;

      // Update active style
      filterBtns.forEach(b => b.classList.remove('active-filter'));
      btn.classList.add('active-filter');

      renderTasks();
    });
  });

  /* ── Task list — event delegation (toggle / edit / delete) ── */
  const taskList = document.getElementById('task-list');

  taskList.addEventListener('change', (e) => {
    // Checkbox toggle
    if (e.target.matches('.task-checkbox')) {
      const id = e.target.closest('li').dataset.id;
      toggleTask(id);
      renderTasks();
    }
  });

  taskList.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;

    const li = actionBtn.closest('li');
    const id = li.dataset.id;

    if (actionBtn.dataset.action === 'edit') {
      openEditModal(id);
    }

    if (actionBtn.dataset.action === 'delete') {
      // Animate out before removing from state
      li.classList.add('task-item-removing');
      li.addEventListener('animationend', () => {
        deleteTask(id);
        renderTasks();
      }, { once: true });
    }
  });

  /* ── Clear completed ── */
  document.getElementById('clear-completed').addEventListener('click', () => {
    clearCompleted();
    renderTasks();
  });

  /* ── Edit modal: Save ── */
  document.getElementById('edit-save').addEventListener('click', () => {
    const editInput = document.getElementById('edit-input');
    const editError = document.getElementById('edit-error');

    if (!editInput.value.trim()) {
      editError.classList.remove('hidden');
      editInput.focus();
      return;
    }

    editError.classList.add('hidden');
    updateTask(editingTaskId, editInput.value);
    closeEditModal();
    renderTasks();
  });

  /* ── Edit modal: Cancel ── */
  document.getElementById('edit-cancel').addEventListener('click', closeEditModal);

  /* ── Edit modal: close on backdrop click ── */
  document.getElementById('edit-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeEditModal();
  });

  /* ── Edit modal: close on Escape key ── */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeEditModal();
  });

  /* ── Edit input: save on Enter ── */
  document.getElementById('edit-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('edit-save').click();
  });
}

/* ════════════════════════════════════════════
   9. BOOTSTRAP
════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  loadTasks();          // hydrate state from localStorage
  initEventListeners(); // wire up all interactions
  renderTasks();        // draw initial UI
});
