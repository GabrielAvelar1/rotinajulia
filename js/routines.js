// routines.js
// Módulo de Rotinas e Hábitos

window.Routines_init = async function() {
  const dateLabel = document.getElementById('routines-date-label');
  if (dateLabel) {
    const today = new Date();
    dateLabel.textContent = today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  // Load today's logs and routines
  const user = window.AppState.user;
  const todayStr = new Date().toISOString().split('T')[0];
  
  if (user) {
    try {
      // Carregar rotinas
      const { data: routines, error: routinesError } = await window.supabase
        .from('routines')
        .select('*')
        .eq('user_id', user.id)
        .order('position', { ascending: true });
      
      if (!routinesError && routines) {
        window.AppState.routines = routines;
      }

      // Carregar logs de hoje
      const { data, error } = await window.supabase
        .from('routine_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('completed_date', todayStr);
        
      if (!error && data) {
        window.AppState.routineLogs = data;
      }
    } catch (err) {
      console.error('Erro ao carregar rotinas:', err);
    }
  }

  // Modal events
  document.getElementById('add-routine-btn')?.addEventListener('click', () => {
    document.getElementById('routine-id-input').value = '';
    document.getElementById('routine-title-input').value = '';
    document.getElementById('routine-icon-input').value = '✨';
    if (window.showModal) window.showModal('routine-modal');
  });

  document.getElementById('routine-cancel-btn')?.addEventListener('click', () => {
    if (window.hideModal) window.hideModal('routine-modal');
  });

  document.getElementById('routine-save-btn')?.addEventListener('click', async () => {
    try {
      const id = document.getElementById('routine-id-input').value;
      const title = document.getElementById('routine-title-input').value;
      const icon = document.getElementById('routine-icon-input').value || '✨';
      
      if (!title) {
        window.showToast?.('O título é obrigatório.', 'error');
        return;
      }
      
      const user = window.AppState.user;
      
      let res;
      if (id) {
        res = await window.supabase.from('routines').update({ title, icon }).eq('id', id).select();
      } else {
        res = await window.supabase.from('routines').insert([{
          user_id: user.id,
          title,
          icon,
          position: window.AppState.routines.length
        }]).select();
      }
      
      if (res.error) throw res.error;
      
      if (id) {
        const idx = window.AppState.routines.findIndex(r => r.id === id);
        if (idx !== -1) window.AppState.routines[idx] = res.data[0];
      } else {
        window.AppState.routines.push(res.data[0]);
      }
      
      window.Routines_render();
      if (window.Charts_render) window.Charts_render();
      if (window.hideModal) window.hideModal('routine-modal');
      window.showToast?.('Rotina salva com sucesso!', 'success');
    } catch (err) {
      console.error(err);
      window.showToast?.('Erro ao salvar rotina.', 'error');
    }
  });

  // Delegate events for list
  const list = document.getElementById('routines-list');
  if (list) {
    list.addEventListener('change', async (e) => {
      if (e.target.classList.contains('routine-checkbox')) {
        const id = e.target.dataset.id;
        const completed = e.target.checked;
        const todayStr = new Date().toISOString().split('T')[0];
        const user = window.AppState.user;
        
        try {
          // Check if log exists
          let existingLog = window.AppState.routineLogs.find(l => l.routine_id === id && l.completed_date === todayStr);
          
          if (existingLog) {
            const { error } = await window.supabase.from('routine_logs').update({ completed }).eq('id', existingLog.id);
            if (error) throw error;
            existingLog.completed = completed;
          } else {
            const { data, error } = await window.supabase.from('routine_logs').insert([{
              routine_id: id,
              user_id: user.id,
              completed_date: todayStr,
              completed
            }]).select();
            if (error) throw error;
            if (data && data.length > 0) {
              window.AppState.routineLogs.push(data[0]);
            }
          }
          window.Routines_render();
          if (window.Charts_render) window.Charts_render();
        } catch (err) {
          console.error(err);
          e.target.checked = !completed;
          window.showToast?.('Erro ao atualizar.', 'error');
        }
      }
    });

    list.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('.routine-edit-btn');
      if (editBtn) {
        const id = editBtn.dataset.id;
        const routine = window.AppState.routines.find(r => r.id === id);
        if (routine) {
          document.getElementById('routine-id-input').value = routine.id;
          document.getElementById('routine-title-input').value = routine.title;
          document.getElementById('routine-icon-input').value = routine.icon;
          if (window.showModal) window.showModal('routine-modal');
        }
        return;
      }

      const delBtn = e.target.closest('.routine-delete-btn');
      if (delBtn) {
        if (!confirm('Deseja excluir este hábito? Os dados do histórico também serão perdidos.')) return;
        
        const id = delBtn.dataset.id;
        try {
          const { error } = await window.supabase.from('routines').delete().eq('id', id);
          if (error) throw error;
          
          window.AppState.routines = window.AppState.routines.filter(r => r.id !== id);
          window.AppState.routineLogs = window.AppState.routineLogs.filter(l => l.routine_id !== id);
          
          window.Routines_render();
          if (window.Charts_render) window.Charts_render();
          window.showToast?.('Hábito removido.', 'success');
        } catch (err) {
          console.error(err);
          window.showToast?.('Erro ao deletar.', 'error');
        }
      }
    });
  }

  window.Routines_render();
};

window.Routines_render = function() {
  const container = document.getElementById('routines-list');
  if (!container) return;

  const todayStr = new Date().toISOString().split('T')[0];
  let html = '';
  
  let completedCount = 0;

  window.AppState.routines.forEach(routine => {
    const todayLog = window.AppState.routineLogs.find(l => l.routine_id === routine.id && l.completed_date === todayStr);
    const isCompleted = todayLog ? todayLog.completed : false;
    if (isCompleted) completedCount++;

    html += `
      <div class="routine-item" data-routine-id="${routine.id}" style="${isCompleted ? 'opacity: 0.6;' : ''}">
        <input type="checkbox" class="routine-checkbox" data-id="${routine.id}" ${isCompleted ? 'checked' : ''}>
        <div class="routine-icon">${routine.icon || '✨'}</div>
        <div class="routine-title" style="${isCompleted ? 'text-decoration: line-through;' : ''}">${routine.title}</div>
        <div class="routine-actions">
          <button class="routine-edit-btn" data-id="${routine.id}">✏️</button>
          <button class="routine-delete-btn" data-id="${routine.id}">🗑️</button>
        </div>
      </div>
    `;
  });

  if (window.AppState.routines.length === 0) {
    html = `<p class="empty-msg">Nenhum hábito cadastrado. Clique no botão + para adicionar.</p>`;
  }

  container.innerHTML = html;

  // Update header text
  const headerText = document.querySelector('.routines-header h3');
  if (headerText && window.AppState.routines.length > 0) {
    const total = window.AppState.routines.length;
    const perc = Math.round((completedCount / total) * 100);
    // Might need a specific element for this, using an assumed selector or injecting it
    const infoSpan = document.getElementById('routines-info');
    if (infoSpan) {
      infoSpan.textContent = `${completedCount} de ${total} concluídas (${perc}%)`;
    }
  }
};
