 (() => {
      "use strict";

      const STORAGE_KEY = "appleTasks.v1";

      const state = {
        tasks: [],
        view: "all",
        search: "",
        sort: "newest",
        editingId: null,
        pendingDeleteId: null,
        toastTimer: null
      };

      const $ = (selector, root = document) => root.querySelector(selector);
      const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

      const els = {
        taskList: $("#task-list"),
        pageTitle: $("#page-title"),
        pageSubtitle: $("#page-subtitle"),
        search: $("#search-input"),
        sortTrigger: $("#sort-trigger"),
        sortMenu: $("#sort-menu"),
        sortLabel: $("#sort-label"),
        confirmBackdrop: $("#confirm-backdrop"),
        confirmCancel: $("#confirm-cancel"),
        confirmDelete: $("#confirm-delete"),
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

      function normalizeTask(task) {
        if (!task || typeof task !== "object" || Array.isArray(task)) return null;
        if (typeof task.id !== "string" || !task.id || typeof task.title !== "string") return null;

        const title = task.title.trim().slice(0, 180);
        if (!title) return null;

        const validDate = value => typeof value === "string" && Number.isFinite(Date.parse(value));
        const createdAt = validDate(task.createdAt) ? task.createdAt : nowISO();
        const updatedAt = validDate(task.updatedAt) ? task.updatedAt : createdAt;

        return {
          id: task.id.slice(0, 100),
          title,
          note: typeof task.note === "string" ? task.note.slice(0, 3000) : "",
          completed: task.completed === true,
          favorite: task.favorite === true,
          createdAt,
          updatedAt
        };
      }

      function safeStorageSet(key, value) {
        try {
          localStorage.setItem(key, value);
          return true;
        } catch {
          showToast("Storage is unavailable. Changes may not be saved.");
          return false;
        }
      }

      function load() {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          const saved = raw ? JSON.parse(raw) : [];
          state.tasks = Array.isArray(saved)
            ? saved.map(normalizeTask).filter(Boolean).slice(0, 1000)
            : [];
        } catch {
          state.tasks = [];
          showToast("Saved task data could not be read.");
        }

        try {
          const savedView = localStorage.getItem("appleTasks.view");
          state.view = ["all", "active", "completed", "favorites"].includes(savedView) ? savedView : "all";
          const savedSort = localStorage.getItem("appleTasks.sort");
          state.sort = ["newest", "oldest", "az", "za"].includes(savedSort) ? savedSort : "newest";
        } catch {
          state.view = "all";
          state.sort = "newest";
        }
        updateSortControl();
      }

      function updateSortControl() {
        const labels = { newest: "Newest first", oldest: "Oldest first", az: "Name A–Z", za: "Name Z–A" };
        const label = labels[state.sort] || labels.newest;
        els.sortLabel.textContent = label;
        $$(".sort-option", els.sortMenu).forEach(option => {
          const selected = option.dataset.sort === state.sort;
          option.classList.toggle("active", selected);
          option.setAttribute("aria-checked", String(selected));
        });
      }

      function setSort(sort) {
        if (!["newest", "oldest", "az", "za"].includes(sort)) return;
        state.sort = sort;
        safeStorageSet("appleTasks.sort", sort);
        updateSortControl();
        closeSortMenu();
        render();
      }

      function openSortMenu() {
        els.sortMenu.classList.add("open");
        els.sortTrigger.setAttribute("aria-expanded", "true");
      }

      function closeSortMenu() {
        els.sortMenu.classList.remove("open");
        els.sortTrigger.setAttribute("aria-expanded", "false");
      }

      function toggleSortMenu() {
        els.sortMenu.classList.contains("open") ? closeSortMenu() : openSortMenu();
      }

      function persist() {
        const payload = JSON.stringify(state.tasks);
        if (payload.length > 3500000) {
          showToast("Storage limit reached. Remove large notes to save changes.");
          return false;
        }
        return safeStorageSet(STORAGE_KEY, payload);
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
          if (state.sort === "oldest") return Date.parse(a.createdAt) - Date.parse(b.createdAt);
          if (state.sort === "az") return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
          if (state.sort === "za") return b.title.localeCompare(a.title, undefined, { sensitivity: "base" });
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
        card.tabIndex = 0;
        card.setAttribute("aria-label", `Edit task: ${task.title}`);

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

        card.addEventListener("click", event => {
          if (event.target.closest("button, a, input, textarea, select")) return;
          openModal(task.id);
        });
        card.addEventListener("keydown", event => {
          if ((event.key === "Enter" || event.key === " ") && !event.target.closest("button")) {
            event.preventDefault();
            openModal(task.id);
          }
        });

        const actions = document.createElement("div");
        actions.className = "task-actions";

        const favorite = document.createElement("button");
        favorite.className = `icon-button favorite${task.favorite ? " active" : ""}`;
        favorite.type = "button";
        favorite.setAttribute("aria-label", task.favorite ? "Remove from favorites" : "Add to favorites");
        favorite.innerHTML = icons.star;
        favorite.addEventListener("click", () => toggleFavorite(task.id));

        const del = document.createElement("button");
        del.className = "icon-button delete";
        del.type = "button";
        del.setAttribute("aria-label", "Delete task");
        del.innerHTML = icons.trash;
        del.addEventListener("click", () => openConfirm(task.id));

        actions.append(favorite, del);
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
        safeStorageSet("appleTasks.view", view);
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

        const title = els.titleInput.value.trim().slice(0, 180);
        const note = els.noteInput.value.trim().slice(0, 3000);

        if (!title) return;
        if (title.length > 180 || note.length > 3000) {
          showToast("Task text is too long.");
          return;
        }

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

      function openConfirm(id) {
        if (!state.tasks.some(task => task.id === id)) return;
        state.pendingDeleteId = id;
        els.confirmBackdrop.classList.add("open");
        els.confirmBackdrop.setAttribute("aria-hidden", "false");
        els.confirmCancel.focus();
      }

      function closeConfirm() {
        els.confirmBackdrop.classList.remove("open");
        els.confirmBackdrop.setAttribute("aria-hidden", "true");
        state.pendingDeleteId = null;
      }

      function confirmDeleteTask() {
        const id = state.pendingDeleteId;
        if (!id) return;
        const card = $(`.task-card[data-id="${CSS.escape(id)}"]`);
        closeConfirm();
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

        els.sortTrigger.addEventListener("click", toggleSortMenu);
        $$(".sort-option", els.sortMenu).forEach(option => {
          option.addEventListener("click", () => setSort(option.dataset.sort));
        });
        els.confirmCancel.addEventListener("click", closeConfirm);
        els.confirmDelete.addEventListener("click", confirmDeleteTask);
        els.confirmBackdrop.addEventListener("click", event => {
          if (event.target === els.confirmBackdrop) closeConfirm();
        });
        document.addEventListener("pointerdown", event => {
          if (!event.target.closest(".sort-control")) closeSortMenu();
        });

        document.addEventListener("pointerdown", addRipple);

        document.addEventListener("keydown", event => {
          const isTyping = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName);

          if (event.key === "Escape" && els.confirmBackdrop.classList.contains("open")) {
            closeConfirm();
          } else if (event.key === "Escape" && els.backdrop.classList.contains("open")) {
            closeModal();
          } else if (event.key === "Escape") {
            closeSortMenu();
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
            if (firstVisible) openConfirm(firstVisible.id);
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
