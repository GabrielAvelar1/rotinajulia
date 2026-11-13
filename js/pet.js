// pet.js - Mascote Pinguim Fofinho (Modelo V1 Clássico Ajustado 56px)
// Física 2D com queda lenta, bater de asas visível, soneca aos 8s e tombo ao pousar

(function() {
  const PET_SIZES = {
    small: { w: 44, h: 44 },
    medium: { w: 56, h: 56 },
    large: { w: 68, h: 68 }
  };

  let currentPetType = 'penguin';
  let currentPetSize = 'medium';
  let currentOutfit = 'none'; // 'none' por padrão! (Pinguim começa sem o laço)

  let PET_WIDTH = 56;
  let PET_HEIGHT = 56;
  const MAX_GLIDE_SPEED = 1.15; // Velocidade lenta de queda para ver o bater de asas
  const GLIDE_ACCEL = 0.04;     // Aceleração bem gradual
  const WALK_SPEED = 0.85;
  const SLEEP_IDLE_TIMEOUT = 8000; // Dorme após 8 segundos sem interação

  let petEl = null;
  let bubbleEl = null;
  let isEnabled = true;

  // Estado físico
  let x = window.innerWidth - 80;
  let y = window.innerHeight - 75;
  let vx = 0;
  let vy = 0;
  let glideTimer = 0;

  // Estados: 'IDLE', 'WALKING', 'FALLING', 'DRAGGING', 'SLEEPING', 'HAPPY', 'TUMBLE', 'FLYING'
  let state = 'IDLE';
  let facing = 'right'; // 'right' ou 'left'
  let currentPlatform = null; // { top, left, right, element, isFloor }
  let flightTarget = null;    // Alvo dinâmico quando está voando

  // Estado de arraste
  let isPointerDown = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragOffsetPetX = 0;
  let dragOffsetPetY = 0;
  let hasMovedDuringDrag = false;
  let dragStartTime = 0;

  // Timers autônomos e inatividade
  let autonomousTimer = null;
  let idleSinceTime = Date.now();
  let floorSitStartTime = 0;
  let bubbleTimeout = null;
  let tumbleTimeout = null;
  let scrollDownDropTimer = null;

  // Carrega customizações de pet/tamanho/roupas
  function loadCustomizations() {
    if (window.Gamification_getPetCustomizations) {
      const data = window.Gamification_getPetCustomizations();
      currentPetType = data.active_pet || 'penguin';
      currentPetSize = data.pet_size || 'medium';
      currentOutfit = data.active_outfit || 'none';
      isEnabled = data.pet_enabled !== false;
    } else {
      try {
        const cached = localStorage.getItem('rotina_gamification');
        if (cached) {
          const parsed = JSON.parse(cached);
          currentPetType = parsed.active_pet || 'penguin';
          currentPetSize = parsed.pet_size || 'medium';
          currentOutfit = parsed.active_outfit || 'none';
          isEnabled = parsed.pet_enabled !== false;
        }
      } catch (e) {}
    }

    const sz = PET_SIZES[currentPetSize] || PET_SIZES.medium;
    PET_WIDTH = sz.w;
    PET_HEIGHT = sz.h;
  }

  // SVG do Pinguim Fofinho Original V1 (Exato como antes)
  function getPenguinSvgContent() {
    return `
      <defs>
        <radialGradient id="bellyGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="100%" stop-color="#f1f5f9" />
        </radialGradient>
        <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#334155" />
          <stop offset="100%" stop-color="#0f172a" />
        </linearGradient>
      </defs>

      <!-- Pés alaranjados fofos -->
      <ellipse class="pet-foot pet-foot-left" cx="23" cy="57" rx="7" ry="3.5" fill="#f59e0b" />
      <ellipse class="pet-foot pet-foot-right" cx="41" cy="57" rx="7" ry="3.5" fill="#f59e0b" />

      <!-- Asinhas / Nadadeiras -->
      <path class="pet-flipper pet-flipper-left" d="M12 30 C7 35 6 45 13 47 C15 45 15 36 12 30 Z" fill="#1e293b" />
      <path class="pet-flipper pet-flipper-right" d="M52 30 C57 35 58 45 51 47 C49 45 49 36 52 30 Z" fill="#1e293b" />

      <!-- Corpo gordinho -->
      <ellipse cx="32" cy="35" rx="22" ry="23" fill="url(#bodyGrad)" />

      <!-- Barriga branca macia -->
      <ellipse cx="32" cy="38" rx="14.5" ry="17" fill="url(#bellyGrad)" />

      <!-- Bochechas rosadas (blush kawaii) -->
      <ellipse cx="20" cy="34" rx="3.5" ry="2" fill="#f472b6" opacity="0.65" />
      <ellipse cx="44" cy="34" rx="3.5" ry="2" fill="#f472b6" opacity="0.65" />

      <!-- Olhinhos normais brilhantes com reflexo de luz -->
      <g class="pet-eye">
        <ellipse cx="24" cy="28" rx="3.2" ry="4.2" fill="#0f172a" />
        <circle cx="25.2" cy="26.5" r="1.3" fill="#ffffff" />
        <circle cx="23" cy="29.5" r="0.6" fill="#ffffff" />

        <ellipse cx="40" cy="28" rx="3.2" ry="4.2" fill="#0f172a" />
        <circle cx="41.2" cy="26.5" r="1.3" fill="#ffffff" />
        <circle cx="39" cy="29.5" r="0.6" fill="#ffffff" />
      </g>

      <!-- Olhinhos dormindo (arcos fofos de olhinho fechado) -->
      <g class="pet-eye-sleep" style="display: none;">
        <path d="M21 28 Q24 32 27 28" fill="none" stroke="#0f172a" stroke-width="2" stroke-linecap="round" />
        <path d="M37 28 Q40 32 43 28" fill="none" stroke="#0f172a" stroke-width="2" stroke-linecap="round" />
      </g>

      <!-- Olhinhos de tombo/colisão (> < fofinho tonto) -->
      <g class="pet-eye-tumble" style="display: none;">
        <path d="M22 26 L26 29 L22 32" fill="none" stroke="#0f172a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M42 26 L38 29 L42 32" fill="none" stroke="#0f172a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
      </g>

      <!-- Biquinho fofo amarelo -->
      <path d="M29 32 Q32 37 35 32 Z" fill="#f59e0b" />
    `;
  }

  // SVG da Lira (Cachorrinha Shih Tzu branca e caramelo fofa)
  function getLiraSvgContent() {
    return `
      <!-- Patinhas traseiras sentadas -->
      <ellipse cx="18" cy="52" rx="4.5" ry="3.5" fill="#f7f3ed" stroke="#4a2c1d" stroke-width="1.4" />
      <ellipse cx="46" cy="52" rx="4.5" ry="3.5" fill="#f7f3ed" stroke="#4a2c1d" stroke-width="1.4" />

      <!-- Orelhas caídas peludinhas (caramelo macio) -->
      <path class="pet-flipper pet-flipper-left" d="M16 16 C9 22 7 36 10 43 C12 47 18 46 20 40 C22 34 22 24 19 18 Z" fill="#c49a7a" stroke="#4a2c1d" stroke-width="1.5" stroke-linejoin="round" />
      <path d="M15 22 C12 28 11 36 13 41 C14 43 17 42 18 38 C19 33 19 26 17 22 Z" fill="#b18362" opacity="0.45" />

      <path class="pet-flipper pet-flipper-right" d="M48 16 C55 22 57 36 54 43 C52 47 46 46 44 40 C42 34 42 24 45 18 Z" fill="#c49a7a" stroke="#4a2c1d" stroke-width="1.5" stroke-linejoin="round" />
      <path d="M49 22 C52 28 53 36 51 41 C50 43 47 42 46 38 C45 33 45 26 47 22 Z" fill="#b18362" opacity="0.45" />

      <!-- Corpo / Peitinho branco -->
      <path d="M22 38 C20 45 20 54 24 57 C27 59 37 59 40 57 C44 54 44 45 42 38 Z" fill="#ffffff" stroke="#4a2c1d" stroke-width="1.5" stroke-linejoin="round" />

      <!-- Patinhas dianteiras fofas -->
      <ellipse cx="26" cy="56" rx="4" ry="3" fill="#ffffff" stroke="#4a2c1d" stroke-width="1.3" />
      <line x1="26" y1="55" x2="26" y2="58" stroke="#4a2c1d" stroke-width="1.1" stroke-linecap="round" />
      <ellipse cx="38" cy="56" rx="4" ry="3" fill="#ffffff" stroke="#4a2c1d" stroke-width="1.3" />
      <line x1="38" y1="55" x2="38" y2="58" stroke="#4a2c1d" stroke-width="1.1" stroke-linecap="round" />

      <!-- Cabeça fofa de Shih Tzu -->
      <path d="M32 7 C21 7 16 14 16 26 C16 33 18 39 22 42 C26 45 38 45 42 42 C46 39 48 33 48 26 C48 14 43 7 32 7 Z" fill="#ffffff" stroke="#4a2c1d" stroke-width="1.5" stroke-linejoin="round" />

      <!-- Manchas faciais caramelo nos olhos (típicas de Shih Tzu) -->
      <path d="M17 24 C17 16 23 15 27 18 C28 22 28 28 25 32 C22 33 18 30 17 24 Z" fill="#c49a7a" />
      <path d="M18 25 C18 19 22 18 25 21 C26 24 26 28 24 30 C22 31 19 29 18 25 Z" fill="#d9b699" opacity="0.6" />

      <path d="M47 24 C47 16 41 15 37 18 C36 22 36 28 39 32 C42 33 46 30 47 24 Z" fill="#c49a7a" />
      <path d="M46 25 C46 19 42 18 39 21 C38 24 38 28 40 30 C42 31 45 29 46 25 Z" fill="#d9b699" opacity="0.6" />

      <!-- Focinho / Barbinha branca volumosa -->
      <path d="M32 26 C26 26 20 29 20 35 C20 40 24 43 32 43 C40 43 44 40 44 35 C44 29 38 26 32 26 Z" fill="#ffffff" stroke="#4a2c1d" stroke-width="1.4" stroke-linejoin="round" />

      <!-- Pintinhas expressivas na testa -->
      <circle cx="26" cy="17" r="1.1" fill="#4a2c1d" />
      <circle cx="38" cy="17" r="1.1" fill="#4a2c1d" />

      <!-- Olhinhos normais brilhantes de cachorrinho -->
      <g class="pet-eye">
        <ellipse cx="24" cy="24" rx="3.2" ry="3.8" fill="#3d2314" />
        <circle cx="25.2" cy="22.6" r="1.3" fill="#ffffff" />
        <circle cx="23.2" cy="25.5" r="0.6" fill="#ffffff" />

        <ellipse cx="40" cy="24" rx="3.2" ry="3.8" fill="#3d2314" />
        <circle cx="41.2" cy="22.6" r="1.3" fill="#ffffff" />
        <circle cx="39.2" cy="25.5" r="0.6" fill="#ffffff" />
      </g>

      <!-- Olhinhos dormindo -->
      <g class="pet-eye-sleep" style="display: none;">
        <path d="M21 24 Q24 28 27 24" fill="none" stroke="#4a2c1d" stroke-width="2" stroke-linecap="round" />
        <path d="M37 24 Q40 28 43 24" fill="none" stroke="#4a2c1d" stroke-width="2" stroke-linecap="round" />
      </g>

      <!-- Olhinhos de tombo (> <) -->
      <g class="pet-eye-tumble" style="display: none;">
        <path d="M22 22 L26 25 L22 28" fill="none" stroke="#4a2c1d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M42 22 L38 25 L42 28" fill="none" stroke="#4a2c1d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </g>

      <!-- Focinho / Narizinho marrom de Shih Tzu -->
      <ellipse cx="32" cy="27" rx="3.2" ry="2.4" fill="#4a2c1d" />
      <ellipse cx="31.2" cy="26.2" rx="1" ry="0.6" fill="#ffffff" opacity="0.7" />

      <!-- Boquinha feliz 'w' -->
      <path d="M29.5 30 Q32 32.5 32 30 Q32 32.5 34.5 30" fill="none" stroke="#4a2c1d" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
    `;
  }

  // Acessórios dinâmicos
  function getAccessoriesSvgContent() {
    return `
      <!-- 1. Laço / Cachecol Rosa (Disponível na Loja) -->
      <g id="pet-acc-scarf" class="pet-accessory" style="${currentOutfit === 'scarf' ? 'display:block' : 'display:none'};">
        ${currentPetType === 'lira' ? `
          <!-- Laço Rosa charmoso na cabecinha/orelha da Lira -->
          <path d="M42 16 C39 12 43 7 47 11 C51 7 55 12 52 16 C55 20 51 25 47 21 C43 25 39 20 42 16 Z" fill="#ec4899" stroke="#be185d" stroke-width="0.8" />
          <circle cx="47" cy="16" r="2.2" fill="#f472b6" stroke="#be185d" stroke-width="0.7" />
        ` : `
          <!-- Cachecol estiloso Lilás/Rosa clássico do Pinguim -->
          <path d="M19 40 C24 44 40 44 45 40 C47 42 45 45 42 46 C32 48 23 47 20 45 Z" fill="#ec4899" />
          <path d="M37 44 L40 52 L35 51 Z" fill="#f472b6" />
        `}
      </g>
    `;
  }

  // Montagem do SVG com Mascote Ativo e Roupa
  function createPetMarkup() {
    loadCustomizations();

    const sz = PET_SIZES[currentPetSize] || PET_SIZES.medium;
    const w = sz.w;
    const h = sz.h;

    let bodySvgContent = '';
    let defaultSound = 'Piu! 🐧';

    if (currentPetType === 'lira') {
      bodySvgContent = getLiraSvgContent();
      defaultSound = 'Au au! 🐶';
    } else {
      bodySvgContent = getPenguinSvgContent();
      defaultSound = 'Piu! 🐧';
    }

    return `
      <div class="pet-shadow"></div>
      <div class="pet-bubble" id="pet-speech-bubble">${defaultSound}</div>
      <div class="pet-gift-box" id="pet-gift-box" style="display: none;">🎁</div>
      <div class="pet-svg-container">
        <svg viewBox="0 0 64 64" width="${w}" height="${h}" style="overflow: visible;">
          ${bodySvgContent}
          ${getAccessoriesSvgContent()}
        </svg>
      </div>
    `;
  }

  // Detecta APENAS as caixas/contêineres principais solicitados
  // NÃO colide com itens individuais (.routine-item, .upcoming-task)
  // NÃO colide com calendário nem overview
  function getAvailablePlatforms() {
    const platforms = [];

    // 1. Chão da tela
    const floorY = window.innerHeight - PET_HEIGHT - 6;
    platforms.push({
      top: floorY,
      left: 0,
      right: window.innerWidth,
      isFloor: true
    });

    // 2. Modais abertos (topo do modal vira plataforma)
    const openModals = document.querySelectorAll('.modal');
    openModals.forEach(m => {
      if (m.style.display !== 'none' && m.offsetWidth > 0 && m.offsetHeight > 0) {
        const content = m.querySelector('.modal-content') || m;
        const rect = content.getBoundingClientRect();
        if (rect.top >= -20 && rect.top <= window.innerHeight) {
          platforms.push({
            top: rect.top - PET_HEIGHT + 4,
            left: Math.max(0, rect.left),
            right: Math.min(window.innerWidth, rect.right),
            element: content
          });
        }
      }
    });

    // 3. Contêineres de tarefas, player, evolução e cards
    const allowedSelectors = [
      '.routine-item',          // Tarefas diárias individuais!
      '#routines-section',      // Caixa de tarefas de rotina diária
      '#upcoming-section',      // Caixa de próximas tarefas ao lado do calendário
      '.overview-left',         // Caixa de tarefas do Overview
      '.tasks-table-container', // Tabela/conteúdo de tarefas do Overview
      '#player-section',        // Caixa do player de música
      '#charts-section',        // Caixa da evolução
      '.chart-card',            // Cards de gráficos da evolução
      '.folder-card',           // Cards de pastas
      '.gamification-card'      // Card de gamificação/nível
    ];

    const elements = document.querySelectorAll(allowedSelectors.join(','));

    elements.forEach(el => {
      if (el === petEl || el.contains(petEl)) return;

      const rect = el.getBoundingClientRect();

      // Verifica se o contêiner/item está visível na tela
      if (rect.width >= 50 && rect.height >= 26 && rect.top >= 20 && rect.top <= window.innerHeight - 40) {
        platforms.push({
          top: rect.top - PET_HEIGHT + 4,
          left: Math.max(0, rect.left),
          right: Math.min(window.innerWidth, rect.right),
          element: el
        });
      }
    });

    return platforms;
  }

  // Verifica se há plataforma abaixo para pousar
  function findPlatformBelow(currentX, currentY) {
    const platforms = getAvailablePlatforms();
    const petCenterX = currentX + PET_WIDTH / 2;

    let bestPlatform = null;
    let minDistance = Infinity;

    platforms.forEach(p => {
      if (petCenterX >= p.left - 10 && petCenterX <= p.right + 10) {
        const dist = p.top - currentY;
        if (dist >= -6 && dist < 18) {
          if (dist < minDistance) {
            minDistance = dist;
            bestPlatform = p;
          }
        }
      }
    });

    return bestPlatform;
  }

  // Procura plataforma diretamente sob o ponto de soltura
  function findPlatformOnRelease(currentX, currentY) {
    const platforms = getAvailablePlatforms();
    const petCenterX = currentX + PET_WIDTH / 2;

    let closest = null;
    let minDistance = Infinity;

    platforms.forEach(p => {
      if (petCenterX >= p.left - 15 && petCenterX <= p.right + 15) {
        const dist = p.top - currentY;
        if (Math.abs(dist) <= 12) {
          if (Math.abs(dist) < minDistance) {
            minDistance = Math.abs(dist);
            closest = p;
          }
        }
      }
    });

    return closest;
  }

  // Encontra modal aberto para o qual o pinguim pode voar
  function findActiveModal() {
    const modals = document.querySelectorAll('.modal');
    for (const m of modals) {
      if (m.style.display !== 'none' && m.offsetWidth > 0 && m.offsetHeight > 0) {
        const content = m.querySelector('.modal-content') || m;
        const rect = content.getBoundingClientRect();
        if (rect.top < window.innerHeight - 10 && rect.bottom > 10) {
          return {
            element: content,
            rect: rect
          };
        }
      }
    }
    return null;
  }

  // Encontra o contêiner visível mais relevante
  function findNearestVisibleBox() {
    const selectors = [
      '.routine-item',
      '#routines-section',
      '#upcoming-section',
      '.overview-left',
      '.tasks-table-container',
      '#player-section',
      '.gamification-card',
      '.folder-card'
    ];
    const viewportCenterY = window.innerHeight * 0.45;
    let best = null;
    let minDistance = Infinity;

    selectors.forEach(sel => {
      const el = document.querySelector(sel);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top >= 20 && rect.top <= window.innerHeight - 100 && rect.width > 50 && rect.height > 25) {
          const dist = Math.abs(rect.top - viewportCenterY);
          if (dist < minDistance) {
            minDistance = dist;
            best = { element: el, rect: rect, centerX: rect.left + rect.width / 2 - PET_WIDTH / 2 };
          }
        }
      }
    });

    return best;
  }

  // Inicia voo em direção a um alvo (modal, card ou coordenadas específicas)
  function startFlightTo(targetBox, bubbleMessage) {
    if (state === 'DRAGGING') return;

    if (state === 'SLEEPING') wakeUp();

    flightTarget = targetBox;
    currentPlatform = null;
    state = 'FLYING';
    vx = 0;
    vy = 0;

    if (bubbleMessage) {
      showBubble(bubbleMessage, 2000);
    }
    updatePetAppearance();
  }

  // Verifica se o elemento clicado/tocado é interativo (para não acionar em botões, campos ou tarefas)
  function isInteractiveElement(target) {
    if (!target || target === document.body || target === document.documentElement) return false;

    // Se for o pet ou dentro do pet, não é lugar vazio
    if (petEl && (target === petEl || petEl.contains(target))) return true;

    // Tags interativas comuns
    const interactiveTags = ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A', 'IFRAME', 'LABEL', 'AUDIO', 'VIDEO'];
    if (interactiveTags.includes(target.tagName)) return true;

    // Classes interativas do sistema
    const interactiveClasses = [
      'btn', 'btn-icon', 'sort-select', 'select', 'input', 'task-checkbox', 
      'routine-checkbox', 'vales-pill', 'special-date-pill', 'filter-tab',
      'folder-card', 'routine-item', 'upcoming-task', 'modal-close',
      'player-control-btn', 'calendar-day', 'mini-calendar', 'main-calendar'
    ];
    for (const cls of interactiveClasses) {
      if (target.classList && target.classList.contains(cls)) return true;
      if (target.closest && target.closest(`.${cls}`)) return true;
    }

    try {
      const style = window.getComputedStyle(target);
      if (style.cursor === 'pointer') return true;
    } catch (e) {}

    return false;
  }

  // Cria efeito visual de chamado no local do duplo clique/toque
  function spawnCallMarker(clientX, clientY) {
    const marker = document.createElement('div');
    marker.className = 'pet-call-marker';
    marker.style.left = `${clientX}px`;
    marker.style.top = `${clientY}px`;
    marker.innerHTML = `<span>✨</span>`;
    document.body.appendChild(marker);

    setTimeout(() => {
      if (marker && marker.parentNode) marker.remove();
    }, 700);
  }

  // Aciona o voo do pinguim até as coordenadas do duplo clique/toque
  function handleCallPet(clientX, clientY) {
    if (!isEnabled || state === 'DRAGGING') return;

    spawnCallMarker(clientX, clientY);

    const destX = Math.max(10, Math.min(window.innerWidth - PET_WIDTH - 10, clientX - PET_WIDTH / 2));
    const destY = Math.max(10, Math.min(window.innerHeight - PET_HEIGHT - 10, clientY - PET_HEIGHT / 2));

    startFlightTo({ x: destX, y: destY, isPoint: true }, 'Tô indo! 🪽✨');
  }

  // Balão de fala
  function showBubble(text, duration = 2200) {
    if (!bubbleEl) return;
    bubbleEl.textContent = text;
    bubbleEl.classList.add('is-visible');

    if (bubbleTimeout) clearTimeout(bubbleTimeout);
    bubbleTimeout = setTimeout(() => {
      if (bubbleEl) bubbleEl.classList.remove('is-visible');
    }, duration);
  }

  // Partículas flutuantes ao interagir com carinho
  function spawnHearts(originX, originY) {
    const emojis = ['💖', '✨', '🐾', '💕', '⭐'];
    for (let i = 0; i < 3; i++) {
      const p = document.createElement('div');
      p.className = 'pet-particle';
      p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      p.style.left = `${originX + (Math.random() * 28 - 14)}px`;
      p.style.top = `${originY - 10}px`;
      p.style.setProperty('--tx', `${(Math.random() - 0.5) * 45}px`);
      document.body.appendChild(p);

      setTimeout(() => p.remove(), 1200);
    }
  }

  // Partículas mágicas especiais na entrega de presente
  function spawnCelebrationGiftParticles(originX, originY) {
    const emojis = ['🎟️', '🛡️', '✨', '💖', '🎁', '⭐', '💫', '🎉'];
    for (let i = 0; i < 16; i++) {
      const p = document.createElement('div');
      p.className = 'pet-particle';
      p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      p.style.left = `${originX + (Math.random() * 80 - 40)}px`;
      p.style.top = `${originY + (Math.random() * 40 - 20)}px`;
      p.style.setProperty('--tx', `${(Math.random() - 0.5) * 110}px`);
      p.style.fontSize = `${1.2 + Math.random() * 0.7}rem`;
      document.body.appendChild(p);

      setTimeout(() => p.remove(), 1400);
    }
  }

  // Verifica e atualiza o estado visual do presente no Pet
  function checkPendingGiftState() {
    const hasGift = Boolean(window.Gamification_hasPendingGift && window.Gamification_hasPendingGift());
    if (!petEl) return;
    const giftBox = document.getElementById('pet-gift-box');

    if (hasGift) {
      petEl.classList.add('has-gift');
      if (giftBox) giftBox.style.display = 'block';
      showBubble('Tenho um presente para você! 🎁', 6000);
    } else {
      petEl.classList.remove('has-gift');
      if (giftBox) giftBox.style.display = 'none';
    }
  }

  // Entrega mágica do presente pelo Pet quando ela toca/faz carinho
  function deliverGiftAnimation() {
    state = 'HAPPY';
    showBubble('Para você! 💖✨', 3000);
    spawnCelebrationGiftParticles(x + PET_WIDTH / 2, y);

    // Pulinho animado de felicidade do pinguim
    vy = -3.8;

    setTimeout(() => {
      openGiftDeliveryModal();
    }, 380);
  }

  // Modal com animação da entrega do Vale Protetor
  function openGiftDeliveryModal() {
    let modal = document.getElementById('pet-gift-delivery-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'pet-gift-delivery-modal';
      modal.className = 'pet-gift-modal';
      modal.innerHTML = `
        <div class="pet-gift-backdrop" id="pet-gift-backdrop"></div>
        <div class="pet-gift-card">
          <div class="pet-gift-box-anim">
            <div class="gift-box-icon">🎁</div>
            <div class="gift-rays"></div>
          </div>

          <div class="pet-gift-header">
            <span class="pet-gift-pill">✨ PRESENTE DO SEU PET ✨</span>
            <h3 class="pet-gift-title">Você ganhou um Vale de Ofensiva!</h3>
            <p class="pet-gift-subtitle">O Pinguim guardou esse presente especial para você com muito carinho!</p>
          </div>

          <div class="pet-voucher-showcase">
            <div class="voucher-shield-wrap">
              <span class="voucher-shield-icon">🛡️</span>
            </div>
            <div class="voucher-text-wrap">
              <strong>1x Vale Protetor de Ofensiva</strong>
              <small>Protege suas sequências de hábitos e rotinas se você esquecer algum dia!</small>
            </div>
          </div>

          <button type="button" class="pet-claim-btn" id="pet-gift-claim-btn">
            💖 Guardar no Inventário (+1 Vale)
          </button>
        </div>
      `;
      document.body.appendChild(modal);

      const claimBtn = modal.querySelector('#pet-gift-claim-btn');
      const backdrop = modal.querySelector('#pet-gift-backdrop');

      const handleClaim = () => {
        if (window.Gamification_claimPendingGift) {
          window.Gamification_claimPendingGift();
        }

        // Celebração na tela
        spawnCelebrationGiftParticles(window.innerWidth / 2, window.innerHeight / 2);
        if (window.showToast) {
          window.showToast('🛡️ Vale de Ofensiva guardado com sucesso no inventário!', 'success');
        }

        // Animação de saída suave
        modal.classList.add('is-closing');
        setTimeout(() => {
          modal.style.display = 'none';
          modal.classList.remove('is-closing');
          modal.classList.remove('is-open');
          checkPendingGiftState();
        }, 320);
      };

      claimBtn.addEventListener('click', handleClaim);
      backdrop.addEventListener('click', handleClaim);
    }

    modal.style.display = 'flex';
    // Dispara a animação de abertura
    setTimeout(() => {
      modal.classList.add('is-open');
      spawnCelebrationGiftParticles(window.innerWidth / 2, window.innerHeight / 2 - 40);
    }, 15);
  }

  // Atualiza as classes CSS do pet conforme o estado atual
  function updatePetAppearance() {
    if (!petEl) return;

    petEl.classList.remove(
      'pet-idle',
      'pet-walking',
      'is-dragging',
      'is-falling',
      'is-flying',
      'pet-tumble',
      'pet-sleeping',
      'pet-happy'
    );

    if (state === 'DRAGGING') {
      petEl.classList.add('is-dragging');
    } else if (state === 'FLYING') {
      petEl.classList.add('is-flying');
    } else if (state === 'FALLING') {
      petEl.classList.add('is-falling');
    } else if (state === 'TUMBLE') {
      petEl.classList.add('pet-tumble');
    } else if (state === 'WALKING') {
      petEl.classList.add('pet-walking');
    } else if (state === 'SLEEPING') {
      petEl.classList.add('pet-sleeping');
    } else if (state === 'HAPPY') {
      petEl.classList.add('pet-happy');
    } else {
      petEl.classList.add('pet-idle');
    }

    if (facing === 'left') {
      petEl.classList.add('pet-facing-left');
    } else {
      petEl.classList.remove('pet-facing-left');
    }

    petEl.style.left = `${Math.round(x)}px`;
    petEl.style.top = `${Math.round(y)}px`;
  }

  // Dispara o tombo de pouso e o levantar
  function triggerTumbleLanding() {
    state = 'TUMBLE';
    updatePetAppearance();

    if (tumbleTimeout) clearTimeout(tumbleTimeout);
    tumbleTimeout = setTimeout(() => {
      if (state === 'TUMBLE') {
        state = 'IDLE';
        idleSinceTime = Date.now();
        updatePetAppearance();
      }
    }, 450);
  }

  // Acorda o pet suavemente
  function wakeUp() {
    if (state === 'SLEEPING') {
      state = 'IDLE';
      idleSinceTime = Date.now();
      showBubble('Piu! ✨', 1200);
      updatePetAppearance();
    }
  }

  // Loop de física e animação (60 FPS)
  function physicsLoop() {
    if (!isEnabled || !petEl) return;

    // Se está sendo arrastado pelo usuário
    if (state === 'DRAGGING') {
      updatePetAppearance();
      requestAnimationFrame(physicsLoop);
      return;
    }

    // Se está voando em direção a um modal, card ou ponto da tela
    if (state === 'FLYING') {
      let targetX = 0;
      let targetY = 0;
      let targetElement = null;

      if (flightTarget && flightTarget.isPoint) {
        targetX = flightTarget.x;
        targetY = flightTarget.y;
      } else if (flightTarget && flightTarget.element && document.body.contains(flightTarget.element)) {
        targetElement = flightTarget.element;
        const rect = targetElement.getBoundingClientRect();
        targetX = Math.max(10, Math.min(window.innerWidth - PET_WIDTH - 10, rect.left + rect.width / 2 - PET_WIDTH / 2));
        targetY = rect.top - PET_HEIGHT + 4;
      } else {
        state = 'FALLING';
        flightTarget = null;
        updatePetAppearance();
        requestAnimationFrame(physicsLoop);
        return;
      }

      const dx = targetX - x;
      const dy = targetY - y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      facing = dx < -2 ? 'left' : 'right';

      if (dist < 10) {
        x = targetX;
        y = targetY;
        flightTarget = null;

        if (targetElement) {
          const rect = targetElement.getBoundingClientRect();
          currentPlatform = {
            element: targetElement,
            top: targetY,
            left: Math.max(0, rect.left),
            right: Math.min(window.innerWidth, rect.right)
          };
          showBubble('Consegui! ✨🐧', 1600);
          triggerTumbleLanding();
        } else {
          // Chegou no ponto do toque!
          showBubble('Tô aqui! 🐧💖', 1600);
          const platformBelow = findPlatformBelow(x, y);
          if (platformBelow) {
            y = platformBelow.top;
            currentPlatform = platformBelow;
            triggerTumbleLanding();
          } else {
            // Se foi no ar vazio, começa a cair/planar suavemente
            state = 'FALLING';
            vy = 0.2;
            glideTimer = 0;
          }
        }
      } else {
        // Velocidade suave com pulso de esforço
        const speed = Math.min(2.8, Math.max(1.4, dist * 0.035));
        const flapEffort = Math.sin(Date.now() / 85) * 0.45;
        x += (dx / dist) * speed;
        y += (dy / dist) * speed + flapEffort;
      }

      updatePetAppearance();
      requestAnimationFrame(physicsLoop);
      return;
    }

    // Se está pousado em um card e o usuário rola a página:
    if (currentPlatform && currentPlatform.element) {
      const rect = currentPlatform.element.getBoundingClientRect();
      const expectedY = rect.top - PET_HEIGHT + 4;

      // Se o usuário arrastou a tela para cima (o elemento está subindo bruscamente):
      if (expectedY < y - 5) {
        const targetModal = findActiveModal() || findNearestVisibleBox();
        currentPlatform = null;
        if (targetModal) {
          startFlightTo(targetModal, 'Tô subindo! 🪽💦');
        } else {
          state = 'FALLING';
          vy = 0.2;
          glideTimer = 0;
        }
        requestAnimationFrame(physicsLoop);
        return;
      }

      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        currentPlatform = null;
        state = 'FALLING';
        vy = 0.2;
        glideTimer = 0;
      } else {
        y = expectedY;
        currentPlatform.top = expectedY;
        currentPlatform.left = Math.max(0, rect.left);
        currentPlatform.right = Math.min(window.innerWidth, rect.right);
      }
    }

    // Se está pousado no chão da tela
    if (currentPlatform && currentPlatform.isFloor) {
      if (!floorSitStartTime) floorSitStartTime = Date.now();

      // 1. Se um modal abrir enquanto está no chão, voa imediatamente para ele!
      const activeModal = findActiveModal();
      if (activeModal) {
        floorSitStartTime = 0;
        startFlightTo(activeModal, 'Tô subindo! 🪽💦');
        requestAnimationFrame(physicsLoop);
        return;
      }

      // 2. Se ficar no chão por mais de 5s, procura a caixa mais próxima
      if (Date.now() - floorSitStartTime > 5000) {
        const nearestBox = findNearestVisibleBox();
        if (nearestBox) {
          floorSitStartTime = 0;
          startFlightTo(nearestBox, 'Subindo! 🚀');
          requestAnimationFrame(physicsLoop);
          return;
        }
      }
    } else {
      floorSitStartTime = 0;
    }

    // QUEDA LENTA / PLANAR COM ASAS BATENDO VISIVELMENTE
    if (state === 'FALLING') {
      glideTimer += 0.06;

      // Queda bem lenta para dar tempo de ver todas as animações
      if (vy < MAX_GLIDE_SPEED) {
        vy += GLIDE_ACCEL;
      } else {
        vy = MAX_GLIDE_SPEED;
      }

      y += vy;
      // Pequena oscilação horizontal de quem tenta se equilibrar no ar
      x += Math.sin(glideTimer * 1.6) * 0.95 + vx;
      vx *= 0.95;

      if (x < 6) { x = 6; }
      if (x > window.innerWidth - PET_WIDTH - 6) { x = window.innerWidth - PET_WIDTH - 6; }

      const platform = findPlatformBelow(x, y);
      if (platform) {
        y = platform.top;
        vy = 0;
        vx = 0;
        currentPlatform = platform;
        glideTimer = 0;
        triggerTumbleLanding();
      }
    } else if (state === 'WALKING') {
      x += vx;

      const minX = currentPlatform ? currentPlatform.left : 4;
      const maxX = currentPlatform ? currentPlatform.right - PET_WIDTH : window.innerWidth - PET_WIDTH - 4;

      if (x <= minX) {
        x = minX;
        vx = Math.abs(vx);
        facing = 'right';
      } else if (x >= maxX) {
        x = maxX;
        vx = -Math.abs(vx);
        facing = 'left';
      }

      if (currentPlatform && !currentPlatform.isFloor && currentPlatform.element) {
        if (!document.body.contains(currentPlatform.element) || currentPlatform.element.offsetParent === null) {
          currentPlatform = null;
          state = 'FALLING';
          vy = 0.2;
          glideTimer = 0;
        }
      }
    }

    // Soneca após 8 segundos sem interação (não dorme se tiver presente pendente para entregar!)
    const hasPendingGift = Boolean(window.Gamification_hasPendingGift && window.Gamification_hasPendingGift());
    if (state === 'IDLE' && Date.now() - idleSinceTime > SLEEP_IDLE_TIMEOUT && !hasPendingGift) {
      state = 'SLEEPING';
      showBubble('Zzz... 💤', 4500);
    }

    updatePetAppearance();
    requestAnimationFrame(physicsLoop);
  }

  // Comportamento autônomo
  function autonomousBehavior() {
    if (!isEnabled || state === 'DRAGGING' || state === 'FALLING' || state === 'FLYING' || state === 'TUMBLE') {
      autonomousTimer = setTimeout(autonomousBehavior, 2000);
      return;
    }

    if (state === 'SLEEPING') {
      if (Math.random() < 0.12) {
        wakeUp();
      } else {
        if (Math.random() < 0.35) showBubble('Zzz... 💤', 3000);
      }
      autonomousTimer = setTimeout(autonomousBehavior, 4000);
      return;
    }

    const hasPendingGift = Boolean(window.Gamification_hasPendingGift && window.Gamification_hasPendingGift());
    if (hasPendingGift && Math.random() < 0.42) {
      showBubble('Tenho um presente para você! 🎁', 3800);
    }

    const rand = Math.random();

    if (state === 'WALKING') {
      state = 'IDLE';
      vx = 0;
      autonomousTimer = setTimeout(autonomousBehavior, 2500 + Math.random() * 2500);
    } else {
      if (rand < 0.65) {
        state = 'WALKING';
        facing = Math.random() < 0.5 ? 'left' : 'right';
        vx = facing === 'left' ? -WALK_SPEED : WALK_SPEED;
        autonomousTimer = setTimeout(autonomousBehavior, 1800 + Math.random() * 3000);
      } else {
        facing = facing === 'left' ? 'right' : 'left';
        autonomousTimer = setTimeout(autonomousBehavior, 2000 + Math.random() * 2000);
      }
    }
  }

  // Pointer Down
  function handlePointerDown(e) {
    if (!isEnabled) return;

    isPointerDown = true;
    hasMovedDuringDrag = false;
    dragStartTime = Date.now();

    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);

    dragStartX = clientX;
    dragStartY = clientY;

    dragOffsetPetX = clientX - x;
    dragOffsetPetY = clientY - y;

    if (state === 'SLEEPING') {
      wakeUp();
    }

    if (scrollDownDropTimer) clearTimeout(scrollDownDropTimer);

    state = 'DRAGGING';
    currentPlatform = null;
    flightTarget = null;
    vx = 0;
    vy = 0;

    if (e.target && e.target.setPointerCapture && e.pointerId) {
      try { e.target.setPointerCapture(e.pointerId); } catch (err) {}
    }
  }

  // Pointer Move
  function handlePointerMove(e) {
    if (!isPointerDown || state !== 'DRAGGING') return;

    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);

    const dx = clientX - dragStartX;
    const dy = clientY - dragStartY;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      hasMovedDuringDrag = true;
    }

    if (dx < -2) facing = 'left';
    else if (dx > 2) facing = 'right';

    x = clientX - dragOffsetPetX;
    y = clientY - dragOffsetPetY;

    x = Math.max(0, Math.min(window.innerWidth - PET_WIDTH, x));
    y = Math.max(0, Math.min(window.innerHeight - PET_HEIGHT, y));

    idleSinceTime = Date.now();
  }

  // Pointer Up
  function handlePointerUp(e) {
    if (!isPointerDown) return;
    isPointerDown = false;

    const duration = Date.now() - dragStartTime;

    // Se foi apenas um toque rápido sem arrastar: Entrega do presente ou pulinho de carinho!
    if (!hasMovedDuringDrag && duration < 350) {
      if (window.Gamification_hasPendingGift && window.Gamification_hasPendingGift()) {
        deliverGiftAnimation();
        return;
      }

      state = 'HAPPY';
      showBubble('💖 Piu!', 1800);
      spawnHearts(x + PET_WIDTH / 2, y);

      setTimeout(() => {
        state = 'IDLE';
        idleSinceTime = Date.now();
      }, 500);
      return;
    }

    // Se soltou exatamente em cima de uma plataforma (tolerância estreita <= 8px)
    const platformNear = findPlatformOnRelease(x, y);
    if (platformNear && Math.abs(platformNear.top - y) <= 8) {
      y = platformNear.top;
      currentPlatform = platformNear;
      triggerTumbleLanding();
    } else {
      // Inicia a queda lenta e fofa batendo as asinhas!
      state = 'FALLING';
      vy = 0.2;
      glideTimer = 0;
    }

    idleSinceTime = Date.now();

    try {
      localStorage.setItem('rotina_pet_pos', JSON.stringify({ x, y }));
    } catch (err) {}
  }

  // Observador para detectar abertura de modais no site e acionar voo caso esteja no chão
  function setupModalObserver() {
    const observer = new MutationObserver(() => {
      if (state !== 'DRAGGING' && state !== 'FLYING' && currentPlatform && currentPlatform.isFloor) {
        const activeModal = findActiveModal();
        if (activeModal) {
          startFlightTo(activeModal, 'Tô subindo! 🪽💦');
        }
      }
    });

    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ['style', 'class']
    });
  }

  // Inicialização
  window.Pet_init = function() {
    const savedEnabled = localStorage.getItem('rotina_pet_enabled');
    isEnabled = savedEnabled === null ? true : savedEnabled === 'true';

    try {
      const savedPos = localStorage.getItem('rotina_pet_pos');
      if (savedPos) {
        const parsed = JSON.parse(savedPos);
        if (parsed.x >= 0 && parsed.x < window.innerWidth && parsed.y >= 0 && parsed.y < window.innerHeight) {
          x = parsed.x;
          y = parsed.y;
        }
      }
    } catch (err) {}

    x = Math.max(10, Math.min(window.innerWidth - PET_WIDTH - 10, x));
    y = Math.max(10, Math.min(window.innerHeight - PET_HEIGHT - 10, y));

    let existingPet = document.getElementById('site-pet');
    if (!existingPet) {
      petEl = document.createElement('div');
      petEl.id = 'site-pet';
      petEl.innerHTML = createPetMarkup();
      document.body.appendChild(petEl);
    } else {
      petEl = existingPet;
      petEl.innerHTML = createPetMarkup();
    }

    bubbleEl = document.getElementById('pet-speech-bubble');
    checkPendingGiftState();

    petEl.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    petEl.addEventListener('touchstart', handlePointerDown, { passive: true });
    window.addEventListener('touchmove', handlePointerMove, { passive: true });
    window.addEventListener('touchend', handlePointerUp, { passive: true });

    // Acorda o pinguim ou reinicia o timer de inatividade ao interagir com a página
    window.addEventListener('click', () => {
      if (state === 'SLEEPING') wakeUp();
      else idleSinceTime = Date.now();
    }, { passive: true });

    // Duplo clique no desktop em área vazia
    window.addEventListener('dblclick', (e) => {
      if (!isEnabled) return;
      if (isInteractiveElement(e.target)) return;
      handleCallPet(e.clientX, e.clientY);
    });

    // Duplo toque no celular em área vazia
    let lastTapTime = 0;
    let lastTapX = 0;
    let lastTapY = 0;

    window.addEventListener('touchend', (e) => {
      if (!isEnabled) return;
      if (!e.changedTouches || e.changedTouches.length === 0) return;

      const touch = e.changedTouches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY) || e.target;
      if (isInteractiveElement(target)) return;

      const now = Date.now();
      const timeDiff = now - lastTapTime;
      const dist = Math.hypot(touch.clientX - lastTapX, touch.clientY - lastTapY);

      if (timeDiff > 60 && timeDiff < 380 && dist < 35) {
        lastTapTime = 0;
        try { e.preventDefault(); } catch (err) {}
        handleCallPet(touch.clientX, touch.clientY);
      } else {
        lastTapTime = now;
        lastTapX = touch.clientX;
        lastTapY = touch.clientY;
      }
    }, { passive: false });

    let lastScrollY = window.scrollY || window.pageYOffset || 0;
    let scrollDownDropTimer = null;

    window.addEventListener('scroll', () => {
      idleSinceTime = Date.now();
      const currentScrollY = window.scrollY || window.pageYOffset || 0;
      const scrollingDown = currentScrollY > lastScrollY + 4;
      lastScrollY = currentScrollY;

      if (state !== 'DRAGGING' && state !== 'FLYING') {
        const activeModal = findActiveModal();

        // 1. Se abriu um modal e ele não está nele:
        if (activeModal && (!currentPlatform || currentPlatform.element !== activeModal.element)) {
          if (scrollDownDropTimer) clearTimeout(scrollDownDropTimer);
          startFlightTo(activeModal, 'Tô subindo! 🪽💦');
          return;
        }

        // 2. Se o usuário rolou a tela para baixo:
        // NÃO desce na mesma hora, aguarda exatamente 1 segundo para cair suavemente!
        if (scrollingDown) {
          if (scrollDownDropTimer) clearTimeout(scrollDownDropTimer);
          scrollDownDropTimer = setTimeout(() => {
            if (state !== 'DRAGGING' && state !== 'FLYING') {
              // Se o pinguim está na metade superior da tela (ficou para trás lá em cima)
              if (y < window.innerHeight * 0.52 && currentPlatform && !currentPlatform.isFloor) {
                currentPlatform = null;
                state = 'FALLING';
                vy = 0.2;
                glideTimer = 0;
                showBubble('Lá vou eu! 🪂', 1600);
              }
            }
          }, 1000);
        } else {
          // Se rolou para cima e estava no chão, voa até a caixa visível
          if (scrollDownDropTimer) clearTimeout(scrollDownDropTimer);
          if (currentPlatform && currentPlatform.isFloor) {
            const target = activeModal || findNearestVisibleBox();
            if (target) {
              startFlightTo(target, 'Tô subindo! 🪽💦');
            }
          }
        }
      }
    }, { passive: true });

    window.addEventListener('keydown', () => {
      if (state === 'SLEEPING') wakeUp();
      else idleSinceTime = Date.now();
    }, { passive: true });

    window.addEventListener('resize', () => {
      x = Math.max(10, Math.min(window.innerWidth - PET_WIDTH - 10, x));
      y = Math.max(10, Math.min(window.innerHeight - PET_HEIGHT - 10, y));
    });

    setupModalObserver();

    petEl.style.display = isEnabled ? 'block' : 'none';

    if (isEnabled) {
      state = 'FALLING';
      vy = 0.2;
      glideTimer = 0;
      requestAnimationFrame(physicsLoop);
      autonomousBehavior();
    }
  };

  window.Pet_setEnabled = function(enabled) {
    isEnabled = !!enabled;
    try {
      localStorage.setItem('rotina_pet_enabled', isEnabled ? 'true' : 'false');
    } catch (e) {}

    if (petEl) {
      petEl.style.display = isEnabled ? 'block' : 'none';
    }

    if (isEnabled) {
      state = 'FALLING';
      vy = 0.2;
      glideTimer = 0;
      requestAnimationFrame(physicsLoop);
      autonomousBehavior();
      showBubble('Olá! 🐧✨', 2000);
    }
  };

  window.Pet_getEnabled = function() {
    return isEnabled;
  };

  // Aplica customizações de pet, tamanho e roupinhas em tempo real
  window.Pet_applyCustomizations = function(customData) {
    if (!customData && window.Gamification_getPetCustomizations) {
      customData = window.Gamification_getPetCustomizations();
    }
    if (customData) {
      currentPetType = customData.active_pet || 'penguin';
      currentPetSize = customData.pet_size || 'medium';
      currentOutfit = customData.active_outfit || 'none';
      isEnabled = customData.pet_enabled !== false;

      const sz = PET_SIZES[currentPetSize] || PET_SIZES.medium;
      PET_WIDTH = sz.w;
      PET_HEIGHT = sz.h;
    }

    if (petEl) {
      petEl.style.width = `${PET_WIDTH}px`;
      petEl.style.height = `${PET_HEIGHT}px`;
      petEl.style.display = isEnabled ? 'block' : 'none';
      petEl.innerHTML = createPetMarkup();
      bubbleEl = document.getElementById('pet-speech-bubble');
      checkPendingGiftState();
    }
  };

  window.Pet_updateGiftState = function(hasGift) {
    checkPendingGiftState();
  };

  window.Pet_notifyPendingGift = function(giftData) {
    checkPendingGiftState();
    wakeUp();
    showBubble('Tenho um presente para você! 🎁', 6000);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.Pet_init);
  } else {
    window.Pet_init();
  }
})();
