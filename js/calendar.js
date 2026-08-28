// calendar.js
// Módulo de Calendário para o projeto Rotina Julia

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function getCalDateStr(d) {
  return window.getLocalDateString ? window.getLocalDateString(d) : d.toISOString().split('T')[0];
}

window.Calendar_init = function() {
  document.getElementById('main-cal-prev')?.addEventListener('click', () => {
    let d = window.AppState.calendarDate;
    window.AppState.calendarDate = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    window.Calendar_renderMain();
  });
  document.getElementById('main-cal-next')?.addEventListener('click', () => {
    let d = window.AppState.calendarDate;
    window.AppState.calendarDate = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    window.Calendar_renderMain();
  });
  document.getElementById('mini-cal-prev')?.addEventListener('click', () => {
    let d = window.AppState.miniCalDate;
    window.AppState.miniCalDate = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    window.Calendar_renderMini();
  });
  document.getElementById('mini-cal-next')?.addEventListener('click', () => {
    let d = window.AppState.miniCalDate;
    window.AppState.miniCalDate = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    window.Calendar_renderMini();
  });
  document.getElementById('main-cal-today-btn')?.addEventListener('click', () => {
    window.AppState.calendarDate = new Date();
    window.AppState.miniCalDate = new Date();
    window.Calendar_render();
  });

  // Modal handlers
  document.getElementById('cal-task-cancel-btn')?.addEventListener('click', () => {
    if (window.hideModal) window.hideModal('cal-task-modal');
  });

  document.getElementById('cal-task-save-btn')?.addEventListener('click', async () => {
    try {
      const title = document.getElementById('cal-task-title-input').value.trim();
      const folderId = document.getElementById('cal-task-folder-select').value || null;
      const selectedColor = document.querySelector('#cal-task-color-options .color-option.selected');
      const color = selectedColor ? selectedColor.dataset.color : '#8b5cf6';
      const priority = document.getElementById('cal-task-priority-select').value;
      const dueDate = document.getElementById('cal-task-date-input').value || null;
      
      if (!title) {
        window.showToast?.('O título da tarefa é obrigatório.', 'error');
        return;
      }
      
      const user = window.AppState.user;
      
      const { data, error } = await window.supabase.from('tasks').insert([{
        user_id: user.id,
        folder_id: folderId,
        title,
        due_date: dueDate,
        color,
        priority,
        completed: false
      }]).select();
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        window.AppState.tasks.push(data[0]);
        if (window.App_refreshAll) {
          window.App_refreshAll();
        } else {
          window.Calendar_render();
        }
        if (window.hideModal) window.hideModal('cal-task-modal');
        window.showToast?.('Tarefa criada com sucesso!', 'success');
        
        // Reset form
        document.getElementById('cal-task-title-input').value = '';
      }
    } catch (err) {
      console.error(err);
      window.showToast?.('Erro ao salvar tarefa.', 'error');
    }
  });

  // Color selection in calendar modal
  document.querySelectorAll('#cal-task-color-options .color-option').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('#cal-task-color-options .color-option').forEach(b => b.classList.remove('selected'));
      e.currentTarget.classList.add('selected');
    });
  });

  window.Calendar_render();
};

window.Calendar_render = function() {
  window.Calendar_updateFilterTabs();
  window.Calendar_renderMini();
  window.Calendar_renderMain();
  window.Calendar_renderUpcoming();
};

window.Calendar_updateFilterTabs = function() {
  const container = document.getElementById('calendar-filter-tabs');
  if (!container) return;
  
  let html = `<button class="filter-tab ${window.AppState.currentCalendarFilter === 'all' ? 'active' : ''}" data-filter="all">Todas</button>`;
  
  window.AppState.folders.forEach(folder => {
    const isActive = window.AppState.currentCalendarFilter === folder.id;
    html += `<button class="filter-tab ${isActive ? 'active' : ''}" data-filter="${folder.id}">
      <span class="folder-color-dot" style="background-color: ${folder.color || '#8b5cf6'}"></span> ${folder.name}
    </button>`;
  });
  
  container.innerHTML = html;
  
  container.querySelectorAll('.filter-tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
      window.AppState.currentCalendarFilter = e.currentTarget.dataset.filter;
      window.Calendar_render();
    });
  });
};

window.Calendar_renderMini = function() {
  const container = document.getElementById('mini-cal-grid');
  const label = document.getElementById('mini-cal-month-label');
  if (!container || !label) return;

  const d = window.AppState.miniCalDate;
  const year = d.getFullYear();
  const month = d.getMonth();
  
  label.textContent = `${MONTH_NAMES[month]} ${year}`;
  
  const firstDay = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  
  let html = '';
  
  // Headers
  const dayNames = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  dayNames.forEach(day => {
    html += `<div class="mini-cal-header">${day}</div>`;
  });
  
  let date = 1;
  let nextDate = 1;
  
  const today = new Date();
  
  for (let i = 0; i < 42; i++) {
    if (i < firstDay) {
      // Prev month
      const prevDateNum = daysInPrevMonth - firstDay + i + 1;
      html += `<div class="mini-cal-day other-month">${prevDateNum}</div>`;
    } else if (date > daysInMonth) {
      // Next month
      html += `<div class="mini-cal-day other-month">${nextDate}</div>`;
      nextDate++;
    } else {
      // Current month
      const isToday = today.getDate() === date && today.getMonth() === month && today.getFullYear() === year;
      const isSelected = window.AppState.calendarDate.getDate() === date && window.AppState.calendarDate.getMonth() === month && window.AppState.calendarDate.getFullYear() === year;
      
      let classes = 'mini-cal-day';
      if (isToday) classes += ' today';
      if (isSelected) classes += ' selected';
      
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
      html += `<div class="${classes}" data-date="${dateString}">${date}</div>`;
      date++;
    }
  }
  
  container.innerHTML = html;
  
  container.querySelectorAll('.mini-cal-day:not(.other-month)').forEach(dayEl => {
    dayEl.addEventListener('click', (e) => {
      const clickedDateStr = e.target.dataset.date;
      if (clickedDateStr) {
        const parts = clickedDateStr.split('-');
        window.AppState.calendarDate = new Date(parts[0], parseInt(parts[1]) - 1, parts[2]);
        window.Calendar_renderMain();
        window.Calendar_renderMini();
      }
    });
  });
};

window.Calendar_renderMain = function() {
  const container = document.getElementById('main-cal-grid');
  const label = document.getElementById('main-cal-month-label');
  if (!container || !label) return;

  const d = window.AppState.calendarDate;
  const year = d.getFullYear();
  const month = d.getMonth();
  
  label.textContent = `${MONTH_NAMES[month]} ${year}`;
  
  const firstDay = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  
  let html = '';
  
  let date = 1;
  let nextDate = 1;
  
  const today = new Date();
  const todayStr = getCalDateStr(today);
  
  for (let i = 0; i < 42; i++) {
    let cellDateStr;
    let isOtherMonth = false;
    let dayNum = 0;
    
    if (i < firstDay) {
      // Prev month
      dayNum = daysInPrevMonth - firstDay + i + 1;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      cellDateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      isOtherMonth = true;
    } else if (date > daysInMonth) {
      // Next month
      dayNum = nextDate;
      const nxtMonth = month === 11 ? 0 : month + 1;
      const nxtYear = month === 11 ? year + 1 : year;
      cellDateStr = `${nxtYear}-${String(nxtMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      isOtherMonth = true;
      nextDate++;
    } else {
      // Current month
      dayNum = date;
      cellDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      date++;
    }
    
    const isToday = cellDateStr === todayStr;
    
    // Obter tarefas para esta data
    let dayTasks = window.AppState.tasks.filter(t => t.due_date === cellDateStr);
    
    // Aplicar filtro
    if (window.AppState.currentCalendarFilter !== 'all') {
      dayTasks = dayTasks.filter(t => t.folder_id === window.AppState.currentCalendarFilter);
    }
    
    let classes = 'cal-day';
    if (isOtherMonth) classes += ' other-month';
    if (isToday) classes += ' cal-today';
    
    let tasksHtml = '';
    const displayTasks = dayTasks.slice(0, 3);
    const extraTasks = dayTasks.length - 3;
    
    displayTasks.forEach(t => {
      const opacity = t.completed ? '0.5' : '1';
      const lineThrough = t.completed ? 'line-through' : 'none';
      tasksHtml += `<div class="cal-task" style="background-color: ${t.color || '#8b5cf6'}; opacity: ${opacity}; text-decoration: ${lineThrough};" title="${t.title}">
        ${t.title}
      </div>`;
    });
    
    if (extraTasks > 0) {
      tasksHtml += `<div class="cal-task-more">+${extraTasks} mais</div>`;
    }
    
    html += `
      <div class="${classes}" data-date="${cellDateStr}">
        <div class="cal-day-num">${dayNum}</div>
        <div class="cal-day-tasks">
          ${tasksHtml}
        </div>
      </div>
    `;
  }
  
  container.innerHTML = html;
  
  container.querySelectorAll('.cal-day').forEach(cell => {
    cell.addEventListener('click', (e) => {
      if (e.target.closest('.cal-task')) return;
      
      const dateStr = cell.dataset.date;
      const dateInput = document.getElementById('cal-task-date-input');
      const dateDisplay = document.getElementById('cal-task-date-display');
      if (dateInput) dateInput.value = dateStr;
      if (dateDisplay) {
        const [y, m, d] = dateStr.split('-');
        dateDisplay.textContent = `${d}/${m}/${y}`;
      }
      
      // Popular select de pastas
      const folderSelect = document.getElementById('cal-task-folder-select');
      if (folderSelect) {
        let options = '<option value="">Sem pasta</option>';
        window.AppState.folders.forEach(f => {
          options += `<option value="${f.id}">${f.icon || '📁'} ${f.name}</option>`;
        });
        folderSelect.innerHTML = options;
        if (window.AppState.currentCalendarFilter !== 'all') {
          folderSelect.value = window.AppState.currentCalendarFilter;
        }
      }
      
      if (window.showModal) window.showModal('cal-task-modal');
    });
  });
};

window.Calendar_renderUpcoming = function() {
  const container = document.getElementById('upcoming-list');
  if (!container) return;

  const today = new Date();
  const todayStr = getCalDateStr(today);
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = getCalDateStr(tomorrow);
  
  const next7Days = new Date();
  next7Days.setDate(next7Days.getDate() + 7);
  const next7DaysStr = getCalDateStr(next7Days);

  let tasks = window.AppState.tasks;
  if (window.AppState.currentCalendarFilter !== 'all') {
    tasks = tasks.filter(t => t.folder_id === window.AppState.currentCalendarFilter);
  }

  const todayTasks = tasks.filter(t => t.due_date === todayStr);
  const tomorrowTasks = tasks.filter(t => t.due_date === tomorrowStr);
  const next7Tasks = tasks.filter(t => t.due_date > tomorrowStr && t.due_date <= next7DaysStr);

  const renderGroup = (title, groupTasks) => {
    let html = `
      <div class="upcoming-group">
        <h4 class="upcoming-group-title">${title} <span class="upcoming-count">${groupTasks.length}</span></h4>
        <div class="upcoming-tasks">
    `;
    
    if (groupTasks.length === 0) {
      html += `<p class="upcoming-empty">Nenhuma tarefa.</p>`;
    } else {
      groupTasks.forEach(t => {
        let badgeColor = '#8b5cf6';
        let badgeText = 'Média';
        if (t.priority === 'alta') { badgeColor = '#ef4444'; badgeText = 'Alta'; }
        if (t.priority === 'baixa') { badgeColor = '#22c55e'; badgeText = 'Baixa'; }
        
        html += `
          <div class="upcoming-task ${t.completed ? 'completed' : ''}" data-id="${t.id}">
            <input type="checkbox" class="upcoming-checkbox" ${t.completed ? 'checked' : ''} data-id="${t.id}">
            <span class="upcoming-dot" style="background-color: ${t.color || '#8b5cf6'}"></span>
            <span class="upcoming-title" style="${t.completed ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${t.title}</span>
            <span class="upcoming-priority" style="background-color: ${badgeColor}20; color: ${badgeColor}">${badgeText}</span>
            <button class="task-edit-btn upcoming-edit-btn" data-id="${t.id}" title="Editar" style="margin-left:auto;">✏️</button>
          </div>
        `;
      });
    }
    html += `</div></div>`;
    return html;
  };

  container.innerHTML = renderGroup('Hoje', todayTasks) + renderGroup('Amanhã', tomorrowTasks) + renderGroup('Próximos 7 dias', next7Tasks);

  // Checkbox de conclusão
  container.querySelectorAll('.upcoming-checkbox').forEach(cb => {
    cb.addEventListener('change', async (e) => {
      const id = e.target.dataset.id;
      const completed = e.target.checked;
      
      try {
        const { error } = await window.supabase.from('tasks').update({ completed }).eq('id', id);
        if (error) throw error;
        
        const taskIndex = window.AppState.tasks.findIndex(t => t.id === id);
        if (taskIndex !== -1) {
          window.AppState.tasks[taskIndex].completed = completed;
        }
        
        if (window.App_refreshAll) {
          window.App_refreshAll();
        } else {
          window.Calendar_render();
        }
      } catch (err) {
        console.error(err);
        e.target.checked = !completed;
        window.showToast?.('Erro ao atualizar tarefa', 'error');
      }
    });
  });

  // Botão editar tarefa no upcoming
  container.querySelectorAll('.upcoming-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      const task = window.AppState.tasks.find(t => t.id === id);
      if (!task) return;

      document.getElementById('task-modal-title').textContent = 'Editar Tarefa';
      document.getElementById('task-id-input').value = task.id;
      document.getElementById('task-title-input').value = task.title;
      document.getElementById('task-folder-select').value = task.folder_id || '';
      document.getElementById('task-date-input').value = task.due_date || '';
      document.getElementById('task-priority-select').value = task.priority || 'media';
      document.getElementById('task-color-input').value = task.color || '#8b5cf6';
      
      const colorOptions = document.querySelectorAll('#task-color-options .color-option');
      colorOptions.forEach(opt => {
        if (opt.getAttribute('data-color') === task.color) {
          opt.classList.add('selected');
        } else {
          opt.classList.remove('selected');
        }
      });

      window.showModal('task-modal');
    });
  });
};

