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

    const coverHtml = folder.cover_url 
      ? `<div class="folder-cover" style="background-image: url('${folder.cover_url}');"></div>`
      : `<div class="folder-cover placeholder-cover"></div>`;

    card.innerHTML = `
      ${coverHtml}
      <div class="folder-content">
        <div class="folder-header" style="color: ${folder.color || '#333'}">
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
};

window.Folders_setupEventListeners = function() {
  const addBtn = document.getElementById('add-folder-btn');
  const grid = document.getElementById('folders-grid');
  const saveBtn = document.getElementById('folder-save-btn');
  const cancelBtn = document.getElementById('folder-cancel-btn');
  const coverInput = document.getElementById('folder-cover-input');
  
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      document.getElementById('folder-id-input').value = '';
      document.getElementById('folder-name-input').value = '';
      document.getElementById('folder-icon-input').value = '📁';
      document.getElementById('folder-color-input').value = '#8b5cf6';
      const preview = document.getElementById('folder-cover-preview');
      if (preview) { preview.src = ''; preview.style.display = 'none'; }
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
          const preview = document.getElementById('folder-cover-preview');
          if (preview) {
            preview.src = e.target.result;
            preview.style.display = 'block';
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
        
        const preview = document.getElementById('folder-cover-preview');
        if (preview) {
          if (folder.cover_url) {
            preview.src = folder.cover_url;
            preview.style.display = 'block';
          } else {
            preview.src = '';
            preview.style.display = 'none';
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
          folderData.position = window.AppState.folders.length; // Adicionar ao final
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
