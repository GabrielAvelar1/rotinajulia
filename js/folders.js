// folders.js
// Módulo CRUD de Pastas

window.Folders_init = async function() {
  try {
    const { data: folders, error } = await window.supabase
      .from('folders')
      .select('*')
      .eq('user_id', window.AppState.user.id)
      .order('position', { ascending: true });

    if (error) throw error;

    window.AppState.folders = folders || [];
    window.Folders_render();
    window.Folders_updateDependents();
    window.Folders_setupEventListeners();

  } catch (error) {
    console.error('Erro ao carregar pastas:', error);
    window.showToast('Erro ao carregar pastas', 'error');
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
      }
    });
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
          const { data, error } = await window.supabase
            .from('folders')
            .update(folderData)
            .eq('id', id)
            .select()
            .single();

          if (error) throw error;
          const index = window.AppState.folders.findIndex(f => f.id === id);
          if (index !== -1) window.AppState.folders[index] = data;
          window.showToast('Pasta atualizada!');
        } else {
          // Create
          folderData.position = window.AppState.folders.length;
          const { data, error } = await window.supabase
            .from('folders')
            .insert([folderData])
            .select()
            .single();

          if (error) throw error;
          window.AppState.folders.push(data);
          window.showToast('Pasta criada!');
        }

        window.hideModal('folder-modal');
        window.Folders_render();
        window.Folders_updateDependents();

      } catch (error) {
        console.error('Erro ao salvar pasta:', error);
        window.showToast('Erro ao salvar pasta', 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Salvar';
      }
    });
  }
};
