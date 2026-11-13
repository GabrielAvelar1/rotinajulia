// shop.js - Sistema de Loja, Meus Pets e Menu Hambúrguer Mobile

(function() {
  // Catálogo Oficial de Itens
  const CATALOG_PETS = [
    {
      id: 'penguin',
      name: 'Pinguim Fofinho',
      icon: '🐧',
      price: 0,
      description: 'Seu companheiro original e leal! Adora planar pelo planner e acompanhar suas tarefas.',
      free: true
    }
  ];

  const CATALOG_OUTFITS = [
    {
      id: 'none',
      name: 'Sem Roupa',
      icon: '🚫',
      price: 0,
      description: 'Estilo natural e limpo sem acessórios adicionais.',
      free: true
    },
    {
      id: 'scarf',
      name: 'Laço / Cachecol Rosa',
      icon: '🎀',
      price: 300,
      description: 'O charmoso laço rosa que dá um toque meigo e especial ao seu pet favorito!',
      free: false
    }
  ];

  let currentShopTab = 'outfits'; // 'outfits' ou 'pets'

  // ==========================================
  // CONTROLE DO MENU HAMBÚRGUER MOBILE
  // ==========================================

  function openMobileMenu() {
    const drawer = document.getElementById('mobile-menu-drawer');
    if (!drawer) return;

    // Atualiza dados no menu
    const emailEl = document.getElementById('mobile-menu-email');
    if (emailEl && window.AppState?.user?.email) {
      emailEl.textContent = window.AppState.user.email;
    }

    const coinsEl = document.getElementById('mobile-menu-coins-count');
    if (coinsEl && window.Gamification_getCoins) {
      coinsEl.textContent = window.Gamification_getCoins();
    }

    drawer.style.display = 'block';
    // Força reflow para animação
    setTimeout(() => {
      drawer.classList.add('is-open');
    }, 10);
  }

  function closeMobileMenu() {
    const drawer = document.getElementById('mobile-menu-drawer');
    if (!drawer) return;
    drawer.classList.remove('is-open');
    setTimeout(() => {
      drawer.style.display = 'none';
    }, 280);
  }

  // ==========================================
  // CONTROLE DE MODAIS (MEUS PETS & LOJA)
  // ==========================================

  window.Shop_openModal = function(modalId) {
    closeMobileMenu();

    if (modalId === 'pets-modal') {
      renderMyPetsModal();
      if (window.showModal) window.showModal('pets-modal');
      else {
        const m = document.getElementById('pets-modal');
        if (m) m.style.display = 'flex';
      }
    } else if (modalId === 'shop-modal') {
      renderShopModal();
      if (window.showModal) window.showModal('shop-modal');
      else {
        const m = document.getElementById('shop-modal');
        if (m) m.style.display = 'flex';
      }
    }
  };

  window.Shop_closeModal = function(modalId) {
    if (window.hideModal) window.hideModal(modalId);
    else {
      const m = document.getElementById(modalId);
      if (m) m.style.display = 'none';
    }
  };

  // ==========================================
  // RENDERIZAÇÃO: MEUS PETS
  // ==========================================

  function renderMyPetsModal() {
    if (!window.Gamification_getPetCustomizations) return;
    const petData = window.Gamification_getPetCustomizations();

    // 1. Toggle Ativo
    const activeToggle = document.getElementById('pet-active-toggle');
    if (activeToggle) {
      activeToggle.checked = petData.pet_enabled;
    }

    // 2. Seletor de Tamanho
    const sizeBtns = document.querySelectorAll('.pet-size-btn');
    sizeBtns.forEach(btn => {
      const sz = btn.getAttribute('data-size');
      if (sz === petData.pet_size) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // 3. Grid de Pets Desbloqueados
    const petsGrid = document.getElementById('pets-collection-grid');
    if (petsGrid) {
      const ownedPets = petData.pets_inventory || ['penguin'];
      let html = '';

      CATALOG_PETS.forEach(pet => {
        const isOwned = ownedPets.includes(pet.id);
        const isActive = petData.active_pet === pet.id;

        html += `
          <div class="pet-select-card ${isActive ? 'is-active' : ''} ${!isOwned ? 'is-locked' : ''}">
            <div class="pet-card-icon">${pet.icon}</div>
            <div class="pet-card-info">
              <strong>${pet.name}</strong>
              <small>${isActive ? '🟢 Mascote Ativo' : (isOwned ? 'Disponível' : '🔒 Na Loja')}</small>
            </div>
            <div class="pet-card-action">
              ${isOwned ? `
                <button type="button" class="btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost'} select-pet-btn" data-id="${pet.id}" ${isActive ? 'disabled' : ''}>
                  ${isActive ? 'Em Uso' : 'Escolher'}
                </button>
              ` : `
                <button type="button" class="btn btn-sm btn-ghost buy-pet-redirect-btn" data-id="${pet.id}">
                  Ver na Loja
                </button>
              `}
            </div>
          </div>
        `;
      });
      petsGrid.innerHTML = html;

      // Eventos de escolha de pet
      petsGrid.querySelectorAll('.select-pet-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const petId = btn.getAttribute('data-id');
          window.Gamification_savePetCustomizations({ active_pet: petId });
          renderMyPetsModal();
          if (window.showToast) window.showToast(`🐾 Mascote alterado com sucesso!`, 'success');
        });
      });

      petsGrid.querySelectorAll('.buy-pet-redirect-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          window.Shop_closeModal('pets-modal');
          currentShopTab = 'pets';
          window.Shop_openModal('shop-modal');
        });
      });
    }

    // 4. Grid de Roupas & Acessórios
    const outfitsGrid = document.getElementById('pets-outfits-grid');
    if (outfitsGrid) {
      const ownedOutfits = petData.pet_outfits || [];
      let html = '';

      CATALOG_OUTFITS.forEach(outfit => {
        const isOwned = outfit.id === 'none' || ownedOutfits.includes(outfit.id);
        const isEquipped = petData.active_outfit === outfit.id;

        html += `
          <div class="outfit-card ${isEquipped ? 'is-equipped' : ''} ${!isOwned ? 'is-locked' : ''}">
            <div class="outfit-card-icon">${outfit.icon}</div>
            <div class="outfit-card-details">
              <strong>${outfit.name}</strong>
              <small>${outfit.description}</small>
            </div>
            <div class="outfit-card-action">
              ${isOwned ? `
                <button type="button" class="btn btn-sm ${isEquipped ? 'btn-primary' : 'btn-ghost'} equip-outfit-btn" data-id="${outfit.id}" ${isEquipped ? 'disabled' : ''}>
                  ${isEquipped ? 'Vestido' : 'Vestir'}
                </button>
              ` : `
                <button type="button" class="btn btn-sm btn-ghost buy-outfit-redirect-btn" data-id="${outfit.id}">
                  ${outfit.price === 0 ? 'Loja (Grátis)' : `Loja (🪙 ${outfit.price})`}
                </button>
              `}
            </div>
          </div>
        `;
      });
      outfitsGrid.innerHTML = html;

      // Eventos de vestir roupa
      outfitsGrid.querySelectorAll('.equip-outfit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const outfitId = btn.getAttribute('data-id');
          window.Gamification_savePetCustomizations({ active_outfit: outfitId });
          renderMyPetsModal();
          if (window.showToast) {
            const item = CATALOG_OUTFITS.find(o => o.id === outfitId);
            window.showToast(`✨ ${item ? item.name : 'Roupa'} equipada com sucesso!`, 'success');
          }
        });
      });

      outfitsGrid.querySelectorAll('.buy-outfit-redirect-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          window.Shop_closeModal('pets-modal');
          currentShopTab = 'outfits';
          window.Shop_openModal('shop-modal');
        });
      });
    }
  }

  // ==========================================
  // RENDERIZAÇÃO: LOJA
  // ==========================================

  function renderShopModal() {
    if (!window.Gamification_getCoins) return;
    const coins = window.Gamification_getCoins();
    const petData = window.Gamification_getPetCustomizations ? window.Gamification_getPetCustomizations() : {};

    // Atualiza saldo na loja
    const balanceEl = document.getElementById('shop-coins-display');
    if (balanceEl) balanceEl.textContent = coins;

    // Abas
    const tabOutfits = document.getElementById('shop-tab-outfits');
    const tabPets = document.getElementById('shop-tab-pets');
    if (tabOutfits && tabPets) {
      if (currentShopTab === 'outfits') {
        tabOutfits.classList.add('active');
        tabPets.classList.remove('active');
      } else {
        tabPets.classList.add('active');
        tabOutfits.classList.remove('active');
      }
    }

    const container = document.getElementById('shop-items-container');
    if (!container) return;

    let html = '';

    if (currentShopTab === 'outfits') {
      // Itens de Roupas
      const ownedOutfits = petData.pet_outfits || [];

      CATALOG_OUTFITS.filter(o => o.id !== 'none').forEach(item => {
        const isBought = ownedOutfits.includes(item.id);
        const canAfford = coins >= item.price;

        html += `
          <div class="shop-item-card ${isBought ? 'is-bought' : ''}">
            <div class="shop-item-preview">${item.icon}</div>
            <div class="shop-item-body">
              <div class="shop-item-title-row">
                <strong>${item.name}</strong>
                <span class="shop-item-price-tag">${item.price === 0 ? 'Grátis' : `🪙 ${item.price}`}</span>
              </div>
              <p class="shop-item-desc">${item.description}</p>
            </div>
            <div class="shop-item-footer">
              ${isBought ? `
                <button type="button" class="btn btn-sm btn-ghost shop-item-btn" disabled>
                  Adquirido ✅
                </button>
              ` : `
                <button type="button" class="btn btn-sm btn-primary shop-buy-outfit-btn" data-id="${item.id}" data-price="${item.price}" ${!canAfford ? 'disabled' : ''}>
                  ${canAfford ? `<i class="fas fa-shopping-bag"></i> Comprar (${item.price === 0 ? 'Grátis' : `🪙 ${item.price}`})` : `Faltam ${item.price - coins} 🪙`}
                </button>
              `}
            </div>
          </div>
        `;
      });
    } else {
      // Itens de Pets
      const ownedPets = petData.pets_inventory || ['penguin'];

      CATALOG_PETS.forEach(pet => {
        const isBought = ownedPets.includes(pet.id);
        const canAfford = coins >= pet.price;

        html += `
          <div class="shop-item-card ${isBought ? 'is-bought' : ''}">
            <div class="shop-item-preview">${pet.icon}</div>
            <div class="shop-item-body">
              <div class="shop-item-title-row">
                <strong>${pet.name}</strong>
                <span class="shop-item-price-tag">${pet.price === 0 ? 'Grátis' : `🪙 ${pet.price}`}</span>
              </div>
              <p class="shop-item-desc">${pet.description}</p>
            </div>
            <div class="shop-item-footer">
              ${isBought ? `
                <button type="button" class="btn btn-sm btn-ghost shop-item-btn" disabled>
                  Adquirido ✅
                </button>
              ` : `
                <button type="button" class="btn btn-sm btn-primary shop-buy-pet-btn" data-id="${pet.id}" data-price="${pet.price}" ${!canAfford ? 'disabled' : ''}>
                  ${canAfford ? `<i class="fas fa-shopping-bag"></i> Adotar (${pet.price === 0 ? 'Grátis' : `🪙 ${pet.price}`})` : `Faltam ${pet.price - coins} 🪙`}
                </button>
              `}
            </div>
          </div>
        `;
      });
    }

    container.innerHTML = html;

    // Eventos de compra de roupas
    container.querySelectorAll('.shop-buy-outfit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const outfitId = btn.getAttribute('data-id');
        const price = parseInt(btn.getAttribute('data-price'), 10) || 0;

        if (window.Gamification_spendCoins(price)) {
          const currentOutfits = petData.pet_outfits || [];
          if (!currentOutfits.includes(outfitId)) {
            currentOutfits.push(outfitId);
          }
          // Equipa automaticamente o item recém comprado para conveniência!
          window.Gamification_savePetCustomizations({
            pet_outfits: currentOutfits,
            active_outfit: outfitId
          });

          const itemObj = CATALOG_OUTFITS.find(o => o.id === outfitId);
          const itemName = itemObj ? itemObj.name : 'Item';

          if (window.showToast) {
            window.showToast(`🎉 Parabéns! Você comprou e equipou "${itemName}"!`, 'success');
          }

          // Partículas festivas
          if (window.spawnCelebrationHearts) window.spawnCelebrationHearts();

          renderShopModal();
        } else {
          if (window.showToast) window.showToast('Moedas insuficientes para realizar esta compra.', 'warning');
        }
      });
    });

    // Eventos de compra de pets
    container.querySelectorAll('.shop-buy-pet-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const petId = btn.getAttribute('data-id');
        const price = parseInt(btn.getAttribute('data-price'), 10) || 0;

        if (window.Gamification_spendCoins(price)) {
          const currentPets = petData.pets_inventory || ['penguin'];
          if (!currentPets.includes(petId)) {
            currentPets.push(petId);
          }
          // Define como pet ativo
          window.Gamification_savePetCustomizations({
            pets_inventory: currentPets,
            active_pet: petId
          });

          const petObj = CATALOG_PETS.find(p => p.id === petId);
          const petName = petObj ? petObj.name : 'Mascote';

          if (window.showToast) {
            window.showToast(`🎉 Parabéns! Você adotou o "${petName}"!`, 'success');
          }

          if (window.spawnCelebrationHearts) window.spawnCelebrationHearts();

          renderShopModal();
        } else {
          if (window.showToast) window.showToast('Moedas insuficientes para adotar este pet.', 'warning');
        }
      });
    });
  }

  // ==========================================
  // INICIALIZAÇÃO DE EVENT LISTENERS
  // ==========================================

  function setupShopEventListeners() {
    // 1. Hambúrguer Mobile
    const hamburgerBtn = document.getElementById('hamburger-btn');
    if (hamburgerBtn) {
      hamburgerBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openMobileMenu();
      });
    }

    const mobileCloseBtn = document.getElementById('mobile-menu-close-btn');
    if (mobileCloseBtn) {
      mobileCloseBtn.addEventListener('click', closeMobileMenu);
    }

    const mobileBackdrop = document.getElementById('mobile-menu-backdrop');
    if (mobileBackdrop) {
      mobileBackdrop.addEventListener('click', closeMobileMenu);
    }

    // 2. Ações do Menu Mobile
    const mobNavPets = document.getElementById('mobile-nav-pets');
    if (mobNavPets) {
      mobNavPets.addEventListener('click', () => window.Shop_openModal('pets-modal'));
    }

    const mobNavShop = document.getElementById('mobile-nav-shop');
    if (mobNavShop) {
      mobNavShop.addEventListener('click', () => window.Shop_openModal('shop-modal'));
    }

    const mobNavSettings = document.getElementById('mobile-nav-settings');
    if (mobNavSettings) {
      mobNavSettings.addEventListener('click', () => {
        closeMobileMenu();
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) settingsBtn.click();
      });
    }

    const mobNavAppIcon = document.getElementById('mobile-nav-app-icon');
    if (mobNavAppIcon) {
      mobNavAppIcon.addEventListener('click', () => {
        closeMobileMenu();
        const iconInput = document.getElementById('app-icon-file-input');
        if (iconInput) iconInput.click();
      });
    }

    const mobNavLogout = document.getElementById('mobile-nav-logout');
    if (mobNavLogout) {
      mobNavLogout.addEventListener('click', () => {
        closeMobileMenu();
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) logoutBtn.click();
      });
    }

    // 3. Desktop Navigation Buttons
    const navShopBtn = document.getElementById('nav-shop-btn');
    if (navShopBtn) {
      navShopBtn.addEventListener('click', () => window.Shop_openModal('shop-modal'));
    }

    const navPetsBtn = document.getElementById('nav-pets-btn');
    if (navPetsBtn) {
      navPetsBtn.addEventListener('click', () => window.Shop_openModal('pets-modal'));
    }

    // 4. Modal "Meus Pets" Controles
    const petsCloseBtn = document.getElementById('pets-close-btn');
    if (petsCloseBtn) {
      petsCloseBtn.addEventListener('click', () => window.Shop_closeModal('pets-modal'));
    }

    const petsOkBtn = document.getElementById('pets-modal-ok-btn');
    if (petsOkBtn) {
      petsOkBtn.addEventListener('click', () => window.Shop_closeModal('pets-modal'));
    }

    const petsGoShopBtn = document.getElementById('pets-modal-go-shop-btn');
    if (petsGoShopBtn) {
      petsGoShopBtn.addEventListener('click', () => {
        window.Shop_closeModal('pets-modal');
        window.Shop_openModal('shop-modal');
      });
    }

    const petActiveToggle = document.getElementById('pet-active-toggle');
    if (petActiveToggle) {
      petActiveToggle.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        window.Gamification_savePetCustomizations({ pet_enabled: isEnabled });
        if (window.Pet_setEnabled) window.Pet_setEnabled(isEnabled);
      });
    }

    // Seletor de Tamanho
    const sizeBtns = document.querySelectorAll('.pet-size-btn');
    sizeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const size = btn.getAttribute('data-size');
        window.Gamification_savePetCustomizations({ pet_size: size });
        renderMyPetsModal();
        if (window.showToast) {
          const names = { small: 'Pequeno (44px)', medium: 'Médio (56px)', large: 'Grande (68px)' };
          window.showToast(`Tamanho ajustado para: ${names[size]}!`, 'info');
        }
      });
    });

    // 5. Modal "Loja" Controles
    const shopCloseBtn = document.getElementById('shop-close-btn');
    if (shopCloseBtn) {
      shopCloseBtn.addEventListener('click', () => window.Shop_closeModal('shop-modal'));
    }

    const shopOkBtn = document.getElementById('shop-modal-ok-btn');
    if (shopOkBtn) {
      shopOkBtn.addEventListener('click', () => window.Shop_closeModal('shop-modal'));
    }

    const shopGoPetsBtn = document.getElementById('shop-go-pets-btn');
    if (shopGoPetsBtn) {
      shopGoPetsBtn.addEventListener('click', () => {
        window.Shop_closeModal('shop-modal');
        window.Shop_openModal('pets-modal');
      });
    }

    // Abas da Loja
    const tabOutfits = document.getElementById('shop-tab-outfits');
    if (tabOutfits) {
      tabOutfits.addEventListener('click', () => {
        currentShopTab = 'outfits';
        renderShopModal();
      });
    }

    const tabPets = document.getElementById('shop-tab-pets');
    if (tabPets) {
      tabPets.addEventListener('click', () => {
        currentShopTab = 'pets';
        renderShopModal();
      });
    }
  }

  // Partículas festivas na tela ao comprar
  window.spawnCelebrationHearts = function() {
    const emojis = ['🪙', '✨', '💖', '🎉', '⭐'];
    for (let i = 0; i < 8; i++) {
      const p = document.createElement('div');
      p.className = 'pet-particle';
      p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      p.style.left = `${window.innerWidth / 2 + (Math.random() * 140 - 70)}px`;
      p.style.top = `${window.innerHeight / 2 + (Math.random() * 80 - 40)}px`;
      p.style.setProperty('--tx', `${(Math.random() - 0.5) * 80}px`);
      document.body.appendChild(p);

      setTimeout(() => p.remove(), 1200);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupShopEventListeners);
  } else {
    setupShopEventListeners();
  }
})();
