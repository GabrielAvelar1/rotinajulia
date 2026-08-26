// player.js
// Módulo de Playlist e Player de Música do YouTube

window.Player_init = async function() {
  const user = window.AppState.user;
  
  if (user) {
    try {
      const { data, error } = await window.supabase
        .from('playlist')
        .select('*')
        .eq('user_id', user.id)
        .order('position', { ascending: true });
        
      if (!error && data) {
        window.AppState.playlist = data;
      }
    } catch (err) {
      console.error('Erro ao carregar playlist:', err);
    }
  }

  // Events
  document.getElementById('add-youtube-btn')?.addEventListener('click', handleAddSong);
  document.getElementById('youtube-url-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleAddSong();
  });

  const list = document.getElementById('playlist-list');
  if (list) {
    list.addEventListener('click', async (e) => {
      const item = e.target.closest('.playlist-item');
      if (!item) return;

      const removeBtn = e.target.closest('.playlist-remove-btn');
      const id = item.dataset.playlistId;

      if (removeBtn) {
        try {
          const { error } = await window.supabase.from('playlist').delete().eq('id', id);
          if (error) throw error;
          
          window.AppState.playlist = window.AppState.playlist.filter(p => p.id !== id);
          
          // Check if playing
          if (item.classList.contains('playing')) {
            const playerContainer = document.getElementById('youtube-player-container');
            if (playerContainer) {
              playerContainer.innerHTML = '<div class="player-placeholder">Nenhuma música tocando</div>';
            }
          }
          
          window.Player_render();
        } catch (err) {
          console.error(err);
          window.showToast?.('Erro ao remover música.', 'error');
        }
        return;
      }

      // Play song
      const song = window.AppState.playlist.find(p => p.id === id);
      if (song) {
        playSong(song.youtube_id, id);
      }
    });
  }

  window.Player_render();
};

window.Player_extractYouTubeId = function(url) {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : null;
};

window.Player_getTitle = async function(videoId) {
  try {
    const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
    const data = await res.json();
    return data.title || 'Música sem título';
  } catch (err) {
    console.error(err);
    return 'Música sem título';
  }
};

async function handleAddSong() {
  const input = document.getElementById('youtube-url-input');
  if (!input) return;
  const url = input.value.trim();
  if (!url) return;

  const videoId = window.Player_extractYouTubeId(url);
  if (!videoId) {
    window.showToast?.('URL do YouTube inválida.', 'error');
    return;
  }

  input.value = 'Carregando...';
  input.disabled = true;

  try {
    const title = await window.Player_getTitle(videoId);
    const user = window.AppState.user;

    const { data, error } = await window.supabase.from('playlist').insert([{
      user_id: user.id,
      title: title,
      youtube_url: `https://www.youtube.com/watch?v=${videoId}`,
      youtube_id: videoId,
      position: window.AppState.playlist.length
    }]).select();

    if (error) throw error;

    if (data && data.length > 0) {
      window.AppState.playlist.push(data[0]);
      window.Player_render();
      playSong(videoId, data[0].id);
    }
    
    input.value = '';
  } catch (err) {
    console.error(err);
    window.showToast?.('Erro ao adicionar música.', 'error');
    input.value = url;
  } finally {
    input.disabled = false;
  }
}

function playSong(videoId, playlistId) {
  const playerContainer = document.getElementById('youtube-player-container');
  if (playerContainer) {
    playerContainer.innerHTML = `<iframe id="youtube-player" src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&origin=http://localhost" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width:100%; height:100%; border-radius: 8px;"></iframe>`;
  }
  
  // Highlight active
  document.querySelectorAll('.playlist-item').forEach(el => el.classList.remove('playing'));
  const activeEl = document.querySelector(`.playlist-item[data-playlist-id="${playlistId}"]`);
  if (activeEl) activeEl.classList.add('playing');
}

window.Player_render = function() {
  const container = document.getElementById('playlist-list');
  if (!container) return;

  if (window.AppState.playlist.length === 0) {
    container.innerHTML = '<p class="empty-msg">Sua playlist está vazia.</p>';
    return;
  }

  let html = '';
  window.AppState.playlist.forEach(song => {
    // Preserve playing state if needed by checking current iframe, or simpler, we just render and classes might be lost unless we store playing id in AppState. We will keep it simple.
    html += `
      <li class="playlist-item" data-playlist-id="${song.id}">
        <img class="playlist-thumb" src="https://img.youtube.com/vi/${song.youtube_id}/default.jpg" alt="thumbnail">
        <div class="playlist-info">
          <div class="playlist-title">${song.title}</div>
        </div>
        <button class="playlist-play-btn">▶️</button>
        <button class="playlist-remove-btn">🗑️</button>
      </li>
    `;
  });

  container.innerHTML = html;
};
