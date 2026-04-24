 (() => {
      "use strict";

      const STORAGE_KEY = "appleTasks.v1";

      const state = {
        tasks: [],
        view: "all",
        search: "",
        sort: "newest",
        editingId: null,
        toastTimer: null
      };

      const $ = (selector, root = document) => root.querySelector(selector);
      const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

      const els = {
        taskList: $("#task-list"),
        pageTitle: $("#page-title"),
        pageSubtitle: $("#page-subtitle"),
        search: $("#search-input"),
        sort: $("#sort-select"),
        openAdd: $("#open-add"),
        backdrop: $("#modal-backdrop"),
        closeModal: $("#close-modal"),
        cancelModal: $("#cancel-modal"),
        form: $("#task-form"),
        titleInput: $("#task-title-input"),
        noteInput: $("#task-note-input"),
        modalTitle: $("#modal-title"),
        saveTask: $("#save-task"),
        toast: $("#toast")
      };

      const viewCopy = {
        all: ["Tasks", "Everything you need to do."],
        active: ["Active", "Tasks still waiting for you."],
        completed: ["Completed", "A quiet place for finished work."],
        favorites: ["Favorites", "Your most important tasks."]
      };

      const icons = {
        check: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M7 12.5l3.1 3.1L17.5 8" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
        star: `<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M12 4.7l2.1 4.3 4.7.7-3.4 3.3.8 4.7-4.2-2.2-4.2 2.2.8-4.7-3.4-3.3 4.7-.7L12 4.7Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
        edit: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4.8 16.8 16.9 4.7a2.2 2.2 0 0 1 3.1 3.1L7.9 19.9l-4 .9.9-4Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
        trash: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 4h6m-8 4h10m-9 0 .7 11h6.6L16 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      };

      function uid() {
        return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
      }

      function nowISO() {
        return new Date().toISOString();
      }

      function formatDate(iso) {
        return new Intl.DateTimeFormat(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit"
        }).format(new Date(iso));
      }

      function load() {
        try {
          const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
          state.tasks = Array.isArray(saved) ? saved : [];
        } catch {
          state.tasks = [];
        }

        state.view = localStorage.getItem("appleTasks.view") || "all";
        state.sort = localStorage.getItem("appleTasks.sort") || "newest";
        els.sort.value = state.sort;
      }

      function persist() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
      }

      function showToast(message) {
        clearTimeout(state.toastTimer);
        els.toast.textContent = message;
        els.toast.classList.add("show");
        state.toastTimer = setTimeout(() => {
          els.toast.classList.remove("show");
        }, 1700);
      }

      function getCounts() {
        return {
          all: state.tasks.length,
          active: state.tasks.filter(task => !task.completed).length,
          completed: state.tasks.filter(task => task.completed).length,
          favorites: state.tasks.filter(task => task.favorite).length
        };
      }

      function getVisibleTasks() {
        const query = state.search.trim().toLowerCase();

        let list = state.tasks.filter(task => {
          if (state.view === "active" && task.completed) return false;
          if (state.view === "completed" && !task.completed) return false;
          if (state.view === "favorites" && !task.favorite) return false;

          if (!query) return true;
          return (
            task.title.toLowerCase().includes(query) ||
            (task.note || "").toLowerCase().includes(query)
          );
        });

        list = list.slice().sort((a, b) => {
          if (state.sort === "oldest") return new Date(a.createdAt) - new Date(b.createdAt);
          if (state.sort === "az") return a.title.localeCompare(b.title);
          if (state.sort === "za") return b.title.localeCompare(a.title);
          return new Date(b.createdAt) - new Date(a.createdAt);
        });

        return list;
      }

      function updateChrome() {
        const [title, subtitle] = viewCopy[state.view] || viewCopy.all;
        els.pageTitle.textContent = title;
        els.pageSubtitle.textContent = subtitle;

        $$(".nav-button, .tab-button").forEach(button => {
          button.classList.toggle("active", button.dataset.view === state.view);
        });

        const counts = getCounts();
        $("#count-all").textContent = counts.all;
        $("#count-active").textContent = counts.active;
        $("#count-completed").textContent = counts.completed;
        $("#count-favorites").textContent = counts.favorites;
      }

      function createTaskCard(task) {
        const card = document.createElement("article");
        card.className = `task-card${task.completed ? " completed" : ""}`;
        card.dataset.id = task.id;

        const check = document.createElement("button");
        check.className = "check-button";
        check.type = "button";
        check.setAttribute("aria-label", task.completed ? "Mark task as active" : "Mark task as completed");
        check.innerHTML = icons.check;
        check.addEventListener("click", () => toggleComplete(task.id));

        const main = document.createElement("div");
        main.className = "task-main";

        const title = document.createElement("h3");
        title.className = "task-title";
        title.textContent = task.title;

        const note = document.createElement("p");
        note.className = "task-note";
        note.textContent = task.note || "";

        const meta = document.createElement("div");
        meta.className = "task-meta";

        const created = document.createElement("span");
        created.className = "pill";
        created.textContent = `Created ${formatDate(task.createdAt)}`;

        const status = document.createElement("span");
        status.className = "pill";
        status.textContent = task.completed ? "Completed" : "Active";

        meta.append(created, status);
        if (task.favorite) {
          const fav = document.createElement("span");
          fav.className = "pill";
          fav.textContent = "Favorite";
          meta.append(fav);
        }

        main.append(title);
        if (task.note) main.append(note);
        main.append(meta);

        main.addEventListener("dblclick", () => openModal(task.id));

        const actions = document.createElement("div");
        actions.className = "task-actions";

        const favorite = document.createElement("button");
        favorite.className = `icon-button favorite${task.favorite ? " active" : ""}`;
        favorite.type = "button";
        favorite.setAttribute("aria-label", task.favorite ? "Remove from favorites" : "Add to favorites");
        favorite.innerHTML = icons.star;
        favorite.addEventListener("click", () => toggleFavorite(task.id));

        const edit = document.createElement("button");
        edit.className = "icon-button";
        edit.type = "button";
        edit.setAttribute("aria-label", "Edit task");
        edit.innerHTML = icons.edit;
        edit.addEventListener("click", () => openModal(task.id));

        const del = document.createElement("button");
        del.className = "icon-button delete";
        del.type = "button";
        del.setAttribute("aria-label", "Delete task");
        del.innerHTML = icons.trash;
        del.addEventListener("click", () => deleteTask(task.id, card));

        actions.append(favorite, edit, del);
        card.append(check, main, actions);

        return card;
      }

      function render() {
        updateChrome();

        const visibleTasks = getVisibleTasks();
        els.taskList.replaceChildren();

        if (!visibleTasks.length) {
          const empty = document.createElement("div");
          empty.className = "empty-state";
          empty.innerHTML = `
            <div class="empty-state-inner">
              <div class="empty-icon" aria-hidden="true">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
                  <path d="M8.5 12.2l2.1 2.1 5-5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
                  <rect x="4" y="4" width="16" height="16" rx="5" stroke="currentColor" stroke-width="2"/>
                </svg>
              </div>
              <h3>${state.search ? "No matching tasks" : "Nothing here yet"}</h3>
              <p>${state.search ? "Try a different search term or switch filters." : "Add a task to start organizing your day."}</p>
            </div>
          `;
          els.taskList.append(empty);
          return;
        }

        const fragment = document.createDocumentFragment();
        visibleTasks.forEach(task => fragment.append(createTaskCard(task)));
        els.taskList.append(fragment);
      }

      function setView(view) {
        state.view = view;
        localStorage.setItem("appleTasks.view", view);
        render();
      }

      function openModal(taskId = null) {
        state.editingId = taskId;
        const task = taskId ? state.tasks.find(item => item.id === taskId) : null;

        els.modalTitle.textContent = task ? "Edit Task" : "New Task";
        els.saveTask.textContent = task ? "Save Changes" : "Add Task";
        els.titleInput.value = task ? task.title : "";
        els.noteInput.value = task ? task.note || "" : "";

        els.backdrop.classList.add("open");
        els.backdrop.setAttribute("aria-hidden", "false");

        requestAnimationFrame(() => {
          els.titleInput.focus();
          els.titleInput.setSelectionRange(els.titleInput.value.length, els.titleInput.value.length);
        });
      }

      function closeModal() {
        els.backdrop.classList.remove("open");
        els.backdrop.setAttribute("aria-hidden", "true");
        state.editingId = null;
        els.form.reset();
      }

      function upsertTask(event) {
        event.preventDefault();

        const title = els.titleInput.value.trim();
        const note = els.noteInput.value.trim();

        if (!title) return;

        if (state.editingId) {
          const task = state.tasks.find(item => item.id === state.editingId);
          if (task) {
            task.title = title;
            task.note = note;
            task.updatedAt = nowISO();
            showToast("Task updated");
          }
        } else {
          state.tasks.unshift({
            id: uid(),
            title,
            note,
            completed: false,
            favorite: false,
            createdAt: nowISO(),
            updatedAt: nowISO()
          });
          showToast("Task added");
        }

        persist();
        closeModal();
        render();
      }

      function toggleComplete(id) {
        const task = state.tasks.find(item => item.id === id);
        if (!task) return;

        task.completed = !task.completed;
        task.updatedAt = nowISO();

        persist();
        render();
        showToast(task.completed ? "Marked completed" : "Marked active");
      }

      function toggleFavorite(id) {
        const task = state.tasks.find(item => item.id === id);
        if (!task) return;

        task.favorite = !task.favorite;
        task.updatedAt = nowISO();

        persist();
        render();
        showToast(task.favorite ? "Added to favorites" : "Removed from favorites");
      }

      function deleteTask(id, card) {
        if (card) card.classList.add("removing");

        setTimeout(() => {
          state.tasks = state.tasks.filter(task => task.id !== id);
          persist();
          render();
          showToast("Task deleted");
        }, 180);
      }

      function addRipple(event) {
        const target = event.target.closest("button");
        if (!target) return;

        target.animate(
          [
            { transform: "scale(1)" },
            { transform: "scale(.97)" },
            { transform: "scale(1)" }
          ],
          {
            duration: 180,
            easing: "cubic-bezier(.2,.8,.2,1)"
          }
        );
      }

      function bindEvents() {
        $$(".nav-button, .tab-button").forEach(button => {
          button.addEventListener("click", () => setView(button.dataset.view));
        });

        els.openAdd.addEventListener("click", () => openModal());
        els.closeModal.addEventListener("click", closeModal);
        els.cancelModal.addEventListener("click", closeModal);
        els.form.addEventListener("submit", upsertTask);

        els.backdrop.addEventListener("click", event => {
          if (event.target === els.backdrop) closeModal();
        });

        els.search.addEventListener("input", event => {
          state.search = event.target.value;
          render();
        });

        els.sort.addEventListener("change", event => {
          state.sort = event.target.value;
          localStorage.setItem("appleTasks.sort", state.sort);
          render();
        });

        document.addEventListener("pointerdown", addRipple);

        document.addEventListener("keydown", event => {
          const isTyping = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName);

          if (event.key === "Escape" && els.backdrop.classList.contains("open")) {
            closeModal();
          }

          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
            event.preventDefault();
            openModal();
          }

          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
            event.preventDefault();
            els.search.focus();
          }

          if (event.key === "Delete" && !isTyping) {
            const firstVisible = getVisibleTasks()[0];
            if (firstVisible) {
              const card = $(`.task-card[data-id="${CSS.escape(firstVisible.id)}"]`);
              deleteTask(firstVisible.id, card);
            }
          }
        });
      }

      function init() {
        load();
        bindEvents();
        render();
      }

      init();
    })();

    /* Created by Abdughafur */
