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

  // Upcoming filter select
  const upcomingFilterSelect = document.getElementById('upcoming-filter-select');
  if (upcomingFilterSelect) {
    upcomingFilterSelect.value = window.AppState.upcomingFilter || 'all';
    upcomingFilterSelect.addEventListener('change', (e) => {
      window.AppState.upcomingFilter = e.target.value;
      window.Calendar_renderUpcoming();
    });
  }

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

  // Day Detail Modal Handlers
  document.getElementById('day-detail-close-btn')?.addEventListener('click', () => {
    window.hideModal('day-detail-modal');
  });
  document.getElementById('day-detail-close-bottom-btn')?.addEventListener('click', () => {
    window.hideModal('day-detail-modal');
  });

  // Color selection in day detail quick add
  document.querySelectorAll('#day-quick-color-options .color-option').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('#day-quick-color-options .color-option').forEach(b => b.classList.remove('selected'));
      e.currentTarget.classList.add('selected');
      const colorInput = document.getElementById('day-quick-color-input');
      if (colorInput) colorInput.value = e.currentTarget.dataset.color || '#8b5cf6';
    });
  });

  // Form de adição rápida no Day Detail Modal
  document.getElementById('day-quick-add-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const titleInput = document.getElementById('day-quick-title-input');
    const title = titleInput ? titleInput.value.trim() : '';
    if (!title) return;

    const dateStr = window.AppState.currentDayDetailDate;
    const folderId = document.getElementById('day-quick-folder-select').value || null;
    const priority = document.getElementById('day-quick-priority-select').value || 'media';
    const color = document.getElementById('day-quick-color-input').value || '#8b5cf6';

    try {
      const user = window.AppState.user;
      const { data, error } = await window.supabase.from('tasks').insert([{
        user_id: user.id,
        folder_id: folderId,
        title,
        due_date: dateStr,
        color,
        priority,
        completed: false
      }]).select();

      if (error) throw error;

      if (data && data.length > 0) {
        window.AppState.tasks.push(data[0]);
        if (titleInput) titleInput.value = '';
        window.Calendar_renderDayDetail(dateStr);
        if (window.App_refreshAll) {
          window.App_refreshAll();
        } else {
          window.Calendar_render();
        }
        window.showToast?.('Tarefa adicionada!', 'success');
      }
    } catch (err) {
      console.error(err);
      window.showToast?.('Erro ao adicionar tarefa', 'error');
    }
  });

  // Eventos na lista de tarefas do Day Detail Modal
  const dayTaskList = document.getElementById('day-detail-tasks-list');
  if (dayTaskList) {
    dayTaskList.addEventListener('click', async (e) => {
      const item = e.target.closest('.day-task-item');
      if (!item) return;
      const taskId = item.getAttribute('data-task-id');
      const task = window.AppState.tasks.find(t => t.id === taskId);
      if (!task) return;

      // Checkbox Toggle
      if (e.target.classList.contains('task-checkbox') || e.target.closest('.task-checkbox')) {
        const checkbox = item.querySelector('.task-checkbox');
        const newCompleted = !task.completed;
        if (e.target.type !== 'checkbox') checkbox.checked = newCompleted;

        try {
          const { error } = await window.supabase
            .from('tasks')
            .update({ completed: newCompleted })
            .eq('id', task.id);
          if (error) throw error;

          task.completed = newCompleted;
          if (window.AppState.currentDayDetailDate) {
            window.Calendar_renderDayDetail(window.AppState.currentDayDetailDate);
          }
          if (window.App_refreshAll) window.App_refreshAll();
        } catch (err) {
          console.error(err);
          checkbox.checked = !newCompleted;
          window.showToast('Erro ao atualizar status', 'error');
        }
        return;
      }

      // Editar Tarefa
      if (e.target.classList.contains('task-edit-btn') || e.target.closest('.task-edit-btn')) {
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
        return;
      }

      // Excluir Tarefa
      if (e.target.classList.contains('task-delete-btn') || e.target.closest('.task-delete-btn')) {
        if (confirm(`Excluir a tarefa "${task.title}"?`)) {
          try {
            const { error } = await window.supabase.from('tasks').delete().eq('id', task.id);
            if (error) throw error;

            window.AppState.tasks = window.AppState.tasks.filter(t => t.id !== task.id);
            if (window.AppState.currentDayDetailDate) {
              window.Calendar_renderDayDetail(window.AppState.currentDayDetailDate);
            }
            if (window.App_refreshAll) window.App_refreshAll();
            window.showToast('Tarefa excluída');
          } catch (err) {
            console.error(err);
            window.showToast('Erro ao excluir tarefa', 'error');
          }
        }
        return;
      }

      // Toque na linha para exibir botões no celular
      const wasActive = item.classList.contains('active');
      dayTaskList.querySelectorAll('.day-task-item').forEach(r => r.classList.remove('active'));
      if (!wasActive) {
        item.classList.add('active');
      }
    });
  }

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
      const dateStr = cell.dataset.date;
      if (!dateStr) return;
      window.Calendar_openDayDetail(dateStr);
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

  const upcomingFilter = window.AppState.upcomingFilter || 'all';

  let todayTasks = tasks.filter(t => t.due_date === todayStr);
  let tomorrowTasks = tasks.filter(t => t.due_date === tomorrowStr);
  let next7Tasks = tasks.filter(t => t.due_date > tomorrowStr && t.due_date <= next7DaysStr);

  if (upcomingFilter === 'pending') {
    todayTasks = todayTasks.filter(t => !t.completed);
    tomorrowTasks = tomorrowTasks.filter(t => !t.completed);
    next7Tasks = next7Tasks.filter(t => !t.completed);
  }

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

  let outputHtml = '';
  if (upcomingFilter === 'today') {
    outputHtml = renderGroup('Hoje', todayTasks);
  } else if (upcomingFilter === 'tomorrow') {
    outputHtml = renderGroup('Amanhã', tomorrowTasks);
  } else if (upcomingFilter === 'next7') {
    outputHtml = renderGroup('Próximos 7 dias', next7Tasks);
  } else {
    // 'all' ou 'pending'
    outputHtml = renderGroup('Hoje', todayTasks) + renderGroup('Amanhã', tomorrowTasks) + renderGroup('Próximos 7 dias', next7Tasks);
  }

  container.innerHTML = outputHtml;

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
      e.stopPropagation();
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

  // Toque na tarefa do upcoming para exibir botão de editar
  container.querySelectorAll('.upcoming-task').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.upcoming-checkbox') || e.target.closest('.upcoming-edit-btn')) return;
      const wasActive = row.classList.contains('active');
      container.querySelectorAll('.upcoming-task').forEach(r => r.classList.remove('active'));
      if (!wasActive) {
        row.classList.add('active');
      }
    });
  });
};

const FULL_WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

window.Calendar_openDayDetail = function(dateStr) {
  if (!dateStr) return;
  window.AppState.currentDayDetailDate = dateStr;
  
  // Popular select de pastas no quick add do dia
  const folderSelect = document.getElementById('day-quick-folder-select');
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

  // Reset do formulário rápido
  const titleInput = document.getElementById('day-quick-title-input');
  if (titleInput) titleInput.value = '';

  const colorInput = document.getElementById('day-quick-color-input');
  if (colorInput) colorInput.value = '#8b5cf6';

  const colorOptions = document.querySelectorAll('#day-quick-color-options .color-option');
  colorOptions.forEach((opt, idx) => {
    if (idx === 0) opt.classList.add('selected');
    else opt.classList.remove('selected');
  });

  window.Calendar_renderDayDetail(dateStr);
  window.showModal('day-detail-modal');
};

window.Calendar_renderDayDetail = function(dateStr) {
  if (!dateStr) return;
  
  const titleEl = document.getElementById('day-detail-date-title');
  const subtitleEl = document.getElementById('day-detail-date-subtitle');
  const taskList = document.getElementById('day-detail-tasks-list');

  const [yStr, mStr, dStr] = dateStr.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10) - 1;
  const d = parseInt(dStr, 10);

  const dateObj = new Date(y, m, d);
  const weekday = FULL_WEEKDAYS[dateObj.getDay()] || '';
  const monthName = MONTH_NAMES[m] || '';

  if (titleEl) {
    titleEl.textContent = `${d} de ${monthName} de ${y}`;
  }

  const dayTasks = window.AppState.tasks.filter(t => t.due_date === dateStr);
  const pending = dayTasks.filter(t => !t.completed).length;

  if (subtitleEl) {
    subtitleEl.textContent = `${weekday} • ${dayTasks.length} tarefa${dayTasks.length !== 1 ? 's' : ''} (${pending} pendente${pending !== 1 ? 's' : ''})`;
  }

  if (!taskList) return;

  if (dayTasks.length === 0) {
    taskList.innerHTML = `<p class="empty-msg" style="text-align:center; padding:18px; color:var(--text-muted); font-size:0.9rem;">
      Nenhuma tarefa agendada para este dia. Adicione uma no campo abaixo!
    </p>`;
    return;
  }

  const priorityColors = {
    'alta': '#ef4444',
    'media': '#f59e0b',
    'baixa': '#22c55e'
  };

  let html = '';
  dayTasks.forEach(task => {
    const isDone = task.completed;
    const pColor = priorityColors[task.priority] || '#8b5cf6';
    const pText = task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : 'Média';
    
    let folderLabel = 'Sem pasta';
    let folderColor = '#8b5cf6';
    if (task.folder_id) {
      const folder = window.AppState.folders.find(f => f.id === task.folder_id);
      if (folder) {
        folderLabel = `${folder.icon || '📁'} ${folder.name}`;
        folderColor = folder.color || '#8b5cf6';
      }
    }

    html += `
      <div class="day-task-item ${isDone ? 'completed' : ''}" data-task-id="${task.id}" style="${isDone ? 'opacity: 0.65;' : ''}">
        <input type="checkbox" class="task-checkbox" ${isDone ? 'checked' : ''} data-id="${task.id}">
        <div class="day-task-title" style="${isDone ? 'text-decoration: line-through;' : ''}">
          ${task.title}
        </div>
        <div class="folder-task-meta">
          <span class="badge" style="background-color: ${folderColor}20; color: ${folderColor}; border: 1px solid ${folderColor}40; font-size:0.75rem;">${folderLabel}</span>
          <span class="badge" style="background-color: ${pColor}25; color: ${pColor}; border: 1px solid ${pColor}50; font-size:0.75rem;">${pText}</span>
          <button class="task-edit-btn" data-id="${task.id}" title="Editar">✏️</button>
          <button class="task-delete-btn" data-id="${task.id}" title="Excluir">🗑️</button>
        </div>
      </div>
    `;
  });

  taskList.innerHTML = html;
};

