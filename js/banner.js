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

  // Aplicar ícone do app se existir no localStorage ou no banco
  const localAppIcon = localStorage.getItem('rotina_app_icon');
  if (localAppIcon) {
    Banner_applyAppIcon(localAppIcon);
  } else if (config.app_icon_url) {
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

  // Toque/Clique no banner para exibir/ocultar botão de troca
  const bannerContainer = document.querySelector('.banner-container');
  if (bannerContainer) {
    bannerContainer.addEventListener('click', (e) => {
      if (e.target.closest('#banner-upload-btn')) return;
      bannerContainer.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.banner-container')) {
        bannerContainer.classList.remove('active');
      }
    });
  }

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
        window.showToast('Processando foto do aplicativo...');

        // 1. Processar a imagem com canvas para criar um ícone quadrado perfeito de 192x192
        const iconDataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
              try {
                const canvas = document.createElement('canvas');
                canvas.width = 192;
                canvas.height = 192;
                const ctx = canvas.getContext('2d');
                
                // Enquadramento centralizado proporcional (cover)
                const minSide = Math.min(img.width, img.height);
                const sx = (img.width - minSide) / 2;
                const sy = (img.height - minSide) / 2;
                ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, 192, 192);
                
                resolve(canvas.toDataURL('image/png', 0.92));
              } catch (canvasErr) {
                resolve(event.target.result);
              }
            };
            img.onerror = () => resolve(event.target.result);
            img.src = event.target.result;
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // 2. Salvar imediatamente no navegador (localStorage) e aplicar no cabeçalho
        try {
          localStorage.setItem('rotina_app_icon', iconDataUrl);
        } catch (storageQuotaErr) {
          console.warn('LocalStorage quota excedida para ícone:', storageQuotaErr);
        }
        Banner_applyAppIcon(iconDataUrl);

        // 3. Tentar upload para o Supabase Storage e atualizar site_config sem bloquear sucesso
        let remoteUrl = null;
        try {
          remoteUrl = await window.uploadImage(file, 'app-icons');
        } catch (uploadErr) {
          console.warn('Upload remoto de imagem falhou, mantendo ícone local:', uploadErr);
        }

        if (remoteUrl && window.AppState.siteConfig?.id) {
          try {
            await window.supabase
              .from('site_config')
              .update({ app_icon_url: remoteUrl, updated_at: new Date().toISOString() })
              .eq('id', window.AppState.siteConfig.id);
            window.AppState.siteConfig.app_icon_url = remoteUrl;
          } catch (dbErr) {
            console.warn('Atualização remota no banco falhou:', dbErr);
          }
        }

        window.showToast('Foto do app atualizada com sucesso!', 'success');

      } catch (error) {
        console.error('Erro no processamento do ícone:', error);
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
