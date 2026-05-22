window.onload = () => {
    // --- UI要素取得 ---
    const container = document.getElementById('three-container');
    const dealBtn = document.getElementById('deal-btn');
    const message = document.getElementById('message');
    const chipsDisp = document.getElementById('chips');
    const rankDisp = document.getElementById('hand-rank');
    const controls = document.getElementById('controls');

    const ruleLayer = document.getElementById('rule-layer');
    const lobbyLayer = document.getElementById('lobby-layer');
    const multiChoiceLayer = document.getElementById('multi-choice-layer');
    const roomStageLayer = document.getElementById('room-stage-layer');
    
    const btnSoloMode = document.getElementById('btn-solo-mode');
    const btnMultiMode = document.getElementById('btn-multi-mode');
    const btnNetMatch = document.getElementById('btn-net-match');
    const btnPrivateMatch = document.getElementById('btn-private-match');
    const btnMultiBack = document.getElementById('btn-multi-back');
    const roomInput = document.getElementById('room-input');
    
    const btnSeat1p = document.getElementById('btn-seat-1p');
    const btnSeat2p = document.getElementById('btn-seat-2p');
    const btnSeatWatch = document.getElementById('btn-seat-watch');
    const btnReady = document.getElementById('btn-ready');
    const btnRoomLeave = document.getElementById('btn-room-leave');
    const status1p = document.getElementById('status-1p');
    const status2p = document.getElementById('status-2p');
    const spectatorCount = document.getElementById('spectator-count');
    const readyStatusMsg = document.getElementById('ready-status-msg');
    const stageTitle = document.getElementById('stage-title');

    // --- リアルタイムマルチ通信 (Socket.io) ---
    const socket = io('http://localhost:3000', { autoConnect: false }); 
    let myRole = null; 
    let isMultiplayMode = false;

    // --- 音声エラー安全クラッシュ対策システム ---
    function createSafeAudio(path, volume = 0.5, loop = false) {
        try {
            const audio = new Audio(path);
            audio.volume = volume;
            audio.loop = loop;
            audio.addEventListener('error', (e) => { console.warn(`音声の読み込みスキップ: ${path}`); });
            return {
                play: () => { audio.play().catch(() => {}); },
                setLoop: (val) => { audio.loop = val; }
            };
        } catch(e) {
            console.error("Audioオブジェクトの生成に失敗", e);
            return { play: () => {}, setLoop: () => {} };
        }
    }

    // 各SEファイルのバインド（大文字・小文字のパスずれ対策込み）
    const drawSound = createSafeAudio('Sound/cardDraw.mp3', 0.4); 
    const daipanSound = createSafeAudio('Sound/daipanSound.mp3', 0.5); 
    // 🚨 ざわざわ.mp3 から fukakukuraiido.mp3 に変更を完全に反映 🚨
    const zawazawaSound = createSafeAudio('Sound/fukakukuraiido.mp3', 0.1, true); 
    const loseSound = createSafeAudio('Sound/loseScreaming.mp3', 0.5); 

    let isAudioStarted = false;
    const startAudio = () => {
        if (isAudioStarted) return;
        zawazawaSound.play();
        isAudioStarted = true;
    };

    // --- ゲームロジック・イカサマ能力用変数 ---
    const INITIAL_CHIPS = 1000;
    let betAmount = 10;
    let isSixCardCheatActive = false;
    let isCpuDebuffActive = false; 
    let isChoiceCheatRequested = false;
    let isDestroyModeActive = false;
    
    let deck = [];
    let gameState = 'START'; 
    let chips = INITIAL_CHIPS;
    let cpuChips = 1000;
    let selectedDifficulty = 'NORMAL'; 

    // --- 3D描画リフレッシュ（真っ白バグ強制粉砕システム） ---
    function setupRealScreenSize() {
        controls.style.display = "block"; 
        setTimeout(() => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
            renderer.setPixelRatio(window.devicePixelRatio);
        }, 100);
    }

    // --- 難易度選択レイヤーの生成（個人部屋用） ---
    const diffLayer = document.createElement('div');
    diffLayer.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background-color: rgba(5, 5, 5, 0.99); display: none; flex-direction: column;
        align-items: center; justify-content: center; z-index: 10001; color: #fff;
    `;
    diffLayer.innerHTML = `
        <div style="width: 90%; max-width: 600px; background: #141d26; padding: 30px; border: 4px solid #e74c3c; border-radius: 12px; text-align: center;">
            <h2 style="font-size: 26px; color: #e74c3c; margin-bottom: 25px;">⚔️ NPCの強さを選択（個人部屋） ⚔️</h2>
            <div style="display: flex; flex-direction: column; gap: 15px;">
                <button id="diff-easy" style="background:#2ecc71; color:white; padding:12px; font-size:18px; font-weight:bold; cursor:pointer; border-radius:6px; border:none; text-align:left;">🟢 EASY (相手: 役確率通常)</button>
                <button id="diff-normal" style="background:#3498db; color:white; padding:12px; font-size:18px; font-weight:bold; cursor:pointer; border-radius:6px; border:none; text-align:left;">🔵 NORMAL (相手: ワンペア以上確定)</button>
                <button id="diff-hard" style="background:#e67e22; color:white; padding:12px; font-size:18px; font-weight:bold; cursor:pointer; border-radius:6px; border:none; text-align:left;">🟠 HARD (相手: ストレート以上確定)</button>
                <button id="diff-hell" style="background:#9b59b6; color:white; padding:12px; font-size:18px; font-weight:bold; cursor:pointer; border-radius:6px; border:none; text-align:left;">😈 HELL (相手: フルハウス以上確定)</button>
            </div>
        </div>
    `;
    document.body.appendChild(diffLayer);

    // --- ルール・モーダルフロー制御 ---
    ruleLayer.style.display = 'flex';

    document.getElementById('game-start-btn').onclick = () => {
        ruleLayer.style.display = 'none'; 
        lobbyLayer.style.display = 'flex'; 
        startAudio();                     
    };

    btnSoloMode.onclick = () => {
        isMultiplayMode = false;
        lobbyLayer.style.display = 'none';
        diffLayer.style.display = 'flex'; 
    };

    btnMultiMode.onclick = () => {
        isMultiplayMode = true;
        lobbyLayer.style.display = 'none';
        multiChoiceLayer.style.display = 'flex'; 
        socket.connect(); 
    };

    btnMultiBack.onclick = () => {
        multiChoiceLayer.style.display = 'none';
        lobbyLayer.style.display = 'flex';
        socket.disconnect();
    };

    btnNetMatch.onclick = () => {
        stageTitle.innerText = "🌐 マッチング検索中...";
        multiChoiceLayer.style.display = 'none';
        roomStageLayer.style.display = 'flex';
        resetSeatUI();
        socket.emit('join-matchmaking');
    };

    btnPrivateMatch.onclick = () => {
        const roomId = roomInput.value.trim();
        if (!roomId) { alert("部屋番号を指定してください"); return; }
        stageTitle.innerText = `🔒 ルーム: ${roomId} 待機室`;
        multiChoiceLayer.style.display = 'none';
        roomStageLayer.style.display = 'flex';
        resetSeatUI();
        socket.emit('join-private-room', roomId);
    };

    btnRoomLeave.onclick = () => {
        roomStageLayer.style.display = 'none';
        multiChoiceLayer.style.display = 'flex';
        socket.emit('leave-room');
    };

    function resetSeatUI() {
        btnSeat1p.disabled = false; btnSeat1p.style.opacity = "1";
        btnSeat2p.disabled = false; btnSeat2p.style.opacity = "1";
        btnSeatWatch.disabled = false; btnReady.style.display = "none";
        readyStatusMsg.innerText = "席を選択してください";
    }

    // --- 座席同期・マルチ連携 ---
    btnSeat1p.onclick = () => { socket.emit('claim-seat', '1P'); };
    btnSeat2p.onclick = () => { socket.emit('claim-seat', '2P'); };
    btnSeatWatch.onclick = () => { socket.emit('claim-seat', 'spectator'); };

    btnReady.onclick = () => {
        socket.emit('player-ready');
        btnReady.style.display = "none";
        readyStatusMsg.innerText = "⏳ 相手の準備完了を待っています...";
    };

    socket.on('room-update', (data) => {
        status1p.innerText = data.player1 ? `満席 [${data.p1Ready ? "READY" : "未完了"}]` : "空席";
        status2p.innerText = data.player2 ? `満席 [${data.p2Ready ? "READY" : "未完了"}]` : "空席";
        spectatorCount.innerText = `観戦者数: ${data.specs}人`;

        if (myRole !== '1P') { btnSeat1p.disabled = !!data.player1; btnSeat1p.style.opacity = data.player1 ? "0.4" : "1"; }
        if (myRole !== '2P') { btnSeat2p.disabled = !!data.player2; btnSeat2p.style.opacity = data.player2 ? "0.4" : "1"; }
    });

    socket.on('seat-assigned', (role) => {
        myRole = role;
        if (role === 'spectator') {
            readyStatusMsg.innerText = "👁️ 観戦モードとして接続中。";
            btnReady.style.display = "none";
        } else {
            readyStatusMsg.innerText = `あなたの座席: ${role}`;
            btnReady.style.display = "block";
        }
    });

    socket.on('game-start-signal', (gameData) => {
        roomStageLayer.style.display = 'none';
        message.innerText = `マルチプレイ対戦スタート！ 役割: ${myRole}`;
        setupRealScreenSize(); 
    });

    // 個人部屋 開始トリガー
    const selectDiffAndStart = (diff, label) => {
        selectedDifficulty = diff;
        diffLayer.style.display = 'none'; 
        message.innerText = `個人部屋 (VS NPC: ${label}) 開始！「配る」を押してください。`;
        setupRealScreenSize(); 
    };
    
    document.getElementById('diff-easy').onclick = () => selectDiffAndStart('EASY', 'イージー');
    document.getElementById('diff-normal').onclick = () => selectDiffAndStart('NORMAL', 'ノーマル');
    document.getElementById('diff-hard').onclick = () => selectDiffAndStart('HARD', 'ハード');
    document.getElementById('diff-hell').onclick = () => selectDiffAndStart('HELL', 'ヘル');

    // --- チート機能UI ---
    const cheatContainer = document.createElement('div');
    cheatContainer.style.cssText = 'margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; z-index: 101; position: relative; pointer-events: auto;';
    cheatContainer.innerHTML = `
        <button id="cheat-six" style="background:#e74c3c; color:white; border:none; padding:6px 12px; font-weight:bold; border-radius:4px; cursor:pointer;">🔮 6枚手札化(コスト50)</button>
        <button id="cheat-debuff" style="background:#9b59b6; color:white; border:none; padding:6px 12px; font-weight:bold; border-radius:4px; cursor:pointer;">🌀 敵能力封印(コスト30)</button>
        <button id="cheat-choice" style="background:#f1c40f; color:#000; border:none; padding:6px 12px; font-weight:bold; border-radius:4px; cursor:pointer;">🃏 カード選択(コスト40)</button>
        <button id="cheat-destroy" style="background:#000; color:#e74c3c; border:2px solid #e74c3c; padding:6px 12px; font-weight:bold; border-radius:4px; cursor:pointer;">💥 世界破壊(コスト100)</button>
    `;
    document.getElementById('controls').appendChild(cheatContainer);

    document.getElementById('cheat-six').onclick = () => {
        if(chips >= 50) { chips -= 50; chipsDisp.innerText = chips; isSixCardCheatActive = true; message.innerText = "チート発動：手札が6枚になります！"; daipanSound.play(); }
        else { message.innerText = "チップが足りません！"; }
    };
    document.getElementById('cheat-debuff').onclick = () => {
        if(chips >= 30) { chips -= 30; chipsDisp.innerText = chips; isCpuDebuffActive = true; message.innerText = "チート発動：敵の確定役を解除します！"; }
        else { message.innerText = "チップが足りません！"; }
    };
    document.getElementById('cheat-choice').onclick = () => {
        if(chips >= 40) { chips -= 40; chipsDisp.innerText = chips; isChoiceCheatRequested = true; message.innerText = "チート発動：次の交換時に好きなカードを選択可能！"; }
        else { message.innerText = "チップが足りません！"; }
    };
    document.getElementById('cheat-destroy').onclick = () => {
        if(chips >= 100) { chips -= 100; chipsDisp.innerText = chips; isDestroyModeActive = true; message.innerText = "禁忌発動：ディーラーの全チップを消し去る...！"; loseSound.play(); }
        else { message.innerText = "コストが足りません！"; }
    };

    // --- BET金額変更UI ---
    const uiContainer = document.createElement('div');
    uiContainer.style.cssText = 'color: #f1c40f; margin-top: 5px; font-size: 14px; text-shadow: 1px 1px 2px black;';
    uiContainer.innerHTML = `
        <div style="margin-bottom:6px; display: flex; align-items: center; justify-content: center; gap: 10px;">
            <button id="bet-minus" style="padding: 4px 10px; background:#2c3e50; color:white; border:1px solid #f1c40f; border-radius:4px; cursor:pointer;">-10</button>
            <span style="font-size: 16px; font-weight:bold;">BET: <span id="current-bet">10</span></span>
            <button id="bet-plus" style="padding: 4px 10px; background:#2c3e50; color:white; border:1px solid #f1c40f; border-radius:4px; cursor:pointer;">+10</button>
        </div>
    `;
    document.getElementById('controls').insertBefore(uiContainer, cheatContainer);
    const currentBetDisp = document.getElementById('current-bet');

    document.getElementById('bet-minus').onclick = () => { if(betAmount > 10) { betAmount -= 10; currentBetDisp.innerText = betAmount; } };
    document.getElementById('bet-plus').onclick = () => { if(betAmount < 500 && betAmount < chips) { betAmount += 10; currentBetDisp.innerText = betAmount; } };

    // --- 「配る」ボタン動作 ---
    dealBtn.onclick = () => {
        if (gameState === 'START' || gameState === 'RESULT') {
            message.innerText = "カードを配布中...";
            drawSound.play();
            gameState = 'CHOICE';
            dealBtn.innerText = "交換確定";
        } else if (gameState === 'CHOICE') {
            message.innerText = "勝負判定中...";
            gameState = 'RESULT';
            dealBtn.innerText = "配る";
        }
    };

    // --- ディーラーのチップ表示 ---
    const cpuDisp = document.createElement('div');
    cpuDisp.style.cssText = 'position: absolute; top: 20px; left: 50%; transform: translateX(-50%); color: #e74c3c; font-size: 24px; font-weight: bold; text-shadow: 2px 2px 4px black; z-index: 10;';
    cpuDisp.innerHTML = `DEALER CHIPS: <span id="cpu-chips">${cpuChips}</span>`;
    document.body.appendChild(cpuDisp);

    // --- Three.js 3D レンダラー ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020202);
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 4, 5); camera.lookAt(0, -1, 0);
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);
    
    scene.add(new THREE.AmbientLight(0x555555));
    const ml = new THREE.SpotLight(0xffffff, 30); ml.position.set(0, 8, 2); scene.add(ml);
    const tc = new THREE.Mesh(new THREE.BoxGeometry(20, 0.2, 12), new THREE.MeshStandardMaterial({ color: 0x074324 }));
    tc.position.y = -1.1; scene.add(tc);

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    function animate(time) { 
        requestAnimationFrame(animate); 
        TWEEN.update(time); 
        renderer.render(scene, camera); 
    }
    animate();
};