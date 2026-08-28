// routines.js
// Módulo de Rotinas e Hábitos

const WEEKDAY_NAMES_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function getTodayStr() {
  return window.getLocalDateString ? window.getLocalDateString() : new Date().toISOString().split('T')[0];
}

window.Routines_init = async function() {
  const dateLabel = document.getElementById('routines-date-label');
  if (dateLabel) {
    const today = new Date();
    dateLabel.textContent = today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  const user = window.AppState.user;
  const todayStr = getTodayStr();
  
  if (user) {
    try {
      // Carregar todas as rotinas do usuário
      const { data: routines, error: routinesError } = await window.supabase
        .from('routines')
        .select('*')
        .eq('user_id', user.id)
        .order('position', { ascending: true });
      
      if (!routinesError && routines) {
        window.AppState.routines = routines;
      }

      // Carregar logs de hoje
      const { data: logs, error: logsError } = await window.supabase
        .from('routine_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('completed_date', todayStr);
        
      if (!logsError && logs) {
        window.AppState.routineLogs = logs;
      }
    } catch (err) {
      console.error('Erro ao carregar rotinas:', err);
    }
  }

  // Configuração dos eventos do modal de rotina
  const allDaysCb = document.getElementById('routine-all-days-checkbox');
  const weekdaysContainer = document.getElementById('routine-weekdays-container');

  if (allDaysCb && weekdaysContainer) {
    allDaysCb.addEventListener('change', () => {
      if (allDaysCb.checked) {
        weekdaysContainer.style.display = 'none';
      } else {
        weekdaysContainer.style.display = 'flex';
      }
    });

    weekdaysContainer.addEventListener('click', (e) => {
      const chip = e.target.closest('.weekday-chip');
      if (chip) {
        chip.classList.toggle('active');
      }
    });
  }

  // Botão Adicionar Rotina
  document.getElementById('add-routine-btn')?.addEventListener('click', () => {
    document.getElementById('routine-modal-title').textContent = 'Nova Rotina';
    document.getElementById('routine-id-input').value = '';
    document.getElementById('routine-title-input').value = '';
    document.getElementById('routine-icon-input').value = '✨';
    
    if (allDaysCb) allDaysCb.checked = true;
    if (weekdaysContainer) {
      weekdaysContainer.style.display = 'none';
      weekdaysContainer.querySelectorAll('.weekday-chip').forEach(c => c.classList.remove('active'));
    }

    if (window.showModal) window.showModal('routine-modal');
  });

  document.getElementById('routine-cancel-btn')?.addEventListener('click', () => {
    if (window.hideModal) window.hideModal('routine-modal');
  });

  // Salvar Rotina
  document.getElementById('routine-save-btn')?.addEventListener('click', async () => {
    try {
      const id = document.getElementById('routine-id-input').value;
      const title = document.getElementById('routine-title-input').value.trim();
      const icon = document.getElementById('routine-icon-input').value.trim() || '✨';
      
      if (!title) {
        window.showToast?.('O título é obrigatório.', 'error');
        return;
      }

      // Definir dias da semana
      let days_of_week = 'all';
      if (allDaysCb && !allDaysCb.checked && weekdaysContainer) {
        const activeChips = Array.from(weekdaysContainer.querySelectorAll('.weekday-chip.active'));
        if (activeChips.length > 0) {
          days_of_week = activeChips.map(c => c.dataset.day).join(',');
        }
      }

      const user = window.AppState.user;
      
      let res;
      if (id) {
        res = await window.supabase.from('routines').update({ title, icon, days_of_week }).eq('id', id).select();
      } else {
        res = await window.supabase.from('routines').insert([{
          user_id: user.id,
          title,
          icon,
          days_of_week,
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

  // Eventos na lista de rotinas (Checkbox, Editar, Deletar)
  const list = document.getElementById('routines-list');
  if (list) {
    list.addEventListener('change', async (e) => {
      if (e.target.classList.contains('routine-checkbox')) {
        const id = e.target.dataset.id;
        const completed = e.target.checked;
        const todayStr = getTodayStr();
        const user = window.AppState.user;
        
        try {
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
          window.showToast?.('Erro ao atualizar status da rotina.', 'error');
        }
      }
    });

    list.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('.routine-edit-btn');
      if (editBtn) {
        const id = editBtn.dataset.id;
        const routine = window.AppState.routines.find(r => r.id === id);
        if (routine) {
          document.getElementById('routine-modal-title').textContent = 'Editar Rotina';
          document.getElementById('routine-id-input').value = routine.id;
          document.getElementById('routine-title-input').value = routine.title;
          document.getElementById('routine-icon-input').value = routine.icon || '✨';
          
          const isAllDays = !routine.days_of_week || routine.days_of_week === 'all';
          if (allDaysCb) allDaysCb.checked = isAllDays;
          if (weekdaysContainer) {
            weekdaysContainer.style.display = isAllDays ? 'none' : 'flex';
            const dayList = isAllDays ? [] : routine.days_of_week.split(',');
            weekdaysContainer.querySelectorAll('.weekday-chip').forEach(c => {
              if (dayList.includes(c.dataset.day)) {
                c.classList.add('active');
              } else {
                c.classList.remove('active');
              }
            });
          }

          if (window.showModal) window.showModal('routine-modal');
        }
        return;
      }

      const delBtn = e.target.closest('.routine-delete-btn');
      if (delBtn) {
        if (!confirm('Deseja excluir este hábito?')) return;
        
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
          window.showToast?.('Erro ao deletar hábito.', 'error');
        }
      }
    });
  }

  window.Routines_render();
};

window.Routines_render = function() {
  const container = document.getElementById('routines-list');
  if (!container) return;

  const todayStr = getTodayStr();
  const todayDayOfWeek = new Date().getDay(); // 0 = Dom, 1 = Seg, ... 6 = Sáb
  let html = '';
  
  let todayTotal = 0;
  let todayCompletedCount = 0;

  window.AppState.routines.forEach(routine => {
    // Verificar se este hábito é para hoje
    const isAll = !routine.days_of_week || routine.days_of_week === 'all';
    let daysArray = [];
    if (!isAll && routine.days_of_week) {
      daysArray = routine.days_of_week.split(',').map(Number);
    }
    const appliesToday = isAll || daysArray.includes(todayDayOfWeek);

    // Formatar texto dos dias
    let daysBadgeText = '';
    if (!isAll && daysArray.length > 0) {
      daysBadgeText = daysArray.map(d => WEEKDAY_NAMES_SHORT[d]).join(', ');
    }

    if (appliesToday) {
      todayTotal++;
    }

    const todayLog = window.AppState.routineLogs.find(l => l.routine_id === routine.id && l.completed_date === todayStr);
    const isCompleted = todayLog ? todayLog.completed : false;
    if (appliesToday && isCompleted) todayCompletedCount++;

    // Renderizar item com estilo especial se não for de hoje
    const notTodayStyle = !appliesToday ? 'filter: grayscale(0.8); opacity: 0.5;' : (isCompleted ? 'opacity: 0.6;' : '');
    const notTodayBadge = !appliesToday ? `<span class="routine-days-badge" style="background:rgba(255,255,255,0.05); color:var(--text-muted);">(Hoje não - ${daysBadgeText})</span>` : (daysBadgeText ? `<span class="routine-days-badge">(${daysBadgeText})</span>` : '');

    html += `
      <div class="routine-item" data-routine-id="${routine.id}" style="${notTodayStyle}">
        <input type="checkbox" class="routine-checkbox" data-id="${routine.id}" ${isCompleted ? 'checked' : ''} ${!appliesToday ? 'disabled' : ''} title="${!appliesToday ? 'Este hábito não está programado para hoje' : 'Marcar como concluído'}">
        <div class="routine-icon">${routine.icon || '✨'}</div>
        <div class="routine-title" style="${isCompleted ? 'text-decoration: line-through;' : ''}">
          ${routine.title} ${notTodayBadge}
        </div>
        <div class="routine-actions">
          <button class="routine-edit-btn" data-id="${routine.id}" title="Editar">✏️</button>
          <button class="routine-delete-btn" data-id="${routine.id}" title="Excluir">🗑️</button>
        </div>
      </div>
    `;
  });

  if (window.AppState.routines.length === 0) {
    html = `<p class="empty-msg">Nenhum hábito cadastrado. Clique no botão + para adicionar.</p>`;
  }

  container.innerHTML = html;

  // Atualizar indicador de progresso
  const infoSpan = document.getElementById('routines-info');
  if (infoSpan) {
    if (todayTotal > 0) {
      const perc = Math.round((todayCompletedCount / todayTotal) * 100);
      infoSpan.textContent = `${todayCompletedCount} de ${todayTotal} concluídas (${perc}%)`;
    } else if (window.AppState.routines.length > 0) {
      infoSpan.textContent = `Nenhum hábito programado para hoje`;
    } else {
      infoSpan.textContent = '';
    }
  }
};

