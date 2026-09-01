// app.js
// MAIN orchestrator

window.AppState = {
  user: null,
  folders: [],
  tasks: [],
  routines: [],
  routineLogs: [],
  playlist: [],
  siteConfig: null,
  currentOverviewFilter: 'all',
  currentCalendarFilter: 'all',
  calendarDate: new Date(),
  miniCalDate: new Date(),
  taskSort: 'date_asc',
  taskPage: 0,
  tasksPerPage: 100
};

// Funções de utilidade globais
window.getLocalDateString = function(d = new Date()) {
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

window.App_refreshAll = function() {
  if (window.Tasks_render) window.Tasks_render();
  if (window.Folders_render) window.Folders_render();
  if (window.Calendar_render) window.Calendar_render();
  if (window.Routines_render) window.Routines_render();
  if (window.Charts_render) window.Charts_render();

  // Re-render folder detail se o modal estiver aberto
  const folderModal = document.getElementById('folder-detail-modal');
  if (folderModal && folderModal.style.display !== 'none' && window.AppState.currentFolderDetailId && window.Folders_renderDetailModal) {
    window.Folders_renderDetailModal(window.AppState.currentFolderDetailId);
  }

  // Re-render day detail se o modal estiver aberto
  const dayModal = document.getElementById('day-detail-modal');
  if (dayModal && dayModal.style.display !== 'none' && window.AppState.currentDayDetailDate && window.Calendar_renderDayDetail) {
    window.Calendar_renderDayDetail(window.AppState.currentDayDetailDate);
  }
};

window.showToast = function(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  // Estilo básico para o toast caso não haja CSS
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    padding: '12px 20px',
    borderRadius: '4px',
    color: '#fff',
    backgroundColor: type === 'error' ? '#f44336' : '#4caf50',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
    zIndex: 9999,
    transition: 'opacity 0.3s ease'
  });

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};

window.formatDate = function(dateStr) {
  if (!dateStr) return '';
  // Se for YYYY-MM-DD, parsear com partes locais para evitar fuso horário
  if (typeof dateStr === 'string' && dateStr.includes('-')) {
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
};

window.showModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'flex'; // ou block dependendo do layout
  }
};

window.hideModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
  }
};




window.App_bootstrap = async function() {
  try {
    // 1. Carregar configurações, pastas, tarefas e rotinas em paralelo
    await Promise.allSettled([
      window.Banner_init ? window.Banner_init() : Promise.resolve(),
      window.Folders_init ? window.Folders_init() : Promise.resolve(),
      window.Tasks_init ? window.Tasks_init() : Promise.resolve(),
      window.Routines_init ? window.Routines_init() : Promise.resolve()
    ]);
    
    // 2. Inicializar módulos dependentes (calendário, gráficos, player)
    if (window.Calendar_init) await window.Calendar_init();
    if (window.Charts_init) await window.Charts_init();
    if (window.Player_init) await window.Player_init();

    // 3. Atualizar e sincronizar todos os componentes visuais com os dados carregados
    window.App_refreshAll();
  } catch (err) {
    console.error('Erro no bootstrap do app:', err);
  }
};

// Inicialização principal
document.addEventListener('DOMContentLoaded', async () => {
  let isBootstrapping = false;

  async function handleSession(session) {
    if (isBootstrapping) return;
    if (session && session.user) {
      isBootstrapping = true;
      window.AppState.user = session.user;
      document.getElementById('main-content').style.display = 'block';
      document.getElementById('auth-screen').style.display = 'none';
      
      const emailEl = document.getElementById('user-email');
      if (emailEl) emailEl.textContent = session.user.email;

      await window.App_bootstrap();
      isBootstrapping = false;
    } else {
      window.AppState.user = null;
      document.getElementById('main-content').style.display = 'none';
      document.getElementById('auth-screen').style.display = 'block';
    }
  }

  // 1. Obter sessão salva no localStorage imediatamente no reload (F5)
  try {
    const { data: { session } } = await window.supabase.auth.getSession();
    if (session) {
      await handleSession(session);
    }
  } catch (err) {
    console.error('Erro ao recuperar sessão:', err);
  }

  // 2. Escutar alterações de autenticação (Login, Logout, Token)
  window.supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT') {
      window.AppState.user = null;
      document.getElementById('main-content').style.display = 'none';
      document.getElementById('auth-screen').style.display = 'block';
    } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
      if (session && session.user) {
        if (!window.AppState.user || window.AppState.user.id !== session.user.id) {
          await handleSession(session);
        }
      }
    }
  });

  // Handle formulário de login
  const authForm = document.getElementById('auth-form');
  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = authForm.querySelector('input[type="email"]').value;
      const password = authForm.querySelector('input[type="password"]').value;
      const errorEl = document.getElementById('auth-error');
      
      try {
        const { error } = await window.supabase.auth.signInWithPassword({
          email,
          password
        });
        
        if (error) throw error;
        if (errorEl) errorEl.textContent = '';
      } catch (error) {
        if (errorEl) errorEl.textContent = error.message;
        console.error('Erro de login:', error);
      }
    });
  }

  // Handle logout
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        const { error } = await window.supabase.auth.signOut();
        if (error) throw error;
      } catch (error) {
        window.showToast('Erro ao fazer logout', 'error');
        console.error('Logout error:', error);
      }
    });
  }
});
