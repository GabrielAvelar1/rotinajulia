// settings.js
// Módulo de Configurações, Estética e Temas (Escuro, Claro, Y2K/Vintage)

(function() {
  const THEMES = ['dark', 'light', 'y2k'];

  const ACCENT_GLOWS = {
    '#8b5cf6': 'rgba(139, 92, 246, 0.35)',
    '#ec4899': 'rgba(236, 72, 153, 0.35)',
    '#3b82f6': 'rgba(59, 130, 246, 0.35)',
    '#10b981': 'rgba(16, 185, 129, 0.35)',
    '#f97316': 'rgba(249, 115, 22, 0.35)',
    '#ef4444': 'rgba(239, 68, 68, 0.35)',
    '#06b6d4': 'rgba(6, 182, 212, 0.35)'
  };

  let currentSelectedTheme = 'dark';
  let currentSelectedColor = '#8b5cf6';
  let currentSelectedSecondary = '#a78bfa';

  window.Settings_applyTheme = function(themeName) {
    if (!THEMES.includes(themeName)) themeName = 'dark';
    currentSelectedTheme = themeName;

    document.documentElement.setAttribute('data-theme', themeName);
    if (document.body) {
      document.body.setAttribute('data-theme', themeName);
    }

    // Se for o tema Y2K e nenhuma cor customizada tiver sido selecionada, usa o rosa característico
    if (themeName === 'y2k' && !localStorage.getItem('rotina_accent_color')) {
      window.Settings_applyAccentColor('#ec4899', '#f472b6', false);
    }

    // Atualizar meta theme-color para navegadores mobile
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      if (themeName === 'light') themeColorMeta.setAttribute('content', '#ffffff');
      else if (themeName === 'y2k') themeColorMeta.setAttribute('content', '#120924');
      else themeColorMeta.setAttribute('content', '#0f0f14');
    }
  };

  window.Settings_applyAccentColor = function(primary, secondary, saveState = true) {
    if (!primary) return;
    currentSelectedColor = primary;
    currentSelectedSecondary = secondary || primary;

    document.documentElement.style.setProperty('--primary', primary);
    document.documentElement.style.setProperty('--secondary', currentSelectedSecondary);
    const glow = ACCENT_GLOWS[primary] || (primary + '55');
    document.documentElement.style.setProperty('--glow', glow);

    if (saveState) {
      try {
        localStorage.setItem('rotina_accent_color', primary);
        localStorage.setItem('rotina_accent_secondary', currentSelectedSecondary);
        localStorage.setItem('rotina_accent_glow', glow);
      } catch (e) {}
    }
  };

  window.Settings_openModal = function() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;

    // Sincronizar estado visual atual dos cards e cores
    const savedTheme = localStorage.getItem('rotina_theme') || 'dark';
    currentSelectedTheme = savedTheme;
    document.querySelectorAll('#settings-modal .theme-card').forEach(card => {
      if (card.getAttribute('data-theme') === savedTheme) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });

    const savedColor = localStorage.getItem('rotina_accent_color') || '#8b5cf6';
    currentSelectedColor = savedColor;
    document.querySelectorAll('#settings-modal .accent-chip').forEach(chip => {
      if (chip.getAttribute('data-color') === savedColor) {
        chip.classList.add('selected');
      } else {
        chip.classList.remove('selected');
      }
    });

    if (window.showModal) {
      window.showModal('settings-modal');
    } else {
      modal.style.display = 'flex';
    }
  };

  window.Settings_closeModal = function() {
    if (window.hideModal) {
      window.hideModal('settings-modal');
    } else {
      const modal = document.getElementById('settings-modal');
      if (modal) modal.style.display = 'none';
    }
  };

  window.Settings_savePreferences = async function() {
    try {
      localStorage.setItem('rotina_theme', currentSelectedTheme);
      localStorage.setItem('rotina_accent_color', currentSelectedColor);
      localStorage.setItem('rotina_accent_secondary', currentSelectedSecondary);

      window.Settings_applyTheme(currentSelectedTheme);
      window.Settings_applyAccentColor(currentSelectedColor, currentSelectedSecondary, true);

      // Sincronizar com o Supabase site_config se o usuário estiver logado
      if (window.AppState?.user && window.AppState?.siteConfig?.id) {
        try {
          await window.supabase
            .from('site_config')
            .update({
              theme: currentSelectedTheme,
              accent_color: currentSelectedColor,
              updated_at: new Date().toISOString()
            })
            .eq('id', window.AppState.siteConfig.id);
        } catch (dbErr) {
          console.warn('Banco não possui colunas de tema ainda, salvo no dispositivo:', dbErr);
        }
      }

      window.Settings_closeModal();
      if (window.showToast) {
        window.showToast('Preferências de estética salvas com sucesso!', 'success');
      }
    } catch (err) {
      console.error('Erro ao salvar preferências:', err);
      window.Settings_closeModal();
    }
  };

  window.Settings_init = function() {
    // 1. Carregar do localStorage
    const savedTheme = localStorage.getItem('rotina_theme') || 'dark';
    const savedColor = localStorage.getItem('rotina_accent_color') || '#8b5cf6';
    const savedSecondary = localStorage.getItem('rotina_accent_secondary') || '#a78bfa';

    window.Settings_applyTheme(savedTheme);
    window.Settings_applyAccentColor(savedColor, savedSecondary, false);

    // 2. Event Listeners
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.Settings_openModal();
      });
    }

    const closeBtn = document.getElementById('settings-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => window.Settings_closeModal());
    }

    const modal = document.getElementById('settings-modal');
    if (modal) {
      const backdrop = modal.querySelector('.modal-backdrop');
      if (backdrop) {
        backdrop.addEventListener('click', () => window.Settings_closeModal());
      }
    }

    // Clique nos cards de tema
    document.querySelectorAll('#settings-modal .theme-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('#settings-modal .theme-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        const theme = card.getAttribute('data-theme');
        currentSelectedTheme = theme;
        // Aplicação prévia em tempo real
        window.Settings_applyTheme(theme);
      });
    });

    // Clique nos chips de cor de destaque
    document.querySelectorAll('#settings-modal .accent-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#settings-modal .accent-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        const color = chip.getAttribute('data-color');
        const secondary = chip.getAttribute('data-secondary');
        currentSelectedColor = color;
        currentSelectedSecondary = secondary;
        // Aplicação prévia em tempo real
        window.Settings_applyAccentColor(color, secondary, false);
      });
    });

    // Botão Salvar
    const saveBtn = document.getElementById('settings-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => window.Settings_savePreferences());
    }
  };

  // Inicializar quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.Settings_init);
  } else {
    window.Settings_init();
  }
})();
