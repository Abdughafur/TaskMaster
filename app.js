
      const modal = document.getElementById("taskModal");
      const input = document.getElementById("taskInput");
      const container = document.getElementById("taskContainer");
      let clockInterval;

      // --- CORE FUNCTIONS ---

      function openModal() {
        modal.style.display = "flex";
        input.focus();
      }
      function closeModal() {
        modal.style.display = "none";
        input.value = "";
      }

      function confirmAddTask() {
        if (input.value.trim() === "") return;
        createTaskElement(input.value, false);
        saveToLocalStorage();
        closeModal();
      }

      function createTaskElement(text, isCompleted) {
        const taskDiv = document.createElement("div");
        taskDiv.className = `task-item ${isCompleted ? "completed" : ""}`;
        taskDiv.innerHTML = `
                <div class="task-content">
                    <input type="checkbox" ${isCompleted ? "checked" : ""} onchange="toggleComplete(this)">
                    <span>${text}</span>
                </div>
                <button class="delete-btn" onclick="deleteTask(this)">
                    <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#ff5555" d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19V4M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" /></svg>
                </button>
            `;
        container.appendChild(taskDiv);
      }

      function toggleComplete(checkbox) {
        checkbox.parentElement.parentElement.classList.toggle("completed");
        saveToLocalStorage();
      }

      function deleteTask(btn) {
        btn.parentElement.remove();
        saveToLocalStorage();
      }

      // --- PERSISTENCE LOGIC ---

      function saveToLocalStorage() {
        const tasks = [];
        document.querySelectorAll(".task-item").forEach((item) => {
          tasks.push({
            text: item.querySelector("span").innerText,
            completed: item.classList.contains("completed"),
          });
        });
        localStorage.setItem("todoTasks", JSON.stringify(tasks));
      }

      function loadAppData() {
        // Load Tasks
        const savedTasks = JSON.parse(
          localStorage.getItem("todoTasks") || "[]",
        );
        savedTasks.forEach((task) =>
          createTaskElement(task.text, task.completed),
        );

        // Load Theme
        const savedTheme = localStorage.getItem("todoTheme");
        if (savedTheme) setTheme(savedTheme, false);

        // Load Clock Preference
        const clockPref = localStorage.getItem("todoClock") === "true";
        document.getElementById("timeToggle").checked = clockPref;
        if (clockPref) toggleClock(false);
      }

      function setTheme(color, shouldSave = true) {
        const body = document.body;
        let gradient = "radial-gradient(circle, #03033b, black)";
        if (color === "purple")
          gradient = "radial-gradient(circle, #581c87, #000000)";
        if (color === "red")
          gradient = "radial-gradient(circle, #b91d1d, #450a0a)";
        if (color === "blue")
          gradient = "radial-gradient(circle, #0ea5e9, #0c4a6e)";

        body.style.background = gradient;
        if (shouldSave) localStorage.setItem("todoTheme", color);
      }

      function toggleClock(shouldSave = true) {
        const display = document.getElementById("clockDisplay");
        const isChecked = document.getElementById("timeToggle").checked;

        if (isChecked) {
          display.innerText = new Date().toLocaleTimeString();
          clockInterval = setInterval(() => {
            display.innerText = new Date().toLocaleTimeString();
          }, 1000);
        } else {
          clearInterval(clockInterval);
          display.innerText = "";
        }
        if (shouldSave) localStorage.setItem("todoClock", isChecked);
      }

      // --- UI HELPERS ---
      function toggleSettings() {
        const panel = document.getElementById("settingPanel");
        panel.style.display =
          panel.style.display === "block" ? "none" : "block";
      }

      window.onclick = (e) => {
        if (e.target == modal) closeModal();
      };
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") confirmAddTask();
      });