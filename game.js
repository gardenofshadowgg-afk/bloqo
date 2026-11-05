(() => {
  'use strict';

  const SIZE = 8;
  const POWER_MAX = 100;
  // The multiplier affects points only. The BLOQO POWER energy formula stays independent.
  const MULTIPLIER_MILESTONES = [0, 2, 5, 9, 14];
  const COLORS = ['#5f9eff', '#ffbd57', '#ff647e', '#55d3a0', '#ae86fc', '#5ccee9'];
  const DAILY_TARGET = 1200;
  const DAILY_LIMIT = 20;
  const COLLECTIONS = [
    { id:'crystal', icon:'💎', name:'Cristal Azul', goal:500 },
    { id:'flame', icon:'🔥', name:'Chama Aurora', goal:1500 },
    { id:'ruby', icon:'♦', name:'Núcleo Rubi', goal:2500 },
    { id:'crown', icon:'👑', name:'Coroa Solar', goal:5000 },
    { id:'galaxy', icon:'🌌', name:'Universo BLOQO', goal:10000 }
  ];
  const THEMES = [
    { id:'classic', icon:'🌙', name:'Original', cost:0 },
    { id:'neon', icon:'💜', name:'Neon', cost:4 },
    { id:'aurora', icon:'🌿', name:'Aurora', cost:8 },
    { id:'gold', icon:'☀', name:'Solar', cost:12 }
  ];
  const ACHIEVEMENTS = [
    { id:'firstLine', icon:'✨', name:'Primeira linha' },
    { id:'firstPower', icon:'⚡', name:'Primeiro poder' },
    { id:'multiplier5', icon:'✖', name:'Multiplicador ×5' },
    { id:'collector', icon:'💎', name:'Primeiro colecionável' },
    { id:'dailyWinner', icon:'🏆', name:'Desafio diário vencido' }
  ];
  const MISSIONS = [
    { id:'lines', name:'Complete 6 linhas', goal:6 },
    { id:'points', name:'Ganhe 2.000 pontos', goal:2000 },
    { id:'powers', name:'Use 2 poderes', goal:2 }
  ];
  const SHAPES = [
    [[0,0],[0,1]],
    [[0,0],[1,0]],
    [[0,0],[0,1],[0,2]],
    [[0,0],[1,0],[2,0]],
    [[0,0],[0,1],[1,0]],
    [[0,0],[0,1],[1,1]],
    [[0,1],[1,0],[1,1]],
    [[0,0],[1,0],[1,1]],
    [[0,0],[0,1],[1,0],[1,1]],
    [[0,0],[0,1],[0,2],[0,3]],
    [[0,0],[1,0],[2,0],[3,0]],
    [[0,0],[0,1],[0,2],[1,1]],
    [[0,1],[1,0],[1,1],[1,2]],
    [[0,0],[1,0],[2,0],[2,1]],
    [[0,0],[0,1],[0,2],[1,0]],
    [[0,0],[1,0],[1,1],[1,2]],
    [[0,0],[0,1],[1,1],[2,1]],
    [[0,0],[0,1],[0,2],[1,2]],
    [[0,0],[0,1],[1,1],[1,2]],
    [[0,1],[0,2],[1,0],[1,1]],
    [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]],
    [[0,0],[0,1],[0,2],[0,3],[0,4]],
    [[0,0],[1,0],[2,0],[3,0],[4,0]],
    [[0,0],[0,1],[1,0],[1,1],[2,0]],
    [[0,0],[0,1],[1,0],[2,0],[2,1]],
    [[0,0],[0,1],[0,2],[1,0],[1,2]],
    [[0,0],[0,1],[0,2],[1,1],[2,1]],
    [[0,1],[1,0],[1,1],[1,2],[2,1]],
    [[0,0],[0,1],[0,2],[1,0],[2,0]],
    [[0,0],[0,1],[1,1],[1,2],[2,2]],
    [[0,0],[1,0],[2,0],[2,1],[2,2]],
    [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]]
  ];

  const $ = id => document.getElementById(id);
  const boardEl = $('board');
  const trayEl = $('pieceTray');
  const scoreEl = $('score');
  const bestEl = $('best');
  const comboEl = $('comboCounter');
  const toastEl = $('boardToast');
  const ghostEl = $('dragGhost');
  const hintEl = $('trayHint');
  const powerPanelEl = $('powerPanel');
  const powerFillEl = $('powerFill');
  const powerPercentEl = $('powerPercent');
  const powerMeterEl = powerPanelEl.querySelector('.power-meter');
  const powerHintEl = $('powerHint');
  const removePowerBtn = $('removePowerBtn');
  const movePowerBtn = $('movePowerBtn');
  const multiplierPanelEl = $('multiplierPanel');
  const multiplierValueEl = $('multiplierValue');
  const multiplierHintEl = $('multiplierHint');
  const multiplierFillEl = $('multiplierFill');
  const multiplierMeterEl = multiplierPanelEl.querySelector('.multiplier-meter');
  const multiplierMiniEl = $('multiplierMini');
  const journeyEl = $('journeyModal');
  const comboEffectsEl = $('comboEffects');
  const screenViewportEl = $('screenViewport');
  const screenTrackEl = $('screenTrack');
  let activeScreen = 'play';
  let gameMode = 'classic';
  let dailyMoves = 0;
  let dailyRandom = null;
  let journey;

  let board, hand, score, combo, best, startBest;
  let linesCleared = 0;
  let multiplier = 1;
  let energy = 0;
  let powerMode = null;
  let lastPlaced = null;
  let gameEpoch = 0;
  let selectedSlot = -1;
  let hoverCell = null;
  let busy = false;
  let gameOver = false;
  let drag = null;
  // Gentle one-shot effects are on by default, with a persistent mute option.
  let soundEnabled = (() => {
    try { return localStorage.getItem('bloqo-sound') !== 'off'; }
    catch { return true; }
  })();
  let audioContext = null;
  let toastTimeout = null;

  const getSavedBest = () => {
    try { return Math.max(0, Number(localStorage.getItem('bloqo-best') || 0) || 0); }
    catch { return 0; }
  };
  const saveBest = value => { try { localStorage.setItem('bloqo-best', String(value)); } catch { /* storage is optional */ } };
  journey = loadJourney();

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function loadJourney() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('bloqo-journey-v4') || '{}') || {}; } catch { /* new profile */ }
    const owned = Array.isArray(saved.owned) ? saved.owned : ['classic'];
    const profile = {
      stars: Math.max(0, Math.floor(Number(saved.stars) || 0)),
      owned: Array.from(new Set(['classic', ...owned.filter(x => THEMES.some(t => t.id === x))])),
      theme: THEMES.some(t => t.id === saved.theme && owned.includes(t.id)) ? saved.theme : 'classic',
      collections: Array.isArray(saved.collections) ? saved.collections : [],
      achievements: Array.isArray(saved.achievements) ? saved.achievements : [],
      rankings: Array.isArray(saved.rankings) ? saved.rankings.filter(x => Number.isFinite(x.score)).slice(0,5) : [],
      daily: saved.daily || {}, dailyChallenge: saved.dailyChallenge || {}
    };
    if (profile.daily.date !== todayKey()) profile.daily = { date:todayKey(), lines:0, points:0, powers:0, claimed:[] };
    if (!Array.isArray(profile.daily.claimed)) profile.daily.claimed = [];
    if (profile.dailyChallenge.date !== todayKey()) profile.dailyChallenge = { date:todayKey(), won:false };
    // Respect records achieved before the collection existed.
    const oldBest = getSavedBest();
    for (const item of COLLECTIONS) if (oldBest >= item.goal && !profile.collections.includes(item.id)) profile.collections.push(item.id);
    if (profile.collections.length && !profile.achievements.includes('collector')) profile.achievements.push('collector');
    return profile;
  }

  function saveJourney() {
    try { localStorage.setItem('bloqo-journey-v4', JSON.stringify(journey)); } catch { /* private mode */ }
    $('starsBadge').textContent = `${journey.stars} ★`;
  }

  function refreshDay() {
    if (journey.daily.date !== todayKey()) journey.daily = { date:todayKey(), lines:0, points:0, powers:0, claimed:[] };
    if (journey.dailyChallenge.date !== todayKey()) journey.dailyChallenge = { date:todayKey(), won:false };
  }

  function earnAchievement(id) {
    if (gameMode === 'zen' || journey.achievements.includes(id)) return;
    journey.achievements.push(id);
    saveJourney();
  }

  function unlockCollections() {
    if (gameMode !== 'classic') return;
    let newItem = null;
    for (const item of COLLECTIONS) {
      if (score >= item.goal && !journey.collections.includes(item.id)) {
        journey.collections.push(item.id);
        newItem = item;
      }
    }
    if (newItem) {
      earnAchievement('collector');
      saveJourney();
      showToast(`${newItem.icon} ${newItem.name} LIBERADO!`);
    }
  }

  function updateMission(stat, count) {
    if (gameMode === 'zen' || count <= 0) return;
    refreshDay();
    journey.daily[stat] = Math.max(0, (journey.daily[stat] || 0) + count);
    for (const mission of MISSIONS) {
      if (journey.daily[mission.id] >= mission.goal && !journey.daily.claimed.includes(mission.id)) {
        journey.daily.claimed.push(mission.id);
        journey.stars += 2;
      }
    }
    saveJourney();
  }

  function addPoints(amount) {
    score += amount;
    updateMission('points', amount);
    unlockCollections();
  }

  function renderJourney() {
    refreshDay();
    $('starsTotal').textContent = journey.stars;
    $('missionList').innerHTML = MISSIONS.map(m => {
      const progress = Math.min(m.goal, journey.daily[m.id] || 0);
      const done = journey.daily.claimed.includes(m.id);
      return `<div class="journey-entry"><span>${done ? '✅' : '☀'} <strong>${m.name}</strong><small>${progress.toLocaleString('pt-BR')}/${m.goal.toLocaleString('pt-BR')}</small></span><b>${done ? 'Concluída · +2 ★' : '+2 ★'}</b></div>`;
    }).join('');
    $('collectionGrid').innerHTML = COLLECTIONS.map(item => {
      const owned = journey.collections.includes(item.id);
      return `<div class="collection-item ${owned ? 'unlocked' : 'locked'}"><span class="collection-emoji">${owned ? item.icon : '🔒'}</span><strong>${owned ? item.name : 'Item secreto'}</strong><small>${owned ? 'DESCOBERTO' : `${item.goal.toLocaleString('pt-BR')} pontos`}</small></div>`;
    }).join('');
    $('themeList').innerHTML = THEMES.map(theme => {
      const owned = journey.owned.includes(theme.id);
      const selected = journey.theme === theme.id;
      return `<div class="journey-entry"><span>${theme.icon} <strong>${theme.name}</strong><small>${owned ? 'Seu tema' : `${theme.cost} estrelas`}</small></span><button class="theme-pick" data-theme-id="${theme.id}" ${selected || (!owned && journey.stars < theme.cost) ? 'disabled' : ''}>${selected ? 'Em uso' : owned ? 'Usar' : `Comprar ★${theme.cost}`}</button></div>`;
    }).join('');
    $('achievementList').innerHTML = ACHIEVEMENTS.map(a => `<div class="journey-entry achievement ${journey.achievements.includes(a.id) ? 'achieved' : ''}"><span>${journey.achievements.includes(a.id) ? a.icon : '🔒'} <strong>${a.name}</strong></span><b>${journey.achievements.includes(a.id) ? '✓' : '—'}</b></div>`).join('');
    $('rankingList').innerHTML = journey.rankings.length ? journey.rankings.map((entry,i) => `<div class="journey-entry"><span><strong>#${i+1} · ${Number(entry.score).toLocaleString('pt-BR')} pontos</strong><small>${entry.date || 'Clássico'}</small></span><b>★</b></div>`).join('') : '<p class="journey-empty">Termine uma partida Clássica para entrar no ranking.</p>';
    saveJourney();
  }

  function applyTheme() {
    $('gameWrap').dataset.theme = journey.theme;
  }

  function createDailyRandom() {
    let seed = 2166136261;
    for (const ch of todayKey()) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619);
    return () => {
      seed = (Math.imul(seed,1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  function updateModeUI() {
    for (const [id,mode] of [['classicBtn','classic'],['dailyBtn','daily'],['zenBtn','zen']]) {
      $(id).classList.toggle('active', gameMode === mode);
      $(id).setAttribute('aria-pressed', String(gameMode === mode));
    }
    $('dailyStatus').hidden = gameMode !== 'daily';
    $('dailyStatus').textContent = `DESAFIO ${todayKey().split('-').reverse().slice(0,2).join('/')} · Meta ${DAILY_TARGET.toLocaleString('pt-BR')} pontos · ${Math.max(0,DAILY_LIMIT-dailyMoves)} peças restantes${journey.dailyChallenge.won ? ' · ★ Já concluído hoje' : ''}`;
    $('gameWrap').classList.toggle('zen-mode',gameMode === 'zen');
  }

  // Original, softly tuned sound effects (no looping music or external audio).
  // Each note has a rounded attack/decay so repeated moves stay comfortable.
  const SOUND_EFFECTS = {
    pick:    [[610, 0, .048, .010]],
    place:   [[440, 0, .105, .023], [660, .045, .105, .013]],
    invalid: [[250, 0, .075, .012]],
    clear:   [[523, 0, .13, .024], [659, .075, .13, .022], [784, .15, .17, .021]],
    combo:   [[523, 0, .12, .022], [659, .060, .12, .022], [784, .120, .14, .023], [1047, .19, .19, .020]],
    finish:  [[392, 0, .19, .014], [330, .12, .21, .012]],
    enable:  [[660, 0, .075, .013], [880, .055, .10, .014]],
    ready:   [[659, 0, .11, .020], [880, .09, .14, .021], [1175, .17, .19, .015]],
    power:   [[750, 0, .085, .024], [390, .06, .15, .025]]
  };

  function playSound(effect) {
    if (!soundEnabled) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioContext) audioContext = new Ctx();
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
      const now = audioContext.currentTime + .005;
      for (const [frequency, delay, duration, volume] of SOUND_EFFECTS[effect] || []) {
        const start = now + delay;
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();
        oscillator.type = effect === 'invalid' ? 'triangle' : 'sine';
        oscillator.frequency.setValueAtTime(frequency, start);
        // A tiny downward pitch bend makes the notes sound like soft wooden chimes.
        oscillator.frequency.exponentialRampToValueAtTime(frequency * .985, start + duration);
        filter.type = 'lowpass';
        filter.frequency.value = 1500;
        gain.gain.setValueAtTime(.0001, start);
        gain.gain.linearRampToValueAtTime(volume, start + .009);
        gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
        oscillator.connect(filter);
        filter.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(start);
        oscillator.stop(start + duration + .01);
      }
    } catch { /* no audio permission: game still works */ }
  }

  function randomPiece() {
    // Favor short, easy pieces while still introducing bigger shapes.
    const pool = score < 500 ? SHAPES.slice(0, 21) : SHAPES;
    const random = dailyRandom || Math.random;
    const cells = pool[Math.floor(random() * pool.length)].map(([r,c]) => [r,c]);
    return { cells, color: COLORS[Math.floor(random() * COLORS.length)] };
  }

  function makeHand() {
    return [randomPiece(), randomPiece(), randomPiece()];
  }

  function shapeBounds(piece) {
    return { rows: 1 + Math.max(...piece.cells.map(a => a[0])), cols: 1 + Math.max(...piece.cells.map(a => a[1])) };
  }

  function makeShape(piece, tileSize) {
    const { rows, cols } = shapeBounds(piece);
    const shape = document.createElement('div');
    shape.className = 'piece-shape';
    shape.style.setProperty('--rows', rows);
    shape.style.setProperty('--cols', cols);
    shape.style.setProperty('--tile', `${tileSize}px`);
    const keys = new Set(piece.cells.map(([r,c]) => `${r},${c}`));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const square = document.createElement('span');
        square.className = keys.has(`${r},${c}`) ? 'piece-block' : 'piece-empty';
        if (keys.has(`${r},${c}`)) square.style.setProperty('--tile-color', piece.color);
        shape.appendChild(square);
      }
    }
    return shape;
  }

  function updateScore() {
    scoreEl.textContent = score.toLocaleString('pt-BR');
    if (gameMode === 'classic' && score > best) {
      best = score;
      saveBest(best);
    }
    bestEl.textContent = best.toLocaleString('pt-BR');
    comboEl.hidden = combo < 2;
    comboEl.textContent = `COMBO ×${combo}`;
  }

  function updateMultiplier() {
    const maxed = multiplier === MULTIPLIER_MILESTONES.length;
    const currentGoal = MULTIPLIER_MILESTONES[multiplier - 1];
    const nextGoal = maxed ? currentGoal : MULTIPLIER_MILESTONES[multiplier];
    const progress = maxed ? 1 : (linesCleared - currentGoal) / (nextGoal - currentGoal);
    multiplierValueEl.textContent = `×${multiplier}`;
    multiplierMiniEl.textContent = `×${multiplier}`;
    multiplierHintEl.textContent = maxed
      ? 'MÁXIMO! Pontos ×5'
      : `${linesCleared - currentGoal}/${nextGoal - currentGoal} linhas para ×${multiplier + 1}`;
    multiplierFillEl.style.width = `${Math.min(100, Math.max(0, progress * 100))}%`;
    multiplierMeterEl.setAttribute('aria-valuenow', String(Math.min(linesCleared, nextGoal)));
    multiplierMeterEl.setAttribute('aria-valuemax', String(nextGoal));
    multiplierPanelEl.classList.toggle('is-maxed', maxed);
  }

  function advanceMultiplier(clearedLines) {
    linesCleared += clearedLines;
    const previous = multiplier;
    for (let i = MULTIPLIER_MILESTONES.length - 1; i >= 0; i--) {
      if (linesCleared >= MULTIPLIER_MILESTONES[i]) {
        multiplier = i + 1;
        break;
      }
    }
    updateMultiplier();
    if (multiplier !== previous) {
      if (multiplier >= 5) earnAchievement('multiplier5');
      multiplierPanelEl.classList.remove('level-up');
      void multiplierPanelEl.offsetWidth;
      multiplierPanelEl.classList.add('level-up');
      playSound('ready');
      return true;
    }
    return false;
  }

  function canMoveLast() {
    return !!lastPlaced && lastPlaced.cells.every(([r, c]) => board[r][c] === lastPlaced.piece.color);
  }

  function updatePower() {
    const ready = energy >= POWER_MAX;
    powerFillEl.style.width = `${energy}%`;
    powerPercentEl.textContent = ready ? 'PRONTO!' : `${energy}%`;
    powerMeterEl.setAttribute('aria-valuenow', String(energy));
    powerPanelEl.classList.toggle('is-ready', ready);
    powerPanelEl.classList.toggle('is-charging', !ready && energy > 0);
    removePowerBtn.disabled = busy || gameOver || !ready || !board.some(row => row.some(Boolean));
    movePowerBtn.disabled = busy || gameOver || !ready || !canMoveLast();
    removePowerBtn.classList.toggle('active', powerMode === 'remove');
    movePowerBtn.classList.toggle('active', powerMode === 'move');
    boardEl.classList.toggle('power-remove', powerMode === 'remove');
    boardEl.classList.toggle('power-move', powerMode === 'move');
    if (powerMode === 'remove') powerHintEl.textContent = 'Toque em um quadradinho ocupado para destruí-lo.';
    else if (powerMode === 'move') powerHintEl.textContent = 'Toque em uma nova posição para mover a última peça.';
    else if (ready && !canMoveLast()) powerHintEl.textContent = 'Energia cheia! Use Remover bloco para abrir espaço.';
    else if (ready) powerHintEl.textContent = 'Escolha um poder! Você pode carregá-lo novamente.';
    else powerHintEl.textContent = 'Complete linhas e faça combos para carregar.';
  }

  function addEnergy(amount) {
    const previous = energy;
    energy = Math.min(POWER_MAX, energy + amount);
    const earned = energy - previous;
    if (earned > 0) {
      const feedback = document.createElement('span');
      feedback.className = 'power-earned';
      feedback.textContent = `+${earned} ⚡`;
      feedback.setAttribute('aria-hidden', 'true');
      powerPanelEl.appendChild(feedback);
      setTimeout(() => feedback.remove(), 700);
    }
    if (previous < POWER_MAX && energy === POWER_MAX) {
      playSound('ready');
      powerPanelEl.classList.remove('just-charged');
      void powerPanelEl.offsetWidth;
      powerPanelEl.classList.add('just-charged');
    }
    updatePower();
  }

  function renderBoard(placed = []) {
    const fresh = document.createDocumentFragment();
    const justPlaced = new Set(placed.map(([r,c]) => `${r},${c}`));
    const sourceCells = powerMode === 'move' && lastPlaced ? new Set(lastPlaced.cells.map(([r,c]) => `${r},${c}`)) : null;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'cell';
        cell.dataset.row = r;
        cell.dataset.col = c;
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-label', `Linha ${r+1}, coluna ${c+1}, ${board[r][c] ? 'ocupada' : 'livre'}`);
        if (board[r][c]) {
          cell.classList.add('filled');
          cell.style.setProperty('--tile-color', board[r][c]);
        }
        if (justPlaced.has(`${r},${c}`)) cell.classList.add('just-placed');
        if (sourceCells?.has(`${r},${c}`)) cell.classList.add('move-source');
        fresh.appendChild(cell);
      }
    }
    boardEl.replaceChildren(fresh);
    if (hoverCell && powerMode === 'move') showMovePreview(hoverCell.r, hoverCell.c);
    else if (hoverCell && selectedSlot >= 0) showPreview(hoverCell.r, hoverCell.c);
  }

  function renderHand() {
    trayEl.replaceChildren();
    const slotWidth = (trayEl.clientWidth - 20) / 3;
    hand.forEach((piece, i) => {
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'piece-slot';
      slot.dataset.slot = i;
      slot.setAttribute('aria-label', piece ? `Peça ${i + 1}: ${piece.cells.length} blocos` : `Peça ${i + 1} já usada`);
      if (!piece) {
        slot.classList.add('used');
        slot.disabled = true;
      } else {
        slot.disabled = !!powerMode;
        const { cols, rows } = shapeBounds(piece);
        const tile = Math.max(12, Math.min(24, Math.floor((slotWidth - 20 - (cols - 1) * 2) / cols), Math.floor((85 - (rows - 1) * 2) / rows)));
        slot.appendChild(makeShape(piece, tile));
        if (i === selectedSlot) slot.classList.add('selected');
        slot.setAttribute('aria-pressed', String(i === selectedSlot));
        slot.addEventListener('pointerdown', e => startDrag(e, i));
        slot.addEventListener('click', e => { if (e.detail === 0) selectPiece(i); });
      }
      trayEl.appendChild(slot);
    });
    hintEl.textContent = powerMode ? 'Use o poder no tabuleiro' : selectedSlot < 0 ? 'Toque numa peça e depois no tabuleiro' : 'Agora toque onde deseja encaixar';
  }

  function selectPiece(index) {
    if (busy || gameOver || powerMode || !hand[index]) return;
    selectedSlot = index;
    hoverCell = null;
    clearPreview();
    renderHand();
    playSound('pick');
  }

  function getCells(piece, r, c) {
    return piece.cells.map(([dr, dc]) => [r+dr, c+dc]);
  }

  function fits(piece, r, c) {
    return getCells(piece, r, c).every(([rr,cc]) => rr >= 0 && cc >= 0 && rr < SIZE && cc < SIZE && !board[rr][cc]);
  }

  function anyFit(piece) {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (fits(piece, r, c)) return true;
      }
    }
    return false;
  }

  function clearPreview() {
    boardEl.querySelectorAll('.preview-valid,.preview-invalid').forEach(cell => {
      cell.classList.remove('preview-valid','preview-invalid');
      cell.style.removeProperty('--preview-color');
    });
  }

  function validMove(r, c) {
    if (!canMoveLast() || (r === lastPlaced.r && c === lastPlaced.c)) return false;
    const source = new Set(lastPlaced.cells.map(([rr,cc]) => `${rr},${cc}`));
    return getCells(lastPlaced.piece, r, c).every(([rr,cc]) =>
      rr >= 0 && cc >= 0 && rr < SIZE && cc < SIZE && (!board[rr][cc] || source.has(`${rr},${cc}`))
    );
  }

  function showMovePreview(r, c) {
    clearPreview();
    if (powerMode !== 'move' || busy || gameOver || !canMoveLast()) return;
    const valid = validMove(r, c);
    getCells(lastPlaced.piece, r, c).forEach(([rr,cc]) => {
      if (rr < 0 || cc < 0 || rr >= SIZE || cc >= SIZE) return;
      const cell = boardEl.children[rr * SIZE + cc];
      cell.classList.add(valid ? 'preview-valid' : 'preview-invalid');
      if (valid) cell.style.setProperty('--preview-color', lastPlaced.piece.color);
    });
  }

  function showPreview(r, c, index = selectedSlot) {
    clearPreview();
    if (index < 0 || !hand[index] || busy || gameOver) return;
    const piece = hand[index];
    const valid = fits(piece, r, c);
    getCells(piece, r, c).forEach(([rr,cc]) => {
      if (rr < 0 || cc < 0 || rr >= SIZE || cc >= SIZE) return;
      const cell = boardEl.children[rr * SIZE + cc];
      cell.classList.add(valid ? 'preview-valid' : 'preview-invalid');
      if (valid) cell.style.setProperty('--preview-color', piece.color);
    });
  }

  function showToast(message) {
    clearTimeout(toastTimeout);
    toastEl.textContent = message;
    toastEl.classList.add('show');
    toastTimeout = setTimeout(() => toastEl.classList.remove('show'), 950);
  }

  function placePiece(index, r, c) {
    if (busy || gameOver || !hand[index]) return false;
    const piece = hand[index];
    if (!fits(piece, r, c)) {
      showToast('Essa peça não cabe aqui');
      playSound('invalid');
      return false;
    }
    const cells = getCells(piece, r, c);
    cells.forEach(([rr,cc]) => { board[rr][cc] = piece.color; });
    lastPlaced = { piece: { cells: piece.cells.map(cell => [...cell]), color: piece.color }, r, c, cells };
    addPoints(cells.length * 10 * multiplier);
    addEnergy(10);
    if (gameMode === 'daily') dailyMoves++;
    hand[index] = null;
    selectedSlot = -1;
    hoverCell = null;
    clearPreview();
    renderBoard(cells);
    renderHand();
    resolveLines();
    return true;
  }

  function resolveLines() {
    const rows = [];
    const cols = [];
    for (let i = 0; i < SIZE; i++) {
      if (board[i].every(Boolean)) rows.push(i);
      if (board.every(row => !!row[i])) cols.push(i);
    }
    if (rows.length || cols.length) {
      busy = true;
      const epoch = gameEpoch;
      combo++;
      const total = rows.length + cols.length;
      const upgraded = advanceMultiplier(total);
      const linePoints = (total * 120 + (combo > 1 ? (combo - 1) * 80 : 0)) * multiplier;
      addPoints(linePoints);
      updateMission('lines',total);
      earnAchievement('firstLine');
      addEnergy(total * 25 + (combo > 1 ? 40 : 0));
      updateScore();
      const marked = new Set();
      for (const row of rows) for (let col = 0; col < SIZE; col++) marked.add(`${row},${col}`);
      for (const col of cols) for (let row = 0; row < SIZE; row++) marked.add(`${row},${col}`);
      marked.forEach(key => {
        const [rr,cc] = key.split(',').map(Number);
        boardEl.children[rr*SIZE+cc]?.classList.add('clearing');
      });
      boardEl.classList.remove('line-celebration');
      void boardEl.offsetWidth;
      boardEl.classList.add('line-celebration');
      if (combo >= 2 || total > 1) celebrateCombo(combo,total);
      showToast(upgraded ? `MULTIPLICADOR ×${multiplier}! ✦` : combo > 1 ? `COMBO ×${combo}! +${linePoints}` : total > 1 ? `INCRÍVEL! ${total} LINHAS` : 'LINHA COMPLETA!');
      if (!upgraded) playSound(combo > 1 ? 'combo' : 'clear');
      setTimeout(() => {
        if (epoch !== gameEpoch) return;
        marked.forEach(key => {
          const [rr,cc] = key.split(',').map(Number);
          board[rr][cc] = null;
        });
        if (lastPlaced?.cells.some(([r,c]) => marked.has(`${r},${c}`))) lastPlaced = null;
        busy = false;
        boardEl.classList.remove('line-celebration');
        finishTurn();
      }, 275);
    } else {
      combo = 0;
      playSound('place');
      updateScore();
      finishTurn();
    }
  }

  function finishTurn() {
    if (gameOver) return;
    if (hand.every(piece => piece === null)) hand = makeHand();
    renderBoard();
    renderHand();
    updateScore();
    updatePower();
    updateModeUI();
    if (gameMode === 'daily' && score >= DAILY_TARGET) {
      endGame(true);
      return;
    }
    if (gameMode === 'daily' && dailyMoves >= DAILY_LIMIT) {
      endGame(false);
      return;
    }
    if (!hand.some(piece => piece && anyFit(piece))) {
      if (gameMode === 'zen') {
        // A calm, endless mode: create breathing room without changing a record.
        board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
        hand = makeHand();
        lastPlaced = null;
        powerMode = null;
        energy = 0;
        combo = 0;
        renderBoard();
        renderHand();
        updatePower();
        showToast('ZEN · TABULEIRO RENOVADO 🌿');
        return;
      }
      if (energy >= POWER_MAX && (board.some(row => row.some(Boolean)) || canMoveLast())) {
        showToast('Use um poder para continuar!');
        return;
      }
      endGame(false);
    }
  }

  function celebrateCombo(currentCombo,total) {
    const text = document.createElement('strong');
    text.className = 'combo-burst';
    text.textContent = currentCombo > 1 ? `COMBO ×${currentCombo} ✦` : `${total} LINHAS! ✦`;
    comboEffectsEl.appendChild(text);
    for (let i = 0; i < 10; i++) {
      const spark = document.createElement('i');
      spark.className = 'combo-spark';
      spark.style.setProperty('--angle', `${i*36}deg`);
      spark.style.setProperty('--distance',`${80+(i%3)*20}px`);
      comboEffectsEl.appendChild(spark);
    }
    setTimeout(() => comboEffectsEl.replaceChildren(),800);
  }

  function endGame(won) {
    if (gameOver) return;
    gameOver = true;
    busy = true;
    if (gameMode === 'classic' && score > 0) {
      journey.rankings.push({ score, date:new Date().toLocaleDateString('pt-BR') });
      journey.rankings.sort((a,b) => b.score-a.score);
      journey.rankings = journey.rankings.slice(0,5);
    }
    if (gameMode === 'daily' && won && !journey.dailyChallenge.won) {
      journey.dailyChallenge.won = true;
      journey.stars += 5;
      earnAchievement('dailyWinner');
    }
    saveJourney();
    updatePower();
    updateModeUI();
    const epoch = gameEpoch;

    // Avisa o Android quando a partida classica termina.
    // Sem o aplicativo Android, o jogo continua funcionando normalmente.
    if (gameMode === 'classic') {
      try {
        if (window.BloqoAndroid && typeof window.BloqoAndroid.onGameOver === 'function') {
          window.BloqoAndroid.onGameOver();
        }
      } catch (error) {
        console.warn('Aviso de fim de partida indisponivel', error);
      }
    }

    setTimeout(() => { if (epoch === gameEpoch) showGameOver(won); }, 420);
  }

  function setPowerMode(mode) {
    if (busy || gameOver || energy < POWER_MAX || (mode === 'move' && !canMoveLast())) return;
    powerMode = powerMode === mode ? null : mode;
    selectedSlot = -1;
    hoverCell = null;
    clearPreview();
    renderBoard();
    renderHand();
    updatePower();
  }

  function removeBlock(r, c) {
    if (energy < POWER_MAX || !board[r][c] || busy || gameOver) return;
    busy = true;
    const epoch = gameEpoch;
    const target = boardEl.children[r * SIZE + c];
    powerMode = null;
    energy = 0;
    updateMission('powers',1);
    earnAchievement('firstPower');
    updatePower();
    target.classList.add('power-breaking');
    playSound('power');
    showToast('BLOCO REMOVIDO!');
    setTimeout(() => {
      if (epoch !== gameEpoch) return;
      board[r][c] = null;
      if (lastPlaced?.cells.some(([rr,cc]) => rr === r && cc === c)) lastPlaced = null;
      busy = false;
      finishTurn();
    }, 260);
  }

  function moveLastPiece(r, c) {
    if (energy < POWER_MAX || busy || gameOver) return;
    if (!validMove(r, c)) {
      showToast('Escolha outra posição');
      playSound('invalid');
      return;
    }
    lastPlaced.cells.forEach(([rr,cc]) => { board[rr][cc] = null; });
    const nextCells = getCells(lastPlaced.piece, r, c);
    nextCells.forEach(([rr,cc]) => { board[rr][cc] = lastPlaced.piece.color; });
    lastPlaced.r = r;
    lastPlaced.c = c;
    lastPlaced.cells = nextCells;
    powerMode = null;
    energy = 0;
    updateMission('powers',1);
    earnAchievement('firstPower');
    hoverCell = null;
    renderBoard(nextCells);
    playSound('power');
    showToast('PEÇA MOVIDA!');
    resolveLines();
  }

  function showGameOver(won = false) {
    $('finalScore').textContent = score.toLocaleString('pt-BR');
    const isNewBest = score > startBest;
    if (gameMode === 'daily') {
      $('overTitle').textContent = won ? 'Desafio vencido!' : 'Desafio encerrado';
      $('overDescription').textContent = won ? 'Meta alcançada! Volte amanhã para uma nova sequência.' : 'Tente de novo: você tem 20 peças para atingir a meta.';
      $('bestMessage').textContent = won ? '★ Primeira vitória do dia rende 5 estrelas.' : `${DAILY_TARGET.toLocaleString('pt-BR')} pontos é a meta diária.`;
    } else {
      $('overTitle').textContent = 'Boa jogada!';
      $('overDescription').textContent = 'Cada bloco conta. Que tal tentar de novo?';
      $('bestMessage').textContent = isNewBest ? '★ Novo recorde! Você arrasou!' : 'Seu recorde está esperando por você!';
    }
    $('gameOverModal').hidden = false;
    $('againBtn').focus({ preventScroll: true });
    playSound('finish');
  }

  function newGame() {
    gameEpoch++;
    board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    score = 0;
    combo = 0;
    linesCleared = 0;
    multiplier = 1;
    dailyMoves = 0;
    dailyRandom = gameMode === 'daily' ? createDailyRandom() : null;
    energy = 0;
    powerMode = null;
    lastPlaced = null;
    best = getSavedBest();
    startBest = best;
    hand = makeHand();
    selectedSlot = -1;
    hoverCell = null;
    busy = false;
    gameOver = false;
    drag = null;
    ghostEl.classList.remove('visible');
    $('gameOverModal').hidden = true;
    toastEl.classList.remove('show');
    comboEffectsEl.replaceChildren();
    renderBoard();
    renderHand();
    updateScore();
    updateMultiplier();
    updatePower();
    refreshDay();
    updateModeUI();
  }

  function cellUnderPointer(x, y) {
    // Resolve the closest cell, including the narrow gaps between cells.
    const first = boardEl.children[0]?.getBoundingClientRect();
    const last = boardEl.children[SIZE * SIZE - 1]?.getBoundingClientRect();
    const next = boardEl.children[1]?.getBoundingClientRect();
    const nextRow = boardEl.children[SIZE]?.getBoundingClientRect();
    if (!first || !last || !next || !nextRow) return null;
    if (x < first.left - 3 || x > last.right + 3 || y < first.top - 3 || y > last.bottom + 3) return null;
    const c = Math.round((x - first.left - first.width / 2) / (next.left - first.left));
    const r = Math.round((y - first.top - first.height / 2) / (nextRow.top - first.top));
    return { r: Math.max(0, Math.min(SIZE - 1, r)), c: Math.max(0, Math.min(SIZE - 1, c)) };
  }

  function startDrag(e, index) {
    if (!e.isPrimary || busy || gameOver) return;
    // Remember which colored square the player actually grabbed. The same
    // square will remain under their finger when the piece reaches the board.
    const piece = hand[index];
    const shape = e.currentTarget.querySelector('.piece-shape');
    const rect = shape.getBoundingClientRect();
    const tile = parseFloat(shape.style.getPropertyValue('--tile'));
    const gap = parseFloat(getComputedStyle(shape).columnGap) || 0;
    let grabbed = piece.cells[0];
    let distance = Infinity;
    for (const [r, c] of piece.cells) {
      const dx = e.clientX - (rect.left + c * (tile + gap) + tile / 2);
      const dy = e.clientY - (rect.top + r * (tile + gap) + tile / 2);
      const d = dx * dx + dy * dy;
      if (d < distance) { distance = d; grabbed = [r, c]; }
    }
    drag = {
      index, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY,
      grabRow: grabbed[0], grabCol: grabbed[1], dragging: false
    };
  }

  function handlePointerMove(e) {
    if (!drag || drag.pointerId !== e.pointerId) return;
    const distance = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
    if (!drag.dragging && distance < 9) return;
    if (!drag.dragging) {
      drag.dragging = true;
      selectedSlot = drag.index;
      renderHand();
      const square = boardEl.children[0].getBoundingClientRect();
      const gap = parseFloat(getComputedStyle(boardEl).columnGap) || 0;
      const ghostShape = makeShape(hand[drag.index], square.width);
      ghostShape.style.gap = `${gap}px`;
      ghostEl.replaceChildren(ghostShape);
      drag.cellSize = square.width;
      drag.cellGap = gap;
    }
    if (e.cancelable) e.preventDefault();
    // No arbitrary vertical lift or centering offset: the grabbed block
    // follows the pointer directly. This also works for asymmetrical shapes.
    ghostEl.style.left = `${e.clientX - drag.grabCol * (drag.cellSize + drag.cellGap) - drag.cellSize / 2}px`;
    ghostEl.style.top = `${e.clientY - drag.grabRow * (drag.cellSize + drag.cellGap) - drag.cellSize / 2}px`;
    const cell = cellUnderPointer(e.clientX, e.clientY);
    if (cell) {
      const origin = { r: cell.r - drag.grabRow, c: cell.c - drag.grabCol };
      hoverCell = origin;
      showPreview(origin.r, origin.c, drag.index);
      // On the board, the snapped preview itself is the piece. Showing a
      // second floating copy at another position was visually confusing.
      ghostEl.classList.remove('visible');
    } else {
      hoverCell = null;
      clearPreview();
      ghostEl.classList.add('visible');
    }
  }

  function handlePointerUp(e) {
    if (!drag || drag.pointerId !== e.pointerId) return;
    const current = drag;
    drag = null;
    ghostEl.classList.remove('visible');
    if (current.dragging) {
      const cell = cellUnderPointer(e.clientX, e.clientY);
      if (cell) placePiece(current.index, cell.r - current.grabRow, cell.c - current.grabCol);
      else selectPiece(current.index);
    } else {
      selectPiece(current.index);
    }
  }

  boardEl.addEventListener('pointermove', e => {
    if (drag || (selectedSlot < 0 && powerMode !== 'move')) return;
    const cell = cellUnderPointer(e.clientX, e.clientY);
    if (cell) {
      hoverCell = cell;
      if (powerMode === 'move') showMovePreview(cell.r, cell.c);
      else showPreview(cell.r, cell.c);
    }
  });
  boardEl.addEventListener('pointerleave', () => {
    if (!drag) { hoverCell = null; clearPreview(); }
  });
  boardEl.addEventListener('click', e => {
    const cell = e.target.closest('.cell');
    if (!cell) return;
    const r = Number(cell.dataset.row);
    const c = Number(cell.dataset.col);
    if (powerMode === 'remove') removeBlock(r, c);
    else if (powerMode === 'move') moveLastPiece(r, c);
    else if (selectedSlot >= 0) placePiece(selectedSlot, r, c);
  });
  removePowerBtn.addEventListener('click', () => setPowerMode('remove'));
  movePowerBtn.addEventListener('click', () => setPowerMode('move'));
  window.addEventListener('pointermove', handlePointerMove, { passive: false });
  window.addEventListener('pointerup', handlePointerUp);
  window.addEventListener('pointercancel', e => {
    if (drag?.pointerId === e.pointerId) {
      drag = null;
      ghostEl.classList.remove('visible');
      clearPreview();
    }
  });

  function showHelp() { $('helpModal').hidden = false; $('startBtn').focus({ preventScroll: true }); }
  function hideHelp() { $('helpModal').hidden = true; }
  $('helpBtn').addEventListener('click', showHelp);
  $('tipsBtn').addEventListener('click', showHelp);
  $('startBtn').addEventListener('click', hideHelp);
  $('helpModal').addEventListener('click', e => { if (e.target.id === 'helpModal') hideHelp(); });
  $('againBtn').addEventListener('click', newGame);
  function setScreen(next) {
    activeScreen = next === 'extras' ? 'extras' : 'play';
    const playing = activeScreen === 'play';
    screenTrackEl.style.transform = playing ? 'translateX(0)' : 'translateX(-100%)';
    $('playTab').classList.toggle('active', playing);
    $('extrasTab').classList.toggle('active', !playing);
    $('playTab').setAttribute('aria-pressed', String(playing));
    $('extrasTab').setAttribute('aria-pressed', String(!playing));
    $('playScreen').setAttribute('aria-hidden', String(!playing));
    $('extrasScreen').setAttribute('aria-hidden', String(playing));
    $('playScreen').inert = !playing;
    $('extrasScreen').inert = playing;
  }

  $('playTab').addEventListener('click', () => setScreen('play'));
  $('extrasTab').addEventListener('click', () => setScreen('extras'));
  $('backToPlayBtn').addEventListener('click', () => setScreen('play'));

  // Swipes start only in inactive interface areas. Dragging a piece or using
  // a power must never accidentally switch screens.
  let swipeStart = null;
  screenViewportEl.addEventListener('touchstart', e => {
    swipeStart = null;
    if (e.touches.length !== 1 || e.target.closest('#board, #pieceTray, button, input, [role="progressbar"]')) return;
    swipeStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  screenViewportEl.addEventListener('touchend', e => {
    if (!swipeStart || !e.changedTouches.length) return;
    const dx = e.changedTouches[0].clientX - swipeStart.x;
    const dy = e.changedTouches[0].clientY - swipeStart.y;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.35) {
      setScreen(dx < 0 ? 'extras' : 'play');
    }
    swipeStart = null;
  }, { passive: true });
  screenViewportEl.addEventListener('touchcancel', () => { swipeStart = null; });

  function switchMode(next) {
    if (next === gameMode) { setScreen('play'); return; }
    if (!gameOver && score > 0 && !window.confirm('Mudar de modo vai reiniciar esta partida. Continuar?')) return;
    gameMode = next;
    newGame();
    setScreen('play');
    showToast(next === 'daily' ? '☀ DESAFIO DO DIA' : next === 'zen' ? '🌿 MODO ZEN' : '✦ MODO CLÁSSICO');
  }
  $('classicBtn').addEventListener('click', () => switchMode('classic'));
  $('dailyBtn').addEventListener('click', () => switchMode('daily'));
  $('zenBtn').addEventListener('click', () => switchMode('zen'));
  function showJourney() {
    renderJourney();
    journeyEl.hidden = false;
    $('journeyCloseBtn').focus({ preventScroll:true });
  }
  function hideJourney() { journeyEl.hidden = true; }
  $('journeyBtn').addEventListener('click', showJourney);
  $('journeyCloseBtn').addEventListener('click', hideJourney);
  jour
