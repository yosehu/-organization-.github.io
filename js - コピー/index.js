window.onload = () => {
    const container = document.getElementById('three-container');
    const dealBtn = document.getElementById('deal-btn');
    const message = document.getElementById('message');
    const chipsDisp = document.getElementById('chips');
    const rankDisp = document.getElementById('hand-rank');

    // --- 効果音 ---
    const drawSound = new Audio('Sound/cardDraw.mp3'); 
    const daipanSound = new Audio('Sound/daipanSound.mp3'); 
    const zawazawaSound = new Audio('Sound/ざわざわ.mp3'); 
    const loseSound = new Audio('Sound/loseScreaming.mp3'); 
    
    zawazawaSound.loop = true;
    zawazawaSound.volume = 0.2; 
    drawSound.volume = 0.4;

    let isAudioStarted = false;
    const startAudio = () => {
        if (isAudioStarted) return;
        zawazawaSound.play().then(() => { isAudioStarted = true; }).catch(() => {});
    };

    // --- 状態管理 ---
    const INITIAL_CHIPS = 100;
    let betAmount = 10;
    let isSixCardCheatActive = false;
    let isCpuDebuffActive = false; 
    let isChoiceCheatRequested = false;
    let isDestroyModeActive = false;
    
    let deck = [];
    let gameState = 'START'; 
    let chips = INITIAL_CHIPS;
    let cpuChips = 1000;
    let selectedDifficulty = 'NORMAL'; // デフォルトの難易度

    // --- 難易度選択レイヤーの生成 ---
    const diffLayer = document.createElement('div');
    diffLayer.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background-color: rgba(5, 5, 5, 0.99);
        display: none; flex-direction: column; align-items: center; justify-content: center;
        z-index: 10001; color: #fff;
        font-family: "Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Segoe UI", sans-serif;
        padding: 20px; box-sizing: border-box;
    `;
    diffLayer.innerHTML = `
        <div style="width: 100%; max-width: 900px; background: #141d26; padding: 40px; border: 5px solid #e74c3c; border-radius: 15px; box-shadow: 0 0 50px rgba(231,76,60,0.5); text-align: center;">
            <h2 style="font-size: 46px; color: #e74c3c; margin: 0 0 30px 0; text-shadow: 3px 3px 6px black; font-weight: bold; letter-spacing: 2px;">⚔️ 難易度を選択してください ⚔️</h2>
            
            <div style="display: flex; flex-direction: column; gap: 20px; margin-bottom: 30px;">
                <button id="diff-easy" style="background: #2ecc71; color: white; border: 3px solid #fff; padding: 20px; font-size: 26px; font-weight: bold; cursor: pointer; border-radius: 10px; text-align: left; display: flex; align-items: center; justify-content: space-between; transition: 0.2s;">
                    <span>🟢 EASY (イージー)</span>
                    <span style="font-size: 18px; color: #dfd;">相手：通常と同じ（完全にランダムな役発生）</span>
                </button>
                
                <button id="diff-normal" style="background: #3498db; color: white; border: 3px solid #fff; padding: 20px; font-size: 26px; font-weight: bold; cursor: pointer; border-radius: 10px; text-align: left; display: flex; align-items: center; justify-content: space-between; transition: 0.2s;">
                    <span>🔵 NORMAL (ノーマル)</span>
                    <span style="font-size: 18px; color: #dff;">相手：必ず「ワンペア以上」の役を出す</span>
                </button>
                
                <button id="diff-hard" style="background: #e67e22; color: white; border: 3px solid #fff; padding: 20px; font-size: 26px; font-weight: bold; cursor: pointer; border-radius: 10px; text-align: left; display: flex; align-items: center; justify-content: space-between; transition: 0.2s;">
                    <span>🟠 HARD (ハード)</span>
                    <span style="font-size: 18px; color: #fde;">相手：必ず「ストレート以上」の強烈な役を出す</span>
                </button>
                
                <button id="diff-hell" style="background: #9b59b6; color: white; border: 3px solid #fff; padding: 20px; font-size: 26px; font-weight: bold; cursor: pointer; border-radius: 10px; text-align: left; display: flex; align-items: center; justify-content: space-between; transition: 0.2s;">
                    <span>😈 HELL (ヘル)</span>
                    <span style="font-size: 18px; color: #fdf;">相手：必ず「フルハウス以上」の絶望的な役を出す</span>
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(diffLayer);

    // --- フルスクリーンルール説明レイヤー ---
    const ruleLayer = document.createElement('div');
    ruleLayer.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background-color: rgba(10, 10, 10, 0.98);
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        z-index: 10000; color: #f1c40f; 
        font-family: "Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Segoe UI", sans-serif;
        padding: 5px; box-sizing: border-box; text-align: center;
    `;

    const getCardImgsHtml = (arr) => {
        return `<div style="display: flex; gap: 5px; justify-content: flex-start; margin-top: 8px;">
            ${arr.map(img => `<img src="images/${img}" style="width: 65px; height: auto; border: 2px solid #fff; border-radius: 6px; box-shadow: 2px 2px 6px rgba(0,0,0,0.6);">`).join('')}
        </div>`;
    };

    // 説明文の倍率設定を新しい指定に合わせて修正
    ruleLayer.innerHTML = `
        <div style="width: 100%; height: 100vh; background: #1a252f; padding: 15px; border: 5px solid #f1c40f; box-shadow: 0 0 40px rgba(0,0,0,0.9); box-sizing: border-box; display: flex; flex-direction: column;">
            
            <h1 style="font-size: 42px; margin: 0 0 15px 0; text-shadow: 4px 4px 8px black; font-weight: bold; letter-spacing: 3px;">◆ 遊び方 ＆ ルール説明 ◆</h1>
            
            <div style="display: flex; gap: 15px; flex: 1; min-height: 0; text-align: left;">
                
                <div style="flex: 1.1; display: flex; flex-direction: column; background: #0f171e; border: 2px solid #34495e; border-radius: 8px; padding: 20px; color: #fff; font-size: 20px; overflow-y: auto; line-height: 1.8;">
                    <h3 style="color: #f1c40f; margin-top: 0; font-size: 28px; border-bottom: 3px solid #f1c40f; padding-bottom: 8px; margin-bottom: 15px; font-weight: bold;">🎮 ゲームの操作方法</h3>
                    <p style="margin-bottom: 12px;"><strong>1. ベット額の設定:</strong> 画面下の「+10」「-10」ボタンで賭け金を調整（上限500チップ）。</p>
                    <p style="margin-bottom: 12px;"><strong>2. カードを配る:</strong> 「配る」ボタンを押すとゲームが始まり、自分と相手にカードが配られます。</p>
                    <p style="margin-bottom: 12px;"><strong>3. カードの選択（ホールド）:</strong> 自分の手札をマウスで<strong>左クリック</strong>するとカードが少し浮き上がります。浮いたカードが「交換するカード」になります。</p>
                    <p style="margin-bottom: 12px;"><strong>4. 交換の確定:</strong> 「交換確定」ボタンを押すと選択したカードが引き直され、勝敗判定へ進みます。</p>
                    <p style="margin-bottom: 35px;"><strong>5. チートの発動:</strong> 各フェーズに対応したチートボタンをクリックし、チップを支払うことで発動できます。</p>

                    <h3 style="color: #f1c40f; font-size: 28px; border-bottom: 3px solid #f1c40f; padding-bottom: 8px; margin-bottom: 15px; font-weight: bold;">🃏 イカサマシステム</h3>
                    <p style="margin-bottom: 10px;">・<strong>6枚ドロー(50):</strong> 次の配布で自分だけ手札が6枚になります（最強の5枚を自動判定）。</p>
                    <p style="margin-bottom: 10px;">・<strong>相手制限(50):</strong> 次の配布で相手の手札を3枚に減らし、役の成立を強烈に妨害します。</p>
                    <p style="margin-bottom: 10px;">・<strong>カード破壊(100):</strong> 交換フェーズ中、相手の裏向きカードをクリックして叩き割ることができます。</p>
                    <p style="margin-bottom: 10px;">・<strong>最強交換(150):</strong> 自分が選んだ交換カードのうち、最大2枚まで確実にジョーカーへ変更します。</p>
                </div>
                
                <div style="flex: 1.6; display: flex; flex-direction: column; background: #0f171e; border: 2px solid #34495e; border-radius: 8px; padding: 15px; overflow-y: auto;">
                    <h3 style="color: #f1c40f; margin-top: 0; font-size: 28px; border-bottom: 3px solid #f1c40f; padding-bottom: 8px; margin-bottom: 15px; font-weight: bold;">🏆 ポーカーの役と強さ（上ほど強い）</h3>
                    <table style="width: 100%; border-collapse: collapse; font-size: 22px; color: #fff;">
                        <tr style="background: #2c3e50; color: #f1c40f; font-size: 22px; position: sticky; top: 0; z-index: 1;">
                            <th style="padding: 12px; border: 2px solid #455a64; width: 220px; text-align: center;">役名 / 倍率</th>
                            <th style="padding: 12px; border: 2px solid #455a64; text-align: left;">内容と成立例（画像）</th>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 2px solid #455a64; text-align: center; background: rgba(192, 57, 43, 0.35);"><b>ファイブカード</b><br><span style="color:#f1c40f; font-weight: bold; font-size: 24px;">10倍</span></td>
                            <td style="padding: 12px; border: 2px solid #455a64; line-height: 1.5;">
                                同じ数字4枚 ＋ ジョーカーなどの組み合わせ
                                ${getCardImgsHtml(['s1.png', 'h1.png', 'd1.png', 'c1.png', 'joker.png'])}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 2px solid #455a64; text-align: center;"><b>ロイヤルSF</b><br><span style="color:#f1c40f; font-weight: bold; font-size: 24px;">9倍</span></td>
                            <td style="padding: 12px; border: 2px solid #455a64; line-height: 1.5;">
                                同じマークの「10・J・Q・K・A」
                                ${getCardImgsHtml(['s10.png', 's11.png', 's12.png', 's13.png', 's1.png'])}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 2px solid #455a64; text-align: center;"><b>ストレートF</b><br><span style="color:#f1c40f; font-weight: bold; font-size: 24px;">8倍</span></td>
                            <td style="padding: 12px; border: 2px solid #455a64; line-height: 1.5;">
                                同じマークで数字が連続している5枚
                                ${getCardImgsHtml(['h5.png', 'h6.png', 'h7.png', 'h8.png', 'h9.png'])}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 2px solid #455a64; text-align: center;"><b>フォーカード</b><br><span style="color:#f1c40f; font-weight: bold; font-size: 24px;">7倍</span></td>
                            <td style="padding: 12px; border: 2px solid #455a64; line-height: 1.5;">
                                同じ数字のカードが4枚揃う
                                ${getCardImgsHtml(['d7.png', 'h7.png', 'c7.png', 's7.png', 's13.png'])}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 2px solid #455a64; text-align: center;"><b>フルハウス</b><br><span style="color:#f1c40f; font-weight: bold; font-size: 24px;">6倍</span></td>
                            <td style="padding: 12px; border: 2px solid #455a64; line-height: 1.5;">
                                同じ数字3枚 ＋ 別の同じ数字2枚
                                ${getCardImgsHtml(['c10.png', 'h10.png', 's10.png', 'd3.png', 's3.png'])}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 2px solid #455a64; text-align: center;"><b>フラッシュ</b><br><span style="color:#f1c40f; font-weight: bold; font-size: 24px;">5倍</span></td>
                            <td style="padding: 12px; border: 2px solid #455a64; line-height: 1.5;">
                                5枚すべてのマーク（絵柄）が同じ
                                ${getCardImgsHtml(['d2.png', 'd5.png', 'd8.png', 'd11.png', 'd13.png'])}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 2px solid #455a64; text-align: center;"><b>ストレート</b><br><span style="color:#f1c40f; font-weight: bold; font-size: 24px;">4倍</span></td>
                            <td style="padding: 12px; border: 2px solid #455a64; line-height: 1.5;">
                                マークに関係なく、5枚の数字が連続している
                                ${getCardImgsHtml(['s3.png', 'h4.png', 'd5.png', 'c6.png', 's7.png'])}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 2px solid #455a64; text-align: center;"><b>スリーカード</b><br><span style="color:#f1c40f; font-weight: bold; font-size: 24px;">3倍</span></td>
                            <td style="padding: 12px; border: 2px solid #455a64; line-height: 1.5;">
                                同じ数字のカードが3枚揃う
                                ${getCardImgsHtml(['h9.png', 'd9.png', 'c9.png', 's1.png', 's4.png'])}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 2px solid #455a64; text-align: center;"><b>ツーペア</b><br><span style="color:#f1c40f; font-weight: bold; font-size: 24px;">2倍</span></td>
                            <td style="padding: 12px; border: 2px solid #455a64; line-height: 1.5;">
                                同じ数字のペアが2組揃う
                                ${getCardImgsHtml(['s4.png', 'd4.png', 'h11.png', 'c11.png', 's2.png'])}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 2px solid #455a64; text-align: center;"><b>ワンペア</b><br><span style="color:#f1c40f; font-weight: bold; font-size: 24px;">1倍</span></td>
                            <td style="padding: 12px; border: 2px solid #455a64; line-height: 1.5;">
                                同じ数字のペアが1組揃う
                                ${getCardImgsHtml(['s13.png', 'c13.png', 'h2.png', 'd5.png', 's8.png'])}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 2px solid #455a64; text-align: center; color: #aaa;"><b>ノーペア</b><br><span style="color:#aaa; font-size: 24px;">0倍</span></td>
                            <td style="padding: 12px; border: 2px solid #455a64; color: #aaa; line-height: 1.5;">
                                上記の役が何も成立していない状態
                                ${getCardImgsHtml(['s2.png', 'h5.png', 'd7.png', 'c9.png', 's12.png'])}
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
            
            <button id="game-start-btn" style="background: #c0392b; color: white; border: 4px solid #f1c40f; padding: 15px 0; font-size: 28px; font-weight: bold; cursor: pointer; border-radius: 8px; box-shadow: 0 8px 14px rgba(0,0,0,0.5); transition: 0.2s; width: 100%; letter-spacing: 3px; margin-top: 10px;">
                了解！ 難易度選択へ進む
            </button>
        </div>
    `;
    document.body.appendChild(ruleLayer);

    document.getElementById('game-start-btn').onclick = () => {
        ruleLayer.style.display = 'none'; 
        diffLayer.style.display = 'flex'; 
        startAudio();                     
    };

    const selectDiffAndStart = (diff, label) => {
        selectedDifficulty = diff;
        diffLayer.style.display = 'none';
        message.innerText = `ゲーム開始！ 難易度: ${label}`;
    };
    document.getElementById('diff-easy').onclick = () => selectDiffAndStart('EASY', 'イージ');
    document.getElementById('diff-normal').onclick = () => selectDiffAndStart('NORMAL', 'ノーマル');
    document.getElementById('diff-hard').onclick = () => selectDiffAndStart('HARD', 'ハード');
    document.getElementById('diff-hell').onclick = () => selectDiffAndStart('HELL', 'ヘル');

    // --- 演出用：絶望画像レイヤー ---
    const jumpscareLayer = document.createElement('div');
    jumpscareLayer.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: url('https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/94.png') no-repeat center center;
        background-size: contain; background-color: black;
        z-index: 9999; display: none; pointer-events: none;
    `;
    document.body.appendChild(jumpscareLayer);

    const triggerLoseEffect = () => {
        loseSound.pause();
        loseSound.currentTime = 0;
        loseSound.volume = 1.0; 
        loseSound.play();
        jumpscareLayer.style.display = 'block';
        setTimeout(() => { jumpscareLayer.style.display = 'none'; }, 1500);
    };

    // UI構築
    const cpuDisp = document.createElement('div');
    cpuDisp.style.cssText = 'position: absolute; top: 20px; left: 50%; transform: translateX(-50%); color: #e74c3c; font-size: 28px; font-weight: bold; text-shadow: 2px 2px 4px black; z-index: 10;';
    cpuDisp.innerHTML = `DEALER CHIPS: <span id="cpu-chips">${cpuChips}</span>`;
    document.body.appendChild(cpuDisp);
    const cpuChipsDisp = document.getElementById('cpu-chips');

    const controls = document.getElementById('controls');
    controls.style.zIndex = "100"; 

    // コントロールUI（コンパクト調整版を維持）
    const uiContainer = document.createElement('div');
    uiContainer.style.cssText = 'color: #f1c40f; margin-top: 3px; font-size: 14px; text-shadow: 1px 1px 2px black;';
    uiContainer.innerHTML = `
        <div style="margin-bottom:8px; display: flex; align-items: center; justify-content: center; gap: 10px;">
            <button id="bet-minus" style="padding: 4px 12px; font-size: 16px; font-weight: bold; cursor:pointer; background:#2c3e50; color:white; border:1px solid #f1c40f; border-radius: 4px;">-10</button>
            <span style="font-size: 18px; font-weight:bold;">BET: <span id="current-bet">10</span></span>
            <button id="bet-plus" style="padding: 4px 12px; font-size: 16px; font-weight: bold; cursor:pointer; background:#2c3e50; color:white; border:1px solid #f1c40f; border-radius: 4px;">+10</button>
        </div>
        <div style="border-top: 1px solid #f1c40f; padding-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; justify-content: center;">
            <button id="cheat-6card" style="background:#c0392b; color:white; border:none; padding:8px 14px; font-size: 14px; font-weight: bold; cursor:pointer; border-radius:4px; box-shadow: 0 3px rgba(0,0,0,0.4);">6枚ドロー(50)</button>
            <button id="cheat-debuff" style="background:#2980b9; color:white; border:none; padding:8px 14px; font-size: 14px; font-weight: bold; cursor:pointer; border-radius:4px; box-shadow: 0 3px rgba(0,0,0,0.4);">相手制限(50)</button>
            <button id="cheat-destroy" style="background:#444; color:white; border:none; padding:8px 14px; font-size: 14px; font-weight: bold; cursor:pointer; border-radius:4px; box-shadow: 0 3px rgba(0,0,0,0.4);">カード破壊(100)</button>
            <button id="cheat-choice" style="background:#8e44ad; color:white; border:none; padding:8px 14px; font-size: 14px; font-weight: bold; cursor:pointer; border-radius:4px; box-shadow: 0 3px rgba(0,0,0,0.4);">最強交換[2枚迄](150)</button>
            <button id="manual-flip-btn" style="background:#d35400; color:white; border:none; padding:8px 18px; font-size: 14px; font-weight: bold; cursor:pointer; border-radius:4px; display:none; box-shadow: 0 3px rgba(0,0,0,0.4);">台パン(200)</button>
        </div>
    `;
    controls.appendChild(uiContainer);

    dealBtn.style.cssText = "padding: 10px 30px; font-size: 20px; font-weight: bold; border-radius: 6px; cursor: pointer; box-shadow: 0 4px #666;";

    const currentBetDisp = document.getElementById('current-bet');
    const cheat6Btn = document.getElementById('cheat-6card');
    const cheatDebuffBtn = document.getElementById('cheat-debuff');
    const cheatDestroyBtn = document.getElementById('cheat-destroy');
    const cheatChoiceBtn = document.getElementById('cheat-choice');
    const manualFlipBtn = document.getElementById('manual-flip-btn');

    // --- チート処理 ---
    cheat6Btn.onclick = (e) => {
        e.stopPropagation();
        if ((gameState === 'START' || gameState === 'END') && !isSixCardCheatActive && chips >= 50) {
            chips -= 50; chipsDisp.innerText = chips;
            isSixCardCheatActive = true;
            cheat6Btn.style.opacity = "0.4";
            message.innerText = "次のドローは6枚確定！";
        }
    };

    cheatDebuffBtn.onclick = (e) => {
        e.stopPropagation();
        if ((gameState === 'START' || gameState === 'END') && !isCpuDebuffActive && chips >= 50) {
            chips -= 50; chipsDisp.innerText = chips;
            isCpuDebuffActive = true;
            cheatDebuffBtn.style.opacity = "0.4";
            message.innerText = "次のディーラーは3枚制限！";
        }
    };

    cheatDestroyBtn.onclick = (e) => {
        e.stopPropagation();
        if (gameState === 'CHANGE' && !isDestroyModeActive && chips >= 100) {
            chips -= 100; chipsDisp.innerText = chips;
            isDestroyModeActive = true;
            cheatDestroyBtn.style.opacity = "0.4";
            message.innerText = "相手のカードを破壊せよ！";
        }
    };

    cheatChoiceBtn.onclick = (e) => {
        e.stopPropagation();
        if (gameState === 'CHANGE' && !isChoiceCheatRequested && chips >= 150) {
            chips -= 150; chipsDisp.innerText = chips;
            isChoiceCheatRequested = true;
            cheatChoiceBtn.style.opacity = "0.4";
            message.innerText = "最強交換（最大2枚）予約！";
        }
    };

    const updateBet = (delta) => {
        if (gameState === 'START' || gameState === 'END') {
            const nextBet = betAmount + delta;
            if (nextBet >= 10 && nextBet <= 500 && nextBet <= chips) {
                betAmount = nextBet;
                currentBetDisp.innerText = betAmount;
            }
        }
    };
    document.getElementById('bet-plus').onclick = (e) => { e.stopPropagation(); updateBet(10); };
    document.getElementById('bet-minus').onclick = (e) => { e.stopPropagation(); updateBet(-10); };

    manualFlipBtn.onclick = (e) => {
        e.stopPropagation();
        if (chips >= 200) {
            chips -= 200; chips += betAmount;
            chipsDisp.innerText = chips;
            message.innerText = "台パン！無効試合！";
            manualFlipBtn.style.display = "none";
            daipanSound.currentTime = 0; daipanSound.play();
            [...playerHandObjs, ...cpuHandObjs].filter(o => o).forEach(card => {
                new TWEEN.Tween(card.position).to({ x: (Math.random()-0.5)*50, y: 30, z: (Math.random()-0.5)*50 }, 1000).easing(TWEEN.Easing.Exponential.Out).start();
            });
            gameState = 'END'; dealBtn.innerText = "もう一度";
        }
    };

    const prepareNextGameUI = () => {
        [cheat6Btn, cheatDebuffBtn, cheatDestroyBtn, cheatChoiceBtn].forEach(btn => { 
            const isReserved = (btn === cheat6Btn && isSixCardCheatActive) || (btn === cheatDebuffBtn && isCpuDebuffActive);
            btn.style.opacity = isReserved ? "0.4" : "1"; 
            btn.style.pointerEvents = "auto"; 
        });
        manualFlipBtn.style.display = "none";
    };

    const clearSceneCards = () => {
        [...playerHandObjs, ...cpuHandObjs].forEach(obj => {
            if (obj) {
                scene.remove(obj);
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => m.dispose());
            }
        });
        playerHandObjs = []; cpuHandObjs = [];
    };

    // --- 役判定エンジン ---
    const valueMap = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14, 'Joker': 99 };
    const suits = ['♠', '♥', '♦', '♣'];
    const valuesArr = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

    function getHandRank(hand) {
        if (!hand || hand.length === 0) return { name: "なし", score: 0, pay: 0 };
        if (hand.length > 5) {
            let maxScore = -1, best = null;
            for (let i = 0; i < hand.length; i++) {
                const sub = hand.filter((_, idx) => idx !== i);
                const res = getHandRank(sub);
                if (res.score > maxScore) { maxScore = res.score; best = res; }
            }
            return best;
        }
        const jokersCount = hand.filter(c => c.value === 'Joker').length;
        const normal = hand.filter(c => c.value !== 'Joker');
        if (jokersCount === 5) return { name: "ファイブカード", score: 11, pay: 10 };
        if (jokersCount === 0) return calculateRank(hand);
        let bestRank = { name: "ノーペア", score: 1, pay: 0 };
        for (let v of valuesArr) {
            const res = calculateRank([...normal, ...Array(jokersCount).fill({ suit: '♠', value: v })]);
            if (res.score > bestRank.score) bestRank = res;
        }
        return bestRank;
    }

    // 新しい役の倍率設定（payの値）に修正
    function calculateRank(hand) {
        const counts = {}, suitCounts = {};
        const nums = hand.map(c => valueMap[c.value]).sort((a, b) => a - b);
        hand.forEach(c => { counts[c.value] = (counts[c.value] || 0) + 1; suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1; });
        const sortedCounts = Object.values(counts).sort((a, b) => b - a);
        const isFlush = Object.values(suitCounts).includes(5);
        const isStraight = (nums.length === 5) && (nums.every((n, i) => i === 0 || n === nums[i - 1] + 1) || JSON.stringify(nums) === JSON.stringify([2, 3, 4, 5, 14]));
        
        if (sortedCounts[0] === 5) return { name: "ファイブカード", score: 11, pay: 10 };
        if (isFlush && isStraight && nums[0] === 10) return { name: "ロイヤルSF", score: 10, pay: 9 };
        if (isFlush && isStraight) return { name: "ストレートF", score: 9, pay: 8 };
        if (sortedCounts[0] === 4) return { name: "フォーカード", score: 8, pay: 7 };
        if (sortedCounts[0] === 3 && sortedCounts[1] === 2) return { name: "フルハウス", score: 7, pay: 6 };
        if (isFlush) return { name: "フラッシュ", score: 6, pay: 5 };
        if (isStraight) return { name: "ストレート", score: 5, pay: 4 };
        if (sortedCounts[0] === 3) return { name: "スリーカード", score: 4, pay: 3 };
        if (sortedCounts[0] === 2 && sortedCounts[1] === 2) return { name: "ツーペア", score: 3, pay: 2 };
        if (sortedCounts[0] === 2) return { name: "ワンペア", score: 2, pay: 1 };
        return { name: "ノーペア", score: 1, pay: 0 };
    }

    let playerHandObjs = []; let cpuHandObjs = [];
    const loader = new THREE.TextureLoader();

    function createCardMesh(cardData) {
        const materials = Array(6).fill().map(() => new THREE.MeshStandardMaterial({ color: 0xffffff }));
        const suitMap = { '♠': 's', '♥': 'h', '♦': 'd', '♣': 'c' };
        const num = (cardData.value === 'A') ? 1 : (cardData.value === 'J' ? 11 : (cardData.value === 'Q' ? 12 : (cardData.value === 'K' ? 13 : cardData.value)));
        const facePath = (cardData.value === 'Joker') ? `images/joker.png` : `images/${suitMap[cardData.suit]}${num}.png`;
        loader.load(facePath, tex => { tex.colorSpace = THREE.SRGBColorSpace; materials[2].map = tex; materials[2].needsUpdate = true; });
        loader.load(`images/back.png`, tex => { tex.colorSpace = THREE.SRGBColorSpace; materials[3].map = tex; materials[3].needsUpdate = true; });
        const card = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.02, 1.6), materials);
        card.castShadow = true; card.cardData = cardData; return card;
    }

    function dealCard(index, isPlayer, totalCount, forceJoker = false) {
        let cardData;
        if (forceJoker) {
            cardData = { suit: 'Joker', value: 'Joker', isJ2: (index % 2 === 1) };
        } else {
            cardData = deck.pop();
        }

        const card = createCardMesh(cardData);
        card.position.set(0, 4, -4); card.rotation.set(Math.PI, 0, 0); 
        scene.add(card);
        drawSound.currentTime = 0; drawSound.play();
        const offsetX = (totalCount - 1) * 0.65;
        if (isPlayer) {
            playerHandObjs[index] = card;
            new TWEEN.Tween(card.position).to({ x: -offsetX + index * 1.3, y: -0.8, z: 2.2 }, 700).onComplete(() => { new TWEEN.Tween(card.rotation).to({ x: 0 }, 500).start(); }).start();
        } else {
            cpuHandObjs[index] = card;
            new TWEEN.Tween(card.position).to({ x: 4.0, y: 0.0, z: -2.5 + index * 0.3 }, 700).start();
            card.rotation.y = Math.PI / 2;
        }
    }

    // 難易度指定に応じたCPUの手札作成
    function makeCpuHandByDifficulty(count) {
        let attempts = 0;
        while (attempts < 1000) { 
            let tempDeck = [...deck];
            for (let i = tempDeck.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [tempDeck[i], tempDeck[j]] = [tempDeck[j], tempDeck[i]];
            }
            
            let candidateCards = tempDeck.slice(0, count);
            let rank = getHandRank(candidateCards);

            if (selectedDifficulty === 'EASY') {
                return candidateCards; 
            } else if (selectedDifficulty === 'NORMAL' && rank.score >= 2) {
                return candidateCards; 
            } else if (selectedDifficulty === 'HARD' && rank.score >= 5) {
                return candidateCards; 
            } else if (selectedDifficulty === 'HELL' && rank.score >= 7) {
                return candidateCards; 
            }
            attempts++;
        }
        return Array(count).fill(null).map(() => deck.pop());
    }

    dealBtn.onclick = () => {
        startAudio();
        if (gameState === 'START' || gameState === 'END') {
            if (chips < betAmount) { message.innerText = "チップ不足！"; return; }
            clearSceneCards();
            const currentPCount = isSixCardCheatActive ? 6 : 5;
            const currentCCount = isCpuDebuffActive ? 3 : 5;
            if (gameState === 'END') prepareNextGameUI();
            chips -= betAmount; chipsDisp.innerText = chips;
            
            deck = []; for (let s of suits) for (let v of valuesArr) deck.push({ suit: s, value: v }); 
            deck.push({ suit: 'Joker', value: 'Joker' }); 
            
            for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
            
            playerHandObjs = new Array(currentPCount).fill(null); 
            for (let i = 0; i < currentPCount; i++) dealCard(i, true, currentPCount);

            let selectedCpuCards = makeCpuHandByDifficulty(currentCCount);

            selectedCpuCards.forEach(card => {
                deck = deck.filter(c => !(c.suit === card.suit && c.value === card.value));
                deck.push(card);
            });

            cpuHandObjs = new Array(currentCCount).fill(null); 
            for (let i = 0; i < currentCCount; i++) dealCard(i, false, currentCCount);
            
            isSixCardCheatActive = false;
            isCpuDebuffActive = false;
            gameState = 'CHANGE'; dealBtn.innerText = "交換確定";
        } else if (gameState === 'CHANGE') {
            let cheatCount = 0;
            playerHandObjs.forEach((card, i) => { 
                if (card && card.isHeld) { 
                    scene.remove(card); 
                    const useJoker = isChoiceCheatRequested && cheatCount < 2;
                    if (useJoker) cheatCount++;
                    dealCard(i, true, playerHandObjs.length, useJoker); 
                }
            });
            isChoiceCheatRequested = false; 
            isDestroyModeActive = false;

            setTimeout(() => {
                cpuHandObjs.forEach((c, i) => { if(c) {
                    const activeCount = cpuHandObjs.filter(x => x).length;
                    new TWEEN.Tween(c.position).to({ x: -((activeCount-1)*0.65) + i*1.3, y: -0.8, z: -1.0 }, 700).start();
                    new TWEEN.Tween(c.rotation).to({ x: 0, y: 0 }, 700).start();
                }});
                const pRes = getHandRank(playerHandObjs.filter(o => o).map(o => o.cardData));
                const cRes = getHandRank(cpuHandObjs.filter(o => o).map(o => o.cardData));
                rankDisp.innerText = pRes.name;
                
                // 配当金の精算計算ロジック（ベースの賭け金＋賭け金×役倍率）
                if (pRes.score > cRes.score) { 
                    const pay = betAmount * 2 + (betAmount * pRes.pay); chips += pay; cpuChips -= (pay - betAmount); message.innerText = `勝利！[敵:${cRes.name}]`; 
                } else if (pRes.score < cRes.score) { 
                    const loss = betAmount * Math.max(0, cRes.pay); cpuChips += (betAmount + loss); chips -= loss; message.innerText = `敗北...[敵:${cRes.name}]`;
                    if (chips <= 0) triggerLoseEffect();
                    else if (chips >= 200) manualFlipBtn.style.display = "inline-block";
                } else { chips += betAmount; message.innerText = `引き分け[敵:${cRes.name}]`; }
                chipsDisp.innerText = chips; cpuChipsDisp.innerText = cpuChips;
                if (chips <= 0 || cpuChips <= 0) {
                    setTimeout(() => { alert(chips > 0 ? "完全勝利！" : "破産..."); location.reload(); }, 1500);
                } else { gameState = 'END'; dealBtn.innerText = "もう一度"; prepareNextGameUI(); }
            }, 1000);
        }
    };

    // --- シーン構築 ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020202);
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 4, 5); camera.lookAt(0, -1, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0x444444));
    const ml = new THREE.SpotLight(0xffffff, 30); ml.position.set(0, 8, 2); scene.add(ml);
    const tc = new THREE.Mesh(new THREE.BoxGeometry(20, 0.2, 12), new THREE.MeshStandardMaterial({ color: 0x074324 }));
    tc.position.y = -1.1; scene.add(tc);

    window.addEventListener('mousedown', (e) => {
        if (ruleLayer.style.display !== 'none' || diffLayer.style.display !== 'none') return;

        startAudio();
        const rect = renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(((e.clientX-rect.left)/rect.width)*2-1, -((e.clientY-rect.top)/rect.height)*2+1);
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);

        if (gameState === 'CHANGE') {
            const pIntersects = raycaster.intersectObjects(playerHandObjs.filter(o => o));
            if (pIntersects.length > 0) {
                const card = pIntersects[0].object;
                card.isHeld = !card.isHeld;
                drawSound.currentTime = 0; drawSound.play();
                new TWEEN.Tween(card.position).to({ y: card.isHeld ? -0.2 : -0.8 }, 200).start();
                return;
            }
            if (isDestroyModeActive) {
                const cIntersects = raycaster.intersectObjects(cpuHandObjs.filter(o => o));
                if (cIntersects.length > 0) {
                    const card = cIntersects[0].object;
                    daipanSound.currentTime = 0; daipanSound.play();
                    new TWEEN.Tween(card.position).to({ y: 15, z: -10 }, 600).easing(TWEEN.Easing.Back.In).onComplete(() => {
                        scene.remove(card);
                        const idx = cpuHandObjs.indexOf(card);
                        if (idx > -1) cpuHandObjs[idx] = null;
                    }).start();
                }
            }
        }
    });

    function animate(time) { requestAnimationFrame(animate); TWEEN.update(time); renderer.render(scene, camera); }
    animate();
};