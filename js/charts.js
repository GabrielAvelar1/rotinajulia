// charts.js
// Módulo de Gráficos e Evolução usando Chart.js

let weeklyChartInstance = null;
let monthlyChartInstance = null;

function getChartDateStr(d) {
  return window.getLocalDateString ? window.getLocalDateString(d) : d.toISOString().split('T')[0];
}

window.Charts_init = async function() {
  if (typeof Chart !== 'undefined') {
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = '#2d2d44';
  } else {
    console.warn('Chart.js não está carregado.');
  }
  await window.Charts_fetchLogs();
  window.Charts_render();
};

window.Charts_fetchLogs = async function() {
  const user = window.AppState.user;
  if (!user) return;
  
  // Buscar histórico de logs dos últimos 60 dias
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 60);
  const startStr = getChartDateStr(startDate);

  try {
    const { data, error } = await window.supabase
      .from('routine_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('completed_date', startStr);

    if (!error && data) {
      window.AppState.routineLogs = data;
    }
  } catch (err) {
    console.error('Erro ao carregar histórico de rotinas:', err);
  }
};

window.Charts_render = function() {
  if (typeof Chart === 'undefined') return;
  
  const routinesCount = window.AppState.routines.length;
  
  renderWeeklyChart(routinesCount);
  renderMonthlyChart(routinesCount);
  renderIndicators(routinesCount);
};

function getDayLogs(dateStr) {
  return (window.AppState.routineLogs || []).filter(l => l.completed_date === dateStr && l.completed);
}

function renderWeeklyChart(totalRoutines) {
  const ctx = document.getElementById('weekly-chart');
  if (!ctx) return;

  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const labels = [];
  const data = [];
  const bgColors = [];

  const today = new Date();
  
  // Calcular últimos 7 dias
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const dateStr = getChartDateStr(d);
    labels.push(dayNames[d.getDay()]);
    
    const completed = getDayLogs(dateStr).length;
    const percentage = totalRoutines === 0 ? 0 : Math.round((completed / totalRoutines) * 100);
    data.push(percentage);
    
    if (i === 0) {
      bgColors.push('#a78bfa');
    } else {
      bgColors.push('#8b5cf6');
    }
  }

  if (weeklyChartInstance) {
    weeklyChartInstance.destroy();
  }

  weeklyChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: bgColors,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) { return context.parsed.y + '%'; }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { callback: function(value) { return value + '%'; } }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

function renderMonthlyChart(totalRoutines) {
  const ctx = document.getElementById('monthly-chart');
  if (!ctx) return;

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const labels = [];
  const data = [];

  for (let i = 1; i <= daysInMonth; i++) {
    labels.push(i.toString());
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    
    // Se for no futuro, podemos deixar como 0 ou null (null não desenha a linha)
    if (new Date(year, month, i) > today) {
      data.push(null);
    } else {
      const completed = getDayLogs(dateStr).length;
      const percentage = totalRoutines === 0 ? 0 : Math.round((completed / totalRoutines) * 100);
      data.push(percentage);
    }
  }

  if (monthlyChartInstance) {
    monthlyChartInstance.destroy();
  }

  monthlyChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointStyle: 'circle',
        pointRadius: 3,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) { return context.parsed.y + '%'; }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { callback: function(value) { return value + '%'; } }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

function renderIndicators(totalRoutines) {
  const container = document.getElementById('evolution-indicators');
  if (!container) return;

  // Basic mock implementation for indicators as full historical data might be needed
  // This calculates this week average vs last week average
  
  const calcAvg = (startOffset, endOffset) => {
    let sum = 0;
    const today = new Date();
    for (let i = startOffset; i <= endOffset; i++) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = getChartDateStr(d);
      const completed = getDayLogs(dateStr).length;
      sum += totalRoutines === 0 ? 0 : (completed / totalRoutines) * 100;
    }
    const days = (endOffset - startOffset + 1);
    return Math.round(sum / days);
  };

  const thisWeekAvg = calcAvg(0, 6);
  const lastWeekAvg = calcAvg(7, 13);
  
  let weekDiff = thisWeekAvg - lastWeekAvg;
  let weekHtml = '';
  
  if (lastWeekAvg === 0 && thisWeekAvg === 0) {
    weekHtml = `<div class="indicator-card">Sem dados suficientes para comparar a semana</div>`;
  } else {
    const isUp = weekDiff >= 0;
    const color = isUp ? '#22c55e' : '#ef4444';
    const icon = isUp ? '↑' : '↓';
    weekHtml = `
      <div class="indicator-card">
        <span style="color: ${color}; font-weight: bold; font-size: 1.2rem;">${icon} ${Math.abs(weekDiff)}%</span>
        <span>em relação à semana passada</span>
      </div>
    `;
  }

  container.innerHTML = weekHtml;
}
