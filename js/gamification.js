// gamification.js
// Sistema de Níveis (XP) e Vales de Proteção de Ofensiva

(function() {
  const XP_PER_LEVEL = 100;
  const XP_TASK = 8;
  const XP_ROUTINE = 2;

  // Estado padrão
  let state = {
    xp: 0,
    vales: 0,
    last_level_rewarded: 0,
    last_water_streak_rewarded: 0
  };

  function loadState() {
    try {
      const cached = localStorage.getItem('rotina_gamification');
      if (cached) {
        const parsed = JSON.parse(cached);
        state = { ...state, ...parsed };
      }
    } catch (e) {
      console.warn('Erro ao carregar gamificação do localStorage:', e);
    }
  }

  function saveState() {
    try {
      localStorage.setItem('rotina_gamification', JSON.stringify(state));
    } catch (e) {}

    // Sincronizar com Supabase site_config se disponível
    if (window.AppState?.user && window.AppState?.siteConfig?.id) {
      try {
        window.supabase
          .from('site_config')
          .update({
            xp: state.xp,
            vales: state.vales,
            gamification_data: state,
            updated_at: new Date().toISOString()
          })
          .eq('id', window.AppState.siteConfig.id)
          .then(() => {})
          .catch(() => {});
      } catch (err) {}
    }
  }

  window.Gamification_getLevel = function(xp = state.xp) {
    return Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1;
  };

  window.Gamification_getCurrentLevelXP = function(xp = state.xp) {
    return Math.max(0, xp) % XP_PER_LEVEL;
  };

  window.Gamification_addXP = function(amount, reason = '') {
    const oldLevel = window.Gamification_getLevel(state.xp);
    state.xp = Math.max(0, state.xp + amount);
    const newLevel = window.Gamification_getLevel(state.xp);

    saveState();
    window.Gamification_render();

    // Feedback de XP
    if (amount > 0 && window.showToast) {
      // Exibir aviso discreto de XP apenas em tarefas
      // (evitar flood em cliques repetidos)
    }

    // Passou de nível!
    if (newLevel > oldLevel) {
      window.Gamification_onLevelUp(newLevel, oldLevel);
    }
  };

  window.Gamification_removeXP = function(amount) {
    state.xp = Math.max(0, state.xp - amount);
    saveState();
    window.Gamification_render();
  };

  window.Gamification_onLevelUp = function(newLevel, oldLevel) {
    // Efeito sonoro / celebração
    let celebrationMsg = `⭐ Parabéns! Você subiu para o Nível ${newLevel}!`;

    // Verifica se atingiu nível múltiplo de 10 (10, 20, 30...)
    if (newLevel % 10 === 0 && newLevel > (state.last_level_rewarded || 0)) {
      state.vales += 1;
      state.last_level_rewarded = newLevel;
      saveState();
      window.Gamification_render();

      celebrationMsg = `🎉 NÍVEL ${newLevel} ALCANÇADO! Você conquistou 1 Vale Especial de Ofensiva 🎟️!`;
      if (window.showToast) {
        window.showToast(celebrationMsg, 'success');
      }
      return;
    }

    if (window.showToast) {
      window.showToast(celebrationMsg, 'success');
    }
  };

  // Verifica recompensa da rotina "Beber Água" (a cada 3 dias de ofensiva)
  window.Gamification_checkWaterStreakReward = function(streakCount) {
    if (streakCount < 3) return;
    
    // Premiar a cada ciclo de 3 dias (ex: 3, 6, 9, 12...)
    if (streakCount % 3 === 0 && streakCount > (state.last_water_streak_rewarded || 0)) {
      state.vales += 1;
      state.last_water_streak_rewarded = streakCount;
      saveState();
      window.Gamification_render();

      if (window.showToast) {
        window.showToast(`💧 Incrível! ${streakCount} dias bebendo água! Você ganhou 1 Vale de Ofensiva 🎟️!`, 'success');
      }
    }
  };

  // Aplica um vale como escudo protetor na rotina
  window.Gamification_applyValeToRoutine = async function(routineId) {
    if (state.vales <= 0) {
      if (window.showToast) window.showToast('Você não possui vales disponíveis no momento.', 'warning');
      return false;
    }

    const routine = window.AppState.routines.find(r => r.id === routineId);
    if (!routine) return false;

    if (routine.has_vale) {
      if (window.showToast) window.showToast('Esta rotina já está protegida com um Vale!', 'info');
      return false;
    }

    state.vales -= 1;
    routine.has_vale = true;
    saveState();

    // Persistir no Supabase
    try {
      await window.supabase
        .from('routines')
        .update({ has_vale: true })
        .eq('id', routineId);
    } catch (e) {
      console.warn('Coluna has_vale não existe no Supabase ainda, mantido localmente.');
    }

    // Salvar no cache local de rotinas
    try {
      localStorage.setItem('rotina_cached_routines', JSON.stringify(window.AppState.routines));
    } catch (e) {}

    window.Gamification_render();
    if (window.Routines_render) window.Routines_render();
    if (window.showToast) {
      window.showToast(`🛡️ Vale ativado com sucesso em "${routine.title}"! Sua ofensiva está protegida!`, 'success');
    }
    return true;
  };

  // Remove / Desativa o vale da rotina e devolve para o inventário
  window.Gamification_removeValeFromRoutine = async function(routineId) {
    const routine = window.AppState.routines.find(r => r.id === routineId);
    if (!routine || !routine.has_vale) return false;

    routine.has_vale = false;
    state.vales += 1;
    saveState();

    try {
      await window.supabase
        .from('routines')
        .update({ has_vale: false })
        .eq('id', routineId);
    } catch (e) {}

    try {
      localStorage.setItem('rotina_cached_routines', JSON.stringify(window.AppState.routines));
    } catch (e) {}

    window.Gamification_render();
    if (window.Routines_render) window.Routines_render();
    if (window.showToast) {
      window.showToast(`Vale desativado de "${routine.title}" e devolvido ao inventário 🎟️.`, 'info');
    }
    return true;
  };

  // Quando o vale é consumido automaticamente para salvar a ofensiva
  window.Gamification_onValeConsumed = function(routine, savedStreak) {
    saveState();
    try {
      localStorage.setItem('rotina_cached_routines', JSON.stringify(window.AppState.routines));
    } catch (e) {}

    window.Gamification_render();
    if (window.showToast) {
      window.showToast(`🛡️ SEU VALE SALVOU SUA OFENSIVA! Os ${savedStreak} dias de "${routine.title}" foram preservados!`, 'success');
    }
  };

  // Abre modal de gerenciamento de Vales
  window.Gamification_openValesModal = function() {
    const modal = document.getElementById('vales-modal');
    if (!modal) return;

    const countEl = document.getElementById('vales-modal-count');
    if (countEl) countEl.textContent = state.vales;

    const listEl = document.getElementById('vales-routines-list');
    if (listEl) {
      if (!window.AppState.routines || window.AppState.routines.length === 0) {
        listEl.innerHTML = `<p class="empty-msg" style="text-align:center; padding:15px; color:var(--text-muted);">Nenhuma rotina cadastrada ainda.</p>`;
      } else {
        let html = '';
        window.AppState.routines.forEach(routine => {
          const isProtected = !!routine.has_vale;
          const streak = parseInt(routine.streak_count) || 0;

          html += `
            <div class="vale-routine-row ${isProtected ? 'protected' : ''}">
              <div class="vale-routine-info">
                <span class="vale-routine-icon">${routine.icon || '✨'}</span>
                <div>
                  <div class="vale-routine-title">${routine.title}</div>
                  <div class="vale-routine-sub">
                    🔥 Ofensiva: <strong>${streak} ${streak === 1 ? 'dia' : 'dias'}</strong>
                    ${isProtected ? ' • <span style="color:#22c55e; font-weight:600;"><i class="fas fa-shield-alt"></i> Protegida com Vale</span>' : ''}
                  </div>
                </div>
              </div>
              <div class="vale-routine-action">
                ${isProtected ? `
                  <button type="button" class="btn btn-sm btn-ghost remove-vale-btn" data-id="${routine.id}" title="Remover e recuperar vale">
                    <i class="fas fa-undo"></i> Devolver Vale
                  </button>
                ` : `
                  <button type="button" class="btn btn-sm btn-primary apply-vale-btn" data-id="${routine.id}" ${state.vales <= 0 ? 'disabled' : ''}>
                    <i class="fas fa-shield-alt"></i> Proteger
                  </button>
                `}
              </div>
            </div>
          `;
        });
        listEl.innerHTML = html;
      }
    }

    if (window.showModal) {
      window.showModal('vales-modal');
    } else {
      modal.style.display = 'flex';
    }
  };

  window.Gamification_closeValesModal = function() {
    if (window.hideModal) {
      window.hideModal('vales-modal');
    } else {
      const modal = document.getElementById('vales-modal');
      if (modal) modal.style.display = 'none';
    }
  };

  window.Gamification_render = function() {
    const level = window.Gamification_getLevel();
    const currentXP = window.Gamification_getCurrentLevelXP();
    const perc = Math.min(100, Math.round((currentXP / XP_PER_LEVEL) * 100));

    // Elementos da barra de nível
    const levelNumEl = document.getElementById('user-level-num');
    if (levelNumEl) levelNumEl.textContent = level;

    const currentXpEl = document.getElementById('user-current-xp');
    if (currentXpEl) currentXpEl.textContent = currentXP;

    const progressBar = document.getElementById('xp-progress-bar');
    if (progressBar) progressBar.style.width = `${perc}%`;

    const valesCountEl = document.getElementById('user-vales-num');
    if (valesCountEl) valesCountEl.textContent = state.vales;

    // Próxima recompensa de nível múltiplo de 10
    const nextRewardHint = document.getElementById('xp-next-reward-hint');
    if (nextRewardHint) {
      const nextMilestone = Math.ceil(level / 10) * 10;
      const target = nextMilestone === level ? level + 10 : nextMilestone;
      nextRewardHint.innerHTML = `<i class="fas fa-gift"></i> Nível ${target}: Ganhe 1 Vale 🎟️`;
    }
  };

  window.Gamification_setupEventListeners = function() {
    const valesBtn = document.getElementById('vales-btn');
    if (valesBtn) {
      valesBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.Gamification_openValesModal();
      });
    }

    const closeBtn = document.getElementById('vales-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => window.Gamification_closeValesModal());
    }

    const okBtn = document.getElementById('vales-modal-ok-btn');
    if (okBtn) {
      okBtn.addEventListener('click', () => window.Gamification_closeValesModal());
    }

    const modal = document.getElementById('vales-modal');
    if (modal) {
      const backdrop = modal.querySelector('.modal-backdrop');
      if (backdrop) {
        backdrop.addEventListener('click', () => window.Gamification_closeValesModal());
      }
    }

    // Ações dentro da lista de rotinas do modal
    const listEl = document.getElementById('vales-routines-list');
    if (listEl) {
      listEl.addEventListener('click', async (e) => {
        const applyBtn = e.target.closest('.apply-vale-btn');
        if (applyBtn) {
          const id = applyBtn.getAttribute('data-id');
          await window.Gamification_applyValeToRoutine(id);
          window.Gamification_openValesModal(); // Re-renderiza o modal
          return;
        }

        const removeBtn = e.target.closest('.remove-vale-btn');
        if (removeBtn) {
          const id = removeBtn.getAttribute('data-id');
          await window.Gamification_removeValeFromRoutine(id);
          window.Gamification_openValesModal();
          return;
        }
      });
    }
  };

  window.Gamification_init = async function() {
    loadState();

    // Sincronizar com site_config se existir dados remotos
    if (window.AppState?.siteConfig) {
      const sc = window.AppState.siteConfig;
      if (sc.xp !== undefined && sc.xp !== null) {
        state.xp = Math.max(state.xp, parseInt(sc.xp) || 0);
      }
      if (sc.vales !== undefined && sc.vales !== null) {
        state.vales = Math.max(state.vales, parseInt(sc.vales) || 0);
      }
      if (sc.gamification_data && typeof sc.gamification_data === 'object') {
        state = { ...state, ...sc.gamification_data };
      }
    }

    window.Gamification_render();
    window.Gamification_setupEventListeners();
  };

  // Expor estado para leitura
  window.Gamification_getState = function() {
    return state;
  };
})();
