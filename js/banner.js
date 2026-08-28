// banner.js
// Módulo de Edição do Banner e Título

window.Banner_init = async function() {
  try {
    const userId = window.AppState.user.id;
    
    // Carregar configurações do site do Supabase
    let { data: config, error } = await window.supabase
      .from('site_config')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    // Se não existir configuração (retorna null), criar uma com valores padrão
    if (!config && !error) {
      const { data: newConfig, error: createError } = await window.supabase
        .from('site_config')
        .insert([{ 
          user_id: userId, 
          title: 'Minha Rotina', 
          subtitle: 'Todas as suas tarefas em um só lugar.',
          banner_url: null 
        }])
        .select()
        .single();
        
      if (createError) throw createError;
      config = newConfig;
    } else if (error) {
      throw error;
    }

    window.AppState.siteConfig = config;
    Banner_applyConfig();
    Banner_setupEventListeners();

  } catch (error) {
    console.error('Erro ao inicializar banner:', error);
    window.showToast('Erro ao carregar configurações do site', 'error');
  }
};

function Banner_applyConfig() {
  const config = window.AppState.siteConfig;
  if (!config) return;

  const titleEl = document.getElementById('site-title');
  const subtitleEl = document.getElementById('site-subtitle');
  const bannerImg = document.getElementById('banner-image');
  const bannerContainer = document.querySelector('.banner-container');

  // Aplicar título
  if (titleEl) {
    titleEl.textContent = config.title || 'Minha Rotina';
  }

  // Aplicar subtítulo
  if (subtitleEl) {
    subtitleEl.textContent = config.subtitle || 'Todas as suas tarefas em um só lugar.';
  }

  // Aplicar banner
  if (bannerImg && bannerContainer) {
    if (config.banner_url) {
      bannerImg.src = config.banner_url;
      bannerImg.style.display = 'block';
    } else {
      // Gradiente padrão roxo escuro quando não há imagem
      bannerImg.style.display = 'none';
      bannerContainer.style.background = 'linear-gradient(135deg, #1a1a2e 0%, #4a1a6b 50%, #2d1b69 100%)';
    }
  }

  // Aplicar ícone do app se existir
  if (config.app_icon_url) {
    Banner_applyAppIcon(config.app_icon_url);
  }
}

function Banner_applyAppIcon(iconUrl) {
  if (!iconUrl) return;
  
  // Atualizar apple-touch-icon
  let touchIcon = document.querySelector('link[rel="apple-touch-icon"]');
  if (!touchIcon) {
    touchIcon = document.createElement('link');
    touchIcon.rel = 'apple-touch-icon';
    document.head.appendChild(touchIcon);
  }
  touchIcon.href = iconUrl;

  // Atualizar favicon
  let favicon = document.querySelector('link[rel="icon"]');
  if (!favicon) {
    favicon = document.createElement('link');
    favicon.rel = 'icon';
    document.head.appendChild(favicon);
  }
  favicon.href = iconUrl;
}

function Banner_setupEventListeners() {
  const uploadBtn = document.getElementById('banner-upload-btn');
  const fileInput = document.getElementById('banner-file-input');
  const titleEl = document.getElementById('site-title');
  const subtitleEl = document.getElementById('site-subtitle');
  const appIconBtn = document.getElementById('app-icon-btn');
  const appIconInput = document.getElementById('app-icon-file-input');

  // Upload de Banner
  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        window.showToast('Enviando banner...');
        const url = await window.uploadImage(file, 'banners');
        
        // Atualizar no banco
        const { error } = await window.supabase
          .from('site_config')
          .update({ banner_url: url, updated_at: new Date().toISOString() })
          .eq('id', window.AppState.siteConfig.id);

        if (error) throw error;

        window.AppState.siteConfig.banner_url = url;
        
        // Mostrar a imagem
        const bannerImg = document.getElementById('banner-image');
        const bannerContainer = document.querySelector('.banner-container');
        if (bannerImg) {
          bannerImg.src = url;
          bannerImg.style.display = 'block';
        }
        if (bannerContainer) {
          bannerContainer.style.background = '';
        }
        
        window.showToast('Banner atualizado com sucesso!');
        
      } catch (error) {
        console.error('Erro no upload do banner:', error);
        window.showToast('Erro ao atualizar o banner', 'error');
      } finally {
        fileInput.value = '';
      }
    });
  }

  // Upload de Foto/Ícone do App
  if (appIconBtn && appIconInput) {
    appIconBtn.addEventListener('click', () => {
      appIconInput.click();
    });

    appIconInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        window.showToast('Enviando foto do aplicativo...');
        const url = await window.uploadImage(file, 'app-icons');

        // Atualizar no banco
        const { error } = await window.supabase
          .from('site_config')
          .update({ app_icon_url: url, updated_at: new Date().toISOString() })
          .eq('id', window.AppState.siteConfig.id);

        if (error) throw error;

        window.AppState.siteConfig.app_icon_url = url;
        Banner_applyAppIcon(url);
        window.showToast('Ícone do app atualizado com sucesso!');

      } catch (error) {
        console.error('Erro no upload do ícone:', error);
        window.showToast('Erro ao atualizar foto do app', 'error');
      } finally {
        appIconInput.value = '';
      }
    });
  }

  // Título editável (contenteditable h1)
  if (titleEl) {
    titleEl.addEventListener('blur', async () => {
      const newTitle = titleEl.textContent.trim();
      if (!newTitle || newTitle === window.AppState.siteConfig.title) return;

      try {
        const { error } = await window.supabase
          .from('site_config')
          .update({ title: newTitle, updated_at: new Date().toISOString() })
          .eq('id', window.AppState.siteConfig.id);

        if (error) throw error;
        
        window.AppState.siteConfig.title = newTitle;
        window.showToast('Título salvo!');
      } catch (error) {
        console.error('Erro ao salvar título:', error);
        window.showToast('Erro ao salvar título', 'error');
        titleEl.textContent = window.AppState.siteConfig.title;
      }
    });

    // Impedir Enter para não criar nova linha
    titleEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        titleEl.blur();
      }
    });
  }

  // Subtítulo editável (contenteditable p)
  if (subtitleEl) {
    subtitleEl.addEventListener('blur', async () => {
      const newSubtitle = subtitleEl.textContent.trim();
      if (!newSubtitle || newSubtitle === window.AppState.siteConfig.subtitle) return;

      try {
        const { error } = await window.supabase
          .from('site_config')
          .update({ subtitle: newSubtitle, updated_at: new Date().toISOString() })
          .eq('id', window.AppState.siteConfig.id);

        if (error) throw error;
        
        window.AppState.siteConfig.subtitle = newSubtitle;
        window.showToast('Subtítulo salvo!');
      } catch (error) {
        console.error('Erro ao salvar subtítulo:', error);
        window.showToast('Erro ao salvar subtítulo', 'error');
        subtitleEl.textContent = window.AppState.siteConfig.subtitle;
      }
    });

    subtitleEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        subtitleEl.blur();
      }
    });
  }
}
