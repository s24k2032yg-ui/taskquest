/* ==========================================================================
   TaskQuest Javascript Logic
   ========================================================================== */

// --- STATE MANAGEMENT ---
let state = {
    level: 1,
    exp: 0,
    coins: 0,
    soundOn: true,
    quests: [],
    notifications: {
        enabled: false,
        notify24h: true,
        notify3h: true,
        notify1h: true,
        notifyAction: true,
        sent: {}
    }
};

// Initial demo data if localStorage is empty
const INITIAL_DEMO_QUESTS = [
    {
        id: "demo-1",
        title: "英語の単語テスト勉強（Chap.4）",
        subject: "english",
        due: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // 3 hours from now
        difficulty: 1,
        notes: "範囲はプリント裏表。8割合格でクリア！",
        completed: false,
        completedAt: null
    },
    {
        id: "demo-2",
        title: "数学ワーク提出 p.45〜p.48",
        subject: "math",
        due: new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString(), // 30 hours from now
        difficulty: 2,
        notes: "ノートに途中式も書くこと。授業開始時に提出。",
        completed: false,
        completedAt: null
    },
    {
        id: "demo-3",
        title: "理科の自由研究テーマ決めレポート",
        subject: "science",
        due: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
        difficulty: 3,
        notes: "A4用紙1枚。テーマ候補3つと動機を書く。",
        completed: false,
        completedAt: null
    }
];

// Load State from LocalStorage
function loadState() {
    const savedState = localStorage.getItem('taskquest_state');
    if (savedState) {
        try {
            state = JSON.parse(savedState);
            // Ensure properties exist
            state.level = state.level || 1;
            state.exp = state.exp || 0;
            state.coins = state.coins || 0;
            state.soundOn = state.soundOn !== undefined ? state.soundOn : true;
            state.quests = state.quests || [];
            
            // Ensure notifications state exists
            state.notifications = state.notifications || {};
            state.notifications.enabled = state.notifications.enabled !== undefined ? state.notifications.enabled : false;
            state.notifications.notify24h = state.notifications.notify24h !== undefined ? state.notifications.notify24h : true;
            state.notifications.notify3h = state.notifications.notify3h !== undefined ? state.notifications.notify3h : true;
            state.notifications.notify1h = state.notifications.notify1h !== undefined ? state.notifications.notify1h : true;
            state.notifications.notifyAction = state.notifications.notifyAction !== undefined ? state.notifications.notifyAction : true;
            state.notifications.sent = state.notifications.sent || {};
        } catch (e) {
            console.error("Error parsing saved state, resetting...", e);
            resetToDefault();
        }
    } else {
        // Initialize with default values
        state.quests = [...INITIAL_DEMO_QUESTS];
        state.notifications = {
            enabled: false,
            notify24h: true,
            notify3h: true,
            notify1h: true,
            notifyAction: true,
            sent: {}
        };
        saveState();
    }
}

// Save State to LocalStorage
function saveState() {
    localStorage.setItem('taskquest_state', JSON.stringify(state));
}

// Reset State
function resetToDefault() {
    localStorage.removeItem('taskquest_state');
    state = {
        level: 1,
        exp: 0,
        coins: 0,
        soundOn: true,
        quests: [...INITIAL_DEMO_QUESTS],
        notifications: {
            enabled: false,
            notify24h: true,
            notify3h: true,
            notify1h: true,
            notifyAction: true,
            sent: {}
        }
    };
    saveState();
    updateUI();
}

// --- DOM ELEMENTS ---
const elements = {
    // Header Stats
    playerLevel: document.getElementById('player-level'),
    playerExp: document.getElementById('player-exp'),
    playerNextExp: document.getElementById('player-next-exp'),
    playerExpBar: document.getElementById('player-exp-bar'),
    playerCoins: document.getElementById('player-coins'),
    soundToggle: document.getElementById('sound-toggle'),
    soundOnIcon: document.querySelector('.sound-on'),
    soundOffIcon: document.querySelector('.sound-off'),

    // Mascot
    mascotSvg: document.getElementById('mascot-svg'),
    mascotMessage: document.getElementById('mascot-message'),

    // Load Meter
    loadPercent: document.getElementById('load-percent'),
    loadGaugeFill: document.getElementById('load-gauge-fill'),
    loadStatusDesc: document.getElementById('load-status-desc'),
    statCompletedCount: document.getElementById('stat-completed-count'),
    statUrgentCount: document.getElementById('stat-urgent-count'),

    // Board Elements
    listUrgent: document.getElementById('list-urgent'),
    listActive: document.getElementById('list-active'),
    listSafe: document.getElementById('list-safe'),
    countUrgent: document.getElementById('count-urgent'),
    countActive: document.getElementById('count-active'),
    countSafe: document.getElementById('count-safe'),

    // Completed List
    toggleCompleted: document.getElementById('toggle-completed'),
    completedContainer: document.getElementById('completed-container'),
    listCompleted: document.getElementById('list-completed'),
    countCompleted: document.getElementById('count-completed'),
    btnClearCompleted: document.getElementById('btn-clear-completed'),

    // Modal
    questModal: document.getElementById('quest-modal'),
    btnOpenModal: document.getElementById('btn-open-modal'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    btnCancel: document.getElementById('btn-cancel'),
    questForm: document.getElementById('quest-form'),
    duePresets: document.querySelectorAll('.due-presets button'),
    customDateContainer: document.getElementById('custom-date-container'),
    questDue: document.getElementById('quest-due'),

    // Level Up Modal
    levelUpModal: document.getElementById('level-up-modal'),
    lvlOldVal: document.getElementById('lvl-old-val'),
    lvlNewVal: document.getElementById('lvl-new-val'),
    lvlCoinReward: document.getElementById('lvl-coin-reward'),
    btnLvlClose: document.getElementById('btn-lvl-close'),

    // Reset button
    btnResetApp: document.getElementById('btn-reset-app'),

    // Notifications UI
    notificationToggle: document.getElementById('notification-toggle'),
    notificationOptions: document.getElementById('notification-options'),
    notify24h: document.getElementById('notify-24h'),
    notify3h: document.getElementById('notify-3h'),
    notify1h: document.getElementById('notify-1h'),
    notifyAction: document.getElementById('notify-action'),
    btnTestNotification: document.getElementById('btn-test-notification')
};

// --- AUDIO SYNTHESIZER (Web Audio API) ---
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playSound(type) {
    if (!state.soundOn) return;
    
    try {
        initAudio();
        const now = audioCtx.currentTime;

        if (type === 'click') {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(300, now + 0.08);

            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.005, now + 0.08);

            osc.start(now);
            osc.stop(now + 0.08);
        } 
        else if (type === 'success') {
            // Cheerful ascending bubble pop sound (E5 -> G5 -> B5 -> E6)
            const notes = [659.25, 783.99, 987.77, 1318.51];
            notes.forEach((freq, idx) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now + idx * 0.05); // Faster rate

                gain.gain.setValueAtTime(0.1, now + idx * 0.05);
                gain.gain.exponentialRampToValueAtTime(0.005, now + idx * 0.05 + 0.1);

                osc.start(now + idx * 0.05);
                osc.stop(now + idx * 0.05 + 0.1);
            });
        } 
        else if (type === 'levelup') {
            // Epic retro bubble fanfare (C5 -> E5 -> G5 -> C6 -> G5 -> C6 -> E6 -> G6)
            const notes = [
                { f: 523.25, d: 0.08 }, // C5
                { f: 659.25, d: 0.08 }, // E5
                { f: 783.99, d: 0.08 }, // G5
                { f: 1046.50, d: 0.12 },// C6
                { f: 783.99, d: 0.08 }, // G5
                { f: 1046.50, d: 0.08 },// C6
                { f: 1318.51, d: 0.08 },// E6
                { f: 1567.98, d: 0.3 }  // G6 (long)
            ];
            
            let timeAccumulator = 0;
            notes.forEach((note) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                
                // Add low-pass filter to make it sound warm/retro
                const filter = audioCtx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = 1800; // Bright filter
                
                osc.connect(filter);
                filter.connect(gain);
                gain.connect(audioCtx.destination);

                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(note.f, now + timeAccumulator);

                gain.gain.setValueAtTime(0.07, now + timeAccumulator);
                gain.gain.exponentialRampToValueAtTime(0.001, now + timeAccumulator + note.d);

                osc.start(now + timeAccumulator);
                osc.stop(now + timeAccumulator + note.d);
                
                timeAccumulator += note.d - 0.01;
            });
        }
        else if (type === 'delete') {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(350, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.12);

            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.005, now + 0.12);

            osc.start(now);
            osc.stop(now + 0.12);
        }
    } catch (e) {
        console.warn("Audio Context error: ", e);
    }
}

// --- CONFETTI PARTICLE SYSTEM ---
const canvas = elements.confettiCanvas;
const ctx = canvas.getContext('2d');
let particles = [];
let animationFrameId = null;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class ConfettiParticle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 10 + 6;
        // Pop Theme curated colors (Pink, Cyan, Yellow, Purple, Orange, Green)
        const popColors = ['#f43f5e', '#06b6d4', '#ffd233', '#a855f7', '#ffa502', '#2ed573'];
        this.color = popColors[Math.floor(Math.random() * popColors.length)];
        this.speedX = Math.random() * 8 - 4;
        this.speedY = Math.random() * -12 - 6; // Launch slightly higher
        this.gravity = 0.32;
        this.rotation = Math.random() * 360;
        this.rotationSpeed = Math.random() * 12 - 6;
        this.opacity = 1;
    }

    update() {
        this.speedY += this.gravity;
        this.x += this.speedX;
        this.y += this.speedY;
        this.rotation += this.rotationSpeed;
        if (this.speedY > 0) {
            this.opacity -= 0.015;
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate((this.rotation * Math.PI) / 180);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.opacity;
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        ctx.restore();
    }
}

function startConfetti(originX, originY) {
    // Generate particles around the clicked coordinate
    for (let i = 0; i < 40; i++) {
        particles.push(new ConfettiParticle(originX, originY));
    }
    
    if (!animationFrameId) {
        animateConfetti();
    }
}

function animateConfetti() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Update and draw particles
    particles = particles.filter(p => p.opacity > 0 && p.y < canvas.height);
    particles.forEach(p => {
        p.update();
        p.draw();
    });

    if (particles.length > 0) {
        animationFrameId = requestAnimationFrame(animateConfetti);
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        animationFrameId = null;
    }
}

// --- MASCOT SYSTEM ---
const MascotPhrases = {
    idle: [
        "宿題やレポートはクエストみたいにやっつけちゃおう！✨",
        "クエストクリアでEXPとお宝コインをゲットだよ！🪙",
        "たいへんなクエストを倒すと、EXPがどっさり貰えちゃう！🌟",
        "今日が締め切りの課題はないかな？ボードをチェック！🚨",
        "新しいクエストを受注して、最強の冒険者を目指そう！👑",
        "少しずつ進めるのが、クエスト攻略の最大の秘訣だよ！✍️"
    ],
    panic: [
        "ひゃああ！あと24時間で締め切りのクエストがあるよ！💦",
        "赤色の緊急クエストが発生中！急いでやっつけよう！🔥",
        "大変大変！このままずっと放置だとクエスト失敗（忘れ物）になっちゃうよぉ！😱",
        "あわてずに、まずは一番かんたんなやつからやっちゃおう！👍"
    ],
    happy: [
        "やったね！クエスト攻略、お見事だよー！🎉",
        "わぁい！EXPとお宝コインをゲット！すごすぎる！✨",
        "その調子その調子！次のクエストも一気に倒しちゃおう！🚀",
        "クリアするとピコピコ音が鳴って最高に気持ちいいね！🎵"
    ],
    sleep: [
        "すやすや… クエストが全部終わって平和な世界になったよぉ…💤",
        "今日もお疲れさま！ゆっくり休んで、明日に備えようね。おやすみ〜😴"
    ]
};

let mascotSpeechTimer = null;
let currentMascotState = 'idle';

function setMascotExpression(expression) {
    // Remove all classes
    elements.mascotSvg.classList.remove('mascot--idle', 'mascot--happy', 'mascot--panic', 'mascot--sleep');
    elements.mascotSvg.classList.add(`mascot--${expression}`);

    // Toggle visible parts in SVG
    const exprClasses = {
        idle: '.face-expr--idle',
        happy: '.face-expr--happy',
        panic: '.face-expr--panic',
        sleep: '.face-expr--sleep'
    };

    Object.keys(exprClasses).forEach(key => {
        const group = elements.mascotSvg.querySelector(exprClasses[key]);
        if (key === expression) {
            group.classList.remove('hidden');
        } else {
            group.classList.add('hidden');
        }
    });
    
    currentMascotState = expression;
}

function speakMascot(text) {
    elements.mascotMessage.textContent = text;
}

function updateMascotState(forcePhrase = null) {
    // If a temporary happy animation is active, don't interrupt it immediately
    if (elements.mascotSvg.classList.contains('mascot--happy') && !forcePhrase) {
        return;
    }

    const now = new Date();
    const uncompletedQuests = state.quests.filter(q => !q.completed);
    
    // Check if any quest is within 24h
    const hasUrgent = uncompletedQuests.some(q => {
        const timeLeft = new Date(q.due) - now;
        return timeLeft <= 24 * 60 * 60 * 1000; // 24h
    });

    let newState = 'idle';
    let phraseList = MascotPhrases.idle;

    if (uncompletedQuests.length === 0) {
        newState = 'sleep';
        phraseList = MascotPhrases.sleep;
    } else if (hasUrgent) {
        newState = 'panic';
        phraseList = MascotPhrases.panic;
    }

    setMascotExpression(newState);

    if (forcePhrase) {
        speakMascot(forcePhrase);
    } else {
        const randomPhrase = phraseList[Math.floor(Math.random() * phraseList.length)];
        speakMascot(randomPhrase);
    }
}

// Start Random Speaking Timer
function startMascotInterval() {
    if (mascotSpeechTimer) clearInterval(mascotSpeechTimer);
    mascotSpeechTimer = setInterval(() => {
        updateMascotState();
    }, 30000); // Speak every 30 seconds
}

// Mascot click event to trigger reaction
elements.mascotSvg.addEventListener('click', (e) => {
    playSound('click');
    startConfetti(e.clientX, e.clientY);
    
    // Jump reaction
    const originalState = currentMascotState;
    setMascotExpression('happy');
    
    // Select happy speech
    const happyQuotes = MascotPhrases.happy;
    const randomHappy = happyQuotes[Math.floor(Math.random() * happyQuotes.length)];
    speakMascot(randomHappy);
    
    setTimeout(() => {
        updateMascotState();
    }, 25000);
});


// --- GAMIFICATION / PROGRESS LOGIC ---
function addExp(amount) {
    state.exp += amount;
    const expNeeded = state.level * 100;
    
    if (state.exp >= expNeeded) {
        // LEVEL UP!
        state.exp -= expNeeded;
        state.level += 1;
        state.coins += 50; // Level Up bonus
        
        saveState();
        triggerLevelUpUI(state.level - 1, state.level);
    } else {
        saveState();
    }
    updateStatsBar();
}

function triggerLevelUpUI(oldLvl, newLvl) {
    elements.lvlOldVal.textContent = oldLvl;
    elements.lvlNewVal.textContent = newLvl;
    elements.lvlCoinReward.textContent = 50;
    elements.levelUpModal.classList.remove('hidden');
    
    setMascotExpression('happy');
    speakMascot(`レベルアップおめでとう！さらなる強敵（課題）に立ち向かおう！`);
    
    playSound('levelup');
    
    // Epic confetti splash
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (let j = 0; j < 3; j++) {
        setTimeout(() => {
            startConfetti(w * 0.3 + Math.random() * w * 0.4, h * 0.4 + Math.random() * h * 0.2);
        }, j * 250);
    }
}

// Close level up modal
elements.btnLvlClose.addEventListener('click', () => {
    playSound('click');
    elements.levelUpModal.classList.add('hidden');
    updateMascotState();
});


// --- DATE UTILITIES ---
function formatTimeRemaining(dueDateStr) {
    const now = new Date();
    const due = new Date(dueDateStr);
    const diffMs = due - now;
    
    if (diffMs < 0) {
        return { text: "期限切れ！", isOverdue: true };
    }
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays >= 1) {
        const remainingHours = diffHours % 24;
        return { text: `残り ${diffDays}日 ${remainingHours}時間`, isOverdue: false };
    } else {
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        return { text: `残り ${diffHours}時間 ${diffMins}分`, isOverdue: false };
    }
}

function formatDateDisplay(dueDateStr) {
    const due = new Date(dueDateStr);
    const month = due.getMonth() + 1;
    const date = due.getDate();
    const hours = String(due.getHours()).padStart(2, '0');
    const mins = String(due.getMinutes()).padStart(2, '0');
    const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
    const day = dayNames[due.getDay()];
    
    return `${month}/${date}(${day}) ${hours}:${mins}`;
}

// --- UI RENDERING ENGINE ---
function updateStatsBar() {
    elements.playerLevel.textContent = state.level;
    elements.playerExp.textContent = state.exp;
    const nextExp = state.level * 100;
    elements.playerNextExp.textContent = nextExp;
    
    const percent = Math.min((state.exp / nextExp) * 100, 100);
    elements.playerExpBar.style.width = `${percent}%`;
    elements.playerCoins.textContent = state.coins;
}

function renderQuestCards() {
    const now = new Date();
    
    // Clear list areas
    elements.listUrgent.innerHTML = '';
    elements.listActive.innerHTML = '';
    elements.listSafe.innerHTML = '';
    elements.listCompleted.innerHTML = '';
    
    let counts = { urgent: 0, active: 0, safe: 0, completed: 0 };
    
    // Sort quests: nearest deadline first
    const sortedQuests = [...state.quests].sort((a, b) => new Date(a.due) - new Date(b.due));
    
    sortedQuests.forEach(quest => {
        if (quest.completed) {
            counts.completed++;
            const completedCard = createCompletedCardElement(quest);
            elements.listCompleted.appendChild(completedCard);
            return;
        }
        
        // Calculate remaining time
        const dueTime = new Date(quest.due);
        const timeLeftMs = dueTime - now;
        
        let column = null;
        let urgencyClass = '';
        
        if (timeLeftMs <= 24 * 60 * 60 * 1000) { // < 24 hours (including overdue)
            column = elements.listUrgent;
            urgencyClass = 'near-deadline';
            counts.urgent++;
        } else if (timeLeftMs <= 72 * 60 * 60 * 1000) { // < 3 days
            column = elements.listActive;
            urgencyClass = 'warning-deadline';
            counts.active++;
        } else { // Future
            column = elements.listSafe;
            urgencyClass = 'safe-deadline';
            counts.safe++;
        }
        
        const card = createQuestCardElement(quest, urgencyClass);
        column.appendChild(card);
    });
    
    // Update count badges
    elements.countUrgent.textContent = counts.urgent;
    elements.countActive.textContent = counts.active;
    elements.countSafe.textContent = counts.safe;
    elements.countCompleted.textContent = counts.completed;
    
    // Inject empty placeholders if columns are empty
    checkEmptyColumn(elements.listUrgent, "緊急クエストはありません。素晴らしい！");
    checkEmptyColumn(elements.listActive, "進行中のクエストはありません。");
    checkEmptyColumn(elements.listSafe, "登録されたクエストはありません。");
    
    if (counts.completed === 0) {
        elements.listCompleted.innerHTML = `<p class="empty-text">クリアしたクエストはまだありません。最初のクエストをクリアしよう！</p>`;
        elements.btnClearCompleted.classList.add('hidden');
    } else {
        elements.btnClearCompleted.classList.remove('hidden');
    }
    
    // Update Load Gauge & Stats
    updateLoadAnalysis(counts);
}

function checkEmptyColumn(columnElem, placeholderText) {
    if (columnElem.children.length === 0) {
        columnElem.innerHTML = `<div class="empty-placeholder">${placeholderText}</div>`;
    }
}

function createQuestCardElement(quest, urgencyClass) {
    const card = document.createElement('div');
    card.className = `quest-card ${urgencyClass}`;
    card.dataset.id = quest.id;
    
    const timeInfo = formatTimeRemaining(quest.due);
    const formattedDue = formatDateDisplay(quest.due);
    
    // Difficulty rating stars string
    const stars = '★'.repeat(quest.difficulty) + '☆'.repeat(3 - quest.difficulty);
    
    let subjectText = '';
    let subjectClass = '';
    switch(quest.subject) {
        case 'japanese': subjectText = '📖 国語'; subjectClass = 'jp-tag'; break;
        case 'math': subjectText = '📐 数学'; subjectClass = 'math-tag'; break;
        case 'english': subjectText = '🔤 英語'; subjectClass = 'eng-tag'; break;
        case 'science': subjectText = '🧪 理科'; subjectClass = 'sci-tag'; break;
        case 'social': subjectText = '🌍 社会'; subjectClass = 'soc-tag'; break;
        default: subjectText = '✨ その他'; subjectClass = 'oth-tag'; break;
    }
    
    // Urgency text pill
    let urgencyBadge = '';
    if (timeInfo.isOverdue) {
        urgencyBadge = `<span class="due-urgency-badge badge red">期限切れ</span>`;
    } else if (urgencyClass === 'near-deadline') {
        urgencyBadge = `<span class="due-urgency-badge badge red">急げ！</span>`;
    }
    
    const notesHTML = quest.notes ? `<div class="quest-notes-snippet" style="display: block;">${escapeHTML(quest.notes)}</div>` : '';
    
    card.innerHTML = `
        <div class="quest-card-header">
            <span class="quest-title">${escapeHTML(quest.title)}</span>
            <button class="quest-complete-checkbox" title="クエストクリア！" aria-label="クエストクリア"></button>
        </div>
        ${notesHTML}
        <div class="quest-due-row ${timeInfo.isOverdue ? 'danger-text' : ''}">
            <svg class="clock-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z" />
            </svg>
            <span class="due-time" title="期限: ${formattedDue}">${formattedDue} (${timeInfo.text})</span>
            ${urgencyBadge}
        </div>
        <div class="quest-metadata">
            <span class="subject-tag ${subjectClass}">${subjectText}</span>
            <span class="quest-stars" title="難易度: ${quest.difficulty}">${stars}</span>
        </div>
    `;
    
    // Add Complete Trigger
    const checkbox = card.querySelector('.quest-complete-checkbox');
    checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        completeQuest(quest.id, e.clientX, e.clientY);
    });
    
    return card;
}

function createCompletedCardElement(quest) {
    const card = document.createElement('div');
    card.className = 'completed-card';
    
    let subjectText = '';
    let subjectClass = '';
    switch(quest.subject) {
        case 'japanese': subjectText = '国語'; subjectClass = 'jp-tag'; break;
        case 'math': subjectText = '数学'; subjectClass = 'math-tag'; break;
        case 'english': subjectText = '英語'; subjectClass = 'eng-tag'; break;
        case 'science': subjectText = '理科'; subjectClass = 'sci-tag'; break;
        case 'social': subjectText = '社会'; subjectClass = 'soc-tag'; break;
        default: subjectText = 'その他'; subjectClass = 'oth-tag'; break;
    }
    
    const expReward = quest.difficulty * 15;
    
    card.innerHTML = `
        <div class="completed-info">
            <span class="completed-tag ${subjectClass}">${subjectText}</span>
            <span class="completed-title" title="${escapeHTML(quest.title)}">${escapeHTML(quest.title)}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
            <span class="quest-exp-reward">+${expReward} EXP</span>
            <button class="trash-btn" title="クエスト履歴を削除" aria-label="クエスト削除">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" />
                </svg>
            </button>
        </div>
    `;
    
    const trashBtn = card.querySelector('.trash-btn');
    trashBtn.addEventListener('click', () => {
        deleteQuest(quest.id);
    });
    
    return card;
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// --- QUEST INTERACTIONS ---

// Add a new quest
function addNewQuest(title, subject, dueIsoString, difficulty, notes) {
    const newQuest = {
        id: 'quest-' + Date.now() + Math.random().toString(36).substr(2, 4),
        title,
        subject,
        due: dueIsoString,
        difficulty: parseInt(difficulty),
        notes,
        completed: false,
        completedAt: null
    };
    
    state.quests.push(newQuest);
    saveState();
    updateUI();
    
    setMascotExpression('idle');
    speakMascot(`新しいクエスト「${title}」を引き受けたよ！頑張ろう！`);
    playSound('click');

    // Notification on quest accept
    if (state.notifications.enabled && state.notifications.notifyAction) {
        sendNotification(`⚔️ クエスト受注: ${title}`, {
            body: `科目: ${getSubjectDisplayName(subject)} | 期限までに攻略しよう！`
        });
    }
}

// Helper to get subject display name
function getSubjectDisplayName(subject) {
    switch(subject) {
        case 'japanese': return '📖 国語';
        case 'math': return '📐 数学';
        case 'english': return '🔤 英語';
        case 'science': return '🧪 理科';
        case 'social': return '🌍 社会';
        default: return '✨ その他';
    }
}

// Complete a quest
function completeQuest(id, clickX, clickY) {
    const questIdx = state.quests.findIndex(q => q.id === id);
    if (questIdx === -1) return;
    
    const quest = state.quests[questIdx];
    quest.completed = true;
    quest.completedAt = new Date().toISOString();
    
    // Reward calculation
    const expReward = quest.difficulty * 15;
    const coinReward = quest.difficulty * 5;
    
    state.coins += coinReward;
    
    // Play Sound & visual effects
    playSound('success');
    startConfetti(clickX || window.innerWidth / 2, clickY || window.innerHeight / 2);
    
    // Show Mascot excitement
    setMascotExpression('happy');
    const happyQuotes = MascotPhrases.happy;
    const randomHappy = happyQuotes[Math.floor(Math.random() * happyQuotes.length)];
    speakMascot(`「${quest.title}」を攻略！+${expReward} EXP, +${coinReward} コイン獲得！`);
    
    // Add EXP and Level Up Check
    addExp(expReward);
    
    saveState();
    updateUI();
    
    // Mascot returns to dynamic expression after 4.5 seconds
    setTimeout(() => {
        updateMascotState();
    }, 4500);

    // Notification on quest complete
    if (state.notifications.enabled && state.notifications.notifyAction) {
        sendNotification(`🏆 クエストクリア！`, {
            body: `「${quest.title}」を攻略しました！お見事！`
        });
    }
}

// Delete completed quest history
function deleteQuest(id) {
    state.quests = state.quests.filter(q => q.id !== id);
    // Clean up notifications log for this quest
    if (state.notifications.sent) {
        const suffixes = ['-24h', '-3h', '-1h', '-overdue'];
        suffixes.forEach(suffix => {
            delete state.notifications.sent[id + suffix];
        });
    }
    saveState();
    playSound('delete');
    updateUI();
}

// Clear all completed quests
elements.btnClearCompleted.addEventListener('click', () => {
    if (confirm("クリア済みのクエスト履歴をすべて消去しますか？（現在の未完了クエストには影響しません）")) {
        const completedIds = state.quests.filter(q => q.completed).map(q => q.id);
        state.quests = state.quests.filter(q => !q.completed);
        if (state.notifications.sent) {
            completedIds.forEach(id => {
                const suffixes = ['-24h', '-3h', '-1h', '-overdue'];
                suffixes.forEach(suffix => {
                    delete state.notifications.sent[id + suffix];
                });
            });
        }
        saveState();
        playSound('delete');
        updateUI();
    }
});


// --- LOAD ANALYSIS METER ---
function updateLoadAnalysis(counts) {
    const activeAndUrgent = counts.urgent + counts.active;
    const totalUncompleted = counts.urgent + counts.active + counts.safe;
    
    elements.statCompletedCount.textContent = `${state.quests.filter(q => q.completed).length} 件`;
    elements.statUrgentCount.textContent = `${counts.urgent} 件`;
    
    // Calculate total weight of incomplete items
    let totalWeight = 0;
    state.quests.forEach(q => {
        if (!q.completed) {
            // Urgent gets higher weight, safe gets lower
            const timeLeftMs = new Date(q.due) - new Date();
            let multiplier = 1.0;
            if (timeLeftMs <= 24 * 60 * 60 * 1000) multiplier = 2.0; // Urgent
            else if (timeLeftMs <= 72 * 60 * 60 * 1000) multiplier = 1.3; // Active
            else multiplier = 0.6; // Safe
            
            totalWeight += q.difficulty * multiplier;
        }
    });
    
    // Let's normalize load: 8 weight points represent 100% full load
    const loadPercentage = Math.min(Math.round((totalWeight / 8) * 100), 100);
    
    // Animate meter
    elements.loadPercent.textContent = loadPercentage;
    
    // Gauge Path Length is 126.
    // 0% load = 126 dashoffset (fully empty)
    // 100% load = 0 dashoffset (fully filled)
    const dashoffset = 126 - (126 * loadPercentage) / 100;
    elements.loadGaugeFill.style.strokeDashoffset = dashoffset;
    
    // Descriptive status message based on percentage
    let statusText = '';
    if (totalUncompleted === 0) {
        statusText = "現在未完了のクエストはありません。のんびり過ごそう！";
    } else if (loadPercentage <= 30) {
        statusText = "負荷は軽めです。今のうちに片付けておくと楽になるよ！";
    } else if (loadPercentage <= 65) {
        statusText = "課題が少し溜まってきました。進行中クエストから計画的に崩そう！";
    } else {
        statusText = "警告！非常に高負荷な状態です！優先度の高いクエストから手分けして片付けよう！";
    }
    
    elements.loadStatusDesc.textContent = statusText;
}


// --- MODAL & FORM CONTROLS ---

// Open Modal
elements.btnOpenModal.addEventListener('click', () => {
    playSound('click');
    elements.questModal.classList.remove('hidden');
    // Set default custom date to tomorrow same time
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setMinutes(tomorrow.getMinutes() - tomorrow.getTimezoneOffset());
    elements.questDue.value = tomorrow.toISOString().slice(0, 16);
    
    // Select Custom by default in JS/CSS
    selectDuePreset('custom');
});

// Close Modal
function closeModal() {
    elements.questModal.classList.add('hidden');
    elements.questForm.reset();
}

elements.btnCloseModal.addEventListener('click', () => {
    playSound('click');
    closeModal();
});
elements.btnCancel.addEventListener('click', () => {
    playSound('click');
    closeModal();
});

// Close modal if clicking outside content
elements.questModal.addEventListener('click', (e) => {
    if (e.target === elements.questModal) {
        closeModal();
    }
});

// Preset Dates Engine
function selectDuePreset(presetValue) {
    elements.duePresets.forEach(btn => {
        if (btn.dataset.preset === presetValue) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const now = new Date();
    
    if (presetValue === 'custom') {
        elements.customDateContainer.style.display = 'block';
        elements.questDue.required = true;
    } else {
        elements.customDateContainer.style.display = 'none';
        elements.questDue.required = false;
        
        let presetDate = new Date();
        
        if (presetValue === 'today') {
            presetDate.setHours(23, 59, 0, 0);
        } else if (presetValue === 'tomorrow') {
            presetDate.setDate(presetDate.getDate() + 1);
            presetDate.setHours(23, 59, 0, 0);
        } else if (presetValue === 'weekend') {
            // Get Sunday of current week
            const day = presetDate.getDay();
            const distance = (7 - day) % 7; // Sunday is index 0
            presetDate.setDate(presetDate.getDate() + (distance === 0 ? 7 : distance));
            presetDate.setHours(23, 59, 0, 0);
        }
        
        // Adjust timezone offset
        presetDate.setMinutes(presetDate.getMinutes() - presetDate.getTimezoneOffset());
        elements.questDue.value = presetDate.toISOString().slice(0, 16);
    }
}

// Preset buttons event listener
elements.duePresets.forEach(button => {
    button.addEventListener('click', (e) => {
        playSound('click');
        const preset = e.target.dataset.preset;
        selectDuePreset(preset);
    });
});

// Form Submit
elements.questForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const title = document.getElementById('quest-title').value.trim();
    const subject = document.querySelector('input[name="subject"]:checked').value;
    const dueVal = elements.questDue.value;
    const difficulty = document.querySelector('input[name="difficulty"]:checked').value;
    const notes = document.getElementById('quest-notes').value.trim();
    
    if (!title || !dueVal) return;
    
    // Create local ISO string from datetime-local value
    const localDate = new Date(dueVal);
    
    addNewQuest(title, subject, localDate.toISOString(), difficulty, notes);
    closeModal();
});


// --- COLLAPSE COMPLETED SECTION ---
elements.toggleCompleted.addEventListener('click', () => {
    playSound('click');
    elements.toggleCompleted.classList.toggle('collapsed');
    elements.completedContainer.classList.toggle('hidden');
});


// --- NOTIFICATION ENGINE ---

// Register Service Worker
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(reg => {
                console.log('Service Worker registered successfully:', reg);
            })
            .catch(err => {
                console.error('Service Worker registration failed:', err);
            });
    }
}

// Helper to send browser notification
function sendNotification(title, options = {}) {
    if (!state.notifications.enabled || Notification.permission !== 'granted') return;

    const defaultOptions = {
        icon: 'favicon.ico',
        badge: 'favicon.ico',
        tag: 'taskquest-notification',
        renotify: true,
        vibrate: [200, 100, 200]
    };

    const combinedOptions = Object.assign({}, defaultOptions, options);

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(title, combinedOptions);
        }).catch(err => {
            new Notification(title, combinedOptions);
        });
    } else {
        new Notification(title, combinedOptions);
    }
}

// Check uncompleted quests and trigger notifications
function checkDueQuestsAndNotify() {
    if (!state.notifications.enabled || Notification.permission !== 'granted') return;

    const now = new Date();
    let stateChanged = false;

    // Ensure state.notifications.sent exists
    if (!state.notifications.sent) {
        state.notifications.sent = {};
    }

    state.quests.forEach(quest => {
        if (quest.completed) return;

        const dueTime = new Date(quest.due);
        const timeLeftMs = dueTime - now;

        // Thresholds
        const oneHour = 1 * 60 * 60 * 1000;
        const threeHours = 3 * 60 * 60 * 1000;
        const twentyFourHours = 24 * 60 * 60 * 1000;

        // Overdue check
        if (timeLeftMs <= 0) {
            const key = `${quest.id}-overdue`;
            if (!state.notifications.sent[key]) {
                sendNotification(`🚨 クエスト失敗！(期限切れ)`, {
                    body: `「${quest.title}」の提出期限が切れました。急いで対応してください！🛡️`
                });
                state.notifications.sent[key] = true;
                // Mark earlier thresholds as sent so we don't retroactively trigger them
                state.notifications.sent[`${quest.id}-1h`] = true;
                state.notifications.sent[`${quest.id}-3h`] = true;
                state.notifications.sent[`${quest.id}-24h`] = true;
                stateChanged = true;
            }
        }
        // Under 1 hour check
        else if (timeLeftMs <= oneHour) {
            if (state.notifications.notify1h) {
                const key = `${quest.id}-1h`;
                if (!state.notifications.sent[key]) {
                    sendNotification(`⏱️ 直前警告！あと1時間`, {
                        body: `クエスト「${quest.title}」の期限まで残り1時間です！急いで攻略せよ！⚔️`
                    });
                    state.notifications.sent[key] = true;
                    // Mark earlier thresholds as sent
                    state.notifications.sent[`${quest.id}-3h`] = true;
                    state.notifications.sent[`${quest.id}-24h`] = true;
                    stateChanged = true;
                }
            }
        }
        // Under 3 hours check
        else if (timeLeftMs <= threeHours) {
            if (state.notifications.notify3h) {
                const key = `${quest.id}-3h`;
                if (!state.notifications.sent[key]) {
                    sendNotification(`⏳ 直前警告！あと3時間`, {
                        body: `クエスト「${quest.title}」の期限まで残り3時間です。計画的に攻略しよう！`
                    });
                    state.notifications.sent[key] = true;
                    // Mark earlier thresholds as sent
                    state.notifications.sent[`${quest.id}-24h`] = true;
                    stateChanged = true;
                }
            }
        }
        // Under 24 hours check
        else if (timeLeftMs <= twentyFourHours) {
            if (state.notifications.notify24h) {
                const key = `${quest.id}-24h`;
                if (!state.notifications.sent[key]) {
                    sendNotification(`🚨 緊急警告！あと24時間`, {
                        body: `緊急クエスト発生！「${quest.title}」の期限まで残り24時間です。最優先で攻略せよ！🔥`
                    });
                    state.notifications.sent[key] = true;
                    stateChanged = true;
                }
            }
        }
    });

    if (stateChanged) {
        saveState();
    }
}

// Initialize Notification UI states and event handlers
function initNotificationUI() {
    const toggle = elements.notificationToggle;
    const optionsPanel = elements.notificationOptions;

    // Load initial values from state
    toggle.checked = state.notifications.enabled;
    elements.notify24h.checked = state.notifications.notify24h;
    elements.notify3h.checked = state.notifications.notify3h;
    elements.notify1h.checked = state.notifications.notify1h;
    elements.notifyAction.checked = state.notifications.notifyAction;

    // Set panel disabled class based on status
    if (state.notifications.enabled && Notification.permission === 'granted') {
        optionsPanel.classList.remove('disabled-panel');
    } else {
        optionsPanel.classList.add('disabled-panel');
        toggle.checked = false;
        state.notifications.enabled = false;
        saveState();
    }

    // Toggle Handler
    toggle.addEventListener('change', () => {
        playSound('click');
        if (toggle.checked) {
            // Request Notification Permission
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    state.notifications.enabled = true;
                    optionsPanel.classList.remove('disabled-panel');
                    saveState();
                    
                    // Welcome test notification
                    sendNotification(`🔔 通知が有効になりました！`, {
                        body: `伝書鳩がクエストの期限を監視します。お任せください！🐦`
                    });
                } else {
                    toggle.checked = false;
                    state.notifications.enabled = false;
                    optionsPanel.classList.add('disabled-panel');
                    saveState();
                    alert('通知権限が拒否されました。通知を受け取るにはブラウザの設定から通知を許可してください。');
                }
            });
        } else {
            state.notifications.enabled = false;
            optionsPanel.classList.add('disabled-panel');
            saveState();
        }
    });

    // Checkbox Handlers
    const checkboxes = [
        { elem: elements.notify24h, prop: 'notify24h' },
        { elem: elements.notify3h, prop: 'notify3h' },
        { elem: elements.notify1h, prop: 'notify1h' },
        { elem: elements.notifyAction, prop: 'notifyAction' }
    ];

    checkboxes.forEach(item => {
        item.elem.addEventListener('change', () => {
            playSound('click');
            state.notifications[item.prop] = item.elem.checked;
            saveState();
        });
    });

    // Test Button Handler
    elements.btnTestNotification.addEventListener('click', () => {
        playSound('click');
        // Instantly trigger a fun test notification
        const randomPhrases = [
            "テスト通知に成功したよ！冒険の準備はオッケー？⚔️",
            "クルックー！伝書鳩は今日も元気に稼働中！🐦",
            "通知のテスト完了！これで大事なクエストを見逃さないね！🌟",
            "タスクンからのメッセージ！今日も一緒にクエストを倒そう！🤖"
        ];
        const text = randomPhrases[Math.floor(Math.random() * randomPhrases.length)];
        sendNotification("🔔 伝書鳩テスト通知", {
            body: text
        });
    });
}


// --- INITIALIZATION ---
function updateUI() {
    updateStatsBar();
    renderQuestCards();
    updateMascotState();
}

function init() {
    loadState();
    registerServiceWorker(); // Register Service Worker
    updateUI();
    initNotificationUI();   // Initialize Notification UI
    startMascotInterval();
    checkDueQuestsAndNotify(); // Initial check on load
    
    // Sound Toggle Handler
    elements.soundToggle.addEventListener('click', () => {
        state.soundOn = !state.soundOn;
        saveState();
        
        if (state.soundOn) {
            elements.soundOnIcon.classList.remove('hidden');
            elements.soundOffIcon.classList.add('hidden');
            playSound('click');
        } else {
            elements.soundOnIcon.classList.add('hidden');
            elements.soundOffIcon.classList.remove('hidden');
        }
    });
    
    // Initialize sound toggler UI based on state
    if (state.soundOn) {
        elements.soundOnIcon.classList.remove('hidden');
        elements.soundOffIcon.classList.add('hidden');
    } else {
        elements.soundOnIcon.classList.add('hidden');
        elements.soundOffIcon.classList.remove('hidden');
    }
    
    // App reset button handler
    elements.btnResetApp.addEventListener('click', () => {
        if (confirm("アプリを初期化しますか？すべてのクエスト情報とプレイヤーのレベルがリセットされます。")) {
            resetToDefault();
            playSound('delete');
        }
    });

    // Dynamic timer to refresh due times on the dashboard every 30 seconds
    setInterval(() => {
        renderQuestCards();
        checkDueQuestsAndNotify(); // Run notification checks every 30 seconds
    }, 30000);
}

// Boot
window.addEventListener('DOMContentLoaded', init);
