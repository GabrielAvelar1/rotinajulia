// tasks.js
// Módulo CRUD de Tarefas e Visão Geral

window.Tasks_init = async function() {
  try {
    // Carregar todas as tarefas do usuário para manter calendário e contadores precisos
    await window.Tasks_fetchAll();
    window.Tasks_updateFilterTabs();
    window.Tasks_setupEventListeners();
  } catch (error) {
    console.error('Erro ao inicializar tarefas:', error);
    window.showToast('Erro ao carregar tarefas', 'error');
  }
};

window.Tasks_fetchAll = async function() {
  const { data, error } = await window.supabase
    .from('tasks')
    .select('*')
    .eq('user_id', window.AppState.user.id)
    .order('due_date', { ascending: true, nullsFirst: false });

  if (error) throw error;

  window.AppState.tasks = data || [];
  window.Tasks_render();
  if (window.Folders_render) window.Folders_render();
  if (window.Calendar_render) window.Calendar_render();
};

window.Tasks_render = function() {
  const tbody = document.getElementById('tasks-tbody');
  const toggleExpandBtn = document.getElementById('toggle-expand-tasks-btn');
  if (!tbody) return;

  tbody.innerHTML = '';

  const filter = window.AppState.currentOverviewFilter;
  let filteredTasks = filter === 'all' 
    ? [...window.AppState.tasks]
    : window.AppState.tasks.filter(t => t.folder_id === filter);

  // Ordenação das tarefas
  const sortMode = window.AppState.taskSort || 'date_asc';
  filteredTasks.sort((a, b) => {
    if (sortMode === 'date_asc') {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    } else if (sortMode === 'date_desc') {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return b.due_date.localeCompare(a.due_date);
    } else if (sortMode === 'priority') {
      const pWeights = { 'alta': 3, 'media': 2, 'baixa': 1 };
      const weightA = pWeights[a.priority] || 0;
      const weightB = pWeights[b.priority] || 0;
      return weightB - weightA;
    } else if (sortMode === 'name') {
      return (a.title || '').localeCompare(b.title || '');
    }
    return 0;
  });

  if (filteredTasks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-msg">Nenhuma tarefa encontrada. Clique em "+ Nova" para adicionar.</td></tr>`;
    if (toggleExpandBtn) toggleExpandBtn.style.display = 'none';
    return;
  }

  // Limite e expansão
  const limitSetting = window.AppState.taskLimit || '15';
  const isExpanded = window.AppState.isOverviewExpanded || false;
  let displayTasks = filteredTasks;

  if (limitSetting !== 'all') {
    const numLimit = parseInt(limitSetting, 10);
    if (filteredTasks.length > numLimit) {
      if (!isExpanded) {
        displayTasks = filteredTasks.slice(0, numLimit);
        if (toggleExpandBtn) {
          toggleExpandBtn.style.display = 'inline-block';
          toggleExpandBtn.innerHTML = `<i class="fas fa-chevron-down"></i> Mostrar mais (${filteredTasks.length - numLimit} restantes)`;
        }
      } else {
        displayTasks = filteredTasks;
        if (toggleExpandBtn) {
          toggleExpandBtn.style.display = 'inline-block';
          toggleExpandBtn.innerHTML = `<i class="fas fa-chevron-up"></i> Recolher tarefas`;
        }
      }
    } else {
      if (toggleExpandBtn) toggleExpandBtn.style.display = 'none';
    }
  } else {
    if (toggleExpandBtn) toggleExpandBtn.style.display = 'none';
  }

  displayTasks.forEach(task => {
    const tr = document.createElement('tr');
    tr.setAttribute('data-task-id', task.id);
    tr.className = 'task-row';
    
    // Obter nome da pasta
    let folderName = 'Sem pasta';
    let folderColor = '#8b5cf6';
    if (task.folder_id) {
      const folder = window.AppState.folders.find(f => f.id === task.folder_id);
      if (folder) {
        folderName = (folder.icon || '📁') + ' ' + folder.name;
        folderColor = folder.color || '#8b5cf6';
      }
    }

    // Cores de prioridade
    const priorityColors = {
      'alta': '#ef4444',
      'media': '#f59e0b',
      'baixa': '#22c55e'
    };
    const pColor = priorityColors[task.priority] || '#8b5cf6';
    
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
        <span class="badge" style="background-color: ${pColor}; color: white;">${task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : 'Média'}</span>
      </td>
      <td class="task-cell-actions">
        <button class="task-edit-btn" title="Editar tarefa">✏️</button>
        <button class="task-delete-btn" title="Excluir tarefa">🗑️</button>
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

    // Atualizar selects de pastas
    const updateSelect = (selectEl, includeEmpty = true) => {
      if (!selectEl) return;
      const currentVal = selectEl.value;
      let options = includeEmpty ? '<option value="">Sem pasta</option>' : '';
      window.AppState.folders.forEach(f => {
        options += `<option value="${f.id}">${f.icon || '📁'} ${f.name}</option>`;
      });
      selectEl.innerHTML = options;
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
  const colorOptionsContainer = document.getElementById('task-color-options');
  const sortSelect = document.getElementById('tasks-sort-select');
  const limitSelect = document.getElementById('tasks-limit-select');
  const toggleExpandBtn = document.getElementById('toggle-expand-tasks-btn');

  // Ordenação
  if (sortSelect) {
    sortSelect.value = window.AppState.taskSort || 'date_asc';
    sortSelect.addEventListener('change', (e) => {
      window.AppState.taskSort = e.target.value;
      window.Tasks_render();
    });
  }

  // Limite de tarefas
  if (limitSelect) {
    limitSelect.value = window.AppState.taskLimit || '15';
    limitSelect.addEventListener('change', (e) => {
      window.AppState.taskLimit = e.target.value;
      window.AppState.isOverviewExpanded = false;
      window.Tasks_render();
    });
  }

  // Botão expandir/recolher
  if (toggleExpandBtn) {
    toggleExpandBtn.addEventListener('click', () => {
      window.AppState.isOverviewExpanded = !window.AppState.isOverviewExpanded;
      window.Tasks_render();
    });
  }

  // Filtros por pasta
  if (tabsContainer) {
    tabsContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('filter-tab')) {
        document.querySelectorAll('#tasks-filter-tabs .filter-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        
        window.AppState.currentOverviewFilter = e.target.getAttribute('data-filter');
        window.Tasks_render();
      }
    });
  }

  // Tabela: Checkbox, Editar, Excluir
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
        if (e.target.type !== 'checkbox') checkbox.checked = newCompleted;
        
        try {
          const { error } = await window.supabase
            .from('tasks')
            .update({ completed: newCompleted })
            .eq('id', task.id);
          if (error) throw error;
          
          task.completed = newCompleted;
          if (window.App_refreshAll) {
            window.App_refreshAll();
          } else {
            window.Tasks_render();
          }
        } catch (error) {
          console.error('Erro ao atualizar tarefa:', error);
          window.showToast('Erro ao atualizar status', 'error');
          checkbox.checked = !newCompleted;
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
        
        // Selecionar cor no modal
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

      // Excluir
      if (e.target.classList.contains('task-delete-btn') || e.target.closest('.task-delete-btn')) {
        if (confirm(`Excluir a tarefa "${task.title}"?`)) {
          try {
            const { error } = await window.supabase
              .from('tasks')
              .delete()
              .eq('id', task.id);
            if (error) throw error;
            
            window.AppState.tasks = window.AppState.tasks.filter(t => t.id !== task.id);
            if (window.App_refreshAll) {
              window.App_refreshAll();
            } else {
              window.Tasks_render();
            }
            window.showToast('Tarefa excluída');
          } catch (error) {
            console.error('Erro ao excluir tarefa:', error);
            window.showToast('Erro ao excluir', 'error');
          }
        }
        return;
      }

      // Ao clicar na linha (em celular ou desktop), alternar visibilidade dos botões
      const wasActive = tr.classList.contains('active');
      tbody.querySelectorAll('.task-row').forEach(r => r.classList.remove('active'));
      if (!wasActive) {
        tr.classList.add('active');
      }
    });
  }

  // Abrir Modal de Nova Tarefa
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      document.getElementById('task-modal-title').textContent = 'Nova Tarefa';
      document.getElementById('task-id-input').value = '';
      document.getElementById('task-title-input').value = '';
      document.getElementById('task-date-input').value = window.getLocalDateString ? window.getLocalDateString() : new Date().toISOString().split('T')[0];
      document.getElementById('task-priority-select').value = 'media';
      document.getElementById('task-color-input').value = '#8b5cf6';
      
      const options = document.querySelectorAll('#task-color-options .color-option');
      if (options.length > 0) {
        options.forEach(opt => opt.classList.remove('selected'));
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

  // Seletor de cores
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

  // Salvar Tarefa (Criar ou Editar)
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const id = document.getElementById('task-id-input').value;
      const title = document.getElementById('task-title-input').value.trim();
      const folder_id = document.getElementById('task-folder-select').value || null;
      const due_date = document.getElementById('task-date-input').value || null;
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
          window.showToast('Tarefa atualizada!');
        } else {
          taskData.completed = false;
          const { data, error } = await window.supabase
            .from('tasks')
            .insert([taskData])
            .select()
            .single();
          if (error) throw error;
          
          window.AppState.tasks.unshift(data);
          window.showToast('Tarefa criada!');
        }

        window.hideModal('task-modal');
        if (window.App_refreshAll) {
          window.App_refreshAll();
        } else {
          window.Tasks_render();
        }

      } catch (error) {
        console.error('Erro ao salvar tarefa:', error);
        window.showToast('Erro ao salvar tarefa', 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Salvar';
      }
    });
  }
};

