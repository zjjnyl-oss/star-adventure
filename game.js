/**
 * 小星星奇遇记 - 游戏核心（升级版）
 * 含音效引擎、语音朗读、粒子动画、连击系统
 */

/* ======================== 音效引擎 ======================== */
const Sound = (() => {
  let ctx = null, enabled = true, bgmNodes = null;
  const notes = { C4:262, D4:294, E4:330, F4:349, G4:392, A4:440, B4:494,
    C5:523, D5:587, E5:659, F5:698, G5:784, A5:880, B5:988, C6:1047 };

  function getCtx() {
    if (!ctx) try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type='sine', vol=0.12, delay=0) {
    const c = getCtx(); if (!c || !enabled) return;
    try {
      const t = c.currentTime + delay;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + dur);
    } catch(e) {}
  }

  function noise(dur, vol=0.06) {
    const c = getCtx(); if (!c || !enabled) return;
    try {
      const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
      const src = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
      src.buffer = buf; f.type = 'lowpass'; f.frequency.value = 3000;
      g.gain.setValueAtTime(vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      src.connect(f); f.connect(g); g.connect(c.destination);
      src.start(); src.stop(c.currentTime + dur);
    } catch(e) {}
  }

  return {
    enable()  { enabled = true; },
    disable() { enabled = false; Sound.stopBGM(); },
    isEnabled() { return enabled; },
    toggle()  { enabled ? Sound.disable() : Sound.enable(); return enabled; },

    click() {
      tone(800, 0.06, 'sine', 0.1);
      tone(1200, 0.04, 'sine', 0.06, 0.03);
    },

    swoosh() {
      noise(0.25, 0.08);
      tone(600, 0.15, 'sine', 0.04);
      tone(400, 0.15, 'sine', 0.03, 0.05);
    },

    pop(delay=0) {
      tone(900, 0.08, 'sine', 0.08, delay);
      tone(600, 0.06, 'triangle', 0.05, delay + 0.03);
    },

    correct() {
      tone(notes.C5, 0.12, 'sine', 0.14);
      tone(notes.E5, 0.12, 'sine', 0.14, 0.1);
      tone(notes.G5, 0.2, 'sine', 0.16, 0.2);
      tone(notes.C6, 0.3, 'sine', 0.12, 0.32);
    },

    wrong() {
      tone(notes.E4, 0.2, 'triangle', 0.1);
      tone(notes.C4, 0.35, 'triangle', 0.08, 0.15);
    },

    star(delay=0) {
      tone(notes.E5, 0.08, 'sine', 0.1, delay);
      tone(notes.G5, 0.08, 'sine', 0.1, delay + 0.06);
      tone(notes.B5, 0.15, 'sine', 0.12, delay + 0.12);
    },

    combo(streak) {
      const base = notes.C5 + (streak - 3) * 50;
      for (let i = 0; i < Math.min(streak, 6); i++) {
        tone(base + i * 80, 0.1, 'sine', 0.1, i * 0.05);
      }
    },

    complete() {
      [notes.C5, notes.E5, notes.G5, notes.C6, notes.E5, notes.G5, notes.C6].forEach((f, i) => {
        tone(f, 0.2, 'sine', 0.1, i * 0.1);
      });
    },

    gem() {
      [notes.C5, notes.E5, notes.G5, notes.B5, notes.C6].forEach((f, i) => {
        tone(f, 0.25, 'sine', 0.08, i * 0.12);
        tone(f * 1.5, 0.2, 'triangle', 0.04, i * 0.12 + 0.05);
      });
    },

    playBGM(worldId) {
      Sound.stopBGM();
      const c = getCtx(); if (!c || !enabled) return;
      const melodies = {
        math:    [notes.C5, notes.E5, notes.G5, notes.E5, notes.C5, notes.D5, notes.F5, notes.D5],
        chinese: [notes.D5, notes.F5, notes.A5, notes.G5, notes.F5, notes.D5, notes.E5, notes.D5],
        english: [notes.E5, notes.G5, notes.B5, notes.A5, notes.G5, notes.E5, notes.F5, notes.E5],
        logic:   [notes.G4, notes.B4, notes.D5, notes.G5, notes.F5, notes.D5, notes.B4, notes.G4],
        nature:  [notes.C5, notes.D5, notes.E5, notes.G5, notes.A5, notes.G5, notes.E5, notes.D5]
      };
      const mel = melodies[worldId] || melodies.math;
      let idx = 0;
      bgmNodes = setInterval(() => {
        if (!enabled) { Sound.stopBGM(); return; }
        tone(mel[idx % mel.length], 0.4, 'sine', 0.04);
        tone(mel[idx % mel.length] * 0.5, 0.4, 'triangle', 0.02);
        idx++;
      }, 500);
    },

    stopBGM() {
      if (bgmNodes) { clearInterval(bgmNodes); bgmNodes = null; }
    }
  };
})();

/* ======================== 语音引擎 ======================== */
const Voice = (() => {
  let enabled = true;

  function getVoice() {
    const voices = speechSynthesis.getVoices();
    return voices.find(v => v.lang.startsWith('zh')) ||
           voices.find(v => v.lang.includes('CN')) || null;
  }

  return {
    isSupported: 'speechSynthesis' in window,

    speak(text, rate=0.9, pitch=1.1) {
      if (!this.isSupported || !enabled) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN'; u.rate = rate; u.pitch = pitch; u.volume = 0.9;
      const v = getVoice(); if (v) u.voice = v;
      speechSynthesis.speak(u);
    },

    speakQuestion(text) {
      const clean = text.replace(/[🔴🔵🟢🟡⭐🌟🌙⬛🐱🐶🐟🐘🌞🌧️🍎🎂❄️🌈🏠👧🐧🐰🌻💧⚡☁️🔥⬆️➡️⬅️⬇️↗️🐜🐘📦🍊🦋🌺👁️🏔️👂🐎🐝🍄🌹🌸🍂🦊🐉🐬🦉🐰🍌🏰🌲🧩🌊]/g, '');
      this.speak(clean, 0.85, 1.15);
    },

    speakFeedback(isCorrect) {
      if (isCorrect) {
        const msgs = ['答对了！太棒了！', '真聪明！', '厉害！', '没错！'];
        this.speak(msgs[Math.floor(Math.random() * msgs.length)], 1.0, 1.2);
      } else {
        const msgs = ['没关系，再想想！', '差一点点！', '别灰心！'];
        this.speak(msgs[Math.floor(Math.random() * msgs.length)], 0.9, 1.0);
      }
    },

    speakDialog(text) { this.speak(text, 0.85, 1.1); },
    stop() { if (this.isSupported) speechSynthesis.cancel(); },
    enable() { enabled = true; },
    disable() { enabled = false; Voice.stop(); },
    toggle() { enabled = !enabled; if (!enabled) Voice.stop(); return enabled; }
  };
})();

/* ======================== 粒子引擎 ======================== */
const Particles = (() => {
  let canvas, cctx, particles = [], animId = null, theme = null;

  class P {
    constructor(x, y, text, color, size, vx, vy, life, spin) {
      Object.assign(this, { x, y, text, color, size, vx, vy, life, maxLife: life, spin, angle: Math.random() * 360 });
    }
    update() {
      this.x += this.vx; this.y += this.vy;
      this.vy += 0.01; this.life--;
      this.angle += this.spin;
      this.alpha = Math.max(0, this.life / this.maxLife);
    }
    draw(c) {
      c.save(); c.globalAlpha = this.alpha * 0.7;
      c.translate(this.x, this.y); c.rotate(this.angle * Math.PI / 180);
      if (this.text) {
        c.font = `${this.size}px sans-serif`; c.textAlign = 'center';
        c.fillText(this.text, 0, 0);
      } else {
        c.fillStyle = this.color; c.beginPath();
        c.arc(0, 0, this.size, 0, Math.PI * 2); c.fill();
      }
      c.restore();
    }
  }

  function loop() {
    cctx.clearRect(0, 0, canvas.width, canvas.height);
    if (theme && Math.random() < 0.08) spawnBg();
    particles.forEach(p => { p.update(); p.draw(cctx); });
    particles = particles.filter(p => p.life > 0 && p.y < canvas.height + 50);
    animId = requestAnimationFrame(loop);
  }

  function spawnBg() {
    if (!theme) return;
    const s = theme.shapes[Math.floor(Math.random() * theme.shapes.length)];
    const isEmoji = s.length > 1 || /[\u{1F000}-\u{1FFFF}]/u.test(s);
    const x = Math.random() * canvas.width;
    const y = canvas.height + 20;
    const c = theme.colors[Math.floor(Math.random() * theme.colors.length)];
    particles.push(new P(x, y, isEmoji ? s : null, isEmoji ? null : c,
      isEmoji ? (12 + Math.random() * 10) : (2 + Math.random() * 4),
      (Math.random() - 0.5) * 0.5, -(0.3 + Math.random() * 0.8),
      200 + Math.random() * 200, (Math.random() - 0.5) * 1));
  }

  return {
    init() {
      canvas = document.getElementById('particle-canvas');
      cctx = canvas.getContext('2d');
      const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
      resize(); window.addEventListener('resize', resize);
    },

    setTheme(t) { theme = t; },
    clearTheme() { theme = null; },

    start() { if (!animId) loop(); },
    stop() { if (animId) { cancelAnimationFrame(animId); animId = null; } cctx.clearRect(0, 0, canvas.width, canvas.height); particles = []; },

    burst(x, y, count=20, colors=['#FFD700','#FF6B9D','#60A5FA','#4ADE80','#FB923C','#C084FC']) {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
        const speed = 2 + Math.random() * 4;
        const c = colors[Math.floor(Math.random() * colors.length)];
        particles.push(new P(x, y, null, c, 3 + Math.random() * 4,
          Math.cos(angle) * speed, Math.sin(angle) * speed,
          40 + Math.random() * 30, (Math.random() - 0.5) * 5));
      }
    },

    starBurst(x, y) {
      for (let i = 0; i < 12; i++) {
        const angle = (Math.PI * 2 * i) / 12;
        const speed = 1.5 + Math.random() * 2;
        particles.push(new P(x, y, '⭐', null, 14 + Math.random() * 8,
          Math.cos(angle) * speed, Math.sin(angle) * speed - 1,
          50 + Math.random() * 20, (Math.random() - 0.5) * 3));
      }
    },

    celebrationBurst() {
      const cw = canvas.width, ch = canvas.height;
      for (let i = 0; i < 80; i++) {
        const x = Math.random() * cw;
        const colors = ['#FFD700','#FF6B9D','#60A5FA','#4ADE80','#FB923C','#C084FC','#22D3EE'];
        const c = colors[Math.floor(Math.random() * colors.length)];
        particles.push(new P(x, -10, null, c, 4 + Math.random() * 5,
          (Math.random() - 0.5) * 2, 1 + Math.random() * 3,
          80 + Math.random() * 60, (Math.random() - 0.5) * 6));
      }
      for (let i = 0; i < 15; i++) {
        const emojis = ['🌟','⭐','✨','🎉','🎊','💫'];
        particles.push(new P(Math.random() * cw, -10,
          emojis[Math.floor(Math.random() * emojis.length)], null,
          18 + Math.random() * 12,
          (Math.random() - 0.5) * 1.5, 0.8 + Math.random() * 1.5,
          100 + Math.random() * 50, (Math.random() - 0.5) * 2));
      }
    }
  };
})();

/* ======================== 游戏主逻辑 ======================== */
const Game = (() => {
  const STORAGE_KEY = 'star_adventure_v2';
  const Q_PER_LEVEL = 5;
  const STARS_MAP = { 5:3, 4:2, 3:1, 2:0, 1:0, 0:0 };

  let state = {
    playerName: '', parentPassword: '1234',
    currentWorld: 0, currentLevel: 0, currentQuestion: 0,
    questions: [], correctCount: 0, comboCount: 0, maxCombo: 0,
    levelStartTime: 0,
    worldProgress: {}, totalStars: 0, gemsCollected: [], history: []
  };

  let hintTimeout = null, typewriterInterval = null;
  let dialogIndex = 0, dialogList = [];

  // ===== 存档 =====
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({
      playerName: state.playerName, parentPassword: state.parentPassword,
      worldProgress: state.worldProgress, totalStars: state.totalStars,
      gemsCollected: state.gemsCollected, history: state.history.slice(-50)
    })); } catch(e) {}
  }

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!d) return false;
      state.playerName = d.playerName || '';
      state.parentPassword = d.parentPassword || '1234';
      state.worldProgress = d.worldProgress || {};
      state.totalStars = d.totalStars || 0;
      state.gemsCollected = d.gemsCollected || [];
      state.history = d.history || [];
      return !!state.playerName;
    } catch(e) { return false; }
  }

  // ===== 屏幕切换 =====
  function showScreen(id, anim='fade-in') {
    document.querySelectorAll('.screen').forEach(s => {
      s.classList.remove('active','slide-in-right','slide-in-left','zoom-in','fade-in');
    });
    const el = document.getElementById(`screen-${id}`);
    el.classList.add('active', anim);
    Sound.swoosh();
  }

  // ===== 欢迎 =====
  function showWelcome() {
    Sound.stopBGM(); Voice.stop(); Particles.clearTheme();
    showScreen('welcome', 'fade-in');
    const has = load();
    document.getElementById('btn-continue').style.display = has ? 'inline-block' : 'none';
    updateSoundBtn();
  }

  function showNameInput() {
    Sound.click();
    showScreen('name', 'slide-in-right');
    setTimeout(() => document.getElementById('player-name').focus(), 300);
  }

  function setPlayerName() {
    const name = document.getElementById('player-name').value.trim();
    if (!name) {
      document.getElementById('player-name').style.borderColor = '#F87171';
      setTimeout(() => document.getElementById('player-name').style.borderColor = '', 1000);
      return;
    }
    Sound.click();
    state.playerName = name;
    state.worldProgress = {}; state.totalStars = 0;
    state.gemsCollected = []; state.history = [];
    save();
    Voice.speak(`你好，${name}！让我们开始冒险吧！`);
    showMap();
  }

  function continueGame() {
    Sound.click(); load(); showMap();
    Voice.speak(`欢迎回来，${state.playerName}！`);
  }

  function toggleSound() {
    const on = Sound.toggle();
    if (!on) Voice.disable(); else Voice.enable();
    updateSoundBtn();
  }

  function updateSoundBtn() {
    const btn = document.getElementById('btn-sound');
    if (btn) btn.textContent = Sound.isEnabled() ? '🔊' : '🔇';
  }

  // ===== 世界地图 =====
  function showMap() {
    showScreen('map', 'slide-in-right');
    Particles.clearTheme(); Sound.stopBGM();
    document.getElementById('map-player-name').textContent = state.playerName;
    document.getElementById('total-stars').textContent = state.totalStars;

    const grid = document.getElementById('world-grid');
    grid.innerHTML = '';

    WORLDS.forEach((w, idx) => {
      const prog = getWorldProgress(idx);
      const unlocked = idx === 0 || isWorldComplete(idx - 1);
      const complete = isWorldComplete(idx);
      const wp = state.worldProgress[w.id] || {};
      let stars = 0; for (const k in wp) stars += (wp[k] || 0);

      const card = document.createElement('div');
      card.className = `world-card ${unlocked ? '' : 'locked'}`;
      card.style.background = w.colorGrad;
      card.innerHTML = `
        <div><div class="world-card-icon">${w.icon}</div>
        <div class="world-card-name">${w.name}</div>
        <div class="world-card-desc">${w.description}</div></div>
        ${complete ? `<div class="world-gem">${w.gem}</div>` : ''}
        ${!unlocked ? '<div class="world-lock-icon">🔒</div>' : ''}
        <div class="world-card-progress">
          <div class="world-progress-bar"><div class="world-progress-fill" style="width:${prog}%"></div></div>
          <div class="world-progress-text">⭐${stars}</div>
        </div>`;
      if (unlocked) card.onclick = () => { Sound.click(); showLevels(idx); };
      grid.appendChild(card);
    });

    const cc = WORLDS.filter((_, i) => isWorldComplete(i)).length;
    const sub = document.getElementById('map-subtitle');
    sub.textContent = cc === WORLDS.length ? '🎉 恭喜！所有世界通关！' :
      cc > 0 ? `已收集 ${cc}/5 颗宝石，继续冒险！` : '选择一个世界开始冒险吧！';
  }

  function getWorldProgress(i) {
    const wp = state.worldProgress[WORLDS[i].id] || {};
    let c = 0; for (let j = 0; j < WORLDS[i].levels.length; j++) if (wp[j] > 0) c++;
    return Math.round((c / WORLDS[i].levels.length) * 100);
  }

  function isWorldComplete(i) {
    const wp = state.worldProgress[WORLDS[i].id] || {};
    for (let j = 0; j < WORLDS[i].levels.length; j++) if (!wp[j] || wp[j] <= 0) return false;
    return true;
  }

  // ===== 关卡选择 =====
  function showLevels(wi) {
    state.currentWorld = wi;
    const w = WORLDS[wi];
    showScreen('levels', 'slide-in-right');
    Particles.setTheme(w.particles); Particles.start();

    document.getElementById('world-icon').textContent = w.icon;
    document.getElementById('world-name-display').textContent = w.name;
    document.getElementById('guardian-avatar').textContent = w.guardian.icon;
    document.getElementById('guardian-speech').textContent = w.guardianGreeting;

    Voice.speak(w.guardianGreeting);

    const grid = document.getElementById('level-grid');
    grid.innerHTML = '';
    const wp = state.worldProgress[w.id] || {};

    w.levels.forEach((lv, idx) => {
      const unlocked = idx === 0 || (wp[idx - 1] > 0);
      const stars = wp[idx] || 0;
      const card = document.createElement('div');
      card.className = `level-card ${unlocked ? '' : 'level-locked'}`;
      card.style.background = unlocked ? w.colorGrad : 'rgba(255,255,255,0.04)';

      let sh = '';
      for (let i = 0; i < 3; i++) sh += `<span class="${i < stars ? 'level-star-filled' : 'level-star-empty'}">⭐</span>`;

      card.innerHTML = `
        <div class="level-num">${idx + 1}</div>
        <div class="level-name">${lv.name}</div>
        <div class="level-stars">${sh}</div>
        ${!unlocked ? '<div style="font-size:1.1rem;opacity:.4">🔒</div>' : ''}`;
      if (unlocked) card.onclick = () => { Sound.click(); startStory(wi, idx); };
      grid.appendChild(card);
    });
  }

  // ===== 故事场景 =====
  function startStory(wi, li) {
    state.currentWorld = wi; state.currentLevel = li;
    const w = WORLDS[wi], lv = w.levels[li];
    dialogList = lv.story; dialogIndex = 0;
    showScreen('story', 'zoom-in');
    Sound.playBGM(w.id);

    const bg = document.getElementById('story-bg');
    bg.style.background = w.colorGrad;
    renderDialog();
  }

  function renderDialog() {
    if (dialogIndex >= dialogList.length) { startLevel(); return; }
    const d = dialogList[dialogIndex];
    document.getElementById('story-char').textContent = d.char;
    document.getElementById('dialog-name').textContent = d.name;

    const el = document.getElementById('dialog-text');
    el.textContent = '';
    if (typewriterInterval) clearInterval(typewriterInterval);

    let ci = 0;
    typewriterInterval = setInterval(() => {
      if (ci < d.text.length) { el.textContent += d.text[ci]; ci++; Sound.pop(0); }
      else clearInterval(typewriterInterval);
    }, 45);

    Voice.speakDialog(d.text);

    const btn = document.getElementById('btn-story-next');
    btn.textContent = dialogIndex < dialogList.length - 1 ? '继续 ▶' : '开始答题！🚀';
    btn.onclick = () => {
      Sound.click();
      if (typewriterInterval) clearInterval(typewriterInterval);
      dialogIndex++;
      dialogIndex >= dialogList.length ? startLevel() : renderDialog();
    };
  }

  function nextDialog() {}

  // ===== 答题流程 =====
  function startLevel() {
    const w = WORLDS[state.currentWorld];
    const pool = QUESTIONS[w.id][state.currentLevel];
    state.questions = [...pool].sort(() => Math.random() - 0.5).slice(0, Q_PER_LEVEL);
    state.currentQuestion = 0; state.correctCount = 0;
    state.comboCount = 0; state.maxCombo = 0;
    state.levelStartTime = Date.now();

    showScreen('question', 'slide-in-right');
    Particles.setTheme(w.particles); Particles.start();
    renderQuestion();
  }

  function renderQuestion() {
    const q = state.questions[state.currentQuestion];
    const total = state.questions.length, idx = state.currentQuestion;

    document.getElementById('progress-fill').style.width = `${(idx / total) * 100}%`;
    document.getElementById('progress-text').textContent = `${idx + 1}/${total}`;

    let sh = '';
    for (let i = 0; i < total; i++)
      sh += i < state.correctCount
        ? '<span style="filter:drop-shadow(0 0 3px gold)">⭐</span>'
        : '<span style="opacity:.2">⭐</span>';
    document.getElementById('question-stars').innerHTML = sh;

    updateComboDisplay();

    const w = WORLDS[state.currentWorld];
    const mascot = document.getElementById('question-mascot');
    mascot.textContent = w.guardian.icon;
    mascot.className = 'question-mascot';

    document.getElementById('question-text').textContent = q.q;
    document.getElementById('question-hint').textContent = '';

    const card = document.getElementById('question-card');
    card.style.animation = 'none'; card.offsetHeight; card.style.animation = '';

    const optGrid = document.getElementById('options-grid');
    optGrid.innerHTML = '';
    const cls = ['opt-a','opt-b','opt-c','opt-d'];

    q.opts.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = `option-btn ${cls[i]} pop-in`;
      btn.textContent = opt;
      btn.onclick = () => handleAnswer(i);
      optGrid.appendChild(btn);
      Sound.pop(i * 0.07);
    });

    document.getElementById('feedback-overlay').classList.remove('show');

    Voice.speakQuestion(q.q);

    if (hintTimeout) clearTimeout(hintTimeout);
    const qi = state.currentQuestion;
    hintTimeout = setTimeout(() => {
      if (state.currentQuestion === qi) {
        const h = document.getElementById('question-hint');
        if (!h.textContent) { h.textContent = `💡 提示：${q.hint}`; h.style.opacity = '1'; }
      }
    }, 10000);
  }

  function handleAnswer(sel) {
    Voice.stop();
    const q = state.questions[state.currentQuestion];
    const ok = sel === q.ans;
    const btns = document.querySelectorAll('.option-btn');
    btns.forEach(b => b.classList.add('disabled'));
    btns[sel].classList.add(ok ? 'correct' : 'wrong');
    if (!ok) btns[q.ans].classList.add('show-correct');

    const mascot = document.getElementById('question-mascot');

    if (ok) {
      state.correctCount++; state.comboCount++;
      if (state.comboCount > state.maxCombo) state.maxCombo = state.comboCount;
      Sound.correct();
      mascot.classList.add('happy');

      const rect = btns[sel].getBoundingClientRect();
      Particles.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, 15);

      if (state.comboCount >= 3) Sound.combo(state.comboCount);
    } else {
      state.comboCount = 0;
      Sound.wrong();
      mascot.classList.add('sad');
    }

    updateComboDisplay();
    setTimeout(() => showFeedback(ok, q), 700);
  }

  function updateComboDisplay() {
    const el = document.getElementById('combo-display');
    if (state.comboCount >= 2) {
      el.textContent = `🔥 ${state.comboCount}连击！`;
      el.className = `combo-display active ${state.comboCount >= 4 ? 'fire' : ''}`;
    } else {
      el.className = 'combo-display';
    }
  }

  function showFeedback(ok, q) {
    const overlay = document.getElementById('feedback-overlay');
    const content = document.getElementById('feedback-content');
    const msgs = ok ? ENCOURAGEMENTS.correct : ENCOURAGEMENTS.wrong;
    const msg = msgs[Math.floor(Math.random() * msgs.length)];

    let comboMsg = '';
    if (ok && state.comboCount >= 3 && ENCOURAGEMENTS.combo[state.comboCount]) {
      comboMsg = `<div style="color:#FF4500;font-weight:bold;margin-top:4px">${ENCOURAGEMENTS.combo[state.comboCount]}</div>`;
    }

    content.className = `feedback-content ${ok ? 'feedback-correct' : 'feedback-wrong'}`;
    content.innerHTML = `
      <div class="feedback-icon ${ok ? 'correct-icon' : 'wrong-icon'}">${ok ? '🎉' : '🤔'}</div>
      <div class="feedback-title">${ok ? '答对了！' : '答错了'}</div>
      <div class="feedback-msg">${msg}${!ok ? '<br>正确答案：<b>' + q.opts[q.ans] + '</b>' : ''}${comboMsg}</div>
      <button class="feedback-btn" onclick="Game.nextQuestion()">${state.currentQuestion < state.questions.length - 1 ? '下一题 ▶' : '看成绩 🏆'}</button>`;

    overlay.classList.add('show');
    Voice.speakFeedback(ok);
    if (ok) Sound.star(0.3);
  }

  function nextQuestion() {
    Sound.click();
    document.getElementById('feedback-overlay').classList.remove('show');
    state.currentQuestion++;
    state.currentQuestion >= state.questions.length ? showResult() : renderQuestion();
  }

  // ===== 结果 =====
  function showResult() {
    Sound.stopBGM();
    const correct = state.correctCount, total = state.questions.length;
    const stars = STARS_MAP[correct] ?? 0;

    const w = WORLDS[state.currentWorld];
    const old = (state.worldProgress[w.id] || {})[state.currentLevel] || 0;
    if (stars > old) {
      if (!state.worldProgress[w.id]) state.worldProgress[w.id] = {};
      state.worldProgress[w.id][state.currentLevel] = stars;
      state.totalStars += (stars - old);
    }

    state.history.push({
      date: new Date().toLocaleDateString('zh-CN'),
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      world: w.name, level: w.levels[state.currentLevel].name,
      correct, total, stars, maxCombo: state.maxCombo
    });
    save();

    showScreen('result', 'zoom-in');

    document.getElementById('result-mascot').textContent = stars >= 2 ? '🥳' : stars === 1 ? '😊' : '💪';
    document.getElementById('result-title').textContent = stars > 0 ? '🎉 过关啦！' : '💪 再接再厉！';

    let sh = '';
    for (let i = 0; i < 3; i++) sh += `<span class="result-star">${i < stars ? '⭐' : '☆'}</span>`;
    document.getElementById('result-stars-display').innerHTML = sh;

    document.getElementById('stat-correct').textContent = correct;
    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-combo').textContent = state.maxCombo;

    const ml = ENCOURAGEMENTS.levelComplete[stars] || ENCOURAGEMENTS.levelComplete[0];
    document.getElementById('result-message').textContent =
      ml[Math.floor(Math.random() * ml.length)].replace('{name}', state.playerName);

    document.getElementById('btn-next-level').style.display =
      (state.currentLevel < w.levels.length - 1 && stars > 0) ? 'inline-block' : 'none';

    if (stars > 0) {
      Sound.complete(); Particles.celebrationBurst();
      Voice.speak(stars === 3 ? `${state.playerName}太棒了！满分通关！` :
        `${state.playerName}真厉害！过关了！`);
    } else {
      Voice.speak(`${state.playerName}加油！再试一次一定行！`);
    }

    setTimeout(() => {
      if (stars > 0) Particles.starBurst(window.innerWidth / 2, window.innerHeight / 3);
    }, 800);

    const wasC = state.gemsCollected.includes(w.id);
    if (!wasC && isWorldComplete(state.currentWorld)) {
      state.gemsCollected.push(w.id); save();
      setTimeout(() => showWorldComplete(), 3000);
    }
  }

  function retryLevel() { Sound.click(); startStory(state.currentWorld, state.currentLevel); }

  function nextLevel() {
    Sound.click();
    const w = WORLDS[state.currentWorld];
    state.currentLevel < w.levels.length - 1
      ? startStory(state.currentWorld, state.currentLevel + 1)
      : showLevels(state.currentWorld);
  }

  // ===== 世界完成 =====
  function showWorldComplete() {
    const w = WORLDS[state.currentWorld];
    showScreen('world-complete', 'zoom-in');
    Sound.gem(); Particles.celebrationBurst();

    document.getElementById('gem-animation').textContent = w.gem;
    document.getElementById('wc-title').textContent = `${w.name} 通关！`;
    const ml = ENCOURAGEMENTS.worldComplete;
    document.getElementById('wc-message').textContent =
      ml[Math.floor(Math.random() * ml.length)].replace('{world}', w.name);

    const gd = document.getElementById('gem-collection');
    gd.innerHTML = '';
    WORLDS.forEach(ww => {
      const s = document.createElement('span');
      s.className = `gem-item ${state.gemsCollected.includes(ww.id) ? 'collected' : ''}`;
      s.textContent = ww.gem;
      gd.appendChild(s);
    });

    Voice.speak(`恭喜！${w.name}通关！你获得了魔法宝石！`);
  }

  // ===== 家长中心 =====
  function showParentLogin() {
    Sound.click(); showScreen('parent-login', 'fade-in');
    document.getElementById('parent-password').value = '';
    setTimeout(() => document.getElementById('parent-password').focus(), 300);
  }

  function parentLogin() {
    if (document.getElementById('parent-password').value === state.parentPassword) {
      showDashboard();
    } else {
      const inp = document.getElementById('parent-password');
      inp.style.borderColor = '#F87171'; inp.value = '';
      inp.placeholder = '密码错误，请重试';
      setTimeout(() => { inp.style.borderColor = ''; inp.placeholder = '输入密码'; }, 2000);
    }
  }

  function showDashboard() {
    showScreen('dashboard', 'fade-in');
    const totalLevels = WORLDS.reduce((s, w) => s + w.levels.length, 0);
    let completedLevels = 0, totalCorrect = 0, totalAnswered = 0;

    WORLDS.forEach(w => {
      const wp = state.worldProgress[w.id] || {};
      for (const k in wp) if (wp[k] > 0) completedLevels++;
    });
    state.history.forEach(h => { totalCorrect += h.correct; totalAnswered += h.total; });

    const acc = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

    document.getElementById('dash-overview').innerHTML = `
      <div class="dash-stat-card"><div class="dash-stat-icon">⭐</div><div class="dash-stat-value">${state.totalStars}</div><div class="dash-stat-label">获得星星</div></div>
      <div class="dash-stat-card"><div class="dash-stat-icon">📚</div><div class="dash-stat-value">${completedLevels}/${totalLevels}</div><div class="dash-stat-label">通关关卡</div></div>
      <div class="dash-stat-card"><div class="dash-stat-icon">🎯</div><div class="dash-stat-value">${acc}%</div><div class="dash-stat-label">正确率</div></div>
      <div class="dash-stat-card"><div class="dash-stat-icon">🔥</div><div class="dash-stat-value">${Math.max(...state.history.map(h => h.maxCombo || 0), 0)}</div><div class="dash-stat-label">最高连击</div></div>`;

    const sd = document.getElementById('dash-subjects');
    sd.innerHTML = '<h3>📖 各科目详情</h3>';
    WORLDS.forEach((w, i) => {
      let wc = 0, wt = 0;
      state.history.forEach(h => { if (h.world === w.name) { wc += h.correct; wt += h.total; } });
      const wa = wt > 0 ? Math.round((wc / wt) * 100) : 0;
      const row = document.createElement('div'); row.className = 'subject-row';
      row.innerHTML = `
        <div class="subject-icon">${w.icon}</div>
        <div class="subject-info"><div class="subject-name">${w.name}</div><div class="subject-detail">已答 ${wt} 题，正确 ${wc} 题</div></div>
        <div class="subject-bar"><div class="subject-bar-fill" style="width:${getWorldProgress(i)}%;background:${w.color}"></div></div>
        <div class="subject-accuracy" style="color:${wa >= 80 ? '#16a34a' : wa >= 60 ? '#f59e0b' : '#ef4444'}">${wa}%</div>`;
      sd.appendChild(row);
    });

    const hd = document.getElementById('dash-history');
    hd.innerHTML = '<h3>📋 最近学习记录</h3>';
    const recent = state.history.slice(-10).reverse();
    if (!recent.length) { hd.innerHTML += '<div style="color:#94a3b8;padding:10px">还没有学习记录~</div>'; }
    else recent.forEach(h => {
      const it = document.createElement('div'); it.className = 'history-item';
      let st = ''; for (let i = 0; i < (h.stars||0); i++) st += '⭐';
      it.innerHTML = `<div class="history-left"><span>${h.world} - ${h.level}</span><span class="history-stars">${st || '未通过'}</span></div>
        <div><span>${h.correct}/${h.total}</span><span class="history-date">${h.date} ${h.time}</span></div>`;
      hd.appendChild(it);
    });
  }

  function changePassword() {
    const p = document.getElementById('new-password').value.trim();
    if (p.length < 4) { alert('密码至少4位！'); return; }
    state.parentPassword = p; save();
    document.getElementById('new-password').value = '';
    alert('密码修改成功！');
  }

  function resetProgress() {
    if (confirm('确定要重置所有进度吗？此操作不可恢复！'))
      if (confirm('再次确认：所有星星、进度、记录都会被清除！')) {
        state.worldProgress = {}; state.totalStars = 0;
        state.gemsCollected = []; state.history = [];
        save(); showDashboard();
      }
  }

  // ===== 初始化 =====
  function init() {
    Particles.init(); Particles.start();
    const has = load();
    document.getElementById('btn-continue').style.display = has ? 'inline-block' : 'none';

    document.getElementById('player-name').addEventListener('keydown', e => {
      if (e.key === 'Enter') setPlayerName();
    });
    document.getElementById('parent-password').addEventListener('keydown', e => {
      if (e.key === 'Enter') parentLogin();
    });

    document.addEventListener('click', () => {
      if (Sound.isEnabled()) {
        const c = new (window.AudioContext || window.webkitAudioContext)();
        if (c.state === 'suspended') c.resume();
        c.close();
      }
    }, { once: true });

    if (Voice.isSupported) speechSynthesis.getVoices();
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    showWelcome, showNameInput, setPlayerName, continueGame, showMap, toggleSound,
    showLevels, showParentLogin, parentLogin, showDashboard, changePassword,
    resetProgress, nextDialog, nextQuestion, retryLevel, nextLevel
  };
})();
