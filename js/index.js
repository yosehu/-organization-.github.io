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
    
    const btnReady = document.getElementById('btn-ready');
    const btnRoomLeave = document.getElementById('btn-room-leave');
    const status1p = document.getElementById('status-1p');
    const status2p = document.getElementById('status-2p');
    const spectatorCount = document.getElementById('spectator-count');
    const readyStatusMsg = document.getElementById('ready-status-msg');
    const stageTitle = document.getElementById('stage-title');

    // --- 🌐 Photon Realtime 通信設定 🌐 ---
    // ⚠️ 下記の 'YOUR_PHOTON_APP_ID' を、あなたがPhotonで取得した実際のAppIDに書き換えてください。
    const PHOTON_APP_ID = "20cf626f-e202-4acb-9491-e9f0f8a2a316"; 
    const photonClient = new Photon.LoadBalancing.LoadBalancingClient(
        Photon.LoadBalancing.Constants.ConnectionProtocol.Wss, 
        PHOTON_APP_ID, 
        "1.0"
    );

    let myRole = null; 
    let isMultiplayMode = false;
    let opponentReady = false;
    let myReady = false;

    // Photon コールバックイベント定義
    photonClient.onStateChange = (state) => {
        console.log("Photon 状態変更:", state);
    };

    // ルーム入室成功時
    photonClient.onActorJoin = (actor) => {
        const room = photonClient.myRoom();
        spectatorCount.innerText = `現在の接続人数: ${room.actorCount}人`;
        
        if (actor.isLocal) {
            // 自分が1番目なら1P、2番目なら2P
            myRole = (room.actorCount === 1) ? '1P' : '2P';
            readyStatusMsg.innerText = `あなたの座席: ${myRole} (待機中)`;
        }

        status1p.innerText = "接続済み";
        status2p.innerText = (room.actorCount >= 2) ? "満席 (接続済み)" : "空席 (対戦相手を待っています)";

        // 2人揃ったら準備完了ボタンを有効化
        if (room.actorCount >= 2) {
            btnReady.disabled = false;
            if(!myReady) readyStatusMsg.innerText = "対戦相手が来ました！準備完了を押してください。";
        } else {
            btnReady.disabled = true;
            readyStatusMsg.innerText = "対戦相手の入室を待っています...";
        }
    };

    // 誰かが退出したとき
    photonClient.onActorLeave = (actor) => {
        const room = photonClient.myRoom();
        spectatorCount.innerText = `現在の接続人数: ${room ? room.actorCount : 0}人`;
        status2p.innerText = "空席 (退出しました)";
        readyStatusMsg.innerText = "相手が退出しました。対戦相手を待っています...";
        btnReady.disabled = true;
        opponentReady = false;
    };

    // 相手からのリアルタイムパケット通信を受信したとき
    photonClient.onEvent = (code, content, actorNr) => {
        // イベントコード 1: 準備完了通知
        if (code === 1) {
            opponentReady = content.isReady;
            if (myRole === '1P') status2p.innerText = "満席 [READY]";
            if (myRole === '2P') status1p.innerText = "接続済み [READY]";
            
            checkGameStartTrigger();
        }
    };

    function checkGameStartTrigger() {
        if (myReady && opponentReady) {
            roomStageLayer.style.display = 'none';
            message.innerText = `マルチプレイ対戦スタート！ 役割: ${myRole}`;
            setupRealScreenSize();
        }
    }

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

    const drawSound = createSafeAudio('sound/cardDraw.mp3', 0.4); 
    const daipanSound = createSafeAudio('sound/daipanSound.mp3', 0.5); 
    const zawazawaSound = createSafeAudio('sound/fukakukuraiido.mp3', 0.1, true); 
    const loseSound = createSafeAudio('sound/loseScreaming.mp3', 0.5); 

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

    // --- 3D描画リフレッシュシステム ---
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
        
        // Photonサーバーの日本地域(jp)に接続
        if (!photonClient.isInLobby()) {
            photonClient.connectToRegionMaster("jp");
        }
    };

    btnMultiBack.onclick = () => {
        multiChoiceLayer.style.display = 'none';
        lobbyLayer.style.display = 'flex';
        photonClient.disconnect();
    };

    // インターネット対戦（ランダムマッチング）
    btnNetMatch.onclick = () => {
        stageTitle.innerText = "🌐 マッチング検索中...";
        multiChoiceLayer.style.display = 'none';
        roomStageLayer.style.display = 'flex';
        resetSeatUI();
        
        // 空いている部屋を自動検索して入室、なければ自動作成
        photonClient.joinRandomOrCreateRoom();
    };

    // プライベートマッチング（部屋番号指定）
    btnPrivateMatch.onclick = () => {
        const roomId = roomInput.value.trim();
        if (!roomId) { alert("部屋番号を指定してください"); return; }
        stageTitle.innerText = `🔒 ルーム: ${roomId} 待機室`;
        multiChoiceLayer.style.display = 'none';
        roomStageLayer.style.display = 'flex';
        resetSeatUI();
        
        // 指定されたカスタムルームに入室 or 作成
        photonClient.joinOrCreateRoom(roomId);
    };

    btnRoomLeave.onclick = () => {
        roomStageLayer.style.display = 'none';
        multiChoiceLayer.style.display = 'flex';
        photonClient.leaveRoom();
    };

    function resetSeatUI() {
        btnReady.style.display = "block";
        btnReady.disabled = true;
        myReady = false;
        opponentReady = false;
        readyStatusMsg.innerText = "Photonクラウドに接続中...";
    }

    // 「準備完了」ボタン送信
    btnReady.onclick = () => {
        myReady = true;
        btnReady.style.display = "none";
        readyStatusMsg.innerText = "⏳ 对戦相手がREADYになるのを待っています...";
        
        if (myRole === '1P') status1p.innerText = "接続済み [READY]";
        if (myRole === '2P') status2p.innerText = "満席 [READY]";

        // イベントコード 1番 で相手に準備完了をブロードキャスト転送
        photonClient.raiseEvent(1, { isReady: true });
        checkGameStartTrigger();
    };

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