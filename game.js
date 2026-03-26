/**
 * 小星星奇遇记 - 游戏核心逻辑
 */

const Game = (() => {
  const STORAGE_KEY = 'star_adventure_save';
  const QUESTIONS_PER_LEVEL = 5;
  const STARS_FOR_PASS = { 5: 3, 4: 2, 3: 1, 2: 0, 1: 0, 0: 0 };

  let state = {
    playerName: '',
    parentPassword: '1234',
    currentWorld: 0,
    currentLevel: 0,
    currentQuestion: 0,
    questions: [],
    correctCount: 0,
    levelStartTime: 0,
    worldProgress: {},
    totalStars: 0,
    gemsCollected: [],
    history: []
  };

  let audioCtx = null;
  let hintTimeout = null;

  function getAudioCtx() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    return audioCtx;
  }

  function playTone(freq, duration, type = 'sine', volume = 0.15) {
    const ctx = getAudioCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  }

  function playCorrectSound() {
    playTone(523, 0.12);
    setTimeout(() => playTone(659, 0.12), 100);
    setTimeout(() => playTone(784, 0.25), 200);
  }

  function playWrongSound() {
    playTone(330, 0.15, 'triangle');
    setTimeout(() => playTone(262, 0.3, 'triangle'), 150);
  }

  function playStarSound() {
    playTone(784, 0.1);
    setTimeout(() => playTone(988, 0.1), 80);
    setTimeout(() => playTone(1175, 0.2), 160);
  }

  function playCompleteSound() {
    [523, 587, 659, 784, 880, 1047].forEach((f, i) => {
      setTimeout(() => playTone(f, 0.2, 'sine', 0.12), i * 120);
    });
  }

  // ===== 存档管理 =====
  function save() {
    const data = {
      playerName: state.playerName,
      parentPassword: state.parentPassword,
      worldProgress: state.worldProgress,
      totalStars: state.totalStars,
      gemsCollected: state.gemsCollected,
      history: state.history.slice(-50)
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      state.playerName = data.playerName || '';
      state.parentPassword = data.parentPassword || '1234';
      state.worldProgress = data.worldProgress || {};
      state.totalStars = data.totalStars || 0;
      state.gemsCollected = data.gemsCollected || [];
      state.history = data.history || [];
      return !!state.playerName;
    } catch (e) { return false; }
  }

  // ===== 屏幕切换 =====
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${id}`).classList.add('active');
  }

  // ===== 欢迎界面 =====
  function showWelcome() {
    showScreen('welcome');
    const hasData = load();
    document.getElementById('btn-continue').style.display = hasData ? 'inline-block' : 'none';
  }

  function showNameInput() {
    showScreen('name');
    setTimeout(() => document.getElementById('player-name').focus(), 300);
  }

  function setPlayerName() {
    const name = document.getElementById('player-name').value.trim();
    if (!name) {
      document.getElementById('player-name').style.borderColor = '#F87171';
      setTimeout(() => document.getElementById('player-name').style.borderColor = '', 1000);
      return;
    }
    state.playerName = name;
    state.worldProgress = {};
    state.totalStars = 0;
    state.gemsCollected = [];
    state.history = [];
    save();
    showMap();
  }

  function continueGame() {
    load();
    showMap();
  }

  // ===== 世界地图 =====
  function showMap() {
    showScreen('map');
    document.getElementById('map-player-name').textContent = state.playerName;
    document.getElementById('total-stars').textContent = state.totalStars;

    const grid = document.getElementById('world-grid');
    grid.innerHTML = '';

    WORLDS.forEach((world, idx) => {
      const progress = getWorldProgress(idx);
      const isUnlocked = idx === 0 || isWorldComplete(idx - 1);
      const isComplete = isWorldComplete(idx);

      const card = document.createElement('div');
      card.className = `world-card ${isUnlocked ? '' : 'locked'}`;
      card.style.background = world.color;

      let starsInWorld = 0;
      const wp = state.worldProgress[world.id] || {};
      for (const key in wp) starsInWorld += (wp[key] || 0);

      card.innerHTML = `
        <div>
          <div class="world-card-icon">${world.icon}</div>
          <div class="world-card-name">${world.name}</div>
          <div class="world-card-desc">${world.description}</div>
        </div>
        ${isComplete ? `<div class="world-gem">${world.gem}</div>` : ''}
        ${!isUnlocked ? '<div class="world-lock-icon">🔒</div>' : ''}
        <div class="world-card-progress">
          <div class="world-progress-bar">
            <div class="world-progress-fill" style="width:${progress}%"></div>
          </div>
          <div class="world-progress-text">⭐${starsInWorld}</div>
        </div>
      `;

      if (isUnlocked) {
        card.onclick = () => showLevels(idx);
      }

      grid.appendChild(card);
    });

    const completedCount = WORLDS.filter((_, i) => isWorldComplete(i)).length;
    const subtitle = document.getElementById('map-subtitle');
    if (completedCount === WORLDS.length) {
      subtitle.textContent = '🎉 恭喜！你已经完成了所有世界的冒险！';
    } else if (completedCount > 0) {
      subtitle.textContent = `已收集 ${completedCount}/5 颗宝石，继续冒险吧！`;
    } else {
      subtitle.textContent = '选择一个世界开始冒险吧！';
    }
  }

  function getWorldProgress(worldIdx) {
    const world = WORLDS[worldIdx];
    const wp = state.worldProgress[world.id] || {};
    const totalLevels = world.levels.length;
    let completed = 0;
    for (let i = 0; i < totalLevels; i++) {
      if (wp[i] !== undefined && wp[i] > 0) completed++;
    }
    return Math.round((completed / totalLevels) * 100);
  }

  function isWorldComplete(worldIdx) {
    const world = WORLDS[worldIdx];
    const wp = state.worldProgress[world.id] || {};
    for (let i = 0; i < world.levels.length; i++) {
      if (wp[i] === undefined || wp[i] <= 0) return false;
    }
    return true;
  }

  // ===== 关卡选择 =====
  function showLevels(worldIdx) {
    state.currentWorld = worldIdx;
    const world = WORLDS[worldIdx];
    showScreen('levels');

    document.getElementById('world-icon').textContent = world.icon;
    document.getElementById('world-name-display').textContent = world.name;
    document.getElementById('guardian-avatar').textContent = world.guardian.icon;
    document.getElementById('guardian-speech').textContent = world.guardianGreeting;
    document.getElementById('screen-levels').style.background = `linear-gradient(180deg, ${world.bgColor}33 0%, #1a1a3e 100%)`;

    const grid = document.getElementById('level-grid');
    grid.innerHTML = '';
    const wp = state.worldProgress[world.id] || {};

    world.levels.forEach((level, idx) => {
      const isUnlocked = idx === 0 || (wp[idx - 1] !== undefined && wp[idx - 1] > 0);
      const stars = wp[idx] || 0;

      const card = document.createElement('div');
      card.className = `level-card ${isUnlocked ? '' : 'level-locked'}`;
      card.style.background = isUnlocked ? world.color : 'rgba(255,255,255,0.05)';

      let starsHtml = '';
      for (let i = 0; i < 3; i++) {
        starsHtml += `<span class="${i < stars ? 'level-star-filled' : 'level-star-empty'}">⭐</span>`;
      }

      card.innerHTML = `
        <div class="level-num">${idx + 1}</div>
        <div class="level-name">${level.name}</div>
        <div class="level-stars">${starsHtml}</div>
        ${!isUnlocked ? '<div style="font-size:1.2rem;opacity:0.5">🔒</div>' : ''}
      `;

      if (isUnlocked) {
        card.onclick = () => startStory(worldIdx, idx);
      }

      grid.appendChild(card);
    });
  }

  // ===== 故事场景 =====
  let dialogIndex = 0;
  let dialogList = [];
  let typewriterInterval = null;

  function startStory(worldIdx, levelIdx) {
    state.currentWorld = worldIdx;
    state.currentLevel = levelIdx;

    const world = WORLDS[worldIdx];
    const level = world.levels[levelIdx];

    dialogList = level.story;
    dialogIndex = 0;

    showScreen('story');

    const storyBg = document.getElementById('story-bg');
    storyBg.style.background = world.color;
    storyBg.style.flex = '1';

    renderDialog();
  }

  function renderDialog() {
    if (dialogIndex >= dialogList.length) {
      startLevel();
      return;
    }

    const d = dialogList[dialogIndex];
    document.getElementById('story-char').textContent = d.char;
    document.getElementById('dialog-name').textContent = d.name;

    const textEl = document.getElementById('dialog-text');
    textEl.textContent = '';

    const fullText = d.text;
    let charIdx = 0;
    if (typewriterInterval) clearInterval(typewriterInterval);
    typewriterInterval = setInterval(() => {
      if (charIdx < fullText.length) {
        textEl.textContent += fullText[charIdx];
        charIdx++;
      } else {
        clearInterval(typewriterInterval);
      }
    }, 40);

    const btn = document.getElementById('btn-story-next');
    btn.textContent = dialogIndex < dialogList.length - 1 ? '继续 ▶' : '开始答题！🚀';

    btn.onclick = () => {
      if (typewriterInterval) clearInterval(typewriterInterval);
      dialogIndex++;
      if (dialogIndex >= dialogList.length) {
        startLevel();
      } else {
        renderDialog();
      }
    };
  }

  function nextDialog() {}

  // ===== 答题流程 =====
  function startLevel() {
    const world = WORLDS[state.currentWorld];
    const levelQuestions = QUESTIONS[world.id][state.currentLevel];

    const shuffled = [...levelQuestions].sort(() => Math.random() - 0.5);
    state.questions = shuffled.slice(0, QUESTIONS_PER_LEVEL);
    state.currentQuestion = 0;
    state.correctCount = 0;
    state.levelStartTime = Date.now();

    showScreen('question');
    renderQuestion();
  }

  function renderQuestion() {
    const q = state.questions[state.currentQuestion];
    const total = state.questions.length;
    const idx = state.currentQuestion;

    document.getElementById('progress-fill').style.width = `${((idx) / total) * 100}%`;
    document.getElementById('progress-text').textContent = `${idx + 1}/${total}`;

    let starsHtml = '';
    for (let i = 0; i < total; i++) {
      if (i < state.correctCount) {
        starsHtml += '<span style="filter:drop-shadow(0 0 3px gold)">⭐</span>';
      } else {
        starsHtml += '<span style="opacity:0.2">⭐</span>';
      }
    }
    document.getElementById('question-stars').innerHTML = starsHtml;

    const world = WORLDS[state.currentWorld];
    document.getElementById('question-mascot').textContent = world.guardian.icon;

    document.getElementById('question-text').textContent = q.q;
    document.getElementById('question-hint').textContent = '';

    const optGrid = document.getElementById('options-grid');
    optGrid.innerHTML = '';
    const optClasses = ['option-a', 'option-b', 'option-c', 'option-d'];

    q.opts.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = `option-btn ${optClasses[i]}`;
      btn.textContent = opt;
      btn.onclick = () => handleAnswer(i);
      optGrid.appendChild(btn);
    });

    document.getElementById('feedback-overlay').classList.remove('show');

    if (hintTimeout) clearTimeout(hintTimeout);
    const qIdx = state.currentQuestion;
    hintTimeout = setTimeout(() => {
      if (state.currentQuestion === qIdx) {
        const hintEl = document.getElementById('question-hint');
        if (hintEl.textContent === '') {
          hintEl.textContent = `💡 提示：${q.hint}`;
        }
      }
    }, 8000);
  }

  function handleAnswer(selectedIdx) {
    const q = state.questions[state.currentQuestion];
    const isCorrect = selectedIdx === q.ans;
    const btns = document.querySelectorAll('.option-btn');

    btns.forEach(b => b.classList.add('disabled'));
    btns[selectedIdx].classList.add(isCorrect ? 'correct' : 'wrong');
    if (!isCorrect) {
      btns[q.ans].classList.add('show-correct');
    }

    if (isCorrect) {
      state.correctCount++;
      playCorrectSound();
    } else {
      playWrongSound();
    }

    setTimeout(() => showFeedback(isCorrect, q), 600);
  }

  function showFeedback(isCorrect, q) {
    const overlay = document.getElementById('feedback-overlay');
    const content = document.getElementById('feedback-content');

    const msgs = isCorrect ? ENCOURAGEMENTS.correct : ENCOURAGEMENTS.wrong;
    const msg = msgs[Math.floor(Math.random() * msgs.length)];

    content.className = `feedback-content ${isCorrect ? 'feedback-correct' : 'feedback-wrong'}`;
    content.innerHTML = `
      <div class="feedback-icon">${isCorrect ? '🎉' : '😊'}</div>
      <div class="feedback-title">${isCorrect ? '答对了！' : '答错了'}</div>
      <div class="feedback-msg">${msg}${!isCorrect ? '<br>正确答案是：<b>' + q.opts[q.ans] + '</b>' : ''}</div>
      <button class="feedback-btn" onclick="Game.nextQuestion()">${state.currentQuestion < state.questions.length - 1 ? '下一题 ▶' : '看看成绩 🏆'}</button>
    `;

    overlay.classList.add('show');

    if (isCorrect) playStarSound();
  }

  function nextQuestion() {
    document.getElementById('feedback-overlay').classList.remove('show');
    state.currentQuestion++;

    if (state.currentQuestion >= state.questions.length) {
      showResult();
    } else {
      renderQuestion();
    }
  }

  // ===== 关卡结果 =====
  function showResult() {
    const correct = state.correctCount;
    const total = state.questions.length;
    const stars = STARS_FOR_PASS[correct] !== undefined ? STARS_FOR_PASS[correct] : 0;
    const elapsed = Math.round((Date.now() - state.levelStartTime) / 1000);

    const world = WORLDS[state.currentWorld];
    const oldStars = (state.worldProgress[world.id] || {})[state.currentLevel] || 0;

    if (stars > oldStars) {
      if (!state.worldProgress[world.id]) state.worldProgress[world.id] = {};
      state.worldProgress[world.id][state.currentLevel] = stars;
      state.totalStars += (stars - oldStars);
    }

    state.history.push({
      date: new Date().toLocaleDateString('zh-CN'),
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      world: world.name,
      level: world.levels[state.currentLevel].name,
      correct,
      total,
      stars,
      elapsed
    });

    save();

    showScreen('result');
    playCompleteSound();

    document.getElementById('result-title').textContent = stars > 0 ? '🎉 过关啦！' : '💪 再接再厉！';

    let starsHtml = '';
    for (let i = 0; i < 3; i++) {
      starsHtml += `<span class="result-star">${i < stars ? '⭐' : '☆'}</span>`;
    }
    document.getElementById('result-stars-display').innerHTML = starsHtml;

    document.getElementById('stat-correct').textContent = correct;
    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-time').textContent = elapsed + 's';

    const msgList = ENCOURAGEMENTS.levelComplete[stars] || ENCOURAGEMENTS.levelComplete[0];
    const msg = msgList[Math.floor(Math.random() * msgList.length)].replace('{name}', state.playerName);
    document.getElementById('result-message').textContent = msg;

    const hasNext = state.currentLevel < world.levels.length - 1;
    document.getElementById('btn-next-level').style.display = (hasNext && stars > 0) ? 'inline-block' : 'none';

    if (stars > 0) createConfetti();

    const wasComplete = state.gemsCollected.includes(world.id);
    if (!wasComplete && isWorldComplete(state.currentWorld)) {
      state.gemsCollected.push(world.id);
      save();
      setTimeout(() => showWorldComplete(), 2500);
    }
  }

  function createConfetti() {
    const container = document.getElementById('confetti-container');
    container.innerHTML = '';
    const colors = ['#FF6B9D', '#C084FC', '#60A5FA', '#4ADE80', '#FB923C', '#FBBF24', '#22D3EE'];

    for (let i = 0; i < 60; i++) {
      const conf = document.createElement('div');
      conf.className = 'confetti';
      conf.style.left = Math.random() * 100 + '%';
      conf.style.background = colors[Math.floor(Math.random() * colors.length)];
      conf.style.width = (Math.random() * 8 + 5) + 'px';
      conf.style.height = (Math.random() * 8 + 5) + 'px';
      conf.style.animationDuration = (Math.random() * 2 + 2) + 's';
      conf.style.animationDelay = Math.random() * 1.5 + 's';
      if (Math.random() > 0.5) conf.style.borderRadius = '50%';
      container.appendChild(conf);
    }
  }

  function retryLevel() {
    startStory(state.currentWorld, state.currentLevel);
  }

  function nextLevel() {
    const world = WORLDS[state.currentWorld];
    if (state.currentLevel < world.levels.length - 1) {
      startStory(state.currentWorld, state.currentLevel + 1);
    } else {
      showLevels(state.currentWorld);
    }
  }

  // ===== 世界完成 =====
  function showWorldComplete() {
    const world = WORLDS[state.currentWorld];
    showScreen('world-complete');
    playCompleteSound();

    document.getElementById('gem-animation').textContent = world.gem;

    const msgList = ENCOURAGEMENTS.worldComplete;
    const msg = msgList[Math.floor(Math.random() * msgList.length)].replace('{world}', world.name);
    document.getElementById('wc-title').textContent = `${world.name} 通关！`;
    document.getElementById('wc-message').textContent = msg;

    const gemDiv = document.getElementById('gem-collection');
    gemDiv.innerHTML = '';
    WORLDS.forEach((w, i) => {
      const span = document.createElement('span');
      span.className = `gem-item ${state.gemsCollected.includes(w.id) ? 'collected' : ''}`;
      span.textContent = w.gem;
      gemDiv.appendChild(span);
    });
  }

  // ===== 家长中心 =====
  function showParentLogin() {
    showScreen('parent-login');
    document.getElementById('parent-password').value = '';
    setTimeout(() => document.getElementById('parent-password').focus(), 300);
  }

  function parentLogin() {
    const pwd = document.getElementById('parent-password').value;
    if (pwd === state.parentPassword) {
      showDashboard();
    } else {
      const input = document.getElementById('parent-password');
      input.style.borderColor = '#F87171';
      input.value = '';
      input.placeholder = '密码错误，请重试';
      setTimeout(() => {
        input.style.borderColor = '';
        input.placeholder = '输入密码';
      }, 2000);
    }
  }

  function showDashboard() {
    showScreen('dashboard');

    const overviewDiv = document.getElementById('dash-overview');
    const totalLevels = WORLDS.reduce((sum, w) => sum + w.levels.length, 0);
    let completedLevels = 0;
    let totalCorrect = 0;
    let totalAnswered = 0;
    let totalTime = 0;

    WORLDS.forEach(w => {
      const wp = state.worldProgress[w.id] || {};
      for (const key in wp) {
        if (wp[key] > 0) completedLevels++;
      }
    });

    state.history.forEach(h => {
      totalCorrect += h.correct;
      totalAnswered += h.total;
      totalTime += h.elapsed;
    });

    const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
    const timeMin = Math.round(totalTime / 60);

    overviewDiv.innerHTML = `
      <div class="dash-stat-card">
        <div class="dash-stat-icon">⭐</div>
        <div class="dash-stat-value">${state.totalStars}</div>
        <div class="dash-stat-label">获得星星</div>
      </div>
      <div class="dash-stat-card">
        <div class="dash-stat-icon">📚</div>
        <div class="dash-stat-value">${completedLevels}/${totalLevels}</div>
        <div class="dash-stat-label">通关关卡</div>
      </div>
      <div class="dash-stat-card">
        <div class="dash-stat-icon">🎯</div>
        <div class="dash-stat-value">${accuracy}%</div>
        <div class="dash-stat-label">正确率</div>
      </div>
      <div class="dash-stat-card">
        <div class="dash-stat-icon">⏱️</div>
        <div class="dash-stat-value">${timeMin}</div>
        <div class="dash-stat-label">学习分钟</div>
      </div>
    `;

    const subjectsDiv = document.getElementById('dash-subjects');
    subjectsDiv.innerHTML = '<h3>📖 各科目详情</h3>';

    WORLDS.forEach((w, idx) => {
      let wCorrect = 0, wTotal = 0;
      state.history.forEach(h => {
        if (h.world === w.name) {
          wCorrect += h.correct;
          wTotal += h.total;
        }
      });
      const wAcc = wTotal > 0 ? Math.round((wCorrect / wTotal) * 100) : 0;
      const progress = getWorldProgress(idx);

      const row = document.createElement('div');
      row.className = 'subject-row';
      row.innerHTML = `
        <div class="subject-icon">${w.icon}</div>
        <div class="subject-info">
          <div class="subject-name">${w.name}</div>
          <div class="subject-detail">已答 ${wTotal} 题，正确 ${wCorrect} 题</div>
        </div>
        <div class="subject-bar">
          <div class="subject-bar-fill" style="width:${progress}%;background:${w.bgColor}"></div>
        </div>
        <div class="subject-accuracy" style="color:${wAcc >= 80 ? '#16a34a' : wAcc >= 60 ? '#f59e0b' : '#ef4444'}">${wAcc}%</div>
      `;
      subjectsDiv.appendChild(row);
    });

    const historyDiv = document.getElementById('dash-history');
    historyDiv.innerHTML = '<h3>📋 最近学习记录</h3>';

    const recent = state.history.slice(-10).reverse();
    if (recent.length === 0) {
      historyDiv.innerHTML += '<div style="color:#94a3b8;padding:10px;">还没有学习记录哦~</div>';
    } else {
      recent.forEach(h => {
        const item = document.createElement('div');
        item.className = 'history-item';
        let stars = '';
        for (let i = 0; i < h.stars; i++) stars += '⭐';
        item.innerHTML = `
          <div class="history-left">
            <span>${h.world} - ${h.level}</span>
            <span class="history-stars">${stars || '未通过'}</span>
          </div>
          <div>
            <span>${h.correct}/${h.total}</span>
            <span class="history-date">${h.date} ${h.time}</span>
          </div>
        `;
        historyDiv.appendChild(item);
      });
    }
  }

  function changePassword() {
    const newPwd = document.getElementById('new-password').value.trim();
    if (newPwd.length < 4) {
      alert('密码至少4位！');
      return;
    }
    state.parentPassword = newPwd;
    save();
    document.getElementById('new-password').value = '';
    alert('密码修改成功！');
  }

  function resetProgress() {
    if (confirm('确定要重置所有进度吗？此操作不可恢复！')) {
      if (confirm('再次确认：所有星星、进度、记录都会被清除！')) {
        state.worldProgress = {};
        state.totalStars = 0;
        state.gemsCollected = [];
        state.history = [];
        save();
        showDashboard();
      }
    }
  }

  // ===== 初始化 =====
  function init() {
    const hasData = load();
    document.getElementById('btn-continue').style.display = hasData ? 'inline-block' : 'none';

    document.getElementById('player-name').addEventListener('keydown', e => {
      if (e.key === 'Enter') setPlayerName();
    });
    document.getElementById('parent-password').addEventListener('keydown', e => {
      if (e.key === 'Enter') parentLogin();
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    showWelcome,
    showNameInput,
    setPlayerName,
    continueGame,
    showMap,
    showLevels,
    showParentLogin,
    parentLogin,
    showDashboard,
    changePassword,
    resetProgress,
    nextDialog,
    nextQuestion,
    retryLevel,
    nextLevel
  };
})();
