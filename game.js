(() => {
  'use strict';

  const SIZE = 8;
  const COLORS = ['#5f9eff', '#ffbd57', '#ff647e', '#55d3a0', '#ae86fc', '#5ccee9'];
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

  let board, hand, score, combo, best, startBest;
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

  // Original, softly tuned sound effects (no looping music or external audio).
  // Each note has a rounded attack/decay so repeated moves stay comfortable.
  const SOUND_EFFECTS = {
    pick:    [[610, 0, .048, .010]],
    place:   [[440, 0, .105, .023], [660, .045, .105, .013]],
    invalid: [[250, 0, .075, .012]],
    clear:   [[523, 0, .13, .024], [659, .075, .13, .022], [784, .15, .17, .021]],
    combo:   [[523, 0, .12, .022], [659, .060, .12, .022], [784, .120, .14, .023], [1047, .19, .19, .020]],
    finish:  [[392, 0, .19, .014], [330, .12, .21, .012]],
    enable:  [[660, 0, .075, .013], [880, .055, .10, .014]]
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
    const cells = pool[Math.floor(Math.random() * pool.length)].map(([r,c]) => [r,c]);
    return { cells, color: COLORS[Math.floor(Math.random() * COLORS.length)] };
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
    if (score > best) {
      best = score;
      saveBest(best);
    }
    bestEl.textContent = best.toLocaleString('pt-BR');
    comboEl.hidden = combo < 2;
    comboEl.textContent = `COMBO ×${combo}`;
  }

  function renderBoard(placed = []) {
    const fresh = document.createDocumentFragment();
    const justPlaced = new Set(placed.map(([r,c]) => `${r},${c}`));
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
        fresh.appendChild(cell);
      }
    }
    boardEl.replaceChildren(fresh);
    if (hoverCell && selectedSlot >= 0) showPreview(hoverCell.r, hoverCell.c);
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
    hintEl.textContent = selectedSlot < 0 ? 'Toque numa peça e depois no tabuleiro' : 'Agora toque onde deseja encaixar';
  }

  function selectPiece(index) {
    if (busy || gameOver || !hand[index]) return;
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
    score += cells.length * 10;
    hand[index] = null;
    selectedSlot = -1;
    hoverCell = null;
    clearPreview();
    renderBoard(cells);
    renderHand();

    const rows = [];
    const cols = [];
    for (let i = 0; i < SIZE; i++) {
      if (board[i].every(Boolean)) rows.push(i);
      if (board.every(row => !!row[i])) cols.push(i);
    }
    if (rows.length || cols.length) {
      busy = true;
      combo++;
      const total = rows.length + cols.length;
      score += total * 120 + (combo > 1 ? (combo - 1) * 80 : 0);
      updateScore();
      const marked = new Set();
      for (const row of rows) for (let col = 0; col < SIZE; col++) marked.add(`${row},${col}`);
      for (const col of cols) for (let row = 0; row < SIZE; row++) marked.add(`${row},${col}`);
      marked.forEach(key => {
        const [rr,cc] = key.split(',').map(Number);
        boardEl.children[rr*SIZE+cc]?.classList.add('clearing');
      });
      showToast(combo > 1 ? `COMBO ×${combo}! +${total * 120 + (combo - 1) * 80}` : total > 1 ? `INCRÍVEL! ${total} LINHAS` : 'LINHA COMPLETA!');
      playSound(combo > 1 ? 'combo' : 'clear');
      setTimeout(() => {
        marked.forEach(key => {
          const [rr,cc] = key.split(',').map(Number);
          board[rr][cc] = null;
        });
        busy = false;
        finishTurn();
      }, 275);
    } else {
      combo = 0;
      playSound('place');
      updateScore();
      finishTurn();
    }
    return true;
  }

  function finishTurn() {
    if (hand.every(piece => piece === null)) hand = makeHand();
    renderBoard();
    renderHand();
    updateScore();
    if (!hand.some(piece => piece && anyFit(piece))) {
      busy = true;
      gameOver = true;
      setTimeout(showGameOver, 420);
    }
  }

  function showGameOver() {
    $('finalScore').textContent = score.toLocaleString('pt-BR');
    const isNewBest = score > startBest;
    $('bestMessage').textContent = isNewBest ? '★ Novo recorde! Você arrasou!' : 'Seu recorde está esperando por você!';
    $('gameOverModal').hidden = false;
    $('againBtn').focus({ preventScroll: true });
    playSound('finish');
  }

  function newGame() {
    board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    score = 0;
    combo = 0;
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
    renderBoard();
    renderHand();
    updateScore();
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
    if (drag || selectedSlot < 0) return;
    const cell = cellUnderPointer(e.clientX, e.clientY);
    if (cell) {
      hoverCell = cell;
      showPreview(cell.r, cell.c);
    }
  });
  boardEl.addEventListener('pointerleave', () => {
    if (!drag) { hoverCell = null; clearPreview(); }
  });
  boardEl.addEventListener('click', e => {
    const cell = e.target.closest('.cell');
    if (!cell || selectedSlot < 0) return;
    placePiece(selectedSlot, Number(cell.dataset.row), Number(cell.dataset.col));
  });
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
  $('restartBtn').addEventListener('click', () => {
    if (!gameOver && score > 0 && !window.confirm('Quer recomeçar? Sua pontuação atual será perdida.')) return;
    newGame();
  });
  $('soundBtn').addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    try { localStorage.setItem('bloqo-sound', soundEnabled ? 'on' : 'off'); } catch { /* optional */ }
    updateSoundButton();
    playSound('enable');
  });
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('helpModal').hidden) hideHelp(); });
  window.addEventListener('resize', () => { if (hand && !drag) renderHand(); });

  function updateSoundButton() {
    $('soundBtn').classList.toggle('is-muted', !soundEnabled);
    $('soundBtn').setAttribute('aria-pressed', String(soundEnabled));
    $('soundBtn').setAttribute('aria-label', soundEnabled ? 'Desativar som' : 'Ativar som');
    $('soundBtn').title = soundEnabled ? 'Desativar sons' : 'Ativar sons';
  }
  updateSoundButton();
  newGame();
})();
