// tasks.js
// Módulo CRUD de Tarefas e Visão Geral

window.Tasks_init = async function() {
  try {
    // Carregar primeira página de tarefas
    await window.Tasks_fetchPage();
    window.Tasks_updateFilterTabs();
    window.Tasks_setupEventListeners();
  } catch (error) {
    console.error('Erro ao inicializar tarefas:', error);
    window.showToast('Erro ao carregar tarefas', 'error');
  }
};

window.Tasks_fetchPage = async function() {
  const from = window.AppState.taskPage * window.AppState.tasksPerPage;
  const to = from + window.AppState.tasksPerPage - 1;

  let query = window.supabase
    .from('tasks')
    .select('*')
    .eq('user_id', window.AppState.user.id)
    .order('created_at', { ascending: false })
    .range(from, to);

  const { data, error } = await query;
  if (error) throw error;

  if (window.AppState.taskPage === 0) {
    window.AppState.tasks = data || [];
  } else {
    // Adicionar as novas tarefas evitando duplicatas
    const existingIds = new Set(window.AppState.tasks.map(t => t.id));
    const newTasks = (data || []).filter(t => !existingIds.has(t.id));
    window.AppState.tasks = [...window.AppState.tasks, ...newTasks];
  }

  window.Tasks_render();
};

window.Tasks_render = function() {
  const tbody = document.getElementById('tasks-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  const filter = window.AppState.currentOverviewFilter;
  const filteredTasks = filter === 'all' 
    ? window.AppState.tasks 
    : window.AppState.tasks.filter(t => t.folder_id === filter);

  filteredTasks.forEach(task => {
    const tr = document.createElement('tr');
    tr.setAttribute('data-task-id', task.id);
    tr.className = 'task-row';
    
    // Obter nome da pasta
    let folderName = 'Sem pasta';
    let folderColor = '#888';
    if (task.folder_id) {
      const folder = window.AppState.folders.find(f => f.id === task.folder_id);
      if (folder) {
        folderName = folder.icon + ' ' + folder.name;
        folderColor = folder.color || '#2196F3';
      }
    }

    // Cores de prioridade
    const priorityColors = {
      'alta': '#f44336',
      'media': '#ff9800',
      'baixa': '#4caf50'
    };
    const pColor = priorityColors[task.priority] || '#888';
    
    const textStyle = task.completed ? 'text-decoration: line-through; opacity: 0.6;' : '';
    
    tr.innerHTML = `
      <td class="task-cell-checkbox">
        <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
      </td>
      <td class="task-cell-title" style="${textStyle}">
        ${task.title}
      </td>
      <td class="task-cell-folder">
        <span class="badge" style="background-color: ${folderColor}20; color: ${folderColor}; border: 1px solid ${folderColor};">${folderName}</span>
      </td>
      <td class="task-cell-date">
        ${window.formatDate(task.due_date)}
      </td>
      <td class="task-cell-priority">
        <span class="badge" style="background-color: ${pColor}; color: white;">${task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : ''}</span>
      </td>
      <td class="task-cell-actions">
        <button class="task-delete-btn" title="Excluir">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
};

window.Tasks_updateFilterTabs = function() {
  const tabsContainer = document.getElementById('tasks-filter-tabs');
  const calFolderSelect = document.getElementById('cal-task-folder-select');
  const taskFolderSelect = document.getElementById('task-folder-select');
  
  if (tabsContainer) {
    let tabsHtml = `<button class="filter-tab ${window.AppState.currentOverviewFilter === 'all' ? 'active' : ''}" data-filter="all">Todas</button>`;
    
    window.AppState.folders.forEach(folder => {
      const isActive = window.AppState.currentOverviewFilter === folder.id;
      tabsHtml += `<button class="filter-tab ${isActive ? 'active' : ''}" data-filter="${folder.id}">
        ${folder.icon || '📁'} ${folder.name}
      </button>`;
    });
    
    tabsContainer.innerHTML = tabsHtml;

    // Atualizar selects de pastas também, já que dependem da mesma lista de pastas
    const updateSelect = (selectEl, includeEmpty = true) => {
      if (!selectEl) return;
      // Salva valor atual
      const currentVal = selectEl.value;
      let options = includeEmpty ? '<option value="">Sem pasta</option>' : '';
      window.AppState.folders.forEach(f => {
        options += `<option value="${f.id}">${f.icon || '📁'} ${f.name}</option>`;
      });
      selectEl.innerHTML = options;
      // Restaura se ainda existir
      if (currentVal && window.AppState.folders.find(f => f.id === currentVal)) {
        selectEl.value = currentVal;
      }
    };
    
    updateSelect(taskFolderSelect, true);
    updateSelect(calFolderSelect, true);
  }
};

window.Tasks_getAll = function() {
  return window.AppState.tasks;
};

window.Tasks_setupEventListeners = function() {
  const tabsContainer = document.getElementById('tasks-filter-tabs');
  const tbody = document.getElementById('tasks-tbody');
  const addBtn = document.getElementById('add-task-btn');
  const saveBtn = document.getElementById('task-save-btn');
  const cancelBtn = document.getElementById('task-cancel-btn');
  const loadMoreBtn = document.getElementById('load-more-btn');
  const colorOptionsContainer = document.getElementById('task-color-options');

  if (tabsContainer) {
    tabsContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('filter-tab')) {
        // Atualizar UI
        document.querySelectorAll('#tasks-filter-tabs .filter-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        
        // Atualizar estado e renderizar
        window.AppState.currentOverviewFilter = e.target.getAttribute('data-filter');
        window.Tasks_render();
      }
    });
  }

  if (tbody) {
    tbody.addEventListener('click', async (e) => {
      const tr = e.target.closest('tr');
      if (!tr) return;
      const taskId = tr.getAttribute('data-task-id');
      const task = window.AppState.tasks.find(t => t.id === taskId);
      if (!task) return;

      // Toggle completo
      if (e.target.classList.contains('task-checkbox') || e.target.closest('.task-cell-checkbox')) {
        const checkbox = tr.querySelector('.task-checkbox');
        const newCompleted = !task.completed;
        // Evitar multiplos clicks
        if (e.target.type !== 'checkbox') checkbox.checked = newCompleted;
        
        try {
          const { error } = await window.supabase
            .from('tasks')
            .update({ completed: newCompleted })
            .eq('id', task.id);
          if (error) throw error;
          
          task.completed = newCompleted;
          window.Tasks_render();
          if (window.Calendar_render) window.Calendar_render();
        } catch (error) {
          console.error('Erro ao atualizar tarefa:', error);
          window.showToast('Erro ao atualizar status', 'error');
          checkbox.checked = !newCompleted; // Reverter
        }
      }

      // Excluir
      if (e.target.classList.contains('task-delete-btn')) {
        if (confirm(`Excluir a tarefa "${task.title}"?`)) {
          try {
            const { error } = await window.supabase
              .from('tasks')
              .delete()
              .eq('id', task.id);
            if (error) throw error;
            
            window.AppState.tasks = window.AppState.tasks.filter(t => t.id !== task.id);
            window.Tasks_render();
            if (window.Calendar_render) window.Calendar_render();
            window.showToast('Tarefa excluída');
          } catch (error) {
            console.error('Erro ao excluir tarefa:', error);
            window.showToast('Erro ao excluir', 'error');
          }
        }
      }
    });
  }

  if (addBtn) {
    addBtn.addEventListener('click', () => {
      document.getElementById('task-id-input').value = '';
      document.getElementById('task-title-input').value = '';
      document.getElementById('task-date-input').value = new Date().toISOString().split('T')[0];
      document.getElementById('task-priority-select').value = 'media';
      document.getElementById('task-color-input').value = '#2196F3';
      
      // Reset color selection if we had UI for it
      const options = document.querySelectorAll('.color-option');
      if (options.length > 0) {
        options.forEach(opt => opt.classList.remove('selected'));
        // Select first by default if any
        options[0].classList.add('selected');
        document.getElementById('task-color-input').value = options[0].getAttribute('data-color');
      }

      window.showModal('task-modal');
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      window.hideModal('task-modal');
    });
  }

  if (colorOptionsContainer) {
    colorOptionsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.color-option');
      if (btn) {
        colorOptionsContainer.querySelectorAll('.color-option').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        document.getElementById('task-color-input').value = btn.getAttribute('data-color');
      }
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const id = document.getElementById('task-id-input').value;
      const title = document.getElementById('task-title-input').value.trim();
      const folder_id = document.getElementById('task-folder-select').value || null;
      const due_date = document.getElementById('task-date-input').value;
      const priority = document.getElementById('task-priority-select').value;
      const color = document.getElementById('task-color-input').value;

      if (!title) {
        window.showToast('Título é obrigatório', 'error');
        return;
      }

      try {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Salvando...';

        const taskData = {
          title,
          folder_id,
          due_date,
          priority,
          color,
          user_id: window.AppState.user.id
        };

        if (id) {
          const { data, error } = await window.supabase
            .from('tasks')
            .update(taskData)
            .eq('id', id)
            .select()
            .single();
          if (error) throw error;
          
          const index = window.AppState.tasks.findIndex(t => t.id === id);
          if (index !== -1) window.AppState.tasks[index] = data;
          window.showToast('Tarefa atualizada');
        } else {
          taskData.completed = false;
          const { data, error } = await window.supabase
            .from('tasks')
            .insert([taskData])
            .select()
            .single();
          if (error) throw error;
          
          window.AppState.tasks.unshift(data); // Add no inicio
          window.showToast('Tarefa criada');
        }

        window.hideModal('task-modal');
        window.Tasks_render();
        if (window.Folders_render) window.Folders_render(); // Para atualizar contador de tarefas na pasta
        if (window.Calendar_render) window.Calendar_render();

      } catch (error) {
        console.error('Erro ao salvar tarefa:', error);
        window.showToast('Erro ao salvar tarefa', 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Salvar';
      }
    });
  }

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', async () => {
      window.AppState.taskPage++;
      const btnOrigText = loadMoreBtn.textContent;
      loadMoreBtn.textContent = 'Carregando...';
      loadMoreBtn.disabled = true;
      try {
        await window.Tasks_fetchPage();
      } finally {
        loadMoreBtn.textContent = btnOrigText;
        loadMoreBtn.disabled = false;
      }
    });
  }
};
