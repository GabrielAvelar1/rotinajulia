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




// Inicialização principal
document.addEventListener('DOMContentLoaded', () => {
  // Configurar listener de estado de autenticação
  window.supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
      window.AppState.user = session.user;
      document.getElementById('main-content').style.display = 'block';
      document.getElementById('auth-screen').style.display = 'none';
      
      const emailEl = document.getElementById('user-email');
      if (emailEl) emailEl.textContent = session.user.email;

      // Inicializar módulos apenas uma vez
      if (!window.AppState.modulesInitialized) {
        if (window.Banner_init) window.Banner_init();
        if (window.Folders_init) window.Folders_init();
        if (window.Tasks_init) window.Tasks_init();
        if (window.Calendar_init) window.Calendar_init();
        if (window.Routines_init) window.Routines_init();
        if (window.Charts_init) window.Charts_init();
        if (window.Player_init) window.Player_init();
        window.AppState.modulesInitialized = true;
      }
    } else {
      window.AppState.user = null;
      window.AppState.modulesInitialized = false;
      document.getElementById('main-content').style.display = 'none';
      document.getElementById('auth-screen').style.display = 'block';
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
