// folders.js
// Módulo CRUD de Pastas

window.Folders_init = async function() {
  try {
    // 1. Carregar pastas do cache local imediatamente (0ms de espera)
    const cached = localStorage.getItem('rotina_cached_folders');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          window.AppState.folders = parsed;
          window.Folders_render();
          window.Folders_updateDependents();
        }
      } catch (e) {
        console.warn('Erro ao ler cache de pastas:', e);
      }
    }

    // 2. Garantir usuário logado
    if (!window.AppState.user || !window.AppState.user.id) {
      try {
        const { data: { user } } = await window.supabase.auth.getUser();
        if (user) {
          window.AppState.user = user;
        } else {
          return;
        }
      } catch (e) {
        return;
      }
    }

    let res = await window.supabase
      .from('folders')
      .select('*')
      .eq('user_id', window.AppState.user.id)
      .order('position', { ascending: true });

    // Retry uma vez se falhar por instabilidade
    if (res.error) {
      await new Promise(r => setTimeout(r, 600));
      res = await window.supabase
        .from('folders')
        .select('*')
        .eq('user_id', window.AppState.user.id)
        .order('position', { ascending: true });
    }

    if (!res.error && res.data) {
      window.AppState.folders = res.data;
      try {
        localStorage.setItem('rotina_cached_folders', JSON.stringify(res.data));
      } catch (e) {}
      window.Folders_render();
      window.Folders_updateDependents();
    }

    window.Folders_setupEventListeners();

  } catch (error) {
    console.error('Erro ao carregar pastas:', error);
  }
};

window.Folders_render = function() {
  const grid = document.getElementById('folders-grid');
  if (!grid) return;

  grid.innerHTML = '';

  window.AppState.folders.forEach(folder => {
    // Contar tarefas para esta pasta
    const tasksCount = window.AppState.tasks.filter(t => t.folder_id === folder.id && !t.completed).length;

    const card = document.createElement('div');
    card.className = 'folder-card';
    card.setAttribute('data-folder-id', folder.id);
    card.style.position = 'relative';

    const pos = folder.cover_position || '50% 50%';
    const coverHtml = folder.cover_url 
      ? `<div class="folder-cover" style="background-image: url('${folder.cover_url}'); background-position: ${pos};"></div>`
      : `<div class="folder-cover placeholder-cover"></div>`;

    card.innerHTML = `
      ${coverHtml}
      <div class="folder-content">
        <div class="folder-header" style="color: ${folder.color || '#8b5cf6'}">
          <span class="folder-icon">${folder.icon || '📁'}</span>
          <h3 class="folder-name">${folder.name}</h3>
        </div>
        <p class="folder-meta">${tasksCount} tarefas pendentes</p>
      </div>
      <div class="folder-actions">
        <button class="folder-edit-btn" title="Editar">✏️</button>
        <button class="folder-delete-btn" title="Excluir">🗑️</button>
      </div>
    `;

    grid.appendChild(card);
  });
};

window.Folders_updateDependents = function() {
  if (window.Tasks_updateFilterTabs) window.Tasks_updateFilterTabs();
  if (window.Calendar_updateFilterTabs) window.Calendar_updateFilterTabs();
  if (window.App_refreshAll) window.App_refreshAll();
};

window.Folders_setupEventListeners = function() {
  if (window._foldersListenersSetup) return;
  window._foldersListenersSetup = true;

  const addBtn = document.getElementById('add-folder-btn');
  const grid = document.getElementById('folders-grid');
  const saveBtn = document.getElementById('folder-save-btn');
  const cancelBtn = document.getElementById('folder-cancel-btn');
  const coverInput = document.getElementById('folder-cover-input');
  const preview = document.getElementById('folder-cover-preview');
  const cropContainer = document.getElementById('cover-crop-container');
  const posInput = document.getElementById('folder-cover-position-input');

  let isDragging = false;
  let startX = 0, startY = 0;
  let currentPosX = 50, currentPosY = 50;

  function parsePosition(posStr) {
    if (!posStr) return { x: 50, y: 50 };
    if (posStr === 'center') return { x: 50, y: 50 };
    if (posStr === 'top') return { x: 50, y: 0 };
    if (posStr === 'bottom') return { x: 50, y: 100 };
    if (posStr === '25%') return { x: 50, y: 25 };
    if (posStr === '75%') return { x: 50, y: 75 };
    
    const parts = posStr.split(' ');
    if (parts.length === 2) {
      const x = parseFloat(parts[0]) || 50;
      const y = parseFloat(parts[1]) || 50;
      return { x, y };
    } else if (parts.length === 1) {
      const y = parseFloat(parts[0]) || 50;
      return { x: 50, y };
    }
    return { x: 50, y: 50 };
  }

  function updatePosition(x, y) {
    currentPosX = Math.max(0, Math.min(100, x));
    currentPosY = Math.max(0, Math.min(100, y));
    const val = `${currentPosX.toFixed(1)}% ${currentPosY.toFixed(1)}%`;
    if (preview) preview.style.objectPosition = val;
    if (posInput) posInput.value = val;
  }

  if (cropContainer) {
    const handleDragStart = (e) => {
      isDragging = true;
      cropContainer.classList.add('dragging');
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      startX = clientX;
      startY = clientY;
      
      const parsed = parsePosition(posInput ? posInput.value : '50% 50%');
      currentPosX = parsed.x;
      currentPosY = parsed.y;
    };

    const handleDragMove = (e) => {
      if (!isDragging) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      
      const rect = cropContainer.getBoundingClientRect();
      const deltaX = clientX - startX;
      const deltaY = clientY - startY;
      
      const newX = currentPosX - (deltaX / rect.width) * 70;
      const newY = currentPosY - (deltaY / rect.height) * 70;
      
      updatePosition(newX, newY);
      startX = clientX;
      startY = clientY;
      
      if (e.cancelable) e.preventDefault();
    };

    const handleDragEnd = () => {
      if (isDragging) {
        isDragging = false;
        cropContainer.classList.remove('dragging');
      }
    };

    cropContainer.addEventListener('mousedown', handleDragStart);
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);

    cropContainer.addEventListener('touchstart', handleDragStart, { passive: false });
    window.addEventListener('touchmove', handleDragMove, { passive: false });
    window.addEventListener('touchend', handleDragEnd);
  }
  
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      document.getElementById('folder-id-input').value = '';
      document.getElementById('folder-name-input').value = '';
      document.getElementById('folder-icon-input').value = '📁';
      document.getElementById('folder-color-input').value = '#8b5cf6';
      if (posInput) posInput.value = '50% 50%';
      if (preview) {
        preview.src = '';
        preview.style.objectPosition = '50% 50%';
      }
      if (cropContainer) cropContainer.style.display = 'none';
      if (coverInput) coverInput.value = '';
      window.showModal('folder-modal');
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      window.hideModal('folder-modal');
    });
  }

  if (coverInput) {
    coverInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
          if (preview && cropContainer) {
            preview.src = e.target.result;
            cropContainer.style.display = 'block';
            if (posInput) posInput.value = '50% 50%';
            preview.style.objectPosition = '50% 50%';
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (grid) {
    grid.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('.folder-edit-btn');
      const deleteBtn = e.target.closest('.folder-delete-btn');
      const card = e.target.closest('.folder-card');

      if (!card) return;
      const folderId = card.getAttribute('data-folder-id');
      const folder = window.AppState.folders.find(f => f.id === folderId);
      if (!folder) return;

      if (editBtn) {
        document.getElementById('folder-id-input').value = folder.id;
        document.getElementById('folder-name-input').value = folder.name;
        document.getElementById('folder-icon-input').value = folder.icon || '📁';
        document.getElementById('folder-color-input').value = folder.color || '#8b5cf6';
        
        const pos = folder.cover_position || '50% 50%';
        if (posInput) posInput.value = pos;
        
        if (preview && cropContainer) {
          if (folder.cover_url) {
            preview.src = folder.cover_url;
            cropContainer.style.display = 'block';
            preview.style.objectPosition = pos;
          } else {
            preview.src = '';
            cropContainer.style.display = 'none';
          }
        }
        if (coverInput) coverInput.value = '';
        
        window.showModal('folder-modal');
        return;
      }

      if (deleteBtn) {
        if (confirm(`Tem certeza que deseja excluir a pasta "${folder.name}"?`)) {
          try {
            const { error } = await window.supabase
              .from('folders')
              .delete()
              .eq('id', folder.id);

            if (error) throw error;
            
            window.AppState.folders = window.AppState.folders.filter(f => f.id !== folder.id);
            window.Folders_render();
            window.Folders_updateDependents();
            window.showToast('Pasta excluída com sucesso!');
          } catch (error) {
            console.error('Erro ao excluir pasta:', error);
            window.showToast('Erro ao excluir pasta', 'error');
          }
        }
        return;
      }

      // Ao clicar no card da pasta (sem ser nos botões de editar/excluir), abre os detalhes da pasta
      window.AppState.currentFolderDetailId = folder.id;
      window.AppState.currentFolderDetailFilter = 'all';
      window.Folders_renderDetailModal(folder.id);
      window.showModal('folder-detail-modal');
    });
  }

  // Eventos do Modal de Detalhes da Pasta
  const folderDetailModal = document.getElementById('folder-detail-modal');
  if (folderDetailModal) {
    document.getElementById('folder-detail-close-btn')?.addEventListener('click', () => {
      window.hideModal('folder-detail-modal');
    });
    document.getElementById('folder-detail-close-bottom-btn')?.addEventListener('click', () => {
      window.hideModal('folder-detail-modal');
    });

    // Filtros por status dentro da pasta (Todas, Pendentes, Concluídas)
    const folderTabs = document.getElementById('folder-detail-tabs');
    if (folderTabs) {
      folderTabs.addEventListener('click', (e) => {
        const tab = e.target.closest('.filter-tab');
        if (tab) {
          folderTabs.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          window.AppState.currentFolderDetailFilter = tab.getAttribute('data-filter') || 'all';
          if (window.AppState.currentFolderDetailId) {
            window.Folders_renderDetailModal(window.AppState.currentFolderDetailId);
          }
        }
      });
    }

    // Botão Adicionar Tarefa nesta Pasta
    document.getElementById('folder-detail-add-task-btn')?.addEventListener('click', () => {
      const folderId = window.AppState.currentFolderDetailId;
      document.getElementById('task-modal-title').textContent = 'Nova Tarefa';
      document.getElementById('task-id-input').value = '';
      document.getElementById('task-title-input').value = '';
      document.getElementById('task-folder-select').value = folderId || '';
      document.getElementById('task-date-input').value = window.getLocalDateString ? window.getLocalDateString() : '';
      document.getElementById('task-priority-select').value = 'media';
      document.getElementById('task-color-input').value = '#8b5cf6';
      
      const colorOptions = document.querySelectorAll('#task-color-options .color-option');
      colorOptions.forEach((opt, idx) => {
        if (idx === 0) opt.classList.add('selected');
        else opt.classList.remove('selected');
      });

      window.showModal('task-modal');
    });

    // Eventos na lista de tarefas da pasta (checkbox, editar, excluir, toque para ações)
    const taskList = document.getElementById('folder-detail-tasks-list');
    if (taskList) {
      taskList.addEventListener('click', async (e) => {
        const item = e.target.closest('.folder-task-item');
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

            // Gamificação: +8 XP por tarefa concluída, -8 XP se desmarcada
            if (window.Gamification_addXP && window.Gamification_removeXP) {
              if (newCompleted) {
                window.Gamification_addXP(8, 'Tarefa concluída');
              } else {
                window.Gamification_removeXP(8);
              }
            }

            if (window.AppState.currentFolderDetailId) {
              window.Folders_renderDetailModal(window.AppState.currentFolderDetailId);
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
              if (window.AppState.currentFolderDetailId) {
                window.Folders_renderDetailModal(window.AppState.currentFolderDetailId);
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

        // Toque na linha para exibir os botões no celular
        const wasActive = item.classList.contains('active');
        taskList.querySelectorAll('.folder-task-item').forEach(r => r.classList.remove('active'));
        if (!wasActive) {
          item.classList.add('active');
        }
      });
    }
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const id = document.getElementById('folder-id-input').value;
      const name = document.getElementById('folder-name-input').value.trim();
      const icon = document.getElementById('folder-icon-input').value.trim();
      const color = document.getElementById('folder-color-input').value;
      const cover_position = posInput ? posInput.value : '50% 50%';
      const file = coverInput ? coverInput.files[0] : null;

      if (!name) {
        window.showToast('O nome da pasta é obrigatório', 'error');
        return;
      }

      try {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Salvando...';

        let cover_url = undefined;
        if (file) {
          cover_url = await window.uploadImage(file, 'covers');
        }

        const folderData = {
          name,
          icon,
          color,
          cover_position,
          user_id: window.AppState.user.id
        };
        
        if (cover_url !== undefined) folderData.cover_url = cover_url;

        if (id) {
          // Update
          let updateData = { ...folderData };
          let res = await window.supabase
            .from('folders')
            .update(updateData)
            .eq('id', id)
            .select();

          // Se falhar por causa da coluna cover_position não existir no banco
          if (res.error && (res.error.message?.includes('cover_position') || res.error.code === '42703' || res.error.code === 'PGRST204')) {
            delete updateData.cover_position;
            res = await window.supabase
              .from('folders')
              .update(updateData)
              .eq('id', id)
              .select();
            if (res.data && res.data[0]) {
              res.data[0].cover_position = folderData.cover_position;
            }
          }

          if (res.error) throw res.error;

          const updatedFolder = (res.data && res.data[0]) ? res.data[0] : { id, ...folderData };
          const index = window.AppState.folders.findIndex(f => f.id === id);
          if (index !== -1) window.AppState.folders[index] = updatedFolder;
          window.showToast('Pasta atualizada!');
        } else {
          // Create
          let insertData = { ...folderData, position: window.AppState.folders.length };
          let res = await window.supabase
            .from('folders')
            .insert([insertData])
            .select();

          // Se falhar por causa da coluna cover_position não existir no banco
          if (res.error && (res.error.message?.includes('cover_position') || res.error.code === '42703' || res.error.code === 'PGRST204')) {
            delete insertData.cover_position;
            res = await window.supabase
              .from('folders')
              .insert([insertData])
              .select();
            if (res.data && res.data[0]) {
              res.data[0].cover_position = folderData.cover_position;
            }
          }

          if (res.error) throw res.error;

          const newFolder = (res.data && res.data[0]) ? res.data[0] : insertData;
          window.AppState.folders.push(newFolder);
          window.showToast('Pasta criada!');
        }

        window.hideModal('folder-modal');
        window.Folders_render();
        window.Folders_updateDependents();

      } catch (error) {
        console.error('Erro ao salvar pasta:', error);
        window.showToast('Erro ao salvar pasta: ' + (error.message || 'Verifique o banco'), 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Salvar';
      }
    });
  }
};

window.Folders_renderDetailModal = function(folderId) {
  const folder = window.AppState.folders.find(f => f.id === folderId);
  if (!folder) return;

  const banner = document.getElementById('folder-detail-banner');
  const iconEl = document.getElementById('folder-detail-icon');
  const titleEl = document.getElementById('folder-detail-title');
  const statsEl = document.getElementById('folder-detail-stats');
  const taskList = document.getElementById('folder-detail-tasks-list');

  // Configurar banner da pasta
  if (banner) {
    const pos = folder.cover_position || '50% 50%';
    if (folder.cover_url) {
      banner.style.backgroundImage = `url('${folder.cover_url}')`;
      banner.style.backgroundPosition = pos;
    } else {
      banner.style.backgroundImage = `linear-gradient(135deg, #1a1a2e 0%, #3b1b54 50%, #2d1b69 100%)`;
      banner.style.backgroundPosition = 'center center';
    }
  }

  if (iconEl) iconEl.textContent = folder.icon || '📁';
  if (titleEl) {
    titleEl.textContent = folder.name;
    titleEl.style.color = folder.color || '#fff';
  }

  // Filtrar tarefas desta pasta
  const allFolderTasks = window.AppState.tasks.filter(t => t.folder_id === folder.id);
  const pendingTasks = allFolderTasks.filter(t => !t.completed);
  const completedTasks = allFolderTasks.filter(t => t.completed);

  if (statsEl) {
    statsEl.textContent = `${pendingTasks.length} pendentes • ${completedTasks.length} concluídas`;
  }

  // Aplicar filtro da aba ativa (all, pending, completed)
  const currentTab = window.AppState.currentFolderDetailFilter || 'all';
  let displayTasks = allFolderTasks;
  if (currentTab === 'pending') displayTasks = pendingTasks;
  if (currentTab === 'completed') displayTasks = completedTasks;

  // Ordenar por data
  displayTasks.sort((a, b) => {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });

  if (!taskList) return;

  if (displayTasks.length === 0) {
    taskList.innerHTML = `<p class="empty-msg" style="text-align:center; padding:20px; color:var(--text-muted);">
      Nenhuma tarefa ${currentTab === 'pending' ? 'pendente' : (currentTab === 'completed' ? 'concluída' : 'cadastrada')} nesta pasta.
    </p>`;
    return;
  }

  const priorityColors = {
    'alta': '#ef4444',
    'media': '#f59e0b',
    'baixa': '#22c55e'
  };

  let html = '';
  displayTasks.forEach(task => {
    const isDone = task.completed;
    const pColor = priorityColors[task.priority] || '#8b5cf6';
    const pText = task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : 'Média';
    const dateFormatted = task.due_date ? window.formatDate(task.due_date) : 'Sem data';

    html += `
      <div class="folder-task-item ${isDone ? 'completed' : ''}" data-task-id="${task.id}" style="${isDone ? 'opacity: 0.65;' : ''}">
        <input type="checkbox" class="task-checkbox" ${isDone ? 'checked' : ''} data-id="${task.id}">
        <div class="folder-task-content">
          <div class="folder-task-title" style="${isDone ? 'text-decoration: line-through;' : ''}">
            ${task.title}
          </div>
          <div class="folder-task-meta">
            <span class="folder-task-date"><i class="far fa-calendar"></i> ${dateFormatted}</span>
            <span class="badge" style="background-color: ${pColor}25; color: ${pColor}; border: 1px solid ${pColor}50;">${pText}</span>
          </div>
        </div>
        <div class="folder-task-actions">
          <button class="task-edit-btn" data-id="${task.id}" title="Editar">✏️</button>
          <button class="task-delete-btn" data-id="${task.id}" title="Excluir">🗑️</button>
        </div>
      </div>
    `;
  });

  taskList.innerHTML = html;
};
