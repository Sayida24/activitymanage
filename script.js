// --- DATA STORE ---
const store = {
  get: () => JSON.parse(localStorage.getItem('app_activities')) || [],
  set: (data) => localStorage.setItem('app_activities', JSON.stringify(data))
};

// --- CORE APP LOGIC ---
const app = {
  activities: store.get(),
  view: 'dashboard',
  filters: { search: '', category: '', priority: '', status: '', date: '' },

  init() {
    this.requestNotificationPermission();
    setInterval(() => this.checkReminders(), 30000); // Check every 30s
    ui.render();
  },

  requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  },

  checkReminders() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const now = new Date();

    this.activities.forEach(item => {
      if (item.reminder && !item.completed && !item.notified) {
        const itemDate = new Date(`${item.date}T${item.time}`);
        // If scheduled within the last 60 seconds
        if (itemDate <= now && now - itemDate < 60000) {
          new Notification(item.title, {
            body: `${item.category} • Due right now (${item.time})`
          });
          item.notified = true;
          this.save();
        }
      }
    });
  },

  save() {
    store.set(this.activities);
  },

  isOverdue(item) {
    if (item.completed) return false;
    return new Date(`${item.date}T${item.time}`) < new Date();
  },

  addActivity(data) {
    const baseId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const occurrences = [];

    // Recurring logic (Daily: 30 days, Weekly: 8 weeks)
    const count = data.recurrence === 'daily' ? 30 : data.recurrence === 'weekly' ? 8 : 1;
    for (let i = 0; i < count; i++) {
      const d = new Date(data.date + 'T00:00:00');
      if (data.recurrence === 'daily') d.setDate(d.getDate() + i);
      if (data.recurrence === 'weekly') d.setDate(d.getDate() + (i * 7));

      occurrences.push({
        ...data,
        id: `${baseId}_${i}`,
        date: d.toISOString().split('T')[0],
        completed: false,
        notified: false
      });
    }

    this.activities.push(...occurrences);
    this.save();
    ui.render();
  },

  updateActivity(id, updatedData) {
    const index = this.activities.findIndex(a => a.id === id);
    if (index !== -1) {
      this.activities[index] = { ...this.activities[index], ...updatedData };
      this.save();
      ui.render();
    }
  },

  toggleComplete(id) {
    const item = this.activities.find(a => a.id === id);
    if (item) {
      item.completed = !item.completed;
      this.save();
      ui.render();
    }
  },

  deleteActivity(id) {
    if (confirm('Delete this activity?')) {
      this.activities = this.activities.filter(a => a.id !== id);
      this.save();
      ui.render();
    }
  },

  getFiltered() {
    return this.activities.filter(a => {
      const f = this.filters;
      const matchSearch = !f.search || a.title.toLowerCase().includes(f.search.toLowerCase());
      const matchCat = !f.category || a.category === f.category;
      const matchPri = !f.priority || a.priority === f.priority;
      const matchDate = !f.date || a.date === f.date;

      let matchStatus = true;
      if (f.status === 'completed') matchStatus = a.completed;
      if (f.status === 'pending') matchStatus = !a.completed && !this.isOverdue(a);
      if (f.status === 'overdue') matchStatus = this.isOverdue(a);

      return matchSearch && matchCat && matchPri && matchDate && matchStatus;
    });
  }
};

// --- UI CONTROLLER ---
const ui = {
  render() {
    if (app.view === 'dashboard') this.renderDashboard();
    else this.renderHistory();
  },

  showDashboard() {
    app.view = 'dashboard';
    document.getElementById('nav-dash').classList.add('active');
    document.getElementById('nav-hist').classList.remove('active');
    this.render();
  },

  showHistory() {
    app.view = 'history';
    document.getElementById('nav-hist').classList.add('active');
    document.getElementById('nav-dash').classList.remove('active');
    this.render();
  },

  renderDashboard() {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayList = app.activities.filter(a => a.date === todayStr);
    const todayCompleted = todayList.filter(a => a.completed).length;
    const overdueCount = app.activities.filter(a => app.isOverdue(a)).length;
    const upcomingCount = app.activities.filter(a => a.date > todayStr && !a.completed).length;

    const list = app.getFiltered();

    document.getElementById('main-content').innerHTML = `
      <div class="page-header">
        <h2>Dashboard</h2>
        <span>${new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <h4>Today's Tasks</h4>
          <div class="count">${todayCompleted} / ${todayList.length}</div>
        </div>
        <div class="stat-card">
          <h4>Upcoming</h4>
          <div class="count">${upcomingCount}</div>
        </div>
        <div class="stat-card" style="color: var(--red);">
          <h4 style="color: var(--red);">Overdue</h4>
          <div class="count">${overdueCount}</div>
        </div>
      </div>

      <div class="filter-bar">
        <input type="text" placeholder="Search title..." value="${app.filters.search}" oninput="ui.updateFilter('search', this.value)">
        <input type="date" value="${app.filters.date}" onchange="ui.updateFilter('date', this.value)">
        <select onchange="ui.updateFilter('category', this.value)">
          <option value="">All Categories</option>
          <option value="Study" ${app.filters.category === 'Study' ? 'selected' : ''}>Study</option>
          <option value="Work" ${app.filters.category === 'Work' ? 'selected' : ''}>Work</option>
          <option value="Health" ${app.filters.category === 'Health' ? 'selected' : ''}>Health</option>
          <option value="Personal" ${app.filters.category === 'Personal' ? 'selected' : ''}>Personal</option>
          <option value="Other" ${app.filters.category === 'Other' ? 'selected' : ''}>Other</option>
        </select>
        <select onchange="ui.updateFilter('priority', this.value)">
          <option value="">All Priorities</option>
          <option value="Low" ${app.filters.priority === 'Low' ? 'selected' : ''}>Low</option>
          <option value="Medium" ${app.filters.priority === 'Medium' ? 'selected' : ''}>Medium</option>
          <option value="High" ${app.filters.priority === 'High' ? 'selected' : ''}>High</option>
        </select>
        <select onchange="ui.updateFilter('status', this.value)">
          <option value="">All Statuses</option>
          <option value="pending" ${app.filters.status === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="completed" ${app.filters.status === 'completed' ? 'selected' : ''}>Completed</option>
          <option value="overdue" ${app.filters.status === 'overdue' ? 'selected' : ''}>Overdue</option>
        </select>
      </div>

      <div class="activity-list">
        ${list.length === 0 ? '<p style="color:var(--muted)">No activities found.</p>' : ''}
        ${list.map(item => this.renderCard(item)).join('')}
      </div>
    `;
  },

  renderHistory() {
    const total = app.activities.length;
    const completed = app.activities.filter(a => a.completed).length;
    const rate = total === 0 ? 0 : Math.round((completed / total) * 100);

    const completedList = app.activities.filter(a => a.completed);

    document.getElementById('main-content').innerHTML = `
      <div class="page-header">
        <h2>Activity History</h2>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <h4>Completed Total</h4>
          <div class="count">${completed} / ${total}</div>
        </div>
        <div class="stat-card">
          <h4>Completion Rate</h4>
          <div class="count">${rate}%</div>
        </div>
      </div>

      <h3>Finished Activities</h3>
      <div class="activity-list" style="margin-top: 15px;">
        ${completedList.length === 0 ? '<p style="color:var(--muted)">No completed activities yet.</p>' : ''}
        ${completedList.map(item => this.renderCard(item)).join('')}
      </div>
    `;
  },

  renderCard(item) {
    const overdue = app.isOverdue(item) ? 'overdue' : '';
    const completed = item.completed ? 'completed' : '';
    const priClass = item.priority.toLowerCase();

    return `
      <div class="activity-card ${priClass} ${overdue} ${completed}">
        <input type="checkbox" ${item.completed ? 'checked' : ''} onchange="app.toggleComplete('${item.id}')">
        <div class="activity-info">
          <h4>${item.title}</h4>
          <p>${item.date} at ${item.time} • <strong>${item.category}</strong> • ${item.priority} Priority</p>
          ${item.description ? `<p style="margin-top:4px;">${item.description}</p>` : ''}
        </div>
        <div class="actions">
          <button title="Edit" onclick="ui.openModal('${item.id}')"><span class="material-icons">edit</span></button>
          <button class="del-btn" title="Delete" onclick="app.deleteActivity('${item.id}')"><span class="material-icons">delete</span></button>
        </div>
      </div>
    `;
  },

  updateFilter(key, val) {
    app.filters[key] = val;
    this.render();
  },

  openModal(id = null) {
    const modal = document.getElementById('activity-modal');
    const form = document.getElementById('activity-form');
    form.reset();

    if (id) {
      const item = app.activities.find(a => a.id === id);
      if (!item) return;
      document.getElementById('modal-title').textContent = 'Edit Activity';
      document.getElementById('activity-id').value = item.id;
      document.getElementById('title').value = item.title;
      document.getElementById('description').value = item.description || '';
      document.getElementById('date').value = item.date;
      document.getElementById('time').value = item.time;
      document.getElementById('category').value = item.category;
      document.getElementById('priority').value = item.priority;
      document.getElementById('reminder').checked = !!item.reminder;
      document.getElementById('recurrence').value = item.recurrence || 'none';
      document.getElementById('recurrence').disabled = true; // Avoid restructuring existing recurrence
    } else {
      document.getElementById('modal-title').textContent = 'Add Activity';
      document.getElementById('activity-id').value = '';
      document.getElementById('date').value = new Date().toISOString().split('T')[0];
      document.getElementById('recurrence').disabled = false;
    }

    modal.style.display = 'flex';
  },

  closeModal() {
    document.getElementById('activity-modal').style.display = 'none';
  },
  init() {
    this.requestNotificationPermission();
    setInterval(() => this.checkReminders(), 30000); // Check notifications every 30s
    
    // START LIVE CLOCK
    this.startClock();

    ui.render();
  },

  // ADD THIS FUNCTION
  startClock() {
    const update = () => {
      const now = new Date();
      const timeElem = document.getElementById('live-time');
      const dateElem = document.getElementById('live-date');

      if (timeElem && dateElem) {
        timeElem.textContent = now.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        });
        dateElem.textContent = now.toLocaleDateString([], { 
          weekday: 'short', 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        });
      }
    };
    
    update(); // Run immediately on load
    setInterval(update, 1000); // Update every second
  },

  handleFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('activity-id').value;
    const payload = {
      title: document.getElementById('title').value.trim(),
      description: document.getElementById('description').value.trim(),
      date: document.getElementById('date').value,
      time: document.getElementById('time').value,
      category: document.getElementById('category').value,
      priority: document.getElementById('priority').value,
      reminder: document.getElementById('reminder').checked,
      recurrence: document.getElementById('recurrence').value
    };

    if (id) {
      app.updateActivity(id, payload);
    } else {
      app.addActivity(payload);
    }

    this.closeModal();
  }
};


// Start application
window.addEventListener('DOMContentLoaded', () => app.init());
