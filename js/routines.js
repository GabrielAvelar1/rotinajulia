// routines.js
// Módulo de Rotinas e Hábitos

const WEEKDAY_NAMES_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function getTodayStr() {
  return window.getLocalDateString ? window.getLocalDateString() : new Date().toISOString().split('T')[0];
}

function getYesterdayStr(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return window.getLocalDateString ? window.getLocalDateString(d) : d.toISOString().split('T')[0];
}

// Verifica se a última data de conclusão foi no último dia agendado antes de hoje
function isLastScheduledDay(routine, lastDateStr, todayStr) {
  if (!lastDateStr) return false;
  if (!routine.days_of_week || routine.days_of_week === 'all') {
    return lastDateStr === getYesterdayStr(todayStr);
  }

  const scheduledDays = routine.days_of_week.split(',').map(Number);
  if (scheduledDays.length === 0) return false;

  let checkDate = new Date(todayStr + 'T12:00:00');
  for (let i = 1; i <= 7; i++) {
    checkDate.setDate(checkDate.getDate() - 1);
    const dayOfWeek = checkDate.getDay();
    if (scheduledDays.includes(dayOfWeek)) {
      const expectedDateStr = window.getLocalDateString ? window.getLocalDateString(checkDate) : checkDate.toISOString().split('T')[0];
      return lastDateStr === expectedDateStr;
    }
  }
  return false;
}

// Identifica rotina de hidratação / beber água
function isWaterRoutine(routine) {
  if (!routine || !routine.title) return false;
  const clean = routine.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return clean.includes('agua') || clean.includes('beber') || clean.includes('hidrata');
}

window.Routines_init = async function() {
  const dateLabel = document.getElementById('routines-date-label');
  if (dateLabel) {
    const today = new Date();
    dateLabel.textContent = today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  // 1. Carregar do cache local imediatamente (0ms de espera)
  const cachedRoutines = localStorage.getItem('rotina_cached_routines');
  if (cachedRoutines) {
    try {
      const parsed = JSON.parse(cachedRoutines);
      if (Array.isArray(parsed) && parsed.length > 0) {
        window.AppState.routines = parsed;
        window.Routines_render();
      }
    } catch (e) {}
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
        try { localStorage.setItem('rotina_cached_routines', JSON.stringify(routines)); } catch (e) {}
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
      window.Routines_render();
    } catch (err) {
      console.error('Erro ao carregar rotinas:', err);
    }
  }

  if (window._routinesListenersSetup) return;
  window._routinesListenersSetup = true;

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
        let updatePayload = { title, icon, days_of_week };
        res = await window.supabase.from('routines').update(updatePayload).eq('id', id).select();

        // Se falhar por causa da coluna days_of_week não existir no banco
        if (res.error && (res.error.message?.includes('days_of_week') || res.error.code === '42703' || res.error.code === 'PGRST204')) {
          delete updatePayload.days_of_week;
          res = await window.supabase.from('routines').update(updatePayload).eq('id', id).select();
          if (res.data && res.data[0]) {
            res.data[0].days_of_week = days_of_week;
          }
        }
      } else {
        let insertPayload = {
          user_id: user.id,
          title,
          icon,
          days_of_week,
          position: window.AppState.routines.length
        };
        res = await window.supabase.from('routines').insert([insertPayload]).select();

        // Se falhar por causa da coluna days_of_week não existir no banco
        if (res.error && (res.error.message?.includes('days_of_week') || res.error.code === '42703' || res.error.code === 'PGRST204')) {
          delete insertPayload.days_of_week;
          res = await window.supabase.from('routines').insert([insertPayload]).select();
          if (res.data && res.data[0]) {
            res.data[0].days_of_week = days_of_week;
          }
        }
      }
      
      if (res.error) throw res.error;
      
      if (id) {
        const idx = window.AppState.routines.findIndex(r => r.id === id);
        const updatedRoutine = (res.data && res.data[0]) ? res.data[0] : { id, title, icon, days_of_week };
        if (idx !== -1) window.AppState.routines[idx] = updatedRoutine;
      } else {
        const newRoutine = (res.data && res.data[0]) ? res.data[0] : { title, icon, days_of_week, user_id: user.id };
        window.AppState.routines.push(newRoutine);
      }
      
      window.Routines_render();
      if (window.Charts_render) window.Charts_render();
      if (window.hideModal) window.hideModal('routine-modal');
      window.showToast?.('Rotina salva com sucesso!', 'success');
    } catch (err) {
      console.error(err);
      window.showToast?.('Erro ao salvar rotina: ' + (err.message || 'Verifique o banco'), 'error');
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
        const yesterdayStr = getYesterdayStr(todayStr);
        const user = window.AppState.user;
        const routine = window.AppState.routines.find(r => r.id === id);
        
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

          // Atualizar Lógica de Ofensiva (Streak)
          if (routine) {
            let currentStreak = parseInt(routine.streak_count) || 0;
            let lastCompleted = routine.last_completed_date;

            if (completed) {
              // Marcando como concluído
              if (lastCompleted === todayStr) {
                routine.streak_count = Math.max(1, currentStreak);
              } else if (lastCompleted === yesterdayStr || isLastScheduledDay(routine, lastCompleted, todayStr)) {
                // Concluiu dia seguido
                routine.streak_count = currentStreak + 1;
              } else {
                // Iniciou nova sequência
                routine.streak_count = 1;
              }
              routine.last_completed_date = todayStr;

              // Gamificação: +2 XP por rotina e verificação de vale para 'Beber água'
              if (window.Gamification_addXP) {
                window.Gamification_addXP(2, 'Rotina diária');
              }
              if (isWaterRoutine(routine)) {
                if (window.Gamification_checkWaterStreakReward) {
                  window.Gamification_checkWaterStreakReward(routine.streak_count);
                }
              }
            } else {
              // Desmarcando como concluído hoje
              if (lastCompleted === todayStr) {
                const prevStreak = Math.max(0, currentStreak - 1);
                routine.streak_count = prevStreak;
                routine.last_completed_date = prevStreak > 0 ? yesterdayStr : null;
                if (window.Gamification_removeXP) {
                  window.Gamification_removeXP(2);
                }
              }
            }

            // Persistir no Supabase com fallback gracioso
            try {
              const streakPayload = {
                streak_count: routine.streak_count,
                last_completed_date: routine.last_completed_date
              };
              const res = await window.supabase.from('routines').update(streakPayload).eq('id', id);
              if (res.error && (res.error.message?.includes('streak') || res.error.code === '42703' || res.error.code === 'PGRST204')) {
                console.warn('Banco não possui colunas de streak ainda. Mantido no cache local.');
              }
            } catch (streakErr) {
              console.warn('Erro ao atualizar streak no banco:', streakErr);
            }

            try {
              localStorage.setItem('rotina_cached_routines', JSON.stringify(window.AppState.routines));
            } catch (e) {}
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
      const valeBtn = e.target.closest('.routine-vale-btn');
      if (valeBtn) {
        const id = valeBtn.dataset.id;
        const routine = window.AppState.routines.find(r => r.id === id);
        if (routine) {
          if (routine.has_vale) {
            if (confirm(`Deseja remover o Vale de proteção de "${routine.title}" e devolvê-lo ao seu inventário?`)) {
              if (window.Gamification_removeValeFromRoutine) {
                await window.Gamification_removeValeFromRoutine(id);
              }
            }
          } else {
            if (window.Gamification_applyValeToRoutine) {
              const applied = await window.Gamification_applyValeToRoutine(id);
              if (!applied && window.Gamification_getState && window.Gamification_getState().vales <= 0) {
                if (window.Gamification_openValesModal) {
                  window.Gamification_openValesModal();
                }
              }
            }
          }
        }
        return;
      }

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
        return;
      }

      // Ao clicar no hábito, alternar exibição dos botões
      const item = e.target.closest('.routine-item');
      if (item && !e.target.closest('.routine-checkbox')) {
        const wasActive = item.classList.contains('active');
        list.querySelectorAll('.routine-item').forEach(i => i.classList.remove('active'));
        if (!wasActive) {
          item.classList.add('active');
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
  const yesterdayStr = getYesterdayStr(todayStr);
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

    // Cálculo da Ofensiva Ativa
    let rawStreak = parseInt(routine.streak_count) || 0;
    let lastDate = routine.last_completed_date;
    
    let effectiveStreak = 0;
    if (isCompleted) {
      effectiveStreak = Math.max(1, rawStreak);
    } else if (lastDate === yesterdayStr || isLastScheduledDay(routine, lastDate, todayStr)) {
      // Sequência do dia anterior ainda viva esperando conclusão de hoje
      effectiveStreak = rawStreak;
    } else if (lastDate === todayStr) {
      effectiveStreak = rawStreak;
    } else {
      // Pulou dia ou nova
      // Se a rotina possuir um Vale de proteção ativo e tiver uma sequência salva, o vale protege!
      if (routine.has_vale && rawStreak > 0) {
        effectiveStreak = rawStreak;
        routine.has_vale = false;
        routine.last_completed_date = yesterdayStr;
        if (window.Gamification_onValeConsumed) {
          window.Gamification_onValeConsumed(routine, rawStreak);
        }
      } else {
        effectiveStreak = 0;
      }
    }

    // Feedback dinâmico
    let feedbackHtml = '';
    if (isCompleted) {
      feedbackHtml = `<div class="routine-streak-feedback success">
        <i class="fas fa-fire"></i> Você completou a tarefa <strong>"${routine.title}"</strong> por <strong>${effectiveStreak} ${effectiveStreak === 1 ? 'dia seguido' : 'dias seguidos'}</strong>!
      </div>`;
    } else if (effectiveStreak > 0 && appliesToday) {
      feedbackHtml = `<div class="routine-streak-feedback pending">
        <i class="fas fa-bolt"></i> Marque hoje para manter sua ofensiva de <strong>${effectiveStreak} ${effectiveStreak === 1 ? 'dia' : 'dias'}</strong>!
      </div>`;
    } else if (appliesToday) {
      feedbackHtml = `<div class="routine-streak-feedback info">
        <i class="fas fa-seedling"></i> Complete hoje para iniciar sua sequência de ofensiva!
      </div>`;
    } else {
      feedbackHtml = `<div class="routine-streak-feedback muted">
        <i class="far fa-calendar-check"></i> Ofensiva de ${effectiveStreak} ${effectiveStreak === 1 ? 'dia' : 'dias'} pausada hoje.
      </div>`;
    }

    // Badge visual de Foguinho
    const streakBadgeHtml = `
      <div class="routine-streak-badge ${effectiveStreak > 0 ? (isCompleted ? 'active glow' : 'active') : 'inactive'}" title="Ofensiva atual: ${effectiveStreak} dias seguidos">
        <i class="fas fa-fire"></i>
        <span>${effectiveStreak} ${effectiveStreak === 1 ? 'dia' : 'dias'}</span>
      </div>
    `;

    // Renderizar item com estilo especial se não for de hoje
    const notTodayStyle = !appliesToday ? 'filter: grayscale(0.8); opacity: 0.55;' : (isCompleted ? 'opacity: 0.85;' : '');
    const notTodayBadge = !appliesToday ? `<span class="routine-days-badge" style="background:rgba(255,255,255,0.05); color:var(--text-muted);">(Hoje não - ${daysBadgeText})</span>` : (daysBadgeText ? `<span class="routine-days-badge">(${daysBadgeText})</span>` : '');

    html += `
      <div class="routine-item ${isCompleted ? 'completed' : ''}" data-routine-id="${routine.id}" style="${notTodayStyle}">
        <div class="routine-item-main">
          <input type="checkbox" class="routine-checkbox" data-id="${routine.id}" ${isCompleted ? 'checked' : ''} ${!appliesToday ? 'disabled' : ''} title="${!appliesToday ? 'Este hábito não está programado para hoje' : 'Marcar como concluído'}">
          <div class="routine-icon">${routine.icon || '✨'}</div>
          <div class="routine-info-col">
            <div class="routine-title-row">
              <span class="routine-title" style="${isCompleted ? 'text-decoration: line-through;' : ''}">${routine.title}</span>
              ${notTodayBadge}
              ${routine.has_vale ? '<span class="routine-vale-badge" title="Esta rotina está protegida com um Vale de Ofensiva!"><i class="fas fa-shield-alt"></i> Vale Ativo</span>' : ''}
            </div>
            ${feedbackHtml}
          </div>
          ${streakBadgeHtml}
        </div>
        <div class="routine-actions">
          <button class="routine-vale-btn ${routine.has_vale ? 'active' : ''}" data-id="${routine.id}" title="${routine.has_vale ? 'Vale ativo protegendo esta rotina (clique para remover e devolver ao inventário)' : 'Proteger esta rotina com um Vale 🎟️'}">
            <i class="fas ${routine.has_vale ? 'fa-shield-alt' : 'fa-ticket-alt'}"></i>
          </button>
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

