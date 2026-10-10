"use strict";
// 2026-08-22 계측(⑤) — game.js 자체는 window.__sumoTrack 을 직접 부르지 않고
// 이 로컬 래퍼를 거친다. analyticsBoot.ts 가 아직 안 붙었어도(로드 순서 무관)
// 조용히 무시된다 — 게임은 계측 유무와 무관하게 항상 돑다.
// ⛔개인정보 없음 — props 에는 게임 내부 상태(모드/스테이지/승패)만 실는다.
function track(name, props){
  try { if (typeof window !== 'undefined' && window.__sumoTrack) window.__sumoTrack(name, props || {}); }
  catch(e){ /* 계측 실패가 게임을 막으면 안 된다 */ }
}
let __matchesThisSession = 0;

// ============================== i18n ==============================
// 트랙K 게이트3 재작업(2026-08-03): TITLE 상수는 사용처 0건인 죽은 코드다
// (Partner 지적). 실제 타이틀 텍스트는 index.html의 #gameTitleH1 정적값 +
// applyLang()의 EN 분기로 관리한다. 혼선 방지를 위해 주석만 남기고 상수는
// 지운다. 필요해지면 git 이력에서 복구 가능.
const I18N = {"ko":{"name":"KO","tagline":"힘을 모아 조준하고, 상대를 링 밖으로 밀어내라.","prgCleared":"클리어","prgFighters":"선수","prgArenas":"경기장","mArcade":"아케이드 토너먼트","mArcadeD":"CPU와 12연전을 홀로 돌파한다.","mVersus":"로컬 2인 대전","mVersusD":"한 기기에서 두 명이 5판 3선승으로 겨룬다.","mPractice":"자유 연습","mPracticeD":"경기장과 규칙을 골라 마음껏 연습한다.","howTo":"게임 방법","howToTitle":"게임 방법","hChargeT":"모으고 돌진하기","hChargeD":"길게 눌러 힘을 모으고 떼면 앞으로 돌진한다. 게이지가 찰수록 밀어내는 힘이 세진다.","hAimT":"돌진 방향 조준","hAimD":"누른 채 끌면 화살표 방향이 바뀐다. 끌지 않고 떼면 상대에게 자동으로 조준된다.","hSoloT":"한 손 조작","hSoloD":"1인 모드에서는 화면 전체가 조작 영역이다. 아무 데나 누르고, 끌어서 조준하고, 떼서 공격한다.","hDuoT":"2인 플레이","hDuoD":"화면 아래쪽 절반은 빨강, 위쪽 절반은 파랑을 조종한다. 둘이 동시에 모을 수 있다.","hGoalT":"승리 조건","hGoalD":"상대를 링 밖으로 밀어내면 이긴다. 링이 계속 좁아지므로 버티기만 해서는 끝나지 않는다.","hRulesT":"특수 규칙","hRulesD":"얼음, 강풍, 폭탄 등 규칙이 판마다 바뀐다. 현재 규칙은 항상 상단 바에 표시된다.","bBack":"뒤로","bStart":"시작","bNext":"다음 판","bRetry":"다시 도전","bMenu":"메뉴","bRematch":"다시 대결","bResume":"이어하기","bRestart":"이 판 다시","bQuit":"메뉴로 나가기","bFight":"승부!","bOk":"확인","selEyeArcade":"아케이드 토너먼트","selEyeVersus":"로컬 2인 대전","selEyePractice":"자유 연습","selTitleSolo":"선수 선택","selTitleDuo":"두 플레이어가 각자 선택","selRoster":"선수 명단","selTurnP1":"빨강이 고르는 중","selTurnP2":"파랑이 고르는 중","selLockedMsg":"아직 잠김","selUnlockAt":"{n}번째 판을 이기면 해금","selUnlockClear":"토너먼트를 클리어하면 해금","pickArena":"경기장","pickRule":"규칙","diffLabel":"난이도","dEasy":"쉬움","dNormal":"보통","dHard":"어려움","dEasyD":"느리고 너그러운 상대","dNormalD":"모으기를 읽는다","dHardD":"피하고 반격한다","sWeight":"무게","sPower":"힘","sSpeed":"속도","sSize":"덩치","vsStage":"12판 중 {n}판","vsFinalStage":"최종전 - 최강 챔피언","vsExhibition":"친선 경기","vsPractice":"연습 경기","vsBest":"{n}선승제","vsLadder":"토너먼트 대진","hudRound":"{n}라운드","aReady":"준비","aGo":"시작!","aWinP1":"빨강 승!","aWinP2":"파랑 승!","aDraw":"동시 장외","aDrawSub":"득점 없음 - 다시 붙는다","aNext":"다음 라운드...","aTimeUp":"시간 종료","aTimeUpSub":"중앙에 가까운 쪽이 라운드 승리","lblP1":"빨강","lblP2":"파랑","lblCpu":"CPU","lblYou":"나","resWin":"승리","resLose":"패배","resDrawT":"무승부","resWinSubArcade":"이 상대를 밀어내고 다음 판으로 나아갔다.","resWinSubDuo":"{n}이(가) 링을 지배했다.","resLoseSub":"이번 판은 상대의 차지였다.","resClear":"토너먼트 제패","resClearSub":"모든 상대를 쓰러뜨렸다. 최강 챔피언에 올랐다.","resStats":"경기 기록","stDashes":"돌진 횟수","stHits":"정타","stAcc":"명중률","stMaxCharge":"최대 모으기","stBestRally":"최장 공방","stTime":"경기 시간","stRounds":"획득 라운드","unlockedChar":"새 선수 해금","unlockedArena":"새 경기장 해금","unlockedTitle":"해금","arcNextBout":"다음 상대가 기다린다","arcStageN":"{n}번째 판","pauseTitle":"일시정지","pauseSub":"숨 돌려도 된다. 링은 기다려 준다.","pAggro":"공격형","pDefend":"방어형","pTricky":"변칙형","pBalance":"균형형","pBoss":"챔피언","rNormal":"기본 규칙","rNormalD":"정통 규칙. 시간이 갈수록 링이 좁아진다.","rIce":"미끄러운 얼음","rIceD":"바닥이 거의 잡히지 않아 계속 미끄러진다.","rWind":"측면 강풍","rWindD":"쉼 없는 강풍이 두 선수를 옆으로 밀어낸다.","rBouncy":"탄력 매트","rBouncyD":"부딪칠 때마다 몸이 세게 튕겨 나간다.","rRush":"급속 축소","rRushD":"링이 평소보다 세 배 빠르게 좁아진다.","rBombs":"폭탄 투하","rBombsD":"드럼통이 링에 떨어져 닿으면 터진다.","rOrbit":"순찰 가드","rOrbitD":"묵직한 가드 둘이 링을 돌며 다가오는 선수를 밀어낸다.","rPit":"중앙 함정","rPitD":"한가운데 구멍이 열린다. 빠지면 그대로 탈락이다.","rSurge":"박동 게이지","rSurgeD":"모으기 속도가 파도처럼 빨라졌다 느려진다. 리듬을 보고 떼는 타이밍을 노려라.","rInvert":"조작 반전","rInvertD":"가끔 조준 방향이 반대로 뒤집힌다. 화면 표시를 보고 반대로 그어라.","rPull":"인력 펄스","rPullD":"경고 후 순간적으로 링 중앙으로 끌려간다. 예고를 보고 대비하거나 역이용하라.","rSafeZone":"안전지대","rSafeZoneD":"빛나는 원 안에서 모으면 힘이 더 빨리 찬다. 자리를 먼저 차지하라.","aDawn":"새벽 도효","aSunset":"노을 링","aMidnight":"한밤의 마당","aSnow":"얼어붙은 분지","aDesert":"모래언덕 링","aStorm":"폭풍 갑판","aSakura":"벚꽃 마당","aVolcano":"분화구 대장간","aBamboo":"대나무 숲","aNeon":"네온 거리","aTemple":"황금 신전","aCosmos":"궤도 링","cKotaro":"코타로","cKotaroT":"만능형","cHayate":"하야테","cHayateT":"질풍","cIwao":"이와오","cIwaoT":"철벽","cAkaoni":"아카오니","cAkaoniT":"붉은 도깨비","cKotsubu":"코츠부","cKotsubuT":"작은 혜성","cNagare":"나가레","cNagareT":"흐르는 강","cKumo":"쿠모","cKumoT":"떠도는 구름","cTetsuzan":"테츠잔","cTetsuzanT":"강철 황소","cKagero":"카게로","cKageroT":"아지랑이","cDaimyojin":"다이묘진","cDaimyojinT":"최강 챔피언","tapHint":"아무 데나 누르고, 끌어서 조준, 떼면 돌진","toastLocked":"아직 잠긴 선수다.","dailyTitle":"오늘의 대결","dailyClaimedTitle":"오늘 도전 완료","dailyStreakUnit":"일째"},"en":{"name":"EN","tagline":"Charge up, aim, and shove your rival out of the ring.","prgCleared":"Cleared","prgFighters":"Fighters","prgArenas":"Arenas","mArcade":"Arcade Tournament","mArcadeD":"Fight 12 CPU rivals in a row, one bout at a time.","mVersus":"Local Versus","mVersusD":"Two players, one device, best of five.","mPractice":"Free Practice","mPracticeD":"Pick any arena and special rule, then train freely.","howTo":"How to play","howToTitle":"How to Play","hChargeT":"Charge and dash","hChargeD":"Hold to build power, release to dash forward. A fuller gauge means a heavier shove.","hAimT":"Aim your dash","hAimD":"Drag while holding to point the arrow. Release without dragging and you lock on to your rival.","hSoloT":"One-handed play","hSoloD":"In solo modes the whole screen is yours: press anywhere, drag to aim, release to dash.","hDuoT":"Two players","hDuoD":"Bottom half of the screen controls Red, top half controls Blue. Both can charge at the same time.","hGoalT":"Win the bout","hGoalD":"Push your rival past the ring line. The ring keeps shrinking, so a stalemate never lasts.","hRulesT":"Special rules","hRulesD":"Ice, wind, bombs and more: the special rule changes every bout. The current rule is always shown in the top bar.","bBack":"Back","bStart":"Start","bNext":"Next bout","bRetry":"Try again","bMenu":"Menu","bRematch":"Rematch","bResume":"Resume","bRestart":"Restart bout","bQuit":"Quit to menu","bFight":"Fight!","bOk":"Got it","selEyeArcade":"Arcade Tournament","selEyeVersus":"Local Versus","selEyePractice":"Free Practice","selTitleSolo":"Choose your fighter","selTitleDuo":"Both players choose","selRoster":"Roster","selTurnP1":"Red is picking","selTurnP2":"Blue is picking","selLockedMsg":"Still locked","selUnlockAt":"Win bout {n} to unlock","selUnlockClear":"Clear the tournament to unlock","pickArena":"Arena","pickRule":"Rule","diffLabel":"Difficulty","dEasy":"Easy","dNormal":"Normal","dHard":"Hard","dEasyD":"Slow and forgiving","dNormalD":"Reads your charge-up","dHardD":"Dodges and punishes mistakes","sWeight":"Weight","sPower":"Power","sSpeed":"Speed","sSize":"Size","vsStage":"Bout {n} of 12","vsFinalStage":"Final bout - Grand Champion","vsExhibition":"Exhibition match","vsPractice":"Practice match","vsBest":"First to {n} wins","vsLadder":"Tournament path","hudRound":"Round {n}","aReady":"READY","aGo":"GO!","aWinP1":"RED TAKES IT","aWinP2":"BLUE TAKES IT","aDraw":"DOUBLE OUT","aDrawSub":"No round winner - go again","aNext":"Next round...","aTimeUp":"TIME UP","aTimeUpSub":"Closest to the centre wins the round","lblP1":"Red","lblP2":"Blue","lblCpu":"CPU","lblYou":"You","resWin":"VICTORY","resLose":"DEFEAT","resDrawT":"DRAW","resWinSubArcade":"You shoved your way past this rival.","resWinSubDuo":"{n} dominated the ring.","resLoseSub":"The ring belonged to your rival this time.","resClear":"TOURNAMENT CLEAR","resClearSub":"Every rival in the tournament has fallen. You are the Grand Champion.","resStats":"Match report","stDashes":"Dashes used","stHits":"Clean hits","stAcc":"Accuracy","stMaxCharge":"Max charge-up","stBestRally":"Longest exchange","stTime":"Match time","stRounds":"Rounds won","unlockedChar":"New fighter unlocked","unlockedArena":"New arena unlocked","unlockedTitle":"Unlocked","arcNextBout":"Next rival is waiting","arcStageN":"Bout {n}","pauseTitle":"Paused","pauseSub":"Take a breath. The ring will wait.","pAggro":"Aggressive","pDefend":"Defensive","pTricky":"Tricky","pBalance":"Balanced","pBoss":"Champion","rNormal":"Standard Bout","rNormalD":"Classic rules. The ring shrinks as time runs on.","rIce":"Slick Ice","rIceD":"The floor barely grips - everything keeps sliding.","rWind":"Crosswind","rWindD":"A steady gale pushes both fighters sideways.","rBouncy":"Bounce Mats","rBouncyD":"Fighters rebound hard from every clash.","rRush":"Sudden Shrink","rRushD":"The ring closes in three times faster than usual.","rBombs":"Live Bombs","rBombsD":"Bombs drop into the ring and blast on contact.","rOrbit":"Rolling Guards","rOrbitD":"Two heavy guards circle the ring and shove any fighter they touch.","rPit":"Centre Pit","rPitD":"A hole opens in the middle. Fall in and you are out.","rSurge":"Pulsing Gauge","rSurgeD":"The charge rate surges and dips like a wave. Watch the rhythm and time your release.","rInvert":"Control Invert","rInvertD":"Your aim direction flips at random intervals. Watch the cue and drag the opposite way.","rPull":"Pull Pulse","rPullD":"A brief warning, then a sudden yank toward the centre. Brace for it or use it to your advantage.","rSafeZone":"Safe Zone","rSafeZoneD":"Charge inside the glowing ring for a power boost. Claim the spot first.","aDawn":"Dawn Dohyo","aSunset":"Sunset Ring","aMidnight":"Midnight Palace","aSnow":"Frozen Basin","aDesert":"Dune Circle","aStorm":"Storm Deck","aSakura":"Blossom Garden","aVolcano":"Crater Forge","aBamboo":"Bamboo Grove","aNeon":"Neon District","aTemple":"Golden Temple","aCosmos":"Orbital Ring","cKotaro":"Kotaro","cKotaroT":"The All-Rounder","cHayate":"Hayate","cHayateT":"The Gale","cIwao":"Iwao","cIwaoT":"The Iron Wall","cAkaoni":"Akaoni","cAkaoniT":"The Red Ogre","cKotsubu":"Kotsubu","cKotsubuT":"The Little Comet","cNagare":"Nagare","cNagareT":"The Flowing River","cKumo":"Kumo","cKumoT":"The Drifting Cloud","cTetsuzan":"Tetsuzan","cTetsuzanT":"The Steel Bull","cKagero":"Kagero","cKageroT":"The Heat Haze","cDaimyojin":"Daimyojin","cDaimyojinT":"The Grand Champion","tapHint":"Press anywhere, drag to aim, release to dash","toastLocked":"That fighter is still locked.","dailyTitle":"Daily Bout","dailyClaimedTitle":"Daily bout done","dailyStreakUnit":"day"}};
const LANG_ORDER=['ko','en'];
let curLang='ko';
function t(k){ const L = I18N[curLang]||I18N.ko; return (L[k] !== undefined) ? L[k] : I18N.en[k]; }
// ============================== content data ==============================
// Fighters. weight = mass (resists knockback), power = shove force, speed = charge/dash rate,
// radius = hitbox. Every entry trades one stat off against another.
const CHARS = [
 {id:'kotaro',   k:'cKotaro',   kt:'cKotaroT',   color:'#ff5a5f', skin:'#f2b48c', mawashi:'#2a3350', trim:'#ffd23f',
  weight:1.00, power:1.00, speed:1.00, radius:24, body:'round', hair:'topknot', face:'calm',  mark:'none',   unlock:0},
 {id:'hayate',   k:'cHayate',   kt:'cHayateT',   color:'#35d9a8', skin:'#f5c49e', mawashi:'#0f3f38', trim:'#d9fff2',
  weight:0.78, power:0.82, speed:1.35, radius:20, body:'tall',  hair:'ponytail',face:'cool',  mark:'wave',   unlock:0},
 {id:'iwao',     k:'cIwao',     kt:'cIwaoT',     color:'#8b9bb4', skin:'#e8b492', mawashi:'#1d2430', trim:'#c7d3e6',
  weight:1.55, power:1.15, speed:0.78, radius:30, body:'wide',  hair:'bald',    face:'stern', mark:'plate',  unlock:0},
 {id:'akaoni',   k:'cAkaoni',   kt:'cAkaoniT',   color:'#ff7a3d', skin:'#ffb27a', mawashi:'#4a1206', trim:'#ffe08a',
  weight:1.05, power:1.35, speed:0.95, radius:25, body:'round', hair:'horns',   face:'angry', mark:'flame',  unlock:0},
 {id:'kotsubu',  k:'cKotsubu',  kt:'cKotsubuT',  color:'#ffd23f', skin:'#ffd7ae', mawashi:'#5a3d00', trim:'#fff3c4',
  weight:0.62, power:0.72, speed:1.50, radius:17, body:'blob',  hair:'bun',     face:'wide',  mark:'star',   unlock:1},
 {id:'nagare',   k:'cNagare',   kt:'cNagareT',   color:'#4a9eff', skin:'#f0bd9a', mawashi:'#10294a', trim:'#bfe0ff',
  weight:0.92, power:0.95, speed:1.15, radius:22, body:'tall',  hair:'flat',    face:'calm',  mark:'wave',   unlock:2},
 {id:'kumo',     k:'cKumo',     kt:'cKumoT',     color:'#c9a7ff', skin:'#f3c8b0', mawashi:'#2e2049', trim:'#efe2ff',
  weight:0.85, power:1.05, speed:1.02, radius:26, body:'blob',  hair:'wild',    face:'sleepy',mark:'dots',   unlock:3},
 {id:'tetsuzan', k:'cTetsuzan', kt:'cTetsuzanT', color:'#d94f7a', skin:'#e5a98d', mawashi:'#3a0f22', trim:'#ffc7dc',
  weight:1.30, power:1.22, speed:0.86, radius:28, body:'block', hair:'crest',   face:'fierce',mark:'stripes',unlock:4},
 {id:'kagero',   k:'cKagero',   kt:'cKageroT',   color:'#7ef6dc', skin:'#eec2a4', mawashi:'#123b38', trim:'#d5fff6',
  weight:0.88, power:1.10, speed:1.22, radius:21, body:'tall',  hair:'wild',    face:'smug',  mark:'swirl',  unlock:6},
 {id:'daimyojin',k:'cDaimyojin',kt:'cDaimyojinT',color:'#f5c542', skin:'#ffcf9d', mawashi:'#432a02', trim:'#fff6d0',
  weight:1.38, power:1.36, speed:1.10, radius:29, body:'wide',  hair:'crown',   face:'stern', mark:'ring',   unlock:8}
];
const CHAR_BY_ID = {};
CHARS.forEach(function(c){ CHAR_BY_ID[c.id] = c; });

const STAT_RANGE = { weight:[0.55,1.65], power:[0.65,1.55], speed:[0.70,1.60], radius:[15,32] };
function statPct(c, key){
  const r = STAT_RANGE[key], v = c[key];
  return Math.max(6, Math.min(100, Math.round(((v - r[0]) / (r[1] - r[0])) * 100)));
}

// Arenas (12). Each has its own sky, floor pattern, boundary colour and particle palette.
const ARENAS = [
 {id:'dawn', k:'aDawn', unlock:0, sky:['#10172f','#5a4165','#ef9b78'], arena:['#293247','#101827'], outer:'#252c3d',
  pattern:'rays', patternColor:'rgba(255,220,178,0.075)', boundary:'#ffd68a', boundaryGlow:'rgba(255,190,120,0.62)',
  lights:['#ffb47c','#ffe0aa'], particles:['#ff8a74','#76b8ff','#ffe3a0']},
 {id:'sunset', k:'aSunset', unlock:0, sky:['#231329','#7f2944','#ec704f'], arena:['#352439','#181320'], outer:'#392035',
  pattern:'bands', patternColor:'rgba(255,169,117,0.075)', boundary:'#ff9f68', boundaryGlow:'rgba(255,103,92,0.62)',
  lights:['#ff6b68','#ffc46e'], particles:['#ff6f78','#9b8cff','#ffc56f']},
 {id:'midnight', k:'aMidnight', unlock:0, sky:['#01040f','#07142d','#102b50'], arena:['#142742','#07111f'], outer:'#0d1f36',
  pattern:'grid', patternColor:'rgba(111,180,255,0.075)', boundary:'#7bc8ff', boundaryGlow:'rgba(76,159,255,0.68)',
  lights:['#69a8ff','#a78bfa'], particles:['#7ca7ff','#9fe7ff','#c8a7ff']},
 {id:'snow', k:'aSnow', unlock:0, sky:['#172a3c','#526f83','#c7dbe3'], arena:['#38556a','#162c3c'], outer:'#2a4658',
  pattern:'ice', patternColor:'rgba(211,244,255,0.11)', boundary:'#d5f5ff', boundaryGlow:'rgba(155,225,255,0.72)',
  lights:['#d9f7ff','#7ddcff'], particles:['#f2fbff','#8de6ff','#b7d7ff']},
 {id:'desert', k:'aDesert', unlock:0, sky:['#2a1820','#8b4d35','#dfa15d'], arena:['#58402f','#241d1c'], outer:'#4a3027',
  pattern:'contours', patternColor:'rgba(255,210,139,0.095)', boundary:'#ffd06f', boundaryGlow:'rgba(255,174,74,0.66)',
  lights:['#ffb45e','#ffe0a0'], particles:['#ff9c63','#e6bd80','#ffe2a3']},
 {id:'storm', k:'aStorm', unlock:0, sky:['#060a12','#182332','#344552'], arena:['#25323d','#0c141b'], outer:'#18242d',
  pattern:'chevrons', patternColor:'rgba(137,235,219,0.07)', boundary:'#83f0d3', boundaryGlow:'rgba(75,226,194,0.66)',
  lights:['#7ef6dc','#9db8ff'], particles:['#73e6cf','#8caeff','#d4fff5']},
 {id:'sakura', k:'aSakura', unlock:1, sky:['#2a1a2b','#7d4059','#f0a9b8'], arena:['#4a3242','#1d1520'], outer:'#54303f',
  pattern:'blossom', patternColor:'rgba(255,214,229,0.10)', boundary:'#ffd3e2', boundaryGlow:'rgba(255,150,190,0.62)',
  lights:['#ff9ec2','#ffe3ef'], particles:['#ff8fb5','#ffd6e5','#c9a7ff']},
 {id:'bamboo', k:'aBamboo', unlock:2, sky:['#0d2318','#1f5136','#8fc06a'], arena:['#2b4432','#132018'], outer:'#25412e',
  pattern:'stalks', patternColor:'rgba(180,255,180,0.075)', boundary:'#b6f08a', boundaryGlow:'rgba(120,220,110,0.6)',
  lights:['#a8e07a','#e7ffc9'], particles:['#9ade7a','#e8ffd0','#ffe9a0']},
 {id:'cosmos', k:'aCosmos', unlock:3, sky:['#01020a','#0a0a24','#1b1040'], arena:['#191a3a','#08081a'], outer:'#1e1f45',
  pattern:'orbits', patternColor:'rgba(160,180,255,0.085)', boundary:'#a9b6ff', boundaryGlow:'rgba(130,120,255,0.7)',
  lights:['#8f7dff','#5df1ff'], particles:['#a2a8ff','#5df1ff','#ffb3f0']},
 {id:'volcano', k:'aVolcano', unlock:4, sky:['#1a0806','#5a1508','#c94a17'], arena:['#432018','#160a08'], outer:'#4a1c11',
  pattern:'cracks', patternColor:'rgba(255,140,60,0.10)', boundary:'#ff9448', boundaryGlow:'rgba(255,90,30,0.7)',
  lights:['#ff6a2b','#ffc65e'], particles:['#ff7a3d','#ffcf6b','#ff4d3d']},
 {id:'neon', k:'aNeon', unlock:5, sky:['#08060f','#1a0b33','#3d1060'], arena:['#241541','#0d0819'], outer:'#2c1450',
  pattern:'circuit', patternColor:'rgba(255,110,230,0.09)', boundary:'#ff6ae6', boundaryGlow:'rgba(190,80,255,0.7)',
  lights:['#ff6ae6','#5df1ff'], particles:['#ff6ae6','#5df1ff','#ffe14d']},
 {id:'temple', k:'aTemple', unlock:7, sky:['#1c1206','#4d2f0c','#c99331'], arena:['#4a3512','#1a1206'], outer:'#4e360f',
  pattern:'tatami', patternColor:'rgba(255,220,140,0.09)', boundary:'#ffd98a', boundaryGlow:'rgba(255,190,80,0.68)',
  lights:['#ffc760','#fff0c0'], particles:['#ffd76b','#ffefc0','#ff9d5c']}
];
const ARENA_BY_ID = {};
ARENAS.forEach(function(a){ ARENA_BY_ID[a.id] = a; });

// Special round rules (12, incl. the plain one -- 8 original + 4 added 2026-08-22).
const RULES = [
 {id:'normal', k:'rNormal', kd:'rNormalD', color:'#93a1b5'},
 {id:'ice',    k:'rIce',    kd:'rIceD',    color:'#8de6ff'},
 {id:'wind',   k:'rWind',   kd:'rWindD',   color:'#7ef6dc'},
 {id:'bouncy', k:'rBouncy', kd:'rBouncyD', color:'#c9a7ff'},
 {id:'rush',   k:'rRush',   kd:'rRushD',   color:'#ffd23f'},
 {id:'bombs',  k:'rBombs',  kd:'rBombsD',  color:'#ff8a3d'},
 {id:'orbit',  k:'rOrbit',  kd:'rOrbitD',  color:'#4a9eff'},
 {id:'pit',    k:'rPit',    kd:'rPitD',    color:'#ff5a5f'},
 // 2026-08-22 단계확장 A안(President/Chief 승인) — 신규 4종. 기존 8종과 다른
 // «축»을 하나씩 맡는다(자문 결과, 아래 각 항목 주석 참고). 전부 어느 캐릭터도
 // 재사용 없이 기존 물리 훅(triggerDash/charge accumulate/physicsStep)에만 얹았다
 // — CPU AI 는 별도 코드 없이 같은 훅을 «공유»하므로 회귀 위험이 낮다.
 // ★surge(게이지 축) — 모으기 «단계» 자체를 흔든다. 기존 8종은 전부
 //   방출-이후(굤적/환경)만 건드렸다 — 「언제 떼는가」의 계산법이 처음 바뀐다.
 {id:'surge',  k:'rSurge',  kd:'rSurgeD',  color:'#ff6ae6'},
 // ★invert(입력매핑 축) — «사람 입력의 드래그→조준 매핑 자체»를 뒤집는다.
 //   CPU 는 좌표를 직접 계산해 넣으므로 무접촉(사람 전용) — AI 회귀 없음.
 {id:'invert', k:'rInvert', kd:'rInvertD', color:'#b46aff'},
 // ★pull(주기적 사건 축) — wind(상시 힘)와 달리 «예고 후 순간 펄스»다.
 //   예고를 보고 대응을 «타이밍»해야 한다 — wind 의 「계속 보정」과는 다른 축.
 {id:'pull',   k:'rPull',   kd:'rPullD',   color:'#6c7aff'},
 // ★safezone(자리보상 축, 아레나 임베드) — pit(위험지대·회피)의
 //   반대축인 «보상지대·접근». D안(아레나 기믹) 흡수 — 시각은 curArena 팔레트를 그대로 쒴다.
 {id:'safezone', k:'rSafeZone', kd:'rSafeZoneD', color:'#b8ff5a'}
];
const RULE_BY_ID = {};
RULES.forEach(function(r){ RULE_BY_ID[r.id] = r; });

// Arcade ladder: 12 bouts (8 original + 4 added 2026-08-22), rising difficulty, each with its own arena + rule.
const LADDER = [
 {char:'hayate',    pers:'balance', arena:'dawn',    rule:'normal', wins:2, skill:0.16},
 {char:'kotsubu',   pers:'tricky',  arena:'sakura',  rule:'ice',    wins:2, skill:0.28},
 {char:'nagare',    pers:'defend',  arena:'bamboo',  rule:'wind',   wins:2, skill:0.40},
 {char:'iwao',      pers:'defend',  arena:'snow',    rule:'bouncy', wins:2, skill:0.52},
 {char:'kumo',      pers:'balance', arena:'cosmos',  rule:'rush',   wins:3, skill:0.70},
 {char:'akaoni',    pers:'aggro',   arena:'volcano', rule:'bombs',  wins:3, skill:0.74},
 {char:'tetsuzan',  pers:'aggro',   arena:'neon',    rule:'orbit',  wins:3, skill:0.76},
 {char:'daimyojin', pers:'boss',    arena:'temple',  rule:'pit',    wins:3, skill:1.00},
 // 2026-08-22 단계확장 A안 — 9~12전. ★기존 8전이 8개 아레나를 «전부 다르게»
 //   쓨던 관례를 그대로 잊는다 — 여기서도 지금까지 사다리에 «한 번도» 안 쓴
 //   4개 아레나(sunset/midnight/desert/storm, 전부 unlock:0 기존 자산)를
 //   하나씩만 배정해 반복이 없다. 새 캐릭터는 이번 배치 범위 밖(C안 보류,
 //   phase2)이라 9~10전은 «사다리에 한 번도 안 나온» 기존 선수(kagero·kotaro)를
 //   새로 등판시키고, 11~12전은 「그랜드 챔피언에게 가는 마지막 관문」이라는
 //   서사로 기존 최상위 라이벌의 리매치(tetsuzan·daimyojin, 새 룰+새 배경)로
 //   짜다 — 복붙이가 아니라 «다른 요구»(신규 RULE)로 재도전하는 구조다.
 {char:'kagero',    pers:'tricky',  arena:'storm',   rule:'surge',    wins:3, skill:0.78},
 {char:'kotaro',    pers:'balance', arena:'midnight',rule:'invert',   wins:3, skill:0.84},
 {char:'tetsuzan',  pers:'aggro',   arena:'desert',  rule:'pull',     wins:3, skill:0.90},
 {char:'daimyojin', pers:'boss',    arena:'sunset',  rule:'safezone', wins:3, skill:1.00}
];
const PERS_KEY = {aggro:'pAggro', defend:'pDefend', tricky:'pTricky', balance:'pBalance', boss:'pBoss'};

// ---------------- progress (localStorage, file:// safe) ----------------
function lsGet(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
function lsSet(k,v){ try { localStorage.setItem(k,v); } catch(e){} try { if (typeof window!=='undefined' && window.__nativeStorageMirror) window.__nativeStorageMirror(k,v); } catch(e){} }
// ---------------- 프로모션(토스 포인트) 지급 문턱 ----------------
// 「다이묘진 해금하기」 30원(2026-08-29 President). 정본 = 8 (= CHARS daimyojin.unlock 과 같은 값).
// ★캐릭터 해금 밸런스(CHARS[].unlock)와 «분리»해 둔 «지급 판정 문턱»이다 — TESTONLY 빌드는
//   scripts/promo_testonly_patch.mjs 가 이 숫자만 1 로 바꾼다(캐릭터 unlock 은 안 건드린다).
// 트리거는 finishMatch() 에서 SAVE.cleared 가 이 문턱을 «처음 넘는 순간» 1회다. 부팅 시 소급 지급 없음.
const PROMO_DAIMYOJIN_STAGE = 8;
function promoNotifyDaimyojinUnlock(){
  // 전역 훅은 토스 빌드의 sdk-boot 만 설치한다(웹/file:// 에서는 undefined → 조용히 생략). 절대 throw 안 함.
  try { if (typeof window !== 'undefined' && typeof window.__sumoPromoUnlock === 'function') window.__sumoPromoUnlock('daimyojin'); } catch(e){}
}
// ---------------- 프로모션 ② 「5판 플레이하기」 50원 (2026-09-01 President) ----------------
// ★「1판」 = «끝난» 매치. finishMatch() 가 불린 순간에만 센다 — 시작만 하고 이탈하면 세지 않는다.
// ★과거 누적 판수는 «인정하지 않는다». 판수는 TS(src/toss/promoPlays.ts)가 프로모션 코드별
//   «새 키»로 0 부터 센다 — 이 파일은 세이브(SAVE.cleared 등)를 «넘기지 않는다».
function promoNotifyMatchEnd(){
  try { if (typeof window !== 'undefined' && typeof window.__sumoPromoMatchEnd === 'function') window.__sumoPromoMatchEnd(); } catch(e){}
}
const DEF_SAVE = {v:1, cleared:0, byDiff:[0,0,0], champion:false, diff:1, lastChar:'kotaro',
  // 2026-08-22 오늘의 대결(④) — streak/lastClaimDateKey 는 스칼라(정확일치 배열 함정 자체가 없다).
  // bonusArenas 는 길이 제약 없는 느슨한 배열(id 문자열 목록) — byDiff 와 달리 「정확히 N 개여야 한다」는
  // 제약 자체가 없어 정확일치 리셋 함정이 구조적으로 없다(길이 검사 없이 스프레드만 한다).
  attendance:{streak:0, lastClaimDateKey:'', bonusArenas:[]}};
let SAVE = Object.assign({}, DEF_SAVE);
// 2026-08-22 AI티 단계확장 D-2 — 네온 스레드 course_add_decision_log.md 의
// 「정확일치(length!==N) 검사가 리셋을 부른다」 선례를 스모에서도 발견해 선제 방어.
// byDiff 는 «난이도 단계 수»(현재 3: 쉬움/보통/어려움)를 축으로 하는 배열이다.
// 지금은 난이도 단계를 늘리지 않지만(President 가 B안 기각 확정), 정확일치
// 리셋 자체가 다음 어떤 변경에도 폭발할 수 있는 지뢰라 지금 미리 패딩으로 바꾼다.
// ★네온과 같은 패턴: 짧으면 0 으로 «패딩», 길면(미래 포맷 롤백) «자른다» — 어느
// 쪽도 있던 값을 통째로 버리지 않는다. ⛔주의: 이 패치가 반영 안 된 «구버전
// 빌드»가 신버전 세이브(더 긴 byDiff)를 읽으면 그 구버전 코드의 옛 `!==3` 검사가
// 여전히 살아있어 리셋된다 — 네온 로그에도 있던 같은 한계이며 배포 시점 문제라
// 코드로 더 막을 수 없다.
const DIFF_TIERS = 3; // Easy/Normal/Hard. 티어 수를 바꾸면 «이 상수만» 고치면 된다.
function loadSave(){
  try {
    const raw = lsGet('sumoSave');
    if (raw){
      const o = JSON.parse(raw);
      if (o && typeof o === 'object'){
        SAVE = Object.assign({}, DEF_SAVE, o);
        if (!Array.isArray(SAVE.byDiff)) SAVE.byDiff = [0,0,0];
        SAVE.byDiff = SAVE.byDiff.map(function(v){ return Math.max(0, v|0); });
        while (SAVE.byDiff.length < DIFF_TIERS) SAVE.byDiff.push(0);
        if (SAVE.byDiff.length > DIFF_TIERS) SAVE.byDiff.length = DIFF_TIERS;
        // ★cleared 의 상한은 LADDER.length «에서 유도»한다 — 상수를 다시 박지
        // 않는다(8→12 처럼 스테이지 수가 바뀌어도 이 줄은 다시 안 건드려도 된다).
        SAVE.cleared = Math.max(0, Math.min(LADDER.length, SAVE.cleared|0));
        // ★attendance 는 중첩 객체라 Object.assign({},DEF_SAVE,o) 한 줄로는 부분적으로
        // 있는 o.attendance 가 DEF_SAVE.attendance 를 «통째로 덮어쓴다»(약한 필드만 있으면 나머지가
        // undefined 로 날아간다). 따로 한 번 더 병합해야 안전하다.
        const a = (o && typeof o.attendance === 'object' && o.attendance) ? o.attendance : {};
        SAVE.attendance = Object.assign({}, DEF_SAVE.attendance, a);
        SAVE.attendance.streak = Math.max(0, SAVE.attendance.streak|0);
        if (typeof SAVE.attendance.lastClaimDateKey !== 'string') SAVE.attendance.lastClaimDateKey = '';
        if (!Array.isArray(SAVE.attendance.bonusArenas)) SAVE.attendance.bonusArenas = [];
        // 길이 제약 없이 타입만 거른다 — 잘못된 값이 섮여도 전체 배열을 리셋하지 않고 그 원소만 거른다.
        SAVE.attendance.bonusArenas = SAVE.attendance.bonusArenas.filter(function(id){ return typeof id === 'string'; });
      }
    }
  } catch(e){ SAVE = Object.assign({}, DEF_SAVE); }
}
function persist(){ try { lsSet('sumoSave', JSON.stringify(SAVE)); } catch(e){} }
function charUnlocked(c){ return c.unlock === 0 || SAVE.cleared >= c.unlock; }
function arenaUnlocked(a){ return a.unlock === 0 || SAVE.cleared >= a.unlock ||
  (SAVE.attendance && SAVE.attendance.bonusArenas && SAVE.attendance.bonusArenas.indexOf(a.id) !== -1); }
function unlockedChars(){ return CHARS.filter(charUnlocked); }
function unlockedArenas(){ return ARENAS.filter(arenaUnlocked); }

// ---------------- attendance (오늘의 대결, ④ 2026-08-22) ----------------
// [실측] 스모는 쓸 수 있는 재화가 없다(SAVE 에 spend 가능한 수치 자원 전무) — 억지로 새
// 재화를 만들지 않고 이미 있는 콘텐츠(12아레나×12룰×10선수 조합)를 재료로 쓴다.
// 사다리 진행도(SAVE.cleared)와는 절대 안 섞는다 — 이중 해금 혼란 방지.
// Chief 지시 정본(gameWorld.kstDateKey) 그대로 재사용 — UTC getter 기반이라 기기 로컬/타임존과 무관.
function kstDateKey(now){
  now = (now === undefined) ? Date.now() : now;
  const kst = new Date(now + 9*60*60*1000);
  return kst.getUTCFullYear() + '-' + String(kst.getUTCMonth()+1).padStart(2,'0') + '-' + String(kst.getUTCDate()).padStart(2,'0');
}
function dateKeyToUTCms(key){
  const parts = key.split('-');
  return Date.UTC(+parts[0], +parts[1]-1, +parts[2]);
}
// tier 0~5: 고정 조합(기존 룰 위주, 쉽게 -> 어렵게). tier 6+(streak>=7): 신규 RULE 4종 중
// 하나를 날수 기반으로 돌려서 — 매주 같은 특급 보상이 반복되지 않게 한다.
const DAILY_POOL = [
  {char:'hayate',   arena:'dawn',    rule:'normal'},
  {char:'kotsubu',  arena:'sakura',  rule:'ice'},
  {char:'nagare',   arena:'bamboo',  rule:'wind'},
  {char:'iwao',     arena:'snow',    rule:'bouncy'},
  {char:'akaoni',   arena:'volcano', rule:'bombs'},
  {char:'tetsuzan', arena:'neon',    rule:'orbit'},
];
const DAILY_PEAK = [
  {char:'kagero',    arena:'storm',    rule:'surge'},
  {char:'kotaro',    arena:'midnight', rule:'invert'},
  {char:'tetsuzan',  arena:'desert',   rule:'pull'},
  {char:'daimyojin', arena:'sunset',   rule:'safezone'},
];
function todaysFeatured(streakOverride){
  const streak = Math.max(1, (streakOverride !== undefined ? streakOverride : SAVE.attendance.streak) || 1);
  const tier = Math.min(DAILY_POOL.length, streak - 1);
  if (tier < DAILY_POOL.length) return DAILY_POOL[tier];
  const dayNum = Math.floor(dateKeyToUTCms(kstDateKey()) / 86400000);
  return DAILY_PEAK[((dayNum % DAILY_PEAK.length) + DAILY_PEAK.length) % DAILY_PEAK.length];
}
// 상태를 바꾸지 않고 오늘 클레임하면 스트릭이 몇이 될지 미리 계산한다 -- UI 표시
// (renderDailyBout)가 claimAttendance()와 동일한 간격 로직을 쓰려고 따로 뺐다.
function previewStreak(){
  const today = kstDateKey();
  const last = SAVE.attendance.lastClaimDateKey;
  if (last === today) return SAVE.attendance.streak;
  if (!last) return 1;
  if (today < last) return SAVE.attendance.streak;
  const gapDays = Math.round((dateKeyToUTCms(today) - dateKeyToUTCms(last)) / 86400000);
  return (gapDays <= 2) ? (SAVE.attendance.streak || 0) + 1 : 1;
}
function grantBonusArena(arenaId){
  if (!arenaId) return;
  if (SAVE.attendance.bonusArenas.indexOf(arenaId) === -1){ SAVE.attendance.bonusArenas.push(arenaId); persist(); }
}
// «하루에 한 번»만 진행한다(같은 날 재호출은 no-op). 뒤로 가는 날짜(기기시계 조작)는
// 무시한다 — 갱신도 리셋도 안 한다(코스메틱 보상이라 그 이상 방어는 비례적이지 않다).
//
// ⚠️getServerTime() 미연동 — 2026-08-22 후속 판단(누락 아님, 확정):
//   위협 모델은 «앞»으로(forward) 시계를 돌려 스트릭을 빨리 쌓는 것뿐이다(뒤로
//   돌리기는 위에서 이미 ignored 로 막았다). 그런데 이 보상은 (a) 로컬 SAVE
//   하나뿐 — 서버 동기화·리더보드·타 유저 영향 0, (b) grantBonusArena() 가 주는
//   것도 코스메틱 아레나 등록 1건뿐, 환금성 재화·구매 가능 자원이 아니다.
//   forward 조작으로 얻을 수 있는 최대 이득은 "본인 기기에서 코스메틱 해금을
//   며칠 앞당기는" 것 — 그 이상의 악용 경로(부정 재판매·타인 피해·매출 손실)가
//   존재하지 않는다. 따라서 getServerTime() 없이 기기시계만 쓰는 현재 상태로
//   «충분»하다고 판단한다. 재화·구매·리더보드가 이 시스템에 붙는 순간(=위협
//   모델이 바뀌는 순간) 이 판단은 무효 — 그때는 반드시 서버 시각으로 교체할 것.
function claimAttendance(){
  const today = kstDateKey();
  const last = SAVE.attendance.lastClaimDateKey;
  if (last === today) return {streak: SAVE.attendance.streak, alreadyClaimed: true};
  if (last && today < last) return {streak: SAVE.attendance.streak, alreadyClaimed: false, ignored: true};
  if (last){
    const gapDays = Math.round((dateKeyToUTCms(today) - dateKeyToUTCms(last)) / 86400000);
    // ★관대한 스트릭: 하루 결석(gapDays===2)까지는 유지, 이틀 이상 결석해야 리셋.
    SAVE.attendance.streak = (gapDays <= 2) ? (SAVE.attendance.streak || 0) + 1 : 1;
  } else {
    SAVE.attendance.streak = 1;
  }
  SAVE.attendance.lastClaimDateKey = today;
  const feat = todaysFeatured();
  // ★누적이 «실질 이득」이 되는 지점(Chief 지시 보완) — 7일 이상 연속출석이면 그날의
  // 아레나를 광고 없이도 영구 등록한다. 광고 연동(더블) 자체는 ③ 리워드광고 소관이라
  // 이 함수는 그와 무관하게 독립적으로 작동한다.
  if (SAVE.attendance.streak >= 7) grantBonusArena(feat.arena);
  persist();
  track('attendance_claim', {streak_day: SAVE.attendance.streak});
  return {streak: SAVE.attendance.streak, alreadyClaimed: false, featured: feat};
}

function fmt(str, n){ return String(str).replace('{n}', n); }
// ============================== audio (WebAudio synthesis only) ==============================
let audioCtx = null, masterGain = null;
let muted = (lsGet('sumoMuted') === '1');
const chargeOsc = {1:null, 2:null};

function initAudio(){
  try {
    if (!audioCtx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = new AC();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = muted ? 0 : 1;
      masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch(e){ audioCtx = null; }
}
function setMuted(m){
  muted = !!m;
  lsSet('sumoMuted', muted ? '1' : '0');
  if (masterGain && audioCtx){
    try {
      masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
      masterGain.gain.setValueAtTime(muted ? 0 : 1, audioCtx.currentTime);
    } catch(e){}
  }
  if (muted){ stopCharge(1); stopCharge(2); bgmStop(0.2); }
  else bgmSync();
}
function audioSuspend(){
  stopCharge(1); stopCharge(2);
  bgmSuspend();
  if (audioCtx && audioCtx.state === 'running'){ try { audioCtx.suspend(); } catch(e){} }
}
function audioResume(){
  if (audioCtx && audioCtx.state === 'suspended'){ try { audioCtx.resume(); } catch(e){} }
  bgmResume();
}
function tone(opt){
  if (!audioCtx || !masterGain || muted) return;
  try {
    const now = audioCtx.currentTime + (opt.at || 0);
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    let node = osc;
    if (opt.filter){
      const f = audioCtx.createBiquadFilter();
      f.type = opt.filter; f.frequency.setValueAtTime(opt.cut || 600, now);
      osc.connect(f); node = f;
    }
    node.connect(g); g.connect(masterGain);
    osc.type = opt.type || 'sine';
    osc.frequency.setValueAtTime(opt.f0, now);
    if (opt.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opt.f1), now + opt.dur);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, opt.vol), now + (opt.atk || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, now + opt.dur);
    osc.start(now); osc.stop(now + opt.dur + 0.02);
  } catch(e){}
}
function noiseBurst(dur, vol, cut){
  if (!audioCtx || !masterGain || muted) return;
  try {
    const n = Math.floor(audioCtx.sampleRate * dur);
    const buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i=0;i<n;i++) d[i] = (Math.random()*2-1) * Math.pow(1 - i/n, 2);
    const src = audioCtx.createBufferSource(); src.buffer = buf;
    const f = audioCtx.createBiquadFilter(); f.type='lowpass'; f.frequency.value = cut || 1400;
    const g = audioCtx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(masterGain);
    src.start();
  } catch(e){}
}
/* ZzFX — Zuper Zmall Zound Zynth (Micro Edition). MIT License, Copyright 2019 Frank Force
   https://github.com/KilledByAPixel/ZzFX — 파라미터 배열 하나로 효과음을 «생성»한다(음원 파일 0).
   원본 zzfx() 는 자체 AudioContext 를 만들지만 여기서는 게임의 audioCtx/masterGain(음소거·suspend 연동)으로
   재생하고, 생성 샘플은 키별로 캐시해 재생 시 할당 0. 실패하면 조용히 기존 tone() 경로가 남는다. */
const ZZR = 44100;
function zzfxG(volume,randomness,frequency,attack,sustain,release,shape,shapeCurve,slide,deltaSlide,pitchJump,pitchJumpTime,repeatTime,noise,modulation,bitCrush,delay,sustainVolume,decay,tremolo){
  volume=volume===undefined?1:volume;randomness=randomness||0;frequency=frequency===undefined?220:frequency;attack=attack||0;sustain=sustain||0;release=release===undefined?.1:release;
  shape=shape||0;shapeCurve=shapeCurve===undefined?1:shapeCurve;slide=slide||0;deltaSlide=deltaSlide||0;pitchJump=pitchJump||0;pitchJumpTime=pitchJumpTime||0;repeatTime=repeatTime||0;
  noise=noise||0;modulation=modulation||0;bitCrush=bitCrush||0;delay=delay||0;sustainVolume=sustainVolume===undefined?1:sustainVolume;decay=decay||0;tremolo=tremolo||0;
  const PI2=Math.PI*2,sign=v=>v>0?1:-1;
  let startSlide=slide*=500*PI2/ZZR/ZZR,startFrequency=frequency*=(1+randomness*2*Math.random()-randomness)*PI2/ZZR;
  let t=0,tm=0,i=0,j=1,r=0,c=0,s=0,f,length;
  attack=attack*ZZR+9;decay*=ZZR;sustain*=ZZR;release*=ZZR;delay*=ZZR;
  deltaSlide*=500*PI2/(ZZR*ZZR*ZZR);modulation*=PI2/ZZR;pitchJump*=PI2/ZZR;pitchJumpTime*=ZZR;repeatTime=repeatTime*ZZR|0;
  length=attack+decay+sustain+release+delay|0;
  const b=new Float32Array(length);
  for(;i<length;b[i++]=s){
    if(!(++c%(bitCrush*100|0))){
      s=shape?shape>1?shape>2?shape>3?Math.sin((t%PI2)*(t%PI2)*(t%PI2)):Math.max(Math.min(Math.tan(t),1),-1):1-(2*t/PI2%2+2)%2:1-4*Math.abs(Math.round(t/PI2)-t/PI2):Math.sin(t);
      s=(repeatTime?1-tremolo+tremolo*Math.sin(PI2*i/repeatTime):1)*sign(s)*Math.pow(Math.abs(s),shapeCurve)*volume*(
        i<attack?i/attack:i<attack+decay?1-((i-attack)/decay)*(1-sustainVolume):i<attack+decay+sustain?sustainVolume:i<length-delay?(length-i-delay)/release*sustainVolume:0);
      s=delay?s/2+(delay>i?0:(i<length-delay?1:(length-i)/delay)*b[i-delay|0]/2):s;
    }
    f=(frequency+=slide+=deltaSlide)*Math.cos(modulation*tm++);
    t+=f-f*noise*(1-(Math.sin(i)+1)*1e9%2);
    if(j&&++j>pitchJumpTime){frequency+=pitchJump;startFrequency+=pitchJump;j=0}
    if(repeatTime&&!(++r%repeatTime)){frequency=startFrequency;slide=startSlide;j=j||1}
  }
  return b;
}
const ZZ_MASTER = 0.26, _zzCache = {};
/* [volume,randomness,freq,attack,sustain,release,shape,curve,slide,dSlide,pJump,pJumpT,repeat,noise,mod,crush,delay,susVol,decay,tremolo] */
const ZZ = {
  ui:    [.5,0,540,.004,.02,.07,0,1.5,0,0,0,0,0,0,0,0,0,1,0,0],
  hit:   [1.2,.05,150,.004,.06,.26,3,1.8,-60,0,0,0,0,.45,0,0,0,1,.02,0],
  hitBig:[1.5,.05,110,.004,.09,.36,3,1.9,-70,0,0,0,0,.55,0,0,.03,1,.03,0],
  dash:  [.8,.03,320,.01,.05,.16,1,1.2,-40,0,0,0,0,.25,0,0,0,1,0,0],
  fall:  [1,.02,260,.01,.14,.55,2,1.4,-45,-.1,0,0,0,.2,0,0,.05,1,.05,0],
  boom:  [1.4,.05,90,.01,.12,.5,3,1.9,-30,0,0,0,0,.6,0,0,.04,1,.04,0],
  count: [.6,0,520,.004,.05,.09,2,1.2,0,0,0,0,0,0,0,0,0,1,0,0],
  go:    [.7,0,780,.004,.08,.16,2,1.2,0,0,260,.04,0,0,0,0,0,1,0,0],
  ring:  [.55,0,660,.005,.06,.22,0,1.3,0,0,330,.05,0,0,0,0,.03,1,0,0]
};
function zz(key, when, vol){
  if (!audioCtx || !masterGain || muted) return false;
  try {
    let buf = _zzCache[key];
    if (!buf){ const d = zzfxG.apply(null, ZZ[key]); buf = audioCtx.createBuffer(1, d.length, ZZR); buf.getChannelData(0).set(d); _zzCache[key] = buf; }
    const s = audioCtx.createBufferSource(), g = audioCtx.createGain(); s.buffer = buf; g.gain.value = ZZ_MASTER * (vol === undefined ? 1 : vol);
    s.connect(g); g.connect(masterGain); s.start(audioCtx.currentTime + (when||0));
    return true;
  } catch(e){ return false; }
}
function playHit(intensity){
  const i = Math.max(0.1, Math.min(1, intensity));
  if (zz(i > 0.6 ? 'hitBig' : 'hit', 0, 0.55 + i*0.6)) return;
  tone({type:'triangle', f0:70 + i*90, f1:30, dur:0.16 + i*0.16, vol:0.28*i + 0.06, filter:'lowpass', cut:420});
  noiseBurst(0.09 + i*0.08, 0.10 + i*0.16, 900 + i*1400);
}
function playDash(charge){
  if (zz('dash', 0, 0.5 + charge*0.7)) return;
  tone({type:'sine', f0:170 + charge*340, f1:80, dur:0.24, vol:0.15});
  noiseBurst(0.10, 0.05 + charge*0.05, 2200);
}
function startCharge(id, rate){
  if (!audioCtx || !masterGain || muted) return;
  stopCharge(id);
  try {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    const f = audioCtx.createBiquadFilter();
    osc.connect(f); f.connect(g); g.connect(masterGain);
    osc.type = 'sawtooth'; f.type = 'lowpass';
    const now = audioCtx.currentTime;
    const span = 1.2 / (rate || 1);
    f.frequency.setValueAtTime(260, now);
    osc.frequency.setValueAtTime(id === 1 ? 68 : 78, now);
    osc.frequency.linearRampToValueAtTime(id === 1 ? 270 : 300, now + span);
    g.gain.setValueAtTime(0.008, now);
    g.gain.linearRampToValueAtTime(0.115, now + span);
    osc.start();
    chargeOsc[id] = {osc:osc, gain:g};
  } catch(e){}
}
function stopCharge(id){
  const a = chargeOsc[id];
  if (!a) return;
  try {
    const now = audioCtx.currentTime;
    a.gain.gain.cancelScheduledValues(now);
    a.gain.gain.setValueAtTime(Math.max(0.0002, a.gain.gain.value), now);
    a.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    a.osc.stop(now + 0.07);
  } catch(e){}
  chargeOsc[id] = null;
}
function playFall(){
  if (zz('fall')) return;
  tone({type:'sine', f0:230, f1:40, dur:0.65, vol:0.2});
  noiseBurst(0.3, 0.1, 700);
}
function playBoom(){
  if (zz('boom')) return;
  tone({type:'square', f0:120, f1:30, dur:0.4, vol:0.22, filter:'lowpass', cut:500});
  noiseBurst(0.34, 0.26, 1800);
}
function playChord(notes, tempo, vol){
  notes.forEach(function(f, i){ tone({type:'triangle', f0:f, dur:0.36, vol:vol||0.12, at:i*(tempo||0.11)}); });
}
function playWin(big){ playChord(big ? [392,523.25,659.25,783.99,1046.5] : [329.63,415.3,493.88,659.25], 0.11, 0.13); }
function playLose(){ playChord([392,349.23,293.66,220], 0.15, 0.11); }
function playFanfare(){ playChord([523.25,659.25,783.99,1046.5,1318.5,1567.98], 0.1, 0.14); }
function playCount(hi){ if (zz(hi ? 'go' : 'count')) return; tone({type:'square', f0: hi ? 880 : 520, dur:0.13, vol:0.09, filter:'lowpass', cut:2200}); }
function playUI(){ if (zz('ui')) return; tone({type:'sine', f0:660, f1:880, dur:0.07, vol:0.055}); }
function playUnlockSfx(){ playChord([659.25,830.61,987.77,1318.5], 0.08, 0.12); }

// ============================== BGM (synthesised, no audio files) ==============================
// Three moods on one bus that sits well under the SFX bus:
//   menu   - title / help / select / result: slow taiko pulse, koto motif, low drone
//   battle - VS card and the bout itself: driving 8th bass, steady taiko, shaker
//   boss   - final arcade bout: faster, tritone bass, double-time taiko
// Patterns are 16 steps of a bar, transposed per bar by `bars`, so a loop is 4 bars long.
let bgmGain = null, bgmNoise = null;
const BGM = {track:null, step:0, next:0, spb:0.125, timer:null};
const BGM_MIX = 0.34;
function midiHz(m){ return 440 * Math.pow(2, (m - 69) / 12); }
function seqMap(o){ return o; }
const BGM_TRACKS = {
  menu:{
    bpm:76, mix:1, bars:[0,0,3,-2],
    drone:38, droneVol:0.05, droneDur:7.2, droneCut:240,
    bass:seqMap({0:38, 10:45}), bassVol:0.052, bassDur:1.15, bassType:'triangle', bassCut:440,
    lead:seqMap({0:69, 3:70, 6:74, 11:70, 14:69}), leadVol:0.05, leadDur:0.6, leadType:'triangle', leadCut:2400,
    taiko:'x.......o.......x.......o...o...x.......o.......x...o...o...o...', taikoVol:0.075,
    hat:'', hatVol:0
  },
  battle:{
    bpm:132, mix:1, bars:[0,0,-4,-5],
    drone:0, droneVol:0, droneDur:0, droneCut:240,
    bass:seqMap({0:38, 2:38, 4:45, 6:38, 8:38, 10:38, 12:46, 14:45}),
    bassVol:0.072, bassDur:0.13, bassType:'square', bassCut:380,
    lead:seqMap({0:62, 2:65, 3:67, 6:69, 8:67, 10:65, 11:62, 14:69}),
    leadVol:0.032, leadDur:0.17, leadType:'sawtooth', leadCut:1500,
    taiko:'x.......x.......x.......x....o..x.......x.......x...o...x..o.o..', taikoVol:0.088,
    hat:'..x...x...x...x...x...x...x...x...x...x...x...x...x...x...x...x.', hatVol:0.022
  },
  boss:{
    bpm:152, mix:1, bars:[0,0,-2,-4],
    drone:26, droneVol:0.04, droneDur:3.2, droneCut:200,
    bass:seqMap({0:38, 1:38, 2:38, 4:38, 6:38, 7:38, 8:38, 10:38, 12:44, 14:45}),
    bassVol:0.078, bassDur:0.11, bassType:'square', bassCut:420,
    lead:seqMap({0:74, 1:75, 2:74, 4:70, 8:68, 10:69, 12:70, 14:75}),
    leadVol:0.034, leadDur:0.14, leadType:'sawtooth', leadCut:1900,
    taiko:'x..x..x.x..x..x.x..x..x.x..x..x.x..x..x.x..x..x.x.x.x.x.x.x.x.x.', taikoVol:0.095,
    hat:'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.', hatVol:0.02
  }
};
function bgmInit(){
  if (!audioCtx || bgmGain) return;
  try {
    bgmGain = audioCtx.createGain();
    bgmGain.gain.value = 0;
    bgmGain.connect(masterGain);
    const n = Math.floor(audioCtx.sampleRate * 0.5);
    bgmNoise = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
    const d = bgmNoise.getChannelData(0);
    for (let i=0;i<n;i++) d[i] = Math.random()*2-1;
  } catch(e){ bgmGain = null; }
}
function bgmVoice(t0, hz, dur, type, vol, cut){
  if (!audioCtx || !bgmGain || !vol) return;
  try {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain(), f = audioCtx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(cut || 1600, t0);
    o.type = type || 'triangle';
    o.frequency.setValueAtTime(hz, t0);
    o.connect(f); f.connect(g); g.connect(bgmGain);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0004, vol), t0 + 0.014);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.06, dur));
    o.start(t0); o.stop(t0 + dur + 0.05);
  } catch(e){}
}
function bgmNoiseHit(t0, dur, vol, cut, ftype){
  if (!audioCtx || !bgmGain || !bgmNoise || !vol) return;
  try {
    const s = audioCtx.createBufferSource(); s.buffer = bgmNoise; s.loop = true;
    const f = audioCtx.createBiquadFilter(); f.type = ftype || 'lowpass';
    f.frequency.setValueAtTime(cut || 2000, t0);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(Math.max(0.0004, vol), t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(bgmGain);
    s.start(t0); s.stop(t0 + dur + 0.03);
  } catch(e){}
}
function bgmTaiko(t0, vol, deep){
  if (!audioCtx || !bgmGain || !vol) return;
  try {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(deep ? 170 : 244, t0);
    o.frequency.exponentialRampToValueAtTime(deep ? 48 : 96, t0 + 0.17);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0004, vol), t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (deep ? 0.44 : 0.26));
    o.connect(g); g.connect(bgmGain);
    o.start(t0); o.stop(t0 + 0.55);
  } catch(e){}
  bgmNoiseHit(t0, 0.045, vol * 0.45, 2600, 'lowpass');
}
function bgmStepAt(i, t){
  const T = BGM_TRACKS[BGM.track];
  if (!T) return;
  const off = T.bars[Math.floor(i / 16) % T.bars.length];
  const k = i % 16;
  const bn = T.bass[k]; if (bn) bgmVoice(t, midiHz(bn + off), T.bassDur, T.bassType, T.bassVol, T.bassCut);
  const ln = T.lead[k]; if (ln) bgmVoice(t, midiHz(ln + off), T.leadDur, T.leadType, T.leadVol, T.leadCut);
  const dr = T.taiko.charAt(i);
  if (dr === 'x') bgmTaiko(t, T.taikoVol, true);
  else if (dr === 'o') bgmTaiko(t, T.taikoVol * 0.55, false);
  if (T.hat && T.hat.charAt(i) === 'x') bgmNoiseHit(t, 0.05, T.hatVol, 6500, 'highpass');
  if ((i % 32) === 0 && T.drone) bgmVoice(t, midiHz(T.drone + off), T.droneDur, 'sine', T.droneVol, T.droneCut);
}
function bgmLen(){ const T = BGM_TRACKS[BGM.track]; return T ? T.bars.length * 16 : 32; }
function bgmTick(){
  if (!BGM.track || !audioCtx || audioCtx.state !== 'running') return;
  const horizon = audioCtx.currentTime + 0.3;
  let guard = 0;
  while (BGM.next < horizon && guard++ < 96){
    if (BGM.next < audioCtx.currentTime) BGM.next = audioCtx.currentTime + 0.04;
    bgmStepAt(BGM.step, BGM.next);
    BGM.next += BGM.spb;
    BGM.step = (BGM.step + 1) % bgmLen();
  }
}
function bgmLevel(){
  if (muted || !BGM.track) return 0;
  const T = BGM_TRACKS[BGM.track];
  return BGM_MIX * (T ? T.mix : 1) * (activeScreen === 'sc-pause' ? 0.42 : 1);
}
function bgmRamp(target, secs){
  if (!bgmGain || !audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    bgmGain.gain.cancelScheduledValues(now);
    bgmGain.gain.setValueAtTime(Math.max(0.0001, bgmGain.gain.value), now);
    bgmGain.gain.linearRampToValueAtTime(Math.max(0, target), now + (secs || 0.3));
  } catch(e){}
}
function bgmStart(name){
  bgmInit();
  if (!audioCtx || !bgmGain || !BGM_TRACKS[name]) return;
  BGM.track = name;
  BGM.step = 0;
  BGM.spb = 15 / BGM_TRACKS[name].bpm;
  BGM.next = audioCtx.currentTime + 0.08;
  bgmRamp(bgmLevel(), 0.8);
  if (!BGM.timer) BGM.timer = setInterval(bgmTick, 60);
  bgmTick();
}
function bgmStop(fade){
  bgmRamp(0, fade || 0.25);
  BGM.track = null;
  if (BGM.timer){ clearInterval(BGM.timer); BGM.timer = null; }
}
function bgmSuspend(){ if (BGM.timer){ clearInterval(BGM.timer); BGM.timer = null; } }
function bgmResume(){
  if (BGM.track && audioCtx && !BGM.timer){
    BGM.next = audioCtx.currentTime + 0.08;
    BGM.step = 0;
    BGM.timer = setInterval(bgmTick, 60);
  }
}
function bgmWanted(){
  if (muted) return null;
  // guarded: these live further down the file, so never assume they are initialised yet
  try {
    const finalBout = (stageIdx === LADDER.length - 1);
    if (activeScreen === null || activeScreen === 'sc-pause') return (mode === 'arcade' && finalBout) ? 'boss' : 'battle';
    if (activeScreen === 'sc-vs') return (vsCfg && vsCfg.mode === 'arcade' && finalBout) ? 'boss' : 'battle';
  } catch(e){}
  return 'menu';
}
let bgmSwap = null;
function bgmSync(){
  if (!audioCtx) return;
  const want = bgmWanted();
  if (want === BGM.track){ bgmRamp(bgmLevel(), 0.3); return; }
  if (bgmSwap){ clearTimeout(bgmSwap); bgmSwap = null; }
  if (!want){ bgmStop(0.28); return; }
  if (BGM.track){
    bgmStop(0.22);
    bgmSwap = setTimeout(function(){ bgmSwap = null; if (bgmWanted() === want) bgmStart(want); }, 250);
  } else bgmStart(want);
}
// Autoplay policy: nothing sounds until the player has actually touched the page.
function armAudio(){
  initAudio();
  bgmSync();
  if (audioCtx){
    ['pointerdown','keydown','touchstart'].forEach(function(ev){ window.removeEventListener(ev, armAudio); });
  }
}
// ============================== engine ==============================
const canvas = document.getElementById('gameCanvas');
/* 그래픽 고도화(2026-08-30) — 블룸 포스트 레이어(public/game/sumo-post.js). 있으면 세계는 POST 의
   오프스크린 scene 캔버스에 그리고 #gameCanvas 는 애나운스·비네트 전용 «투명» 캔버스가 된다(글자는
   안 번진다). 없으면(WebGL 불가·?bloom=off) 예전처럼 #gameCanvas 하나에 그린다. ctx 는 draw() 가
   프레임마다 두 컨텍스트 사이를 오가므로 let 이다 — 나머지 렌더 코드는 그대로 ctx 만 쓴다. */
const POST = (typeof window !== 'undefined' && window.SumoPost && window.SumoPost.init(canvas)) ? window.SumoPost : null;
const ctxMain = canvas.getContext('2d', {alpha: !!POST});
let ctx = ctxMain;
if (POST){ canvas.style.background = 'transparent'; canvas.style.position = 'relative'; }
let bloomActive = false;
/* 캔버스 shadowBlur 는 모바일에서 가장 비싼 연산 — 블룸이 켜져 있으면 0(블룸이 대신 번진다), 폴백에서만 원래 값. */
function glow(px){ return bloomActive ? 0 : px; }
/* 품질 2/1/0: 블룸 단계와 연동(강등 시 파티클 상한·배경 동적 레이어도 같이 준다). 블룸 없는 폴백은 1. */
function gfxQ(){ return POST ? (POST.on ? POST.level : 0) : 1; }
/* 실수 품질값(0~2) — 단계 전환 400ms 크로스페이드 동안 파티클 상한·배경 동적 레이어가 «연속»으로 따라간다. */
function gfxQf(){ return POST ? (POST.on ? POST.qf : 0) : 1; }
/* 규칙(2026-08-30, 네온 -22 깜빡임 사고): 캔버스 크기·DPR 은 «플레이 중 바꾸지 않는다». resizeCanvas()(보호 함수,
   바이트 무접촉)가 canvas.width/height 를 대입하면 이 인스턴스 접근자가 받아, 라운드 진행 중이면 보류해 두었다가
   라운드가 끝나거나 화면(일시정지·결과·메뉴)이 떠 있을 때 draw() 첫머리에서 적용한다. 값 자체는 그대로(게임이 계산한 크기). */
const _cvDesc = { w: Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width'), h: Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'height') };
const _cvLock = { w: null, h: null, pending: false };
function _cvLocked(){ return (gameState === 'PLAYING' || gameState === 'READY') && activeScreen === null && !paused; }
function _cvApplyPending(){
  if (!_cvLock.pending || _cvLocked()) return;
  _cvLock.pending = false;
  if (_cvLock.w !== null){ _cvDesc.w.set.call(canvas, _cvLock.w); _cvLock.w = null; }
  if (_cvLock.h !== null){ _cvDesc.h.set.call(canvas, _cvLock.h); _cvLock.h = null; }
}
if (_cvDesc.w && _cvDesc.h && _cvDesc.w.set && _cvDesc.h.set){
  Object.defineProperty(canvas, 'width', { configurable: true, get(){ return _cvDesc.w.get.call(canvas); },
    set(v){ if (_cvLocked() && v !== _cvDesc.w.get.call(canvas)){ _cvLock.w = v; _cvLock.pending = true; return; } _cvDesc.w.set.call(canvas, v); } });
  Object.defineProperty(canvas, 'height', { configurable: true, get(){ return _cvDesc.h.get.call(canvas); },
    set(v){ if (_cvLocked() && v !== _cvDesc.h.get.call(canvas)){ _cvLock.h = v; _cvLock.pending = true; return; } _cvDesc.h.set.call(canvas, v); } });
}
const HUD_FONT = '"Anton","Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",system-ui,sans-serif';
const BODY_FONT = '-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",system-ui,sans-serif';
try { if (document.fonts && document.fonts.load) document.fonts.load('40px Anton'); } catch(e){}
/* 시각 전용 난수 — 게임 로직의 Math.random() 스트림과 «분리»(이펙트가 판정 난수를 먹지 않는다). */
let _vs = 0x9e3779b9; function vr(){ _vs ^= _vs << 13; _vs >>>= 0; _vs ^= _vs >>> 17; _vs ^= _vs << 5; _vs >>>= 0; return _vs / 4294967296; }
function mixHex(a, b, t){
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = ((pa>>16)&255) + (((pb>>16)&255) - ((pa>>16)&255))*t, g = ((pa>>8)&255) + (((pb>>8)&255) - ((pa>>8)&255))*t, bl = (pa&255) + ((pb&255) - (pa&255))*t;
  return '#' + (1<<24 | (Math.round(r)<<16) | (Math.round(g)<<8) | Math.round(bl)).toString(16).slice(1);
}

const PHYS_HZ = 120, PHYS_DT = 1/PHYS_HZ, MAX_PHYS_STEPS = 10;
const BASE_R = 320, MIN_R = 88;
// 2P spawn: lateral spread around straight-down. 0 = dead centre every round.
// At +-40 deg P1.y stays >= sin(50 deg)*198 = 152, i.e. always well inside the
// bottom half, while the pair keeps its exact 2d separation.
const SPAWN_SPREAD = Math.PI*(80/180);
const FALL_GRACE = 0.45, MAX_SPEED = 16, DASH_KNOCK = 5, SELF_RECOIL = 0.15, AIM_THRESHOLD = 18;
const CHARGE_MAX = 1.2;

let mode = 'arcade';                 // arcade | versus | practice
let gameState = 'MENU';              // MENU | READY | PLAYING | ROUND_OVER | MATCH_OVER | PAUSED | REVIVE_OFFER
/* ══ 부활 1회 리워드 광고(2026-08-31, venture-frontend) ════════════════════════
   상태 하나를 추가했다: 'REVIVE_OFFER'. 이 값일 때 update() 의 PLAYING/READY/ROUND_OVER 분기가
   «전부» 거지가 돼 세계가 얼어붙고(물리·AI·타이머·파티클 전머), canPlay()도 false 라
   입력이 안 먹는다. draw() 는 계속 돌아 «진 그 장면»이 보인다. ★따로 건드린 분기가 없다.
   ★래퍼(src/reviveAd.ts)가 없으면(웹/스토어 빌드·토스 밖) 훅이 없어 종전과 100% 동일하게
     곰장 finishMatch(2) 로 간다. 제안 UI 자체가 안 뜼다. */
let reviveUsed = false;      // 경기당 1회 제한(startMatch 에서 초기화)
let reviveFreezeAt = 0;      // 광고를 보는 동안은 「경기 시간」에서 뺀다(결과화면 통계 오염 방지)
let paused = false;
let stageIdx = 0, diff = 1;
let scoreP1 = 0, scoreP2 = 0, roundNum = 1, winsNeeded = 3;
let curArena = ARENAS[0], curRule = RULES[0];
let arenaRadius = BASE_R, shrinkDuration = 45000;
let roundTimer = 0, readyTimer = 0, roundOverTimer = 0, nextRoundWinner = null;
let screenShake = 0, hitStop = 0, slowmo = 0, physAccumulator = 0;
let particles = [], hazards = [], confetti = [], shockwaves = [], floatTexts = [];
let RF = 0.88, RE = 0.5, RK = 1, windOn = false, windAngle = 0, pitRadius = 0, bombTimer = 0;
// 2026-08-22 단계확장 A안 — 신규 RULE 4종 상태(기존 windOn/pitRadius 와 같은 결의
// 모듈레벨 변수 패턴). 각 변수의 용도는 바로 아래 resetRuleState()/updateHazards() 주석 참고.
let invertOn = false, invertTimer = 0;           // R1 조작반전
let surgeT = 0;                                   // R2 게이지 파동(누적 시간)
let pullPhase = 'idle', pullTimer = 0;            // R4 인력펄스: 'idle'|'windup'|'burst'
let zoneX = 0, zoneY = 0, zoneTimer = 0, zoneR = 68; // R3 세이프존(아레나 임베드)

let matchStart = 0, matchElapsed = 0, lastCountBeep = -1;
let roundOutcome = null, matchResult = null, pendingUnlocks = [];
const stats = {dashes:0, hits:0, dashes2:0, hits2:0, maxCharge:0, rally:0, bestRally:0, roundsWon:0, roundsLost:0};

function hexA(hex, a){
  const h = hex.replace('#','');
  const n = parseInt(h.length === 3 ? h.split('').map(function(c){return c+c;}).join('') : h, 16);
  return 'rgba(' + ((n>>16)&255) + ',' + ((n>>8)&255) + ',' + (n&255) + ',' + a + ')';
}
function makeFighter(id){
  return {id:id, def:CHARS[0], color:'#ff5a5f', glow:'rgba(255,90,95,.85)',
    baseRadius:24, radius:24, weight:1, power:1, spd:1,
    x:0, y:0, vx:0, vy:0, charge:0, isCharging:false, isDashing:false,
    dashTimer:0, dashPower:0, cooldown:0, trail:[], state:'alive', fallProgress:0,
    touchId:null, heldKeys:new Set(), autoAimLock:false, keyTimes:{},
    squash:0, squashNx:0, squashNy:0, fallStartTime:0,
    aimDx:0, aimDy:0, aimAnchorX:0, aimAnchorY:0, aimActive:false,
    blink:0, hurt:0, winPose:0, isCPU:false};
}
const P1 = makeFighter(1), P2 = makeFighter(2);
function applyChar(f, def){
  f.def = def; f.color = def.color; f.glow = hexA(def.color, 0.85);
  f.baseRadius = def.radius; f.radius = def.radius;
  f.weight = def.weight; f.power = def.power; f.spd = def.speed;
}
function resetFighter(f){
  f.vx = 0; f.vy = 0; f.charge = 0; f.isCharging = false; f.isDashing = false;
  f.dashTimer = 0; f.dashPower = 0; f.cooldown = 0; f.trail = [];
  f.state = 'alive'; f.radius = f.baseRadius; f.fallProgress = 0; f.touchId = null;
  f.squash = 0; f.squashNx = 0; f.squashNy = 0; f.fallStartTime = 0;
  f.aimDx = 0; f.aimDy = 0; f.aimActive = false; f.autoAimLock = false;
  f.keyTimes = {}; f.hurt = 0; f.winPose = 0; f.blink = Math.random()*3;
  if (f.heldKeys) f.heldKeys.clear();
}

// ---------------- effects ----------------
/* 그래픽 고도화(2026-08-30) — 파티클을 «풀 객체 재사용»으로. 호출 시그니처(spark/dust/shock/floatText)는
   로직(fighterCollision·explode·ringOut·triggerDash·hazardCollisions)이 그대로 부르므로 «절대» 바꾸지 않는다.
   particles/shockwaves «배열» 자체도 로직(startRound/goTitle/update)이 비우고 순회하므로 그대로 두되,
   push 하는 객체를 부팅 때 만든 풀에서 꺼내 쓴다(런타임 할당 0). 살아있는 객체(life>0)는 건너뛴다.
   kind: 0 점(dust) · 1 스트릭 스파크(속도 방향, 흰 코어) · 2 링아웃 흙먼지(무겁고 느림). */
const PPOOL = 320, _pp = new Array(PPOOL);
for (let i=0;i<PPOOL;i++) _pp[i] = {x:0,y:0,vx:0,vy:0,slot:0,color:null,life:0,decay:0.03,size:2,kind:0,core:null};
let _ppCur = 0;
function pAlloc(){
  for (let n=0;n<PPOOL;n++){ const p = _pp[_ppCur]; _ppCur = (_ppCur+1) % PPOOL; if (p.life <= 0) return p; }
  return null;
}
function pCap(){ const f = gfxQf(); return Math.round(f >= 1 ? 200 + (PPOOL - 200)*Math.min(1, f - 1) : 110 + 90*Math.max(0, f)); }
function spark(x, y, impact, nx, ny, palette){
  const cap = pCap();
  const n = Math.min(cap - particles.length, Math.floor(12 + Math.min(22, impact * 0.7)));
  for (let i=0;i<n;i++){
    const p = pAlloc(); if (!p) break;
    const a = vr()*Math.PI*2;
    const streak = (i % 3) === 0;
    const s = (vr()*4+2) * (1 + impact*0.045) * (streak ? 1.35 : 1);
    p.x = x; p.y = y;
    p.vx = Math.cos(a)*s + (ny*(vr()-0.5)*s*0.4);
    p.vy = Math.sin(a)*s + (-nx*(vr()-0.5)*s*0.4);
    p.slot = vr()<0.38 ? 0 : (vr()<0.6 ? 1 : 2);
    p.color = palette ? palette[i%palette.length] : null;
    p.kind = streak ? 1 : 0;
    p.life = 1; p.decay = streak ? (vr()*0.04+0.03) : (vr()*0.035+0.018);
    p.size = streak ? (vr()*1.2+1.2) : (vr()*3+1.6);
    particles.push(p);
  }
}
function dust(x, y, n, color){
  const cap = pCap();
  n = Math.min(n, cap - particles.length);
  for (let i=0;i<n;i++){
    const p = pAlloc(); if (!p) break;
    const a = vr()*Math.PI*2, s = vr()*1.8+0.3;
    p.x = x; p.y = y; p.vx = Math.cos(a)*s; p.vy = Math.sin(a)*s; p.slot = 2; p.color = color; p.kind = 0;
    p.life = 1; p.decay = 0.03+vr()*0.02; p.size = vr()*2.4+1;
    particles.push(p);
  }
}
/* 링아웃 흙먼지 링 — 렌더 쪽(drawFighter)이 떨어지는 «순간»을 감지해 1회 부른다. */
function dustRing(x, y, r, n, color){
  const cap = pCap();
  n = Math.min(n, cap - particles.length);
  for (let i=0;i<n;i++){
    const p = pAlloc(); if (!p) break;
    const a = (i/n)*Math.PI*2 + vr()*0.3, s = 1.6 + vr()*1.4;
    p.x = x + Math.cos(a)*r*0.6; p.y = y + Math.sin(a)*r*0.6; p.vx = Math.cos(a)*s; p.vy = Math.sin(a)*s*0.55 - 0.4;
    p.slot = 2; p.color = color; p.kind = 2; p.life = 1; p.decay = 0.016+vr()*0.01; p.size = 2.2+vr()*3.2;
    particles.push(p);
  }
}
const SPOOL = 16, _sp = new Array(SPOOL);
for (let i=0;i<SPOOL;i++) _sp[i] = {x:0,y:0,r:8,max:60,life:0,color:'#fff'};
let _spCur = 0;
function shock(x, y, r, color){
  for (let n=0;n<SPOOL;n++){ const s = _sp[_spCur]; _spCur = (_spCur+1)%SPOOL;
    if (s.life <= 0){ s.x = x; s.y = y; s.r = 8; s.max = r; s.life = 1; s.color = color; shockwaves.push(s); return; } }
}
function floatText(x, y, text, color){ floatTexts.push({x:x, y:y, text:text, color:color, life:1}); }
function popConfetti(n){
  const pal = ['#ffc94a','#ff5a5f','#4a9eff','#ffe9a8','#ff9d2e','#ffffff'];
  for (let i=0;i<n;i++){
    confetti.push({x:(vr()-0.5)*760, y:-420 - vr()*260,
      vx:(vr()-0.5)*2.4, vy:vr()*2.6+1.6, rot:vr()*6.28,
      vr:(vr()-0.5)*0.34, w:vr()*7+4, h:vr()*10+5,
      color:pal[i%pal.length], life:1});
  }
}

// ---------------- dash ----------------
function triggerDash(f, aimX, aimY){
  let tx, ty;
  const hasAim = (aimX !== undefined && aimY !== undefined) && (aimX*aimX + aimY*aimY) > 1;
  // 2026-08-22 단계확장 A안 R1(invert) — «사람 입력만» 드래그 벡터를 뒤집는다.
  // CPU(f.isCPU)는 좌표를 직접 계산해 triggerDash() 에 넣으므로 여기서 되돌려도
  // 의미가 없고(AI 로직 무접촉 — 회귀 위험 없음). 드래그없이 탭해 자동조준된 경우(!hasAim)도
  // 무접촉 — 조작할 입력이 없는데 뒤집으면 항상 반대쪽으로만 나가는 불만이 된다.
  if (hasAim && curRule.id === 'invert' && invertOn && !f.isCPU){ aimX = -aimX; aimY = -aimY; }
  if (hasAim){ const d = Math.sqrt(aimX*aimX + aimY*aimY); tx = aimX/d; ty = aimY/d; }
  else {
    const o = f.id === 1 ? P2 : P1;
    tx = o.x - f.x; ty = o.y - f.y;
    const d = Math.sqrt(tx*tx + ty*ty);
    if (d > 0){ tx /= d; ty /= d; } else { tx = f.id === 1 ? 1 : -1; ty = 0; }
  }
  f.aimActive = false;
  let cr = Math.max(0.12, Math.min(1, f.charge / CHARGE_MAX));
  const speed = (4 + cr*6) * (0.86 + f.spd*0.16);
  f.vx = tx*speed; f.vy = ty*speed;
  f.dashPower = cr; f.isDashing = true; f.dashTimer = 0.35;
  f.cooldown = 0.5 / (0.7 + f.spd*0.35);
  f.isCharging = false; f.charge = 0;
  stopCharge(f.id); playDash(cr);
  dust(f.x - tx*f.radius, f.y - ty*f.radius, 7, null);
  if (f.id === 1){ stats.dashes++; if (cr > stats.maxCharge) stats.maxCharge = cr; }
  else stats.dashes2++;
}

// ---------------- collisions ----------------
function fighterCollision(){
  if (P1.state !== 'alive' || P2.state !== 'alive') return;
  const dx = P2.x - P1.x, dy = P2.y - P1.y;
  let dist = Math.sqrt(dx*dx + dy*dy);
  const minDist = P1.radius + P2.radius;
  if (dist >= minDist) return;

  let nx, ny;
  if (dist > 0.0001){ nx = dx/dist; ny = dy/dist; } else { nx = 1; ny = 0; dist = 0.0001; }

  const m1 = P1.weight, m2 = P2.weight, im1 = 1/m1, im2 = 1/m2;
  const overlap = minDist - dist;
  P1.x -= nx*overlap*(im1/(im1+im2)); P1.y -= ny*overlap*(im1/(im1+im2));
  P2.x += nx*overlap*(im2/(im1+im2)); P2.y += ny*overlap*(im2/(im1+im2));

  const velN = (P2.vx - P1.vx)*nx + (P2.vy - P1.vy)*ny;
  if (velN >= 0) return;

  const j = -(1 + RE) * velN / (im1 + im2);
  P1.vx -= j*nx*im1; P1.vy -= j*ny*im1;
  P2.vx += j*nx*im2; P2.vy += j*ny*im2;

  let extra = 0, strongHit = 0, strongBy = 0;
  const both = P1.isDashing && P2.isDashing;
  if (both){
    const f1 = P1.dashPower * P1.power, f2 = P2.dashPower * P2.power;
    const diff2 = f1 - f2;
    const p1Push = DASH_KNOCK*RK * (0.55 + Math.max(0, diff2)) / Math.sqrt(m2);
    const p2Push = DASH_KNOCK*RK * (0.55 + Math.max(0, -diff2)) / Math.sqrt(m1);
    P2.vx += nx*p1Push; P2.vy += ny*p1Push;
    P1.vx -= nx*p2Push; P1.vy -= ny*p2Push;
    P1.isDashing = false; P2.isDashing = false;
    extra += Math.max(p1Push, p2Push);
    P2.squash = 1; P2.squashNx = nx; P2.squashNy = ny;
    P1.squash = 1; P1.squashNx = -nx; P1.squashNy = -ny;
    P1.hurt = 0.35; P2.hurt = 0.35;
  } else {
    if (P1.isDashing){
      const force = P1.dashPower * P1.power * DASH_KNOCK * RK / Math.sqrt(m2);
      P2.vx += nx*force; P2.vy += ny*force;
      P1.vx -= nx*force*SELF_RECOIL; P1.vy -= ny*force*SELF_RECOIL;
      P1.isDashing = false; extra += force;
      P2.squash = 1; P2.squashNx = nx; P2.squashNy = ny; P2.hurt = 0.35;
      strongHit = P1.dashPower; strongBy = 1;
      stats.hits++; stats.rally++; if (stats.rally > stats.bestRally) stats.bestRally = stats.rally;
    }
    if (P2.isDashing){
      const force = P2.dashPower * P2.power * DASH_KNOCK * RK / Math.sqrt(m1);
      P1.vx -= nx*force; P1.vy -= ny*force;
      P2.vx += nx*force*SELF_RECOIL; P2.vy += ny*force*SELF_RECOIL;
      P2.isDashing = false; extra += force;
      P1.squash = 1; P1.squashNx = -nx; P1.squashNy = -ny; P1.hurt = 0.35;
      if (P2.dashPower > strongHit){ strongHit = P2.dashPower; strongBy = 2; }
      stats.hits2++; stats.rally++; if (stats.rally > stats.bestRally) stats.bestRally = stats.rally;
    }
  }

  const impact = Math.abs(velN) + extra;
  screenShake = Math.min(26, impact*0.95);
  if (impact > 8) hitStop = Math.min(0.085, impact*0.003);
  const mx = P1.x + nx*P1.radius, my = P1.y + ny*P1.radius;
  spark(mx, my, impact, nx, ny, curArena.particles);
  if (impact > 12) shock(mx, my, 60 + impact*2.2, '#ffffff');
  // numeric power read-out on a heavy shove (no words, so it needs no translation)
  if (strongHit > 0.68){
    floatText(mx, my - 26, Math.round(strongHit*100) + '%', strongBy === 1 ? '#ff8a8f' : '#8cc4ff');
  }
  playHit(Math.min(1, impact/30));
}

// ---------------- hazards / special rules ----------------
function resetRuleState(){
  const id = curRule.id;
  RF = (id === 'ice') ? 0.962 : 0.88;
  RE = (id === 'bouncy') ? 0.94 : 0.5;
  RK = (id === 'bouncy') ? 1.28 : 1;
  shrinkDuration = (id === 'rush') ? 13000 : 30000;
  windOn = (id === 'wind');
  windAngle = Math.random()*Math.PI*2;
  pitRadius = 0;
  bombTimer = 2.4;
  hazards = [];
  if (id === 'orbit'){
    for (let i=0;i<2;i++) hazards.push({type:'guard', ang:i*Math.PI, spin:(i?-1:1)*0.58, rad:BASE_R*0.55, r:19, x:0, y:0, pulse:0});
  }
  // 2026-08-22 단계확장 A안 — 신규 RULE 4종 라운드 초기화(다른 id 일 때도
  // 무해하게 리셋해 직전 라운드의 잔상태가 새어들지 않게 한다 — 기존
  // pitRadius/bombTimer 와 같은 관례).
  surgeT = 0;
  invertOn = false; invertTimer = 3.0; // 첫 전환까지 3초 유예기간
  pullPhase = 'idle'; pullTimer = 3.5; // 첫 windup 까지 3.5초
  if (id === 'safezone'){
    const a = Math.random()*Math.PI*2, r = arenaRadius*(0.28 + Math.random()*0.30);
    zoneX = Math.cos(a)*r; zoneY = Math.sin(a)*r; zoneTimer = 7.0;
  }
}
function updateHazards(dt){
  const id = curRule.id;
  if (id === 'wind'){ windAngle += dt*0.42; }
  if (id === 'pit'){ pitRadius = Math.min(54, pitRadius + dt*7.5); }
  if (id === 'bombs'){
    bombTimer -= dt;
    if (bombTimer <= 0 && hazards.length < 4){
      bombTimer = 3.0;
      const a = Math.random()*Math.PI*2, r = Math.random()*arenaRadius*0.62;
      hazards.push({type:'bomb', x:Math.cos(a)*r, y:Math.sin(a)*r, r:15, fuse:5.2, drop:1, live:false});
    }
  }
  // 2026-08-22 단계확장 A안 — 신규 RULE 4종 프레임별 갱신.
  if (id === 'surge'){ surgeT += dt; }
  if (id === 'invert'){
    invertTimer -= dt;
    if (invertTimer <= 0){
      invertOn = !invertOn;
      invertTimer = invertOn ? 2.2 : 4.2; // 켜져 있는 시간(2.2s) < 꺼져 있는 시간(4.2s) — 복관이 아니라 간헐적 교란
    }
  }
  if (id === 'pull'){
    pullTimer -= dt;
    if (pullTimer <= 0){
      if (pullPhase === 'idle'){ pullPhase = 'windup'; pullTimer = 0.9; }
      else if (pullPhase === 'windup'){ pullPhase = 'burst'; pullTimer = 0.35; screenShake = Math.max(screenShake, 10); }
      else { pullPhase = 'idle'; pullTimer = 5.5; }
    }
  }
  if (id === 'safezone'){
    zoneTimer -= dt;
    if (zoneTimer <= 0){
      const a = Math.random()*Math.PI*2, r = arenaRadius*(0.28 + Math.random()*0.30);
      zoneX = Math.cos(a)*r; zoneY = Math.sin(a)*r; zoneTimer = 7.0;
    }
  }
  for (let i=hazards.length-1;i>=0;i--){
    const h = hazards[i];
    if (h.type === 'bomb'){
      if (h.drop > 0){ h.drop -= dt*2.2; if (h.drop <= 0){ h.drop = 0; h.live = true; dust(h.x, h.y, 8, '#ffb066'); } }
      else { h.fuse -= dt; if (h.fuse <= 0){ explode(h); hazards.splice(i,1); continue; } }
    } else if (h.type === 'guard'){
      h.ang += h.spin*dt;
      const rr = Math.min(h.rad, Math.max(60, arenaRadius - 42));
      h.x = Math.cos(h.ang)*rr; h.y = Math.sin(h.ang)*rr;
      if (h.pulse > 0) h.pulse -= dt*3;
    }
  }
}
function explode(h){
  playBoom();
  screenShake = Math.max(screenShake, 20);
  shock(h.x, h.y, 150, '#ff9448');
  spark(h.x, h.y, 26, 0, -1, ['#ff7a3d','#ffcf6b','#fff0c0']);
  [P1,P2].forEach(function(f){
    if (f.state !== 'alive') return;
    const dx = f.x-h.x, dy = f.y-h.y, d = Math.sqrt(dx*dx+dy*dy) || 1;
    if (d < 128){
      const p = (1 - d/128) * 11 / Math.sqrt(f.weight);
      f.vx += dx/d*p; f.vy += dy/d*p;
      f.hurt = 0.4; f.squash = 0.8; f.squashNx = -dx/d; f.squashNy = -dy/d;
    }
  });
}
function hazardCollisions(){
  for (let i=hazards.length-1;i>=0;i--){
    const h = hazards[i];
    if (h.type === 'bomb' && h.live){
      let boom = false;
      [P1,P2].forEach(function(f){
        if (f.state !== 'alive' || boom) return;
        const dx = f.x-h.x, dy = f.y-h.y;
        if (dx*dx + dy*dy < (f.radius + h.r)*(f.radius + h.r)) boom = true;
      });
      if (boom){ explode(h); hazards.splice(i,1); }
    } else if (h.type === 'guard'){
      [P1,P2].forEach(function(f){
        if (f.state !== 'alive') return;
        const dx = f.x-h.x, dy = f.y-h.y;
        let d = Math.sqrt(dx*dx+dy*dy);
        const md = f.radius + h.r;
        if (d < md && d > 0.001){
          const nx = dx/d, ny = dy/d;
          f.x = h.x + nx*md; f.y = h.y + ny*md;
          const push = (2.5 + (f.isDashing ? 1.9 : 0)) / Math.sqrt(f.weight);
          f.vx += nx*push; f.vy += ny*push;
          f.isDashing = false; f.hurt = 0.25; h.pulse = 1;
          screenShake = Math.max(screenShake, 8);
          spark(h.x + nx*h.r, h.y + ny*h.r, 8, nx, ny, curArena.particles);
          playHit(0.35);
        }
      });
    }
  }
}

// ---------------- physics ----------------
function physicsStep(h){
  const scale = h*60;
  [P1,P2].forEach(function(f){
    if (f.state !== 'alive') return;
    if (windOn){
      f.vx += Math.cos(windAngle)*0.052*scale / Math.sqrt(f.weight);
      f.vy += Math.sin(windAngle)*0.052*scale / Math.sqrt(f.weight);
    }
    // 2026-08-22 단계확장 A안 R4(pull) — wind와 달리 «상시»가 아니라 windup(0.9s 예고)
    // 후 burst(0.35s) 동안만 중심으로 순간적으로 당긴다 — 예고를 보고 타이밍해
    // 대응(버티거나 역이용)해야 하는 축이다(wind 의 「계속 보정」과 다름).
    if (curRule.id === 'pull' && pullPhase === 'burst'){
      const pd = Math.sqrt(f.x*f.x + f.y*f.y);
      if (pd > 1){
        f.vx += (-f.x/pd)*0.16*scale / Math.sqrt(f.weight);
        f.vy += (-f.y/pd)*0.16*scale / Math.sqrt(f.weight);
      }
    }
    const sp = Math.sqrt(f.vx*f.vx + f.vy*f.vy);
    if (sp > MAX_SPEED){ const k = MAX_SPEED/sp; f.vx *= k; f.vy *= k; }
    f.x += f.vx*scale; f.y += f.vy*scale;
    const drag = Math.pow(RF, scale);
    f.vx *= drag; f.vy *= drag;
  });
  fighterCollision();
  hazardCollisions();
  [P1,P2].forEach(function(f){
    if (f.state !== 'alive') return;
    const d = Math.sqrt(f.x*f.x + f.y*f.y);
    if (d > arenaRadius + f.radius*FALL_GRACE) ringOut(f);
    else if (curRule.id === 'pit' && pitRadius > 10 && d < pitRadius - 5) ringOut(f, true);
  });
}
function ringOut(f, intoPit){
  f.state = 'falling';
  f.fallProgress = 0;
  f.fallStartTime = performance.now();
  f.intoPit = !!intoPit;
  stopCharge(f.id); playFall();
  const o = f.id === 1 ? P2 : P1;
  if (o.isCharging) stopCharge(o.id);
  slowmo = 1.15;
  screenShake = Math.max(screenShake, 14);
  dust(f.x, f.y, 14, null);
}

// ---------------- match flow ----------------
function pickArenaFor(i){ return unlockedArenas()[i % unlockedArenas().length]; }
// ★★ 인계 경고 (Partner 지시, 원문 그대로):
//   게임 js 를 나중에 «모듈/번들»로 전환하면 window.startMatch 래핑이 «조용히» 죽는다
//   (지금은 클래식 스크립트 주입이라 전역 프로퍼티가 된다 — 그 전제 위에 서 있다)
// 이 함수의 «본문»은 이번 패치에서 한 줄도 바뀌지 않았다.
function startMatch(cfg){
  mode = cfg.mode;
  applyChar(P1, cfg.c1); applyChar(P2, cfg.c2);
  P1.isCPU = false; P2.isCPU = !!cfg.cpu;
  curArena = cfg.arena; curRule = cfg.rule;
  winsNeeded = cfg.wins || 3;
  scoreP1 = 0; scoreP2 = 0; roundNum = 1;
  reviveUsed = false; reviveFreezeAt = 0;   // 부활 리워드: 경기당 1회 - 새 경기마다 초기화
  stats.dashes = 0; stats.hits = 0; stats.dashes2 = 0; stats.hits2 = 0; stats.maxCharge = 0; stats.rally = 0;
  stats.bestRally = 0; stats.roundsWon = 0; stats.roundsLost = 0;
  matchStart = performance.now(); matchElapsed = 0;
  confetti = []; matchResult = null; pendingUnlocks = [];
  __matchesThisSession++;
  track('run_start', {run_no: __matchesThisSession, mode: cfg.mode,
    rule: cfg.rule ? cfg.rule.id : '', arena: cfg.arena ? cfg.arena.id : '', diff: diff});
  if (mode === 'arcade') track('stage_enter', {id: stageIdx});
  if (P2.isCPU){
    // Difficulty also shifts the CPU's physical handicap, so the setting is felt and
    // not just "the CPU thinks faster". Easy rivals are lighter and shove softer.
    const pw = [0.80, 1.00, 1.08][diff], wt = [0.86, 1.00, 1.06][diff];
    P2.power *= pw; P2.weight *= wt;
    aiConfigure(cfg.pers || 'balance', cfg.skill !== undefined ? cfg.skill : 0.5, diff);
  }
  startRound();
}
function startRound(){
  gameState = 'READY';
  arenaRadius = BASE_R;
  roundTimer = 0; readyTimer = 1.7; lastCountBeep = -1;
  roundOutcome = null; nextRoundWinner = null;
  particles = []; shockwaves = []; floatTexts = []; skids = [];
  stats.rally = 0;
  resetFighter(P1); resetFighter(P2);
  resetRuleState();
  // 2P: the spawn is pinned to the players' own halves - P1 always BOTTOM,
  // P2 always TOP - so "my thumb's half" and "my fighter" can never disagree.
  // Solo keeps the free 360 deg spawn (the whole screen is one player's).
  // The pair is always antipodal at radius d, so separation stays exactly 2d
  // (=396) for any ang: this changes WHERE the pair sits, never the distance,
  // and therefore carries no balance change.
  const d = 198;
  const ang = soloMode()
    ? Math.random()*Math.PI*2
    : Math.PI/2 + (Math.random()-0.5)*SPAWN_SPREAD;   // +y is down = bottom
  P1.x = Math.cos(ang)*d; P1.y = Math.sin(ang)*d;
  P2.x = -Math.cos(ang)*d; P2.y = -Math.sin(ang)*d;
  if (P2.isCPU) aiReset();
  syncHUD();
}
function endRound(winner){
  if (gameState !== 'PLAYING') return;
  gameState = 'ROUND_OVER';
  nextRoundWinner = winner;
  roundOverTimer = 2.1;
  P1.isCharging = false; P2.isCharging = false;
  stopCharge(1); stopCharge(2);
  if (winner === 1){ scoreP1++; stats.roundsWon++; }
  else if (winner === 2){ scoreP2++; stats.roundsLost++; }
  const done = scoreP1 >= winsNeeded || scoreP2 >= winsNeeded;
  if (winner === 0) playFall();
  else if (winner === 1) playWin(done);
  else playLose();
  if (winner) {
    const w = winner === 1 ? P1 : P2;
    w.winPose = 1;
    popConfettiRound(w);
  }
  syncHUD();
}
function popConfettiRound(w){
  for (let i=0;i<26;i++){
    const a = Math.random()*Math.PI*2, s = Math.random()*4+1.5;
    particles.push({x:w.x, y:w.y, vx:Math.cos(a)*s, vy:Math.sin(a)*s - 1.5, slot:i%3,
      color:null, life:1, decay:0.016, size:Math.random()*3+1.5});
  }
}
function afterRound(){
  if (scoreP1 >= winsNeeded || scoreP2 >= winsNeeded) {
    /* ★부활 제안은 반드시 finishMatch() «전»이다. finishMatch 는 SAVE.cleared·byDiff 를 쓰고
       persist()·프로모션 훅·run_end 계측까지 전부 돌린다. 뒤에 놓으면 한 경기에 run_end 가
       두 번 나가고 결과화면이 한 번 번쩡인다. 이 순서가 설계의 핵심이라 여기 적어둔다. */
    if (scoreP2 >= winsNeeded && scoreP1 < winsNeeded && reviveTryOffer()) return;
    finishMatch(scoreP1 >= winsNeeded ? 1 : 2);
  }
  else { roundNum++; startRound(); }
}
/* ══ 부활 1회 — 게임측 배선 ════════════════════════════════════
   President 지시: 「생명 하나로 부활하되 상대방을 이긴 횟수가 남아있어야 함」.
   이 게임엔 lives 변수가 없고 «라운드»만 있다(winsNeeded 선승제). 그래서:
     「생명 하나」      = 상대의 «마지막 결정타 라운드»를 되돌린다(scoreP2 = winsNeeded - 1).
     「이긴 횟수 유지」 = scoreP1 을 아무도 안 건드린다(결과 해석).
     「이긴 횟수 필요」 = scoreP1 > 0 일 때만 제안한다(조건 해석, src/reviveAd.ts 의 REQUIRE_OWN_WIN).
   ⇒ 두 해석을 «둘 다» 만족한다. 조건 판정은 래퍼가 하므로 여긴 모드 게이트만 둔다. */
function reviveTryOffer(){
  try{
    if (reviveUsed) return false;
    /* ⭕아케이드만. ❌2인대전 = 한쪽만 광고로 되살아나면 상대 사람에게 불공정.
       ❌자유연습 = 져도 잃는 게 0이라 부활에 가치가 없다(가치 없는 보상에 광고 ⛔). */
    if (mode !== 'arcade' || !P2.isCPU) return false;
    if (typeof window === 'undefined' || typeof window.__sumoReviveOffer !== 'function') return false;
    var shown = window.__sumoReviveOffer({stage: stageIdx + 1, myWins: scoreP1, theirWins: scoreP2, needed: winsNeeded});
    if (!shown) return false;
    reviveFreezeAt = performance.now();
    stopCharge(1); stopCharge(2);
    P1.isCharging = false; P2.isCharging = false;
    gameState = 'REVIVE_OFFER';
    return true;
  }catch(e){ return false; }
}
/* 래퍼가 유저 선택·광고 판정을 마친 뒤 «한 번» 부른다. ok=false 면 원래대로 결과화면. */
window.__sumoReviveApply = function(ok){
  if (gameState !== 'REVIVE_OFFER') return false;
  /* 광고를 본 시간은 「경기 시간」이 아니다 — 어느 분기든 먼저 보정한다. */
  try{
    if (reviveFreezeAt){ matchStart += performance.now() - reviveFreezeAt; reviveFreezeAt = 0; }
  }catch(e){ reviveFreezeAt = 0; }
  try{
    if (!ok){ gameState = 'ROUND_OVER'; finishMatch(scoreP1 >= winsNeeded ? 1 : 2); return true; }
    reviveUsed = true;
    scoreP2 = Math.max(0, winsNeeded - 1);   // 상대의 결정타 라운드 하나만 되돌린다
    roundNum++;
    startRound();                            // gameState = 'READY' 로 돌아간다(1.7s 카운트다운 뒤 PLAYING)
    track('revive_resume', {run_no: __matchesThisSession, mode: mode, stage_or_course: stageIdx,
      my_wins: scoreP1, rounds: roundNum});
    return true;
  }catch(e){
    /* 여기서 던지면 게임이 프리즈된 채 남는다 — 무슨 일이 있어도 결과화면으로는 보낸다. */
    console.error('[revive] apply failed', e);
    try{ gameState = 'ROUND_OVER'; finishMatch(2); }catch(_e){}
    return false;
  }
};
function finishMatch(winner){
  gameState = 'MATCH_OVER';
  matchElapsed = performance.now() - matchStart;
  matchResult = winner;
  pendingUnlocks = [];
  if (mode === 'arcade' && winner === 1){
    const stageNo = stageIdx + 1;
    const prevCleared = SAVE.cleared;
    if (SAVE.cleared < stageNo){
      SAVE.cleared = stageNo;
      CHARS.forEach(function(c){ if (c.unlock === stageNo) pendingUnlocks.push({type:'char', obj:c}); });
      ARENAS.forEach(function(a){ if (a.unlock === stageNo) pendingUnlocks.push({type:'arena', obj:a}); });
    }
    SAVE.byDiff[diff] = Math.max(SAVE.byDiff[diff]|0, stageNo);
    if (stageNo >= LADDER.length){ SAVE.champion = true; }
    persist();
    // 프로모션: cleared 가 문턱을 «처음» 넘는 순간(= 정본에서 다이묘진이 pendingUnlocks 에 들어가는 그 순간) 1회.
    // persist() «뒤»에 건다. 재해금(이미 cleared ≥ 문턱)은 prevCleared 조건으로 안 걸린다.
    if (prevCleared < PROMO_DAIMYOJIN_STAGE && SAVE.cleared >= PROMO_DAIMYOJIN_STAGE) promoNotifyDaimyojinUnlock();
  }
  // 프로모션 ②: «끝난» 매치 1건. 모드·승패 무관(아케이드/2P 공통). fire-and-forget.
  promoNotifyMatchEnd();
  track('run_end', {run_no: __matchesThisSession, mode: mode,
    result: (winner === 1 ? 'success' : 'fail'),
    stage_or_course: (mode === 'arcade' ? stageIdx : -1),
    duration_ms: Math.round(matchElapsed)});
  if (mode === 'arcade' && winner !== 1) track('stage_exit', {id: stageIdx, reason: 'fail'});
  if (winner === 1){ popConfetti(120); playFanfare(); }
  showResultScreen();
}

// ---------------- per-frame update ----------------
function update(dt){
  if (P1.squash > 0) P1.squash = Math.max(0, P1.squash - dt*6);
  if (P2.squash > 0) P2.squash = Math.max(0, P2.squash - dt*6);
  [P1,P2].forEach(function(f){
    if (f.hurt > 0) f.hurt -= dt;
    f.blink -= dt; if (f.blink < -0.14) f.blink = 2 + Math.random()*3;
    if (f.winPose > 0) f.winPose += dt;
  });

  if (gameState === 'PLAYING'){
    [P1,P2].forEach(function(f){
      if (f.isCharging){
        // 2026-08-22 단계확장 A안 R2(surge)/R3(safezone) — 모으기 «속도» 자체를 바꾸는
        // 배수(chargeMult). 기존 8종은 전부 방출 이후만 건드렸다 — 여기서 처음으로
        // 「언제 떼는가」의 계산법 자체가 바낀다. CPU도 같은 로직을 공유하므로
        // 별도 AI 코드 없이 자동 반영된다(회귀 위험 낮음).
        let chargeMult = 1;
        if (curRule.id === 'surge'){
          chargeMult *= Math.max(0.35, 1 + 0.55*Math.sin(surgeT*(Math.PI*2/1.6) + (f.id===2?Math.PI:0)));
        }
        if (curRule.id === 'safezone'){
          const zdx = f.x - zoneX, zdy = f.y - zoneY;
          if (zdx*zdx + zdy*zdy < zoneR*zoneR) chargeMult *= 1.4;
        }
        f.charge = Math.min(CHARGE_MAX, f.charge + dt*(0.72 + f.spd*0.34)*chargeMult);
        const r = f.charge / CHARGE_MAX;
        f.radius = f.baseRadius * (1 + 0.25*r + Math.sin(performance.now()*0.022)*0.04*r);
      } else if (f.state === 'alive') {
        f.radius += (f.baseRadius - f.radius) * Math.min(1, dt*12);
      }
      if (f.cooldown > 0) f.cooldown -= dt;
      if (f.dashTimer > 0){ f.dashTimer -= dt; if (f.dashTimer <= 0) f.isDashing = false; }
    });
    if (P2.isCPU) aiUpdate(dt);
    updateHazards(dt);

    if (hitStop > 0) hitStop -= dt;
    else {
      physAccumulator += dt;
      let steps = 0;
      while (physAccumulator >= PHYS_DT && steps < MAX_PHYS_STEPS){
        physicsStep(PHYS_DT); physAccumulator -= PHYS_DT; steps++;
        if (hitStop > 0) break;
      }
      if (physAccumulator > PHYS_DT*MAX_PHYS_STEPS) physAccumulator = 0;
    }

    roundTimer += dt*1000;
    const sr = Math.min(1, roundTimer/shrinkDuration);
    arenaRadius = BASE_R - sr*(BASE_R - MIN_R);
    const left = Math.max(0, Math.ceil((shrinkDuration - roundTimer)/1000));
    if (left <= 5 && left !== lastCountBeep && left > 0){ lastCountBeep = left; playCount(false); }
    if (roundTimer > shrinkDuration + 11000 && gameState === 'PLAYING'){
      const d1 = Math.sqrt(P1.x*P1.x + P1.y*P1.y), d2 = Math.sqrt(P2.x*P2.x + P2.y*P2.y);
      roundOutcome = 'time';
      endRound(d1 < d2 ? 1 : (d2 < d1 ? 2 : 0));
    }
  } else if (gameState === 'READY'){
    readyTimer -= dt;
    const step = readyTimer > 0.75 ? 1 : 0;
    if (step !== lastCountBeep){ lastCountBeep = step; playCount(step === 0); }
    if (readyTimer <= 0){ gameState = 'PLAYING'; physAccumulator = 0; }
  } else if (gameState === 'ROUND_OVER'){
    roundOverTimer -= dt;
    if (roundOverTimer <= 0) afterRound();
  }

  if (gameState === 'PLAYING' || gameState === 'ROUND_OVER'){
    [P1,P2].forEach(function(f){
      if (f.state === 'falling'){
        f.fallProgress += dt*1.35;
        f.vx *= Math.pow(0.85, dt*60); f.vy *= Math.pow(0.85, dt*60);
        if (f.intoPit){
          const d = Math.sqrt(f.x*f.x + f.y*f.y) || 1;
          f.x -= (f.x/d)*6*dt*60; f.y -= (f.y/d)*6*dt*60;
        } else {
          const d = Math.sqrt(f.x*f.x + f.y*f.y);
          if (d > 0){ f.x += (f.x/d)*18*dt*60; f.y += (f.y/d)*18*dt*60; }
        }
        f.radius = Math.max(1, f.baseRadius*(1 - f.fallProgress));
        if (f.fallProgress >= 1) f.state = 'dead';
      }
    });
    if (gameState === 'PLAYING' && (P1.state === 'dead' || P2.state === 'dead')){
      const o1 = P1.state !== 'alive', o2 = P2.state !== 'alive';
      if (o1 && o2){
        if (Math.abs(P1.fallStartTime - P2.fallStartTime) < 200) endRound(0);
        else endRound(P1.fallStartTime < P2.fallStartTime ? 2 : 1);
      } else endRound(P1.state === 'dead' ? 2 : 1);
    }
  }

  if (slowmo > 0) slowmo -= dt;
  updateSkids(dt);
  for (let i=particles.length-1;i>=0;i--){
    const p = particles[i];
    p.x += p.vx*dt*60; p.y += p.vy*dt*60;
    p.vx *= Math.pow(0.95, dt*60); p.vy *= Math.pow(0.95, dt*60);
    p.life -= p.decay*dt*60;
    if (p.life <= 0) particles.splice(i,1);
  }
  for (let i=shockwaves.length-1;i>=0;i--){
    const s = shockwaves[i];
    s.r += (s.max - s.r)*Math.min(1, dt*7); s.life -= dt*2.1;
    if (s.life <= 0) shockwaves.splice(i,1);
  }
  for (let i=floatTexts.length-1;i>=0;i--){
    const f = floatTexts[i]; f.y -= dt*34; f.life -= dt*1.2;
    if (f.life <= 0) floatTexts.splice(i,1);
  }
  for (let i=confetti.length-1;i>=0;i--){
    const c = confetti[i];
    c.x += c.vx*dt*60; c.y += c.vy*dt*60; c.vy += dt*3.4; c.rot += c.vr*dt*60;
    if (c.y > 480) confetti.splice(i,1);
  }
  [P1,P2].forEach(function(f){
    const sp = Math.sqrt(f.vx*f.vx + f.vy*f.vy);
    if (f.state === 'alive' && (f.isDashing || sp > 4)){
      f.trail.push({x:f.x, y:f.y, radius:f.radius, opacity:0.6});
    }
    for (let i=f.trail.length-1;i>=0;i--){
      f.trail[i].opacity -= 1.9*dt;
      if (f.trail[i].opacity <= 0) f.trail.splice(i,1);
    }
    if (f.trail.length > 12) f.trail.shift();
  });
}

// ---------------- input ----------------
const P1_DIRS = {KeyW:[0,-1], KeyA:[-1,0], KeyS:[0,1], KeyD:[1,0]};
const P2_DIRS = {ArrowUp:[0,-1], ArrowLeft:[-1,0], ArrowDown:[0,1], ArrowRight:[1,0]};
const OPPOSITE = {KeyA:'KeyD', KeyD:'KeyA', KeyW:'KeyS', KeyS:'KeyW',
  ArrowLeft:'ArrowRight', ArrowRight:'ArrowLeft', ArrowUp:'ArrowDown', ArrowDown:'ArrowUp'};
const AUTO_AIM_WINDOW = 200;
const keysDown = {};
function soloMode(){ return mode !== 'versus'; }
function canPlay(){ return gameState === 'PLAYING' && !paused && activeScreen === null; }

function updateKeyAim(f, dirs){
  let ax = 0, ay = 0;
  f.heldKeys.forEach(function(c){ const d = dirs[c]; if (d){ ax += d[0]; ay += d[1]; } });
  if (ax !== 0 || ay !== 0){
    const m = Math.sqrt(ax*ax + ay*ay);
    f.aimDx = (ax/m)*100; f.aimDy = (ay/m)*100; f.aimActive = true; f.autoAimLock = false;
  } else if (f.heldKeys.size >= 2){
    f.aimDx = 0; f.aimDy = 0; f.aimActive = false; f.autoAimLock = true;
  }
}
function keyCharge(f, code, dirs){
  if (f.state !== 'alive' || f.cooldown > 0) return;
  if (!f.isCharging){ f.isCharging = true; f.charge = 0; startCharge(f.id, 0.72 + f.spd*0.34); }
  f.heldKeys.add(code);
  const now = performance.now(), opp = OPPOSITE[code];
  if (opp && f.keyTimes[opp] && (now - f.keyTimes[opp]) < AUTO_AIM_WINDOW){
    f.autoAimLock = true; f.aimActive = false; f.aimDx = 0; f.aimDy = 0;
  } else updateKeyAim(f, dirs);
  f.keyTimes[code] = now;
}
function keyRelease(f){
  if (!f.isCharging) return;
  if (f.autoAimLock) triggerDash(f); else triggerDash(f, f.aimDx, f.aimDy);
  f.heldKeys.clear(); f.autoAimLock = false;
}
window.addEventListener('keydown', function(e){
  if (e.code === 'Escape'){ if (gameState !== 'MENU' && gameState !== 'REVIVE_OFFER' && activeScreen === null) togglePause(true); return; }
  if (activeScreen !== null) return;
  initAudio();
  if (P2_DIRS[e.code] || e.code === 'Space') e.preventDefault();
  if (keysDown[e.code]) return;
  keysDown[e.code] = true;
  if (!canPlay()) return;
  if (P1_DIRS[e.code]) keyCharge(P1, e.code, P1_DIRS);
  else if (P2_DIRS[e.code]) keyCharge(soloMode() ? P1 : P2, e.code, P2_DIRS);
  else if (e.code === 'Space' && soloMode()){
    if (P1.state === 'alive' && P1.cooldown <= 0 && !P1.isCharging){
      P1.isCharging = true; P1.charge = 0; P1.autoAimLock = true;
      P1.aimActive = false; P1.aimDx = 0; P1.aimDy = 0;
      startCharge(1, 0.72 + P1.spd*0.34);
    }
  }
});
window.addEventListener('keyup', function(e){
  keysDown[e.code] = false;
  if (activeScreen !== null) return;
  if (P1_DIRS[e.code]) keyRelease(P1);
  else if (P2_DIRS[e.code]) keyRelease(soloMode() ? P1 : P2);
  else if (e.code === 'Space' && soloMode() && P1.isCharging){ triggerDash(P1); P1.autoAimLock = false; }
});

// The divider is the stage's own vertical centre, which is exactly where the
// ring centre is drawn (draw() translates to canvas.height/2). Reading it from
// the stage rect - not window.innerHeight - keeps the touch split welded to the
// ring no matter what chrome the host webview adds.
//
// ZERO-HEIGHT GUARD. On a real device there is a window during first layout and
// during orientation change where the stage measures 0 high. An unguarded
// r.top + r.height/2 returns 0 there, every clientY compares >= 0, and BOTH
// players silently drive P1 - the exact failure this whole change exists to
// remove. So a degenerate measurement is never allowed to become the divider:
// the last good value is kept, and before any good value exists we fall back to
// the viewport. Only a positive height is trusted.
let splitYCache = 0;
function splitY(){
  const r = $('stage').getBoundingClientRect();
  if (r.height > 0) splitYCache = r.top + r.height/2;
  else if (!splitYCache) splitYCache = (window.innerHeight || 0)/2;
  return splitYCache;
}
function ownerFor(clientY){
  if (soloMode()) return P1;
  return clientY < splitY() ? P2 : P1;   // top half = P2, bottom half = P1
}
function indicatorFor(f){
  if (soloMode()) return document.getElementById('touch-solo');
  return document.getElementById(f.id === 1 ? 'touch-left' : 'touch-right');
}
function beginAim(f, id, cx, cy){
  if (!canPlay()) return;
  if (f.state !== 'alive' || f.cooldown > 0 || f.isCharging || f.touchId !== null) return;
  f.touchId = id; f.isCharging = true; f.charge = 0;
  f.aimAnchorX = cx; f.aimAnchorY = cy; f.aimDx = 0; f.aimDy = 0; f.aimActive = true;
  startCharge(f.id, 0.72 + f.spd*0.34);
  const el = indicatorFor(f); if (el) el.classList.add('touching');
}
// ★★ 회전 절대 금지 (Partner 원문, 2026-08-14):
//   「드래그 벡터가 곧 대시 방향이라 절대좌표가 이미 양쪽에 옳다.
//    회전을 넣으면 위쪽 플레이어 조준이 «반대로» 뒤집힌다 — 게임이 아예 안 된다」
//   READY/GO 배너와 결과 선언은 180도 돌리기로 «결정»됐다. 그러나 이 벡터는 «예외»다.
//   회전 결정이 여럿 나온 상태라, 다음 사람이 「여기도 돌려야 하나」 하고 손대기
//   가장 쉬운 자리다. 돌리지 마라.
function moveAim(f, cx, cy){ if (f.isCharging){ f.aimDx = cx - f.aimAnchorX; f.aimDy = cy - f.aimAnchorY; } }
function endAim(f){
  if (f.isCharging){
    if (f.aimDx*f.aimDx + f.aimDy*f.aimDy > AIM_THRESHOLD*AIM_THRESHOLD) triggerDash(f, f.aimDx, f.aimDy);
    else triggerDash(f);
  }
  f.touchId = null;
  const el = indicatorFor(f); if (el) el.classList.remove('touching');
}
window.addEventListener('touchstart', function(e){
  initAudio();
  if (!canPlay()) return;
  for (let i=0;i<e.changedTouches.length;i++){
    const t = e.changedTouches[i];
    beginAim(ownerFor(t.clientY), t.identifier, t.clientX, t.clientY);
  }
}, {passive:true});
window.addEventListener('touchmove', function(e){
  for (let i=0;i<e.changedTouches.length;i++){
    const t = e.changedTouches[i];
    if (P1.touchId === t.identifier) moveAim(P1, t.clientX, t.clientY);
    if (P2.touchId === t.identifier) moveAim(P2, t.clientX, t.clientY);
  }
}, {passive:true});
window.addEventListener('touchend', function(e){
  for (let i=0;i<e.changedTouches.length;i++){
    const t = e.changedTouches[i];
    if (P1.touchId === t.identifier) endAim(P1);
    if (P2.touchId === t.identifier) endAim(P2);
  }
}, {passive:true});
window.addEventListener('touchcancel', function(e){
  for (let i=0;i<e.changedTouches.length;i++){
    const t = e.changedTouches[i];
    [P1,P2].forEach(function(f){
      if (f.touchId === t.identifier){
        stopCharge(f.id); f.isCharging = false; f.charge = 0; f.touchId = null;
        const el = indicatorFor(f); if (el) el.classList.remove('touching');
      }
    });
  }
}, {passive:true});
window.addEventListener('mousedown', function(e){
  initAudio();
  if (!canPlay()) return;
  const f = ownerFor(e.clientY);
  beginAim(f, f.id === 1 ? 'mouseL' : 'mouseR', e.clientX, e.clientY);
});
window.addEventListener('mousemove', function(e){
  if (P1.touchId === 'mouseL') moveAim(P1, e.clientX, e.clientY);
  if (P2.touchId === 'mouseR') moveAim(P2, e.clientX, e.clientY);
});
window.addEventListener('mouseup', function(){
  if (P1.touchId === 'mouseL') endAim(P1);
  if (P2.touchId === 'mouseR') endAim(P2);
});
// ============================== CPU opponent ==============================
// The CPU plays with exactly the same verbs as a human: start a charge, steer the aim,
// release. It never reads hidden state and never gets extra force.
const ai = {cfg:{}, pers:'balance', wait:0, tc:0.6, plan:'attack', t:0, burst:0, feint:false};

function aiConfigure(pers, skill, difficulty){
  // level 0..1 blends the chosen difficulty with the ladder position.
  const base = [0.10, 0.30, 0.50][difficulty] || 0.30;
  const span = [0.30, 0.45, 0.50][difficulty] || 0.45;
  let L = Math.max(0, Math.min(1, base + skill*span));
  const c = {
    react:   0.52 - L*0.40,
    aimErr:  0.44 - L*0.37,
    cMin:    0.26 + L*0.34,
    cMax:    0.50 + L*0.48,
    dodge:   0.24 + L*0.26,
    edge:    0.30 + L*0.65,
    lead:    L,
    outward: 0.10 + L*0.34,
    flank:   0.10,
    level:   L
  };
  if (pers === 'aggro'){ c.react *= 0.66; c.cMin *= 0.82; c.cMax *= 0.94; c.dodge *= 0.55; c.outward += 0.08; }
  else if (pers === 'defend'){ c.react *= 1.22; c.cMin += 0.12; c.cMax = Math.min(1, c.cMax + 0.08); c.dodge = Math.min(1, c.dodge*1.3); c.edge = Math.min(1, c.edge*1.2); }
  else if (pers === 'tricky'){ c.flank = 0.22; c.react *= 0.9; c.aimErr *= 0.85; c.dodge = Math.min(1, c.dodge*1.15); }
  else if (pers === 'boss'){ c.react *= 0.55; c.aimErr *= 0.50; c.cMax = 1; c.cMin = 0.44; c.dodge *= 0.9; c.flank = 0.08; }
  ai.cfg = c; ai.pers = pers;
}
function aiReset(){
  ai.wait = (ai.cfg.react || 0.4) * (1.2 + Math.random());
  ai.tc = 0.6; ai.plan = 'attack'; ai.t = 0; ai.burst = 0; ai.feint = false; ai.foeWasDashing = false;
}
function rotVec(x, y, a){ const c = Math.cos(a), s = Math.sin(a); return [x*c - y*s, x*s + y*c]; }
// Straight, honest aim at where the rival will be. Accuracy is the whole skill curve here,
// so nothing is blended into the direction - positioning is handled separately.
function aiAim(me, foe, c){
  const dx = foe.x - me.x, dy = foe.y - me.y;
  const dist = Math.sqrt(dx*dx + dy*dy) || 1;
  const tHit = Math.min(0.5, dist/430);
  const px = foe.x + foe.vx*60*tHit*c.lead*0.35;
  const py = foe.y + foe.vy*60*tHit*c.lead*0.35;
  let ax = px - me.x, ay = py - me.y;
  const m = Math.sqrt(ax*ax + ay*ay) || 1; ax /= m; ay /= m;
  let err = (Math.random() - 0.5) * 2 * c.aimErr;
  if (Math.random() < c.flank) err += (Math.random() < 0.5 ? -1 : 1) * (0.16 + Math.random()*0.14);
  const r = rotVec(ax, ay, err);
  const s = aiPitSafe(me, r[0], r[1]);
  return [s[0]*100, s[1]*100];
}
// How good is our current angle? 1 = we would shove the rival straight out of the ring,
// -1 = we would only push them back toward safety.
function aiShoveQuality(me, foe){
  const fr = Math.sqrt(foe.x*foe.x + foe.y*foe.y);
  if (fr < 60) return 1;
  const dx = foe.x - me.x, dy = foe.y - me.y;
  const d = Math.sqrt(dx*dx + dy*dy) || 1;
  return (dx/d)*(foe.x/fr) + (dy/d)*(foe.y/fr);
}
// Slide to the inner side of the rival so the next shove points at the rim.
function aiRepositionAim(me, foe){
  const fr = Math.sqrt(foe.x*foe.x + foe.y*foe.y) || 1;
  const tx = foe.x - (foe.x/fr)*150, ty = foe.y - (foe.y/fr)*150;
  let ax = tx - me.x, ay = ty - me.y;
  const m = Math.sqrt(ax*ax + ay*ay) || 1;
  const s = aiPitSafe(me, ax/m, ay/m);
  return [s[0]*100, s[1]*100];
}
// Never charge along a line that clips the centre hole - that is a self ring-out.
function aiPitSafe(me, ax, ay){
  if (curRule.id !== 'pit' || pitRadius < 8) return [ax, ay];
  const myR = Math.sqrt(me.x*me.x + me.y*me.y);
  const safe = pitRadius + me.radius + 10;
  if (myR <= safe) return [ax, ay];
  const inward = (ax*(-me.x) + ay*(-me.y)) / myR;
  if (inward <= 0) return [ax, ay];
  const perp = Math.abs(me.x*ay - me.y*ax);       // |me x dir|, dir is unit length
  if (perp >= safe) return [ax, ay];
  const ca = Math.atan2(-me.y, -me.x);
  const a = Math.atan2(ay, ax);
  let da = Math.atan2(Math.sin(a - ca), Math.cos(a - ca));
  const half = Math.asin(Math.min(1, safe/myR));
  const na = ca + (da >= 0 ? half : -half);
  return [Math.cos(na), Math.sin(na)];
}
function aiCenterAim(me){
  const d = Math.sqrt(me.x*me.x + me.y*me.y) || 1;
  const jitter = (Math.random() - 0.5) * 0.5;
  const r = rotVec(-me.x/d, -me.y/d, jitter);
  const s = aiPitSafe(me, r[0], r[1]);
  return [s[0]*100, s[1]*100];
}
function aiDodgeAim(me, foe){
  const dx = me.x - foe.x, dy = me.y - foe.y;
  const d = Math.sqrt(dx*dx + dy*dy) || 1;
  // sidestep, biased back toward the middle so the dodge never self-ejects
  let px = -dy/d, py = dx/d;
  if ((px*(-me.x) + py*(-me.y)) < 0){ px = -px; py = -py; }
  return [px*100, py*100];
}
function aiBegin(me, targetCharge, plan){
  if (me.cooldown > 0 || me.state !== 'alive') return;
  me.isCharging = true; me.charge = 0;
  ai.tc = Math.max(0.12, Math.min(1, targetCharge));
  ai.plan = plan;
  startCharge(me.id, 0.72 + me.spd*0.34);
}
function aiRelease(me, aim){
  if (!me.isCharging) return;
  triggerDash(me, aim[0], aim[1]);
  const c = ai.cfg;
  let w = c.react * (0.55 + Math.random()*1.05);
  if (ai.burst > 0){ ai.burst--; w *= 0.35; }
  ai.wait = w;
}
function aiUpdate(dt){
  const me = P2, foe = P1, c = ai.cfg;
  if (!c || me.state !== 'alive') return;
  ai.t += dt;
  if (foe.state !== 'alive'){ if (me.isCharging) aiRelease(me, aiCenterAim(me)); return; }

  const dx = foe.x - me.x, dy = foe.y - me.y;
  const dist = Math.sqrt(dx*dx + dy*dy) || 1;
  const myR = Math.sqrt(me.x*me.x + me.y*me.y);
  const edge = myR / Math.max(1, arenaRadius);
  const panic = edge > (0.94 - c.edge*0.10);

  // ---- react to an incoming dash exactly once, when it starts ----
  // A per-frame dice roll made the CPU dodge constantly and never attack.
  let incoming = false;
  if (foe.isDashing && !ai.foeWasDashing){
    const fv = Math.sqrt(foe.vx*foe.vx + foe.vy*foe.vy) || 1;
    const aimDot = (foe.vx/fv)*(dx/dist)*-1 + (foe.vy/fv)*(dy/dist)*-1;
    incoming = aimDot > 0.78 && dist < 215;
  }
  ai.foeWasDashing = foe.isDashing;

  // hazard awareness: back away from a live bomb or the centre pit
  let hazardPush = null;
  for (let i=0;i<hazards.length;i++){
    const h = hazards[i];
    if (h.type === 'bomb' && h.live && h.fuse < 2.4){
      const hx = me.x - h.x, hy = me.y - h.y, hd = Math.sqrt(hx*hx + hy*hy) || 1;
      if (hd < 52 + h.r) hazardPush = [hx/hd*100, hy/hd*100];
    }
  }
  if (!hazardPush && curRule.id === 'pit' && pitRadius > 12 && myR < pitRadius + 40){
    hazardPush = [me.x/(myR||1)*100, me.y/(myR||1)*100];
  }

  // A charged body beats an incoming one: countering is better than dodging.
  if (incoming && me.isCharging && me.charge/CHARGE_MAX >= 0.45){
    aiRelease(me, aiAim(me, foe, c));
    return;
  }

  if (!me.isCharging){
    if (me.cooldown > 0) return;
    if (hazardPush && Math.random() < 0.7){ aiBegin(me, 0.22, 'flee'); return; }
    if (incoming && Math.random() < c.dodge*0.55){ aiBegin(me, 0.16, 'dodge'); return; }
    if (panic){ aiBegin(me, 0.30 + Math.random()*0.22, 'panic'); return; }
    ai.wait -= dt;
    if (ai.wait <= 0){
      let tc = c.cMin + Math.random()*Math.max(0.02, c.cMax - c.cMin);
      // a whiff from the rim ejects us, so commit less the closer we are to the line
      if (edge > 0.74) tc = Math.min(tc, 0.48);
      if (ai.pers === 'defend'){
        const foeEdge = Math.sqrt(foe.x*foe.x + foe.y*foe.y) / Math.max(1, arenaRadius);
        if (foeEdge < 0.38 && Math.random() < 0.35){ ai.wait = c.react*0.7; return; }
      }
      if (ai.pers === 'boss' && ai.t > 6 && Math.random() < 0.3){ ai.burst = 2; ai.t = 0; }
      // Bad angle? Circle to the inside first instead of shoving the rival to safety.
      const q = aiShoveQuality(me, foe);
      if (q < -0.15 && c.level > 0.4 && Math.random() < (c.level - 0.3) && edge < 0.7){
        aiBegin(me, 0.26 + Math.random()*0.16, 'reposition');
      } else {
        aiBegin(me, tc, 'attack');
      }
    }
    return;
  }

  // ---- currently charging ----
  const ratio = me.charge / CHARGE_MAX;
  if (ai.plan === 'dodge'){ if (ratio >= 0.12) aiRelease(me, aiDodgeAim(me, foe)); return; }
  if (ai.plan === 'flee'){ if (ratio >= 0.18 && hazardPush) { aiRelease(me, hazardPush); return; } }
  if (ai.plan === 'panic'){ if (ratio >= ai.tc) aiRelease(me, aiCenterAim(me)); return; }
  if (ai.plan === 'reposition'){ if (ratio >= ai.tc) aiRelease(me, aiRepositionAim(me, foe)); return; }
  if (incoming && Math.random() < c.dodge*0.5){
    ai.plan = 'dodge'; if (ratio >= 0.12) aiRelease(me, aiDodgeAim(me, foe));
    return;
  }
  if (panic){ ai.plan = 'panic'; if (ratio >= 0.28) aiRelease(me, aiCenterAim(me)); return; }
  // punish a rival who has drifted to the rim: fire early rather than over-charge
  if (ratio >= 0.45 && ratio < ai.tc){
    const foeEdge = Math.sqrt(foe.x*foe.x + foe.y*foe.y) / Math.max(1, arenaRadius);
    if (foeEdge > 0.58 && aiShoveQuality(me, foe) > 0.35 && Math.random() < c.level*dt*7){
      aiRelease(me, aiAim(me, foe, c));
      return;
    }
  }
  if (ratio >= ai.tc){
    let aim = aiAim(me, foe, c);
    // final safety: only abort when a long whiff from the rim would throw us out
    const ox = me.x/(myR||1), oy = me.y/(myR||1);
    const outDot = (aim[0]*ox + aim[1]*oy) / 100;
    if (edge > 0.80 && outDot > 0.55 && dist > me.radius + foe.radius + 90){
      aim = aiCenterAim(me);
    }
    aiRelease(me, aim);
  }
}
// ============================== fighter art (procedural, no assets) ==============================
function shade(hex, amt){
  const h = hex.replace('#','');
  const n = parseInt(h.length === 3 ? h.split('').map(function(c){return c+c;}).join('') : h, 16);
  let r = (n>>16)&255, g = (n>>8)&255, b = n&255;
  if (amt >= 0){ r += (255-r)*amt; g += (255-g)*amt; b += (255-b)*amt; }
  else { r *= (1+amt); g *= (1+amt); b *= (1+amt); }
  return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
}
function bodyPath(g, r, body){
  g.beginPath();
  if (body === 'wide') g.ellipse(0, 0, r*1.14, r*0.90, 0, 0, Math.PI*2);
  else if (body === 'tall') g.ellipse(0, 0, r*0.86, r*1.12, 0, 0, Math.PI*2);
  else if (body === 'blob') g.ellipse(0, r*0.05, r*1.06, r*0.97, 0, 0, Math.PI*2);
  else if (body === 'block'){
    const w = r*1.02, k = r*0.42;
    g.moveTo(-w+k, -w); g.lineTo(w-k, -w); g.quadraticCurveTo(w, -w, w, -w+k);
    g.lineTo(w, w-k); g.quadraticCurveTo(w, w, w-k, w); g.lineTo(-w+k, w);
    g.quadraticCurveTo(-w, w, -w, w-k); g.lineTo(-w, -w+k); g.quadraticCurveTo(-w, -w, -w+k, -w);
    g.closePath();
  }
  else g.arc(0, 0, r, 0, Math.PI*2);
}
// 2026-08-24 ⛔«어깨 돌출»(SHOULDER_BY_BODY + fullSilhouette) 철회 — 하루 전
// 넣은 우리 변경이 만든 결함이다. President 실기기 지적: 「저 팔 같은 건 왜
// 생긴 거야?」 캐릭터 좌우에 팔/귀처럼 튀어나온 덩어리가 보였다.
//
// 원인은 dx 값(최대 1.18r)만이 아니다 — «구조»가 틀렸다.
//   ① 어깨는 bodyPath 에 «별개의 닫힌 서브패스»로 붙었다. fill 은 합쳐지지만
//      stroke 는 서브패스마다 «전체 둘레»를 긋는다. 그리고 외곽선 stroke 는
//      drawFighterArt 의 «마지막» 연산이라, 어깨 원의 테두리가 얼굴판·마와시
//      «위에» 그려졌다. 그래서 몸통에 붙은 어깨가 아니라 «따로 놓인 원반»으로
//      읽혔다(= 팔/귀/손잡이).
//   ② 어깨 fill 은 몸통 중심 기준 radialGradient 의 가장 어두운 끝(1.0 stop)에
//      걸려 몸통보다 확연히 어두웠다 — 분리감을 한 번 더 키웠다.
//   ③ 인게임 r 은 f.radius(17~30 CSS px)라 어깨 반지름이 3~12px 밖에 안 된다.
//      그 크기의 디테일은 «형태»가 아니라 «노이즈»로만 읽힌다.
//   ④ 시각 폭이 1.58r 까지 벌어져 충돌 반경(r)과 어긋났다 — 「맞았는데 안 밀림」
//      으로 보이는 조작감 오해까지 낳는다.
//   ⇒ dx 만 줄이는 안(실측: dx×0.62)은 «더 나빴다». 원반이 얼굴 위로 올라와
//     고글/안경처럼 보였다. 어깨만 인게임에서 빼는 안도 기각 — ①이 원인이라
//     대전 준비 화면(r=39.4)에서도 똑같이 원반으로 보였다.
//     증거: _shoulder_verify_260824/variants_sheet.png (V0~V3, 두 배율 동시 렌더)
//
// ★그럼 8/23 의 원래 지적(「원 안에 단순한 얼굴」)은 무엇이 해결하나:
//   어깨가 아니라 «머리 올리기(HEAD_DY=-0.20r)» + «마와시 폭 확대(1.3r→1.6r)»
//   가 해결한다. 이 둘은 그대로 살아 있다. 어깨만 뺀 상태와 8/14 원본을 같은
//   회차에 나란히 렌더해 확인했다(baseline_pretoday_0814.png vs
//   after_06_grid_all_chars.png) — 얼굴 비중은 여전히 줄어 있고 몸통·띠가 남는다.
//
// ⛔여기는 «그리기»만 한다. def.radius / f.radius(물리 충돌 반경)는 이 근처
// 어디서도 읽지 않는다 — bodyPath 의 r 은 호출자가 넘기는 그리기 스케일이다.
// 실제 충돌판정은 minDist = P1.radius + P2.radius(위쪽 physics 구역)와
// arenaRadius + f.radius*FALL_GRACE(링아웃)뿐이고, 이 철회로 한 바이트도 안 바뀐다.
function drawHair(g, r, def, back){
  const dark = shade(def.mawashi, 0.06), hair = '#241c22';
  g.fillStyle = hair;
  if (def.hair === 'topknot'){
    if (back){
      g.beginPath(); g.ellipse(0, -r*1.10, r*0.20, r*0.30, 0, 0, Math.PI*2); g.fill();
      g.fillStyle = '#3a2c33';
      g.beginPath(); g.ellipse(0, -r*1.30, r*0.15, r*0.13, 0, 0, Math.PI*2); g.fill();
    } else {
      g.beginPath(); g.arc(0, -r*0.16, r*0.93, Math.PI*1.14, Math.PI*1.86); g.lineTo(0, -r*0.16); g.fill();
    }
  } else if (def.hair === 'ponytail'){
    if (back){
      g.beginPath(); g.moveTo(r*0.2, -r*0.9); g.quadraticCurveTo(r*1.5, -r*1.1, r*1.25, r*0.15);
      g.quadraticCurveTo(r*1.1, -r*0.5, r*0.1, -r*0.6); g.fill();
    } else { g.beginPath(); g.arc(0, -r*0.2, r*0.9, Math.PI*1.08, Math.PI*1.92); g.lineTo(0, -r*0.2); g.fill(); }
  } else if (def.hair === 'bald'){
    if (!back){ g.fillStyle = 'rgba(255,255,255,0.30)';
      g.beginPath(); g.ellipse(-r*0.28, -r*0.52, r*0.24, r*0.11, -0.5, 0, Math.PI*2); g.fill(); }
  } else if (def.hair === 'horns'){
    if (back){
      g.fillStyle = '#f0e6d2';
      for (const s of [-1,1]){
        g.beginPath(); g.moveTo(s*r*0.44, -r*0.72); g.lineTo(s*r*0.74, -r*1.42);
        g.lineTo(s*r*0.20, -r*0.94); g.closePath(); g.fill();
      }
    } else { g.beginPath(); g.arc(0, -r*0.18, r*0.9, Math.PI*1.16, Math.PI*1.84); g.lineTo(0,-r*0.18); g.fill(); }
  } else if (def.hair === 'bun'){
    if (back){ g.beginPath(); g.arc(0, -r*1.12, r*0.34, 0, Math.PI*2); g.fill();
      g.fillStyle = def.trim; g.beginPath(); g.arc(0, -r*1.12, r*0.15, 0, Math.PI*2); g.fill(); }
    else { g.beginPath(); g.arc(0, -r*0.1, r*0.92, Math.PI*1.06, Math.PI*1.94); g.lineTo(0,-r*0.1); g.fill(); }
  } else if (def.hair === 'wild'){
    if (back){
      for (let i=0;i<7;i++){
        const a = Math.PI*1.06 + (i/6)*Math.PI*0.88;
        g.beginPath(); g.moveTo(Math.cos(a)*r*0.85, Math.sin(a)*r*0.85);
        g.lineTo(Math.cos(a-0.10)*r*1.42, Math.sin(a-0.10)*r*1.42);
        g.lineTo(Math.cos(a+0.16)*r*0.86, Math.sin(a+0.16)*r*0.86); g.closePath(); g.fill();
      }
    } else { g.beginPath(); g.arc(0, -r*0.14, r*0.9, Math.PI*1.08, Math.PI*1.92); g.lineTo(0,-r*0.14); g.fill(); }
  } else if (def.hair === 'flat'){
    if (!back){
      g.beginPath(); g.arc(0, -r*0.26, r*0.9, Math.PI*1.02, Math.PI*1.98); g.lineTo(0, -r*0.26); g.fill();
      g.fillRect(-r*0.86, -r*0.62, r*1.72, r*0.16);
    }
  } else if (def.hair === 'crest'){
    if (back){
      g.fillStyle = shade(def.color, 0.30);
      g.beginPath(); g.moveTo(-r*0.42, -r*0.80);
      for (let i=0;i<4;i++){ const x = -r*0.42 + i*r*0.28; g.lineTo(x + r*0.14, -r*(1.34 - i*0.06)); g.lineTo(x + r*0.28, -r*0.84); }
      g.closePath(); g.fill();
    } else { g.beginPath(); g.arc(0, -r*0.16, r*0.9, Math.PI*1.12, Math.PI*1.88); g.lineTo(0,-r*0.16); g.fill(); }
  } else if (def.hair === 'crown'){
    if (back){
      g.beginPath(); g.ellipse(0, -r*1.06, r*0.19, r*0.28, 0, 0, Math.PI*2); g.fill();
      g.strokeStyle = '#fff3cd'; g.lineWidth = r*0.16; g.lineCap = 'round';
      g.beginPath(); g.arc(0, -r*0.10, r*1.02, Math.PI*1.14, Math.PI*1.86); g.stroke();
      g.fillStyle = '#fff3cd';
      for (const s of [-1,0,1]){
        g.beginPath(); g.moveTo(s*r*0.44 - r*0.10, -r*1.00); g.lineTo(s*r*0.44, -r*1.30);
        g.lineTo(s*r*0.44 + r*0.10, -r*1.00); g.closePath(); g.fill();
      }
    } else { g.beginPath(); g.arc(0, -r*0.14, r*0.88, Math.PI*1.16, Math.PI*1.84); g.lineTo(0,-r*0.14); g.fill(); }
  }
}
function drawMark(g, r, def){
  g.save();
  g.globalAlpha = 0.5;
  g.strokeStyle = def.trim; g.fillStyle = def.trim; g.lineWidth = Math.max(1, r*0.09);
  if (def.mark === 'stripes'){
    for (let i=-1;i<=1;i++){
      g.beginPath(); g.moveTo(-r*0.9, r*0.05 + i*r*0.34); g.lineTo(r*0.9, -r*0.25 + i*r*0.34); g.stroke();
    }
  } else if (def.mark === 'dots'){
    for (let i=0;i<5;i++){
      const a = i*1.257;
      g.beginPath(); g.arc(Math.cos(a)*r*0.52, Math.sin(a)*r*0.42 - r*0.05, r*0.10, 0, Math.PI*2); g.fill();
    }
  } else if (def.mark === 'flame'){
    for (let i=-1;i<=1;i++){
      g.beginPath(); g.moveTo(i*r*0.42 - r*0.16, r*0.30); g.quadraticCurveTo(i*r*0.42, -r*0.42, i*r*0.42 + r*0.16, r*0.30);
      g.closePath(); g.fill();
    }
  } else if (def.mark === 'wave'){
    g.beginPath();
    for (let x=-r*0.9; x<=r*0.9; x+=r*0.12) { const y = Math.sin(x/r*3.1)*r*0.16 - r*0.02; if (x <= -r*0.9) g.moveTo(x,y); else g.lineTo(x,y); }
    g.stroke();
  } else if (def.mark === 'star'){
    g.beginPath();
    for (let i=0;i<10;i++){
      const a = -Math.PI/2 + i*Math.PI/5, rr = (i%2 ? r*0.20 : r*0.44);
      const x = Math.cos(a)*rr, y = Math.sin(a)*rr - r*0.04;
      if (i===0) g.moveTo(x,y); else g.lineTo(x,y);
    }
    g.closePath(); g.fill();
  } else if (def.mark === 'plate'){
    g.globalAlpha = 0.42;
    g.fillRect(-r*0.86, -r*0.22, r*1.72, r*0.18);
    g.fillRect(-r*0.70, r*0.08, r*1.40, r*0.14);
  } else if (def.mark === 'swirl'){
    g.beginPath();
    for (let i=0;i<28;i++){ const a = i*0.32, rr = r*0.06 + i*r*0.018; const x = Math.cos(a)*rr, y = Math.sin(a)*rr;
      if (i===0) g.moveTo(x,y); else g.lineTo(x,y); }
    g.stroke();
  } else if (def.mark === 'ring'){
    g.beginPath(); g.arc(0, -r*0.02, r*0.50, 0, Math.PI*2); g.stroke();
    g.globalAlpha = 0.3; g.beginPath(); g.arc(0, -r*0.02, r*0.70, 0, Math.PI*2); g.stroke();
  }
  g.restore();
}
function drawFace(g, r, def, o){
  const ex = r*0.34, ey = -r*0.16, er = r*0.175;
  const charging = o.charging, hurt = o.hurt, win = o.win;
  const f = def.face;
  g.save();
  // brows
  g.strokeStyle = '#241c22'; g.lineWidth = Math.max(1.2, r*0.10); g.lineCap = 'round';
  let browTilt = 0, browY = -r*0.44;
  if (f === 'angry' || f === 'fierce') browTilt = 0.42;
  else if (f === 'stern') browTilt = 0.24;
  else if (f === 'smug') browTilt = -0.10;
  else if (f === 'cool') browTilt = 0.12;
  if (charging) browTilt += 0.24;
  for (const s of [-1,1]){
    const tilt = browTilt * s * (f === 'smug' && s === 1 ? -1.6 : 1);
    g.beginPath();
    g.moveTo(s*ex - r*0.20, browY - tilt*r*0.22);
    g.lineTo(s*ex + r*0.20, browY + tilt*r*0.22);
    g.stroke();
  }
  // eyes
  const closed = (o.blink < 0) || f === 'sleepy' || hurt > 0.15;
  if (closed){
    g.lineWidth = Math.max(1.2, r*0.09);
    for (const s of [-1,1]){
      g.beginPath();
      if (hurt > 0.15){
        g.moveTo(s*ex - er*0.8, ey - er*0.8); g.lineTo(s*ex + er*0.8, ey + er*0.8);
        g.moveTo(s*ex + er*0.8, ey - er*0.8); g.lineTo(s*ex - er*0.8, ey + er*0.8);
      } else {
        g.arc(s*ex, ey, er*0.9, Math.PI*0.15, Math.PI*0.85);
      }
      g.stroke();
    }
  } else {
    const sq = charging ? 0.62 : 1;
    g.fillStyle = '#ffffff';
    for (const s of [-1,1]){
      g.beginPath(); g.ellipse(s*ex, ey, er, er*sq, 0, 0, Math.PI*2); g.fill();
    }
    g.fillStyle = '#1a1a1a';
    const look = charging ? 0.34 : 0.14;
    const pr = er * (f === 'wide' ? 0.62 : 0.52);
    for (const s of [-1,1]){
      g.beginPath(); g.arc(s*ex + (f==='cool' ? s*er*0.2 : 0), ey + er*look*sq, pr, 0, Math.PI*2); g.fill();
    }
  }
  // mouth
  g.strokeStyle = '#2a1c20'; g.lineWidth = Math.max(1.2, r*0.09); g.fillStyle = '#57202a';
  const my = r*0.30;
  if (win){
    g.beginPath(); g.ellipse(0, my, r*0.26, r*0.20, 0, 0, Math.PI*2); g.fill();
  } else if (charging || f === 'fierce' || f === 'angry'){
    g.beginPath(); g.ellipse(0, my, r*0.24, r*0.17, 0, 0, Math.PI*2); g.fill();
    g.fillStyle = '#ffffff';
    g.fillRect(-r*0.20, my - r*0.16, r*0.40, r*0.07);
  } else if (f === 'smug'){
    g.beginPath(); g.moveTo(-r*0.20, my); g.quadraticCurveTo(0, my + r*0.16, r*0.26, my - r*0.10); g.stroke();
  } else if (f === 'sleepy'){
    g.beginPath(); g.arc(0, my - r*0.06, r*0.14, 0, Math.PI); g.stroke();
  } else if (f === 'wide'){
    g.beginPath(); g.arc(0, my - r*0.08, r*0.26, 0.15*Math.PI, 0.85*Math.PI); g.stroke();
  } else if (f === 'stern'){
    g.beginPath(); g.moveTo(-r*0.22, my); g.lineTo(r*0.22, my); g.stroke();
  } else {
    g.beginPath(); g.arc(0, my - r*0.10, r*0.20, 0.2*Math.PI, 0.8*Math.PI); g.stroke();
  }
  g.restore();
}
// Master fighter renderer. Used identically for portraits and for live play.
function drawFighterArt(g, x, y, r, def, o){
  o = o || {};
  g.save();
  g.translate(x, y);
  if (o.squash > 0.01){
    g.rotate(o.squashAng || 0);
    g.scale(1 - o.squash*0.30, 1 + o.squash*0.22);
    g.rotate(-(o.squashAng || 0));
  }
  if (o.bounce) g.translate(0, Math.sin(o.bounce)*r*0.10);

  // 2026-08-23 President 실기기 지적 — 얼굴판이 몸통 대부분을 덮어 "원 안에
  // 단순한 얼굴"로 보였다. 머리(뒷머리+얼굴판+앞머리+이목구비)를 «통째로»
  // 위로 올려(HEAD_DY) 몸통(어깨·마와시)이 차지하는 비율을 키운다.
  // ⭐translate 로만 옮기므로 drawHair/drawFace 내부의 상대 수치는 하나도
  // 안 건드린다 — 헤어스타일별 모양이 깨질 위험이 없다.
  // ⛔def.radius(물리 충돌 반경)는 이 스케일과 무관 — 여기서 옮기는 건
  // 그리기 좌표뿐이고 f.radius 원본(충돌판정)은 이 함수가 아예 안 읽는다.
  const HEAD_DY = -0.20;

  g.save(); g.translate(0, HEAD_DY*r);
  drawHair(g, r, def, true);
  g.restore();

  if (o.glow){ g.shadowColor = hexA(def.color, 0.85); g.shadowBlur = o.glow; }
  const grd = g.createRadialGradient(-r*0.32, -r*0.38, r*0.12, 0, 0, r*1.25);
  grd.addColorStop(0, shade(def.color, 0.30));
  grd.addColorStop(0.55, def.color);
  grd.addColorStop(1, shade(def.color, -0.34));
  g.fillStyle = grd;
  bodyPath(g, r, def.body); g.fill();
  g.shadowBlur = 0;
  // 림라이트(좌상단 안쪽 가장자리) — 몸통 path 를 clip 한 뒤 살짝 밀어 stroke 하면 안쪽 가장자리만 남는다.
  g.save(); bodyPath(g, r, def.body); g.clip();
  g.translate(r*0.07, r*0.10); g.strokeStyle = 'rgba(255,248,236,0.22)'; g.lineWidth = r*0.16;
  bodyPath(g, r, def.body); g.stroke();
  g.restore();

  g.save();
  bodyPath(g, r, def.body); g.clip();
  drawMark(g, r, def);
  // mawashi belt — 머리를 올려 비운 공간까지 덮도록 위로 당긴다(0.30r 시작).
  // 폭 r*1.6 은 clip 안쪽 여유값이다(가장 넓은 몸통 wide 가 1.14r). 2026-08-24
  // 어깨 철회 후에도 clip 이 어차피 잘라내므로 시각 결과는 동일 — 값 유지.
  g.fillStyle = def.mawashi;
  g.fillRect(-r*1.6, r*0.30, r*3.2, r*0.62);
  g.fillStyle = def.trim;
  g.fillRect(-r*1.6, r*0.30, r*3.2, r*0.09);
  g.fillStyle = 'rgba(0,0,0,0.20)';
  g.fillRect(-r*1.6, r*0.83, r*3.2, r*0.10);
  // knot flap (narrow, darker than the belt so it reads as cloth, not a bib)
  g.fillStyle = shade(def.mawashi, -0.28);
  g.fillRect(-r*0.10, r*0.44, r*0.20, r*0.58);
  // volume shading
  const sh = g.createLinearGradient(0, -r, 0, r);
  sh.addColorStop(0, 'rgba(255,255,255,0.20)');
  sh.addColorStop(0.48, 'rgba(255,255,255,0)');
  sh.addColorStop(1, 'rgba(0,0,0,0.30)');
  g.fillStyle = sh; g.fillRect(-r*1.6, -r*1.3, r*3.2, r*2.6);
  if (o.hurt > 0){ g.fillStyle = 'rgba(255,255,255,' + Math.min(0.5, o.hurt) + ')'; g.fillRect(-r*1.6,-r*1.3,r*3.2,r*2.6); }
  g.restore();

  // face plate — HEAD_DY 만큼 위로 올린 머리 그룹 안에서 그린다(내부 상대
  // 좌표는 전임 원본 그대로).
  g.save(); g.translate(0, HEAD_DY*r);
  g.fillStyle = def.skin;
  g.beginPath(); g.ellipse(0, -r*0.12, r*0.72, r*0.62, 0, 0, Math.PI*2); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.06)';
  g.beginPath(); g.ellipse(0, r*0.16, r*0.60, r*0.22, 0, 0, Math.PI*2); g.fill();
  drawHair(g, r, def, false);
  drawFace(g, r, def, o);
  g.restore();

  // outline — 먹선. 배경이 매 순간 바뀌는 오버레이라 실루엣이 항상 읽히도록 진하게.
  g.strokeStyle = 'rgba(14,8,10,0.62)'; g.lineWidth = Math.max(1.2, r*0.075);
  bodyPath(g, r, def.body); g.stroke();
  g.restore();
}
function paintPortrait(el, def, cssSize, opts){
  if (!el) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  el.width = Math.round(cssSize*dpr); el.height = Math.round(cssSize*dpr);
  const g = el.getContext('2d');
  g.clearRect(0,0,el.width,el.height);
  g.save(); g.scale(dpr, dpr);
  drawFighterArt(g, cssSize/2, cssSize/2 + cssSize*0.02, cssSize*0.34, def, opts || {});
  g.restore();
}

// ============================== arena rendering ==============================
/* 그래픽 고도화(2026-08-30) — 배경을 «정적 타일 1장 + 동적 소수»로 나눈다.
   정적(하늘·태양/달·산·건물·가지·기둥·실루엣·관중·등롱 몸체·스타디움·외곽 어둠)은 아레나·해상도·품질별로
   «1회 래스터»(bgTile) 해 매 프레임 drawImage 1회. 동적(구름·눈·꽃잎·불씨·비·번개·등롱 불꽃)만 위에 얹는다.
   dyn=false 는 타일에, dyn=true 는 프레임에 그린다. 품질 0 에서는 동적 레이어를 «전부» 끈다. */
let _tileRaster = false;
function dynN(n){ if (_tileRaster) return n; const f = gfxQf(); const k = f >= 1 ? 0.5 + 0.5*Math.min(1, f - 1) : 0.5*Math.max(0, f); return Math.ceil(n*k); }
function drawSkyDetail(theme, time, dyn){
  ctx.save();
  const id = theme.id;
  if (id === 'dawn' || id === 'sunset'){
    if (!dyn){
      const sx = id === 'dawn' ? -255 : 250, sy = id === 'dawn' ? -205 : -175;
      const sun = ctx.createRadialGradient(sx, sy, 2, sx, sy, 84);
      sun.addColorStop(0, 'rgba(255,244,196,0.95)');
      sun.addColorStop(0.24, id === 'dawn' ? 'rgba(255,197,145,0.72)' : 'rgba(255,142,93,0.72)');
      sun.addColorStop(1, 'rgba(255,118,92,0)');
      ctx.fillStyle = sun; ctx.fillRect(sx-92, sy-92, 184, 184);
    } else {
      ctx.fillStyle = id === 'dawn' ? 'rgba(255,226,211,0.10)' : 'rgba(72,25,53,0.18)';
      const n = dynN(5);
      for (let i=0;i<n;i++){
        const x = ((time*(2.5+i*0.35) + i*181) % 980) - 490, y = -275 + i*67;
        ctx.beginPath(); ctx.ellipse(x, y, 105+i*13, 10+(i%2)*4, -0.08, 0, Math.PI*2); ctx.fill();
      }
    }
  } else if (id === 'midnight'){
    if (!dyn){
      const moon = ctx.createRadialGradient(270,-245,1,270,-245,55);
      moon.addColorStop(0,'rgba(225,240,255,0.9)'); moon.addColorStop(0.18,'rgba(173,211,255,0.5)');
      moon.addColorStop(1,'rgba(102,159,255,0)');
      ctx.fillStyle = moon; ctx.fillRect(210,-305,120,120);
      for (let i=0;i<46;i++){
        const x = ((i*193)%760)-380, y = ((i*83)%520)-370;
        ctx.globalAlpha = 0.22 + ((i*7)%5)*0.06;
        ctx.fillStyle = i%5===0 ? '#b8d8ff' : '#ffffff';
        ctx.beginPath(); ctx.arc(x, y, i%7===0?1.7:0.85, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else {
      const n = dynN(10);
      ctx.fillStyle = '#ffffff';
      for (let i=0;i<n;i++){
        const x = ((i*193)%760)-380, y = ((i*83)%520)-370;
        ctx.globalAlpha = Math.max(0, Math.sin(time*1.8 + i*2.17))*0.35;
        ctx.beginPath(); ctx.arc(x, y, 1.3, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  } else if (id === 'snow'){
    if (!dyn){
      ctx.fillStyle = 'rgba(218,237,244,0.2)';
      ctx.beginPath(); ctx.moveTo(-400,30);
      const pk = [[-310,-210],[-245,-125],[-155,-290],[-55,-105],[35,-250],[150,-95],[240,-270],[330,-135],[400,-220]];
      pk.forEach(function(p){ ctx.lineTo(p[0], p[1]); });
      ctx.lineTo(400,80); ctx.closePath(); ctx.fill();
    } else {
      const n = dynN(52);
      for (let i=0;i<n;i++){
        const x = ((i*149 + time*(18+i%4))%860)-430, y = ((i*97 + time*(30+i%5))%820)-410;
        ctx.globalAlpha = 0.22+(i%5)*0.07; ctx.fillStyle = '#f5fdff';
        ctx.beginPath(); ctx.arc(x, y, 1+(i%3)*0.65, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  } else if (id === 'desert'){
    if (!dyn){
      const sun = ctx.createRadialGradient(-250,-215,4,-250,-215,95);
      sun.addColorStop(0,'rgba(255,239,169,0.92)'); sun.addColorStop(0.22,'rgba(255,187,93,0.58)');
      sun.addColorStop(1,'rgba(255,157,73,0)');
      ctx.fillStyle = sun; ctx.fillRect(-350,-315,200,200);
      ctx.fillStyle = 'rgba(86,42,33,0.24)';
      ctx.beginPath(); ctx.moveTo(-400,80);
      ctx.bezierCurveTo(-250,-40,-85,30,40,-5); ctx.bezierCurveTo(175,-45,270,35,400,-20);
      ctx.lineTo(400,165); ctx.lineTo(-400,165); ctx.closePath(); ctx.fill();
    } else {
      const n = dynN(32);
      for (let i=0;i<n;i++){
        const x = ((i*211 + time*(11+i%3))%900)-450, y = ((i*71 + Math.sin(time+i)*18)%600)-270;
        ctx.globalAlpha = 0.12+(i%4)*0.045; ctx.fillStyle = '#ffe0a0';
        ctx.fillRect(x, y, 1.5+(i%3), 1.5);
      }
      ctx.globalAlpha = 1;
    }
  } else if (id === 'storm'){
    if (!dyn){
      ctx.fillStyle = 'rgba(5,10,17,0.28)';
      for (let i=0;i<7;i++){ ctx.beginPath(); ctx.ellipse(-350+i*118, -280+(i%2)*38, 125, 45, -0.08, 0, Math.PI*2); ctx.fill(); }
    } else {
      ctx.strokeStyle = 'rgba(169,222,231,0.19)'; ctx.lineWidth = 1.2;
      const n = dynN(56);
      ctx.beginPath();
      for (let i=0;i<n;i++){
        const x = ((i*137 + time*105)%940)-470, y = ((i*79 + time*185)%900)-450;
        ctx.moveTo(x,y); ctx.lineTo(x-7,y+21);
      }
      ctx.stroke();
      const flash = Math.sin(time*0.9)*Math.sin(time*3.3);
      if (flash > 0.93){ ctx.fillStyle = 'rgba(200,240,255,' + ((flash-0.93)*3.2) + ')'; ctx.fillRect(-VW/2,-VH/2,VW,VH); }
    }
  } else if (id === 'sakura'){
    if (!dyn){
      const topY = Math.max(-VH/2 + 26, -424);
      for (const s of [-1,1]){
        ctx.strokeStyle = 'rgba(52,28,38,0.85)'; ctx.lineCap = 'round';
        ctx.lineWidth = 15;
        ctx.beginPath();
        ctx.moveTo(s*(Math.min(VW/2, 470) + 10), topY);
        ctx.quadraticCurveTo(s*250, topY + 66, s*70, topY + 44);
        ctx.stroke();
        ctx.lineWidth = 7;
        for (let brm=0; brm<3; brm++){
          const bx = s*(250 - brm*76), by = topY + 54 + brm*6;
          ctx.beginPath(); ctx.moveTo(bx, by);
          ctx.quadraticCurveTo(bx - s*22, by + 34, bx - s*46, by + 30);
          ctx.stroke();
        }
        for (let i=0;i<16;i++){
          const px = s*(320 - i*20) + Math.sin(i*2.3)*16;
          const py = topY + 36 + Math.cos(i*1.7)*26 + (i%3)*11;
          ctx.globalAlpha = 0.62 + (i%3)*0.12;
          for (let pt=0; pt<5; pt++){
            ctx.fillStyle = (i+pt)%3 ? '#ffbcd4' : '#ffe8f1';
            ctx.beginPath();
            ctx.ellipse(px + Math.cos(pt*1.257)*5, py + Math.sin(pt*1.257)*5, 4.6, 3.4, pt*1.257, 0, Math.PI*2);
            ctx.fill();
          }
        }
      }
      ctx.globalAlpha = 1;
    } else {
      const n = dynN(34);
      for (let i=0;i<n;i++){
        const x = ((i*167 + time*(16+i%5))%880)-440;
        const y = ((i*113 + time*(34+i%4))%860)-430;
        ctx.save(); ctx.translate(x,y); ctx.rotate(time*1.4 + i);
        ctx.globalAlpha = 0.42+(i%4)*0.1; ctx.fillStyle = i%4 ? '#ffb7cf' : '#fff0f5';
        ctx.beginPath(); ctx.ellipse(0,0,4.2,2.3,0,0,Math.PI*2); ctx.fill(); ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
  } else if (id === 'volcano'){
    if (!dyn){
      ctx.fillStyle = 'rgba(30,8,4,0.6)';
      ctx.beginPath(); ctx.moveTo(-400,-120); ctx.lineTo(-190,-330); ctx.lineTo(-90,-215);
      ctx.lineTo(60,-350); ctx.lineTo(210,-200); ctx.lineTo(400,-300); ctx.lineTo(400,-40);
      ctx.lineTo(-400,-40); ctx.closePath(); ctx.fill();
      const lava = ctx.createLinearGradient(0,-380,0,-40);
      lava.addColorStop(0,'rgba(255,150,50,0)'); lava.addColorStop(1,'rgba(255,110,30,0.30)');
      ctx.fillStyle = lava; ctx.fillRect(-400,-380,800,340);
    } else {
      const n = dynN(36);
      for (let i=0;i<n;i++){
        const x = ((i*181)%820)-410;
        const y = 340 - ((i*97 + time*(58+i%7)*1.6)%800);
        ctx.globalAlpha = Math.max(0, 0.75 - Math.abs(y)/460);
        ctx.fillStyle = i%3 ? '#ff8a3d' : '#ffe08a';
        ctx.beginPath(); ctx.arc(x, y, 1.4+(i%3)*0.9, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  } else if (id === 'bamboo'){
    if (!dyn){
      for (let i=0;i<16;i++){
        const x = -400 + i*52 + Math.sin(i)*4;
        ctx.fillStyle = i%2 ? 'rgba(48,102,58,0.55)' : 'rgba(32,78,44,0.6)';
        ctx.fillRect(x, -400, 17, 480);
        ctx.fillStyle = 'rgba(150,210,140,0.16)';
        for (let s=0;s<6;s++) ctx.fillRect(x, -400 + s*82, 17, 4);
      }
      const shaft = ctx.createLinearGradient(-120,-400,180,120);
      shaft.addColorStop(0,'rgba(226,255,196,0.16)'); shaft.addColorStop(1,'rgba(226,255,196,0)');
      ctx.fillStyle = shaft; ctx.fillRect(-400,-400,800,600);
    } else {
      const n = dynN(22);
      for (let i=0;i<n;i++){
        const x = ((i*191 + time*(13+i%4))%880)-440, y = ((i*127 + time*(21+i%3))%840)-420;
        ctx.save(); ctx.translate(x,y); ctx.rotate(Math.sin(time+i)*0.8);
        ctx.globalAlpha = 0.4; ctx.fillStyle = '#9ade7a';
        ctx.beginPath(); ctx.ellipse(0,0,7,2.2,0.5,0,Math.PI*2); ctx.fill(); ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
  } else if (id === 'neon'){
    if (!dyn){
      // 원경 고층 실루엣(새로 추가) → 근경 건물(기존) 순.
      ctx.fillStyle = 'rgba(24,12,44,0.85)';
      for (let i=0;i<9;i++){ const w = 60 + (i%3)*30, h = 260 + ((i*89)%240), x = -430 + i*100; ctx.fillRect(x, -120 - h, w, h); if (i%2) ctx.fillRect(x + w*0.4, -120 - h - 26, 6, 26); }
      for (let i=0;i<15;i++){
        const w = 34 + (i%4)*20, h = 120 + ((i*67)%210);
        const x = -400 + i*54;
        ctx.fillStyle = 'rgba(14,8,26,0.92)'; ctx.fillRect(x, -80 - h, w, h);
        for (let wy=0; wy<h-14; wy+=17){
          for (let wx=0; wx<w-10; wx+=14){
            if ((i*7 + wy + wx) % 3 === 0) continue;
            ctx.globalAlpha = 0.30 + 0.30*(((i*13 + wy*3 + wx) % 7)/7);
            ctx.fillStyle = (i+wy)%2 ? '#5df1ff' : '#ff6ae6';
            ctx.fillRect(x+6+wx, -80-h+10+wy, 6, 8);
          }
        }
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = 'rgba(93,241,255,0.08)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let y=-VH/2; y<VH/2; y+=6){ ctx.moveTo(-VW/2,y); ctx.lineTo(VW/2,y); }
      ctx.stroke();
    } else {
      const n = dynN(12);
      for (let i=0;i<n;i++){
        const x = -400 + (i*4)*54 % 810, y = -200 - ((i*67)%210)*0.5;
        ctx.globalAlpha = 0.35 + 0.35*Math.abs(Math.sin(time*1.4 + i*1.7));
        ctx.fillStyle = i%2 ? '#5df1ff' : '#ff6ae6';
        ctx.fillRect(x+8, y, 6, 8);
      }
      ctx.globalAlpha = 1;
    }
  } else if (id === 'temple'){
    if (!dyn){
      ctx.fillStyle = 'rgba(38,24,8,0.72)';
      ctx.beginPath(); ctx.moveTo(-400,-250); ctx.lineTo(0,-380); ctx.lineTo(400,-250);
      ctx.lineTo(400,-200); ctx.lineTo(-400,-200); ctx.closePath(); ctx.fill();
      for (const px of [-300,-160,160,300]){
        ctx.fillStyle = 'rgba(88,52,16,0.7)'; ctx.fillRect(px-16, -210, 32, 300);
        ctx.fillStyle = 'rgba(255,214,140,0.10)'; ctx.fillRect(px-16, -210, 8, 300);
      }
      for (let i=0;i<6;i++){
        const x = -280 + i*112, y = -178;
        ctx.fillStyle = 'rgba(255,120,70,0.9)';
        ctx.beginPath(); ctx.ellipse(x, y+26, 13, 18, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = 'rgba(60,36,12,0.8)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, y-4); ctx.lineTo(x, y+8); ctx.stroke();
        const gl = ctx.createRadialGradient(x, y+26, 2, x, y+26, 46);
        gl.addColorStop(0,'rgba(255,190,110,0.34)'); gl.addColorStop(1,'rgba(255,170,90,0)');
        ctx.fillStyle = gl; ctx.fillRect(x-46, y-20, 92, 92);
      }
    } else {
      const n = dynN(18);
      ctx.fillStyle = '#ffe9b8';
      for (let i=0;i<n;i++){
        const x = ((i*173 + time*9)%860)-430, y = ((i*101 - time*13)%820)-410;
        ctx.globalAlpha = 0.18;
        ctx.beginPath(); ctx.arc(x,y,1.6,0,Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // 등불 심지 흔들림(작은 밝은 코어 6개)
      ctx.fillStyle = '#fff1c4';
      for (let i=0;i<6;i++){
        const x = -280 + i*112, y = -152 + Math.sin(time*5.1 + i*1.3)*1.6;
        ctx.globalAlpha = 0.55 + 0.35*Math.abs(Math.sin(time*7 + i*2.1));
        ctx.beginPath(); ctx.ellipse(x, y, 4.5, 7, 0, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  } else if (id === 'cosmos'){
    if (!dyn){
      for (let i=0;i<70;i++){
        const x = ((i*197)%800)-400, y = ((i*139)%790)-395;
        ctx.globalAlpha = 0.25 + ((i*11)%6)*0.06;
        ctx.fillStyle = i%6===0 ? '#a2a8ff' : '#ffffff';
        ctx.beginPath(); ctx.arc(x,y, i%9===0?1.9:0.9, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      const pg = ctx.createRadialGradient(-250,-250,10,-250,-250,120);
      pg.addColorStop(0,'#6d5cff'); pg.addColorStop(0.6,'#3b2a8f'); pg.addColorStop(1,'rgba(20,12,60,0)');
      ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(-250,-250,105,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = 'rgba(180,190,255,0.30)'; ctx.lineWidth = 4;
      ctx.save(); ctx.translate(-250,-250); ctx.rotate(-0.45);
      ctx.beginPath(); ctx.ellipse(0,0,160,36,0,0,Math.PI*2); ctx.stroke(); ctx.restore();
    } else {
      const n = dynN(16);
      ctx.fillStyle = '#ffffff';
      for (let i=0;i<n;i++){
        const x = ((i*197*3)%800)-400, y = ((i*139*3)%790)-395;
        ctx.globalAlpha = Math.max(0, Math.sin(time*2.2 + i))*0.4;
        ctx.beginPath(); ctx.arc(x,y,1.4,0,Math.PI*2); ctx.fill();
      }
      for (let i=0;i<3;i++){
        const a = time*0.25 + i*2.1;
        ctx.globalAlpha = 0.6; ctx.fillStyle = '#9df8ff';
        ctx.beginPath(); ctx.arc(Math.cos(a)*370, Math.sin(a)*300 - 60, 2.4, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}
/* 실루엣 — 아레나 계열별 원경/근경 2겹(값노이즈 능선 또는 지붕선). 색은 «지평선 하늘색→먹» 단계.
   전부 정적 → 타일에 들어간다. 능선은 결정적 해시(아레나마다 seed 다름)라 매 부팅 같은 모양. */
function silHash(i, seed){ let x = (i*374761393 + seed*668265263)|0; x = (x ^ (x>>>13))*1274126177|0; x ^= x>>>16; return (x>>>0)/4294967296; }
function ridgePath(baseY, amp, seed, step, wide){
  const n = Math.ceil(VW/step) + 2, x0 = -VW/2 - step;
  ctx.beginPath(); ctx.moveTo(x0, VH/2 + 20);
  for (let k=0;k<=n;k++){
    const c0 = Math.floor(k/wide), f = (k%wide)/wide;
    const v = silHash(c0, seed)*(1-f) + silHash(c0+1, seed)*f;
    const fine = silHash(k, seed*7)*0.25;
    ctx.lineTo(x0 + k*step, baseY - (v*0.75 + fine)*amp);
  }
  ctx.lineTo(x0 + n*step, VH/2 + 20); ctx.closePath();
}
function roofPath(x, w, y, tiers){
  // 기와지붕 실루엣: 위로 휘는 처마 tiers 단
  ctx.beginPath();
  for (let t=0;t<tiers;t++){
    const ww = w*(1 - t*0.22), yy = y - t*46, h = 30;
    ctx.moveTo(x - ww/2 - 14, yy);
    ctx.quadraticCurveTo(x - ww/2 + 10, yy + 8, x - ww/2 + 16, yy - h);
    ctx.lineTo(x + ww/2 - 16, yy - h);
    ctx.quadraticCurveTo(x + ww/2 - 10, yy + 8, x + ww/2 + 14, yy);
    ctx.closePath();
    ctx.rect(x - ww/2 + 22, yy - h, ww - 44, h + 46);
  }
}
const SIL_FAMILY = {dawn:'ridge', sunset:'ridge', desert:'ridge', snow:'ridge', volcano:'ridge', storm:'ridge',
  midnight:'roof', sakura:'roof', bamboo:'roof', temple:'roof', neon:'none', cosmos:'planet'};
function drawSilhouettes(theme){
  const fam = SIL_FAMILY[theme.id] || 'ridge';
  const hz = mixHex(theme.sky[1], theme.sky[2], 0.35);
  const far = mixHex(hz, '#070405', 0.62), near = mixHex(hz, '#070405', 0.86);
  ctx.save();
  if (fam === 'ridge'){
    ctx.fillStyle = far; ridgePath(-352, 150, theme.id.length*17 + 11, 26, 5); ctx.fill();
    ctx.fillStyle = near; ridgePath(-300, 96, theme.id.length*29 + 23, 20, 4); ctx.fill();
  } else if (fam === 'roof'){
    ctx.fillStyle = far; ridgePath(-372, 110, 41, 30, 6); ctx.fill();
    ctx.fillStyle = near;
    roofPath(-300, 220, -286, 2); ctx.fill();
    roofPath(20, 300, -300, 3); ctx.fill();
    roofPath(330, 200, -280, 2); ctx.fill();
    // 담장 — 아래 화면 끝까지(하늘 밝은 하단이 새어 나오지 않게)
    ctx.fillRect(-VW/2, -262, VW, VH/2 + 262 + 20);
  } else if (fam === 'planet'){
    const pg = ctx.createRadialGradient(0, 1700, 900, 0, 1700, 1420);
    pg.addColorStop(0, '#0b0820'); pg.addColorStop(0.985, '#1b1040'); pg.addColorStop(1, 'rgba(40,30,90,0)');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(0, 1700, 1420, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}
/* 관중 — 스타디움 타원 바깥 2줄 점묘(어두운 머리 + 등롱색 하이라이트 소수). 정적. */
function drawCrowd(theme){
  ctx.save();
  for (let row=0; row<2; row++){
    const rx = 404 + row*22, ry = 368 + row*20, n = 62 + row*8;
    for (let i=0;i<n;i++){
      const a = (i/n)*Math.PI*2 + row*0.05 + silHash(i, row+3)*0.04;
      const x = Math.cos(a)*rx, y = 18 + Math.sin(a)*ry;
      const lit = (i % 9) === (row*4 % 9);
      ctx.fillStyle = lit ? theme.lights[1] : '#0d0a0c';
      ctx.globalAlpha = lit ? 0.55 : 0.62;
      ctx.beginPath(); ctx.arc(x, y, lit ? 2.2 : 4.6, 0, Math.PI*2); ctx.fill();
    }
  }
  ctx.restore();
}
/* 등롱 줄 — 화면 상단을 가로지르는 줄 2가닥 + 등롱(문턱 위 코어 → 블룸). 몸체는 정적(타일), 불꽃 코어는 동적. */
function lanternSpots(){
  const out = [], n = Math.max(3, Math.floor(VW/150));
  for (let i=0;i<n;i++){
    const t = (i + 0.5)/n, x = -VW/2 + t*VW;
    const sag = Math.sin(t*Math.PI);
    out.push({x:x, y:-560 + sag*46 + ((i%2) ? 14 : -6), i:i});
  }
  return out;
}
function drawLanterns(theme, dyn, time){
  if (VH < 1100) return; // 가로/태블릿 — 하늘이 없다
  const spots = lanternSpots();
  const warm = ['neon','cosmos'].indexOf(theme.id) === -1;
  const body = warm ? '#ff9d2e' : theme.lights[0], deep = warm ? '#c8461a' : mixHex(theme.lights[0], '#070405', 0.55);
  ctx.save();
  if (!dyn){
    ctx.strokeStyle = 'rgba(8,5,6,0.9)'; ctx.lineWidth = 2.2;
    for (const yo of [0, 12]){
      ctx.beginPath(); ctx.moveTo(-VW/2, -572 + yo);
      ctx.quadraticCurveTo(0, -500 + yo, VW/2, -572 + yo); ctx.stroke();
    }
    for (const L of spots){
      const ly = L.y + 30;
      ctx.strokeStyle = 'rgba(8,5,6,0.9)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(L.x, L.y - 8); ctx.lineTo(L.x, ly - 32); ctx.stroke();
      const g = ctx.createRadialGradient(L.x - 5, ly - 8, 2, L.x, ly, 30);
      g.addColorStop(0, '#ffe9a8'); g.addColorStop(0.45, body); g.addColorStop(1, deep);
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(L.x, ly, 20, 28, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = 'rgba(40,10,6,0.35)'; ctx.lineWidth = 1;
      for (let k=-2;k<=2;k++){ ctx.beginPath(); ctx.ellipse(L.x, ly, 20, 28, 0, 0, Math.PI*2); }
      for (let k=1;k<=3;k++){ ctx.beginPath(); ctx.moveTo(L.x - 19, ly - 28 + k*14); ctx.lineTo(L.x + 19, ly - 28 + k*14); ctx.stroke(); }
      ctx.fillStyle = '#1a0f0c'; ctx.fillRect(L.x - 9, ly - 33, 18, 6); ctx.fillRect(L.x - 7, ly + 27, 14, 5);
      ctx.strokeStyle = 'rgba(14,8,10,0.55)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(L.x, ly, 20, 28, 0, 0, Math.PI*2); ctx.stroke();
      const halo = ctx.createRadialGradient(L.x, ly, 10, L.x, ly, 92);
      halo.addColorStop(0, warm ? 'rgba(255,190,110,0.22)' : 'rgba(255,255,255,0.10)'); halo.addColorStop(1, 'rgba(255,170,90,0)');
      ctx.fillStyle = halo; ctx.fillRect(L.x - 92, ly - 92, 184, 184);
    }
  } else {
    for (const L of spots){
      const ly = L.y + 30, k = 0.5 + 0.5*Math.sin(time*6.3 + L.i*1.9)*Math.sin(time*2.1 + L.i);
      ctx.globalAlpha = 0.35 + k*0.45; ctx.fillStyle = '#fff2c8';
      ctx.beginPath(); ctx.ellipse(L.x - 3, ly - 4, 6 + k*2, 9 + k*3, 0, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
function drawStadium(theme){
  ctx.save();
  ctx.strokeStyle = 'rgba(4,7,12,0.76)'; ctx.lineWidth = 58;
  ctx.beginPath(); ctx.ellipse(0,18,382,348,0,0,Math.PI*2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = 2;
  for (let t=0;t<3;t++){ ctx.beginPath(); ctx.ellipse(0,18,347+t*17,317+t*14,0,0,Math.PI*2); ctx.stroke(); }
  for (let i=0;i<88;i++){
    const a = (i/88)*Math.PI*2, tier = i%3;
    ctx.globalAlpha = 0.2 + (i%5)*0.065;
    ctx.fillStyle = theme.lights[i % theme.lights.length];
    ctx.beginPath(); ctx.arc(Math.cos(a)*(348+tier*16), 18+Math.sin(a)*(318+tier*13), 1.6+(i%2)*0.65, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const side of [-1,1]){
    const lx = side*326, ly = -286;
    const beam = ctx.createLinearGradient(lx, ly, side*100, 20);
    beam.addColorStop(0, theme.lights[0] + '2e'); beam.addColorStop(1, theme.lights[0] + '00');
    ctx.fillStyle = beam;
    ctx.beginPath(); ctx.moveTo(lx - side*20, ly+16); ctx.lineTo(side*115, 60);
    ctx.lineTo(side*35, 35); ctx.lineTo(lx + side*20, ly+16); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(6,9,15,0.88)'; ctx.fillRect(lx-25, ly-14, 50, 31);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 2; ctx.strokeRect(lx-25, ly-14, 50, 31);
    for (let row=0;row<2;row++) for (let col=0;col<4;col++){
      ctx.fillStyle = theme.lights[(row+col) % theme.lights.length]; ctx.globalAlpha = 0.72;
      ctx.beginPath(); ctx.arc(lx-17+col*11, ly-6+row*13, 3.2, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
/* 정적 배경 타일 — 아레나·캔버스 크기·품질 키가 바뀔 때만 다시 래스터. 전역 ctx 를 잠시 타일 컨텍스트로 바꿔
   기존 그리기 함수들을 그대로 재사용한다. */
let bgC = null, bgKey = '';
function bgTile(theme){
  const key = theme.id + '|' + canvas.width + 'x' + canvas.height;   // 품질은 키에 «안» 넣는다 — 단계 전환이 타일을 다시 굽지 않게
  if (key === bgKey && bgC) return bgC;
  if (!bgC) bgC = document.createElement('canvas');
  bgC.width = canvas.width; bgC.height = canvas.height;
  const o = bgC.getContext('2d', {alpha:false});
  const saved = ctx, savedBloom = bloomActive; ctx = o; bloomActive = false; _tileRaster = true;
  o.setTransform(1,0,0,1,0,0);
  o.translate(canvas.width/2, canvas.height/2);
  const s = Math.min(canvas.width, canvas.height)/780;
  o.scale(s,s);
  const sky = o.createLinearGradient(0,-VH/2,0,VH/2);
  sky.addColorStop(0, theme.sky[0]); sky.addColorStop(0.5, theme.sky[1]); sky.addColorStop(1, theme.sky[2]);
  o.fillStyle = sky; o.fillRect(-VW/2,-VH/2,VW,VH);
  const hz = o.createRadialGradient(0,90,30,0,90,Math.max(VW,VH)*0.62);
  hz.addColorStop(0, theme.lights[0] + '26'); hz.addColorStop(1, theme.sky[0] + '00');
  o.fillStyle = hz; o.fillRect(-VW/2,-VH/2,VW,VH);
  drawSkyDetail(theme, 0, false);
  drawSilhouettes(theme);
  // 지면 — 스타디움 아래는 하늘이 아니라 «땅»이다(따뜻한 먹, 등롱 빛이 살짝 닿는다).
  const gnd = o.createLinearGradient(0, 300, 0, VH/2);
  gnd.addColorStop(0, 'rgba(10,6,7,0)'); gnd.addColorStop(0.25, 'rgba(10,6,7,0.55)'); gnd.addColorStop(1, 'rgba(7,4,5,0.92)');
  o.fillStyle = gnd; o.fillRect(-VW/2, 300, VW, VH/2 - 300);
  drawCrowd(theme);
  drawStadium(theme);
  drawLanterns(theme, false, 0);
  const outer = o.createRadialGradient(0, 18, 368, 0, 18, Math.max(VW, VH)*0.56);
  outer.addColorStop(0, 'rgba(4,7,12,0)');
  outer.addColorStop(0.40, 'rgba(4,7,12,0.42)');
  outer.addColorStop(1, 'rgba(3,5,9,0.94)');
  o.fillStyle = outer;
  o.fillRect(-VW/2, -VH/2, VW, VH);
  ctx = saved; bloomActive = savedBloom; _tileRaster = false; bgKey = key;
  return bgC;
}
function drawBackdrop(theme){
  const time = performance.now()*0.001;
  const tile = bgTile(theme);
  ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.drawImage(tile, 0, 0); ctx.restore();
  const f = gfxQf();
  if (f > 0){
    // 품질 1 미만으로 내려가는 400ms 동안 개수(dynN)와 함께 알파도 같이 줄어 «툭» 사라지지 않는다.
    if (f < 1){ ctx.save(); ctx.globalAlpha = f; }
    drawSkyDetail(theme, time, true); drawLanterns(theme, true, time);
    if (f < 1) ctx.restore();
  }
}
function drawFloorPattern(theme){
  ctx.save();
  ctx.beginPath(); ctx.arc(0,0,BASE_R,0,Math.PI*2); ctx.clip();
  ctx.strokeStyle = theme.patternColor; ctx.fillStyle = theme.patternColor; ctx.lineWidth = 1.4;
  const p = theme.pattern;
  if (p === 'rays'){
    for (let i=0;i<16;i+=2){
      ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,BASE_R,(i/16)*Math.PI*2,((i+1)/16)*Math.PI*2); ctx.closePath(); ctx.fill();
    }
  } else if (p === 'bands'){
    ctx.lineWidth = 18;
    for (let r=55;r<BASE_R;r+=62){ ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.stroke(); }
  } else if (p === 'grid'){
    for (let q=-280;q<=280;q+=70){
      ctx.beginPath(); ctx.moveTo(q,-330); ctx.lineTo(q,330); ctx.moveTo(-330,q); ctx.lineTo(330,q); ctx.stroke();
    }
  } else if (p === 'ice'){
    for (let i=0;i<12;i++){
      const a = i*Math.PI/6;
      ctx.beginPath(); ctx.moveTo(Math.cos(a)*42, Math.sin(a)*42);
      for (let s=1;s<=5;s++){ const r = 42+s*58, b = Math.sin(i*3.1+s*2.3)*0.11;
        ctx.lineTo(Math.cos(a+b)*r, Math.sin(a+b)*r); }
      ctx.stroke();
    }
  } else if (p === 'contours'){
    for (let row=-7;row<=7;row++){
      ctx.beginPath();
      for (let x=-340;x<=340;x+=12){ const y = row*42 + Math.sin((x+row*31)*0.024)*9;
        if (x === -340) ctx.moveTo(x,y); else ctx.lineTo(x,y); }
      ctx.stroke();
    }
  } else if (p === 'chevrons'){
    for (let y=-280;y<=280;y+=70) for (let x=-320;x<=320;x+=80){
      ctx.beginPath(); ctx.moveTo(x-30,y-15); ctx.lineTo(x,y+15); ctx.lineTo(x+30,y-15); ctx.stroke();
    }
  } else if (p === 'blossom'){
    for (let ring=1; ring<=4; ring++){
      const n = ring*7, rr = ring*74;
      for (let i=0;i<n;i++){
        const a = (i/n)*Math.PI*2 + ring*0.42;
        ctx.save(); ctx.translate(Math.cos(a)*rr, Math.sin(a)*rr); ctx.rotate(a*1.7);
        for (let pt=0;pt<5;pt++){
          ctx.beginPath(); ctx.ellipse(Math.cos(pt*1.257)*5.4, Math.sin(pt*1.257)*5.4, 4.6, 2.9, pt*1.257, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
      }
    }
  } else if (p === 'stalks'){
    for (let x=-300;x<=300;x+=42){
      ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(x,-330); ctx.lineTo(x,330); ctx.stroke();
      ctx.lineWidth = 3;
      for (let y=-320;y<=320;y+=76){ ctx.beginPath(); ctx.moveTo(x-9,y); ctx.lineTo(x+9,y); ctx.stroke(); }
    }
  } else if (p === 'circuit'){
    ctx.lineWidth = 2;
    for (let q=-300;q<=300;q+=60){
      ctx.beginPath(); ctx.moveTo(q,-330); ctx.lineTo(q,330); ctx.moveTo(-330,q); ctx.lineTo(330,q); ctx.stroke();
    }
    for (let x=-300;x<=300;x+=60) for (let y=-300;y<=300;y+=60){
      if ((x+y) % 120 === 0){ ctx.beginPath(); ctx.arc(x,y,5,0,Math.PI*2); ctx.fill(); }
    }
  } else if (p === 'tatami'){
    ctx.lineWidth = 3;
    for (let y=-330;y<=330;y+=88) for (let x=-330;x<=330;x+=132){
      const ox = ((y/88)%2) ? 66 : 0;
      ctx.strokeRect(x+ox, y, 128, 84);
    }
  } else if (p === 'orbits'){
    for (let i=1;i<=5;i++){
      ctx.save(); ctx.rotate(i*0.55);
      ctx.beginPath(); ctx.ellipse(0,0,i*58, i*58*0.42, 0, 0, Math.PI*2); ctx.stroke(); ctx.restore();
    }
  } else if (p === 'cracks'){
    for (let i=0;i<14;i++){
      const a = (i/14)*Math.PI*2;
      ctx.beginPath(); ctx.moveTo(Math.cos(a)*22, Math.sin(a)*22);
      let cx = Math.cos(a)*22, cy = Math.sin(a)*22, ca = a;
      for (let s=0;s<6;s++){
        ca += (Math.sin(i*7.3 + s*2.9))*0.36;
        cx += Math.cos(ca)*52; cy += Math.sin(ca)*52;
        ctx.lineTo(cx, cy);
      }
      ctx.lineWidth = 3; ctx.stroke();
    }
  }
  ctx.restore();
}
/* 링 바닥(외곽 흙띠·바닥 그라데이션·무늬·동심원)은 «정적» → 아레나·배율별 1회 래스터(floorTile). 매 프레임은
   위험띠·살아있는 경계선(튜브: 색 몸체 + 흰 코어 → 코어만 블룸)만 그린다. */
let flC = null, flKey = '';
function floorTile(theme){
  const s = Math.min(canvas.width, canvas.height)/780;
  const R = BASE_R + 30, px = Math.ceil(R*2*s);
  const key = theme.id + '|' + px;
  if (key === flKey && flC) return flC;
  if (!flC) flC = document.createElement('canvas');
  flC.width = px; flC.height = px;
  const o = flC.getContext('2d');
  const saved = ctx, savedBloom = bloomActive; ctx = o; bloomActive = false;
  o.setTransform(s,0,0,s,px/2,px/2);
  o.save();
  o.strokeStyle = theme.outer; o.lineWidth = 14;
  o.shadowColor = theme.boundaryGlow; o.shadowBlur = 12;
  o.beginPath(); o.arc(0,0,BASE_R,0,Math.PI*2); o.stroke();
  o.restore();
  o.save();
  const grad = o.createRadialGradient(0,0,10,0,0,BASE_R);
  grad.addColorStop(0, theme.arena[0]); grad.addColorStop(1, theme.arena[1]);
  o.fillStyle = grad;
  o.beginPath(); o.arc(0,0,BASE_R,0,Math.PI*2); o.fill();
  o.restore();
  drawFloorPattern(theme);
  o.save();
  o.strokeStyle = theme.patternColor; o.globalAlpha = 0.42; o.lineWidth = 1.5;
  for (let r=80;r<BASE_R;r+=80){ o.beginPath(); o.arc(0,0,r,0,Math.PI*2); o.stroke(); }
  o.restore();
  // 바닥 안쪽 그림자(링 가장자리에서 안으로 어두워짐 — 두께감)
  o.save();
  const inner = o.createRadialGradient(0,0,BASE_R*0.78,0,0,BASE_R);
  inner.addColorStop(0, 'rgba(0,0,0,0)'); inner.addColorStop(1, 'rgba(0,0,0,0.38)');
  o.fillStyle = inner; o.beginPath(); o.arc(0,0,BASE_R,0,Math.PI*2); o.fill();
  o.restore();
  ctx = saved; bloomActive = savedBloom; flKey = key;
  return flC;
}
function drawArena(theme){
  const tile = floorTile(theme), R = BASE_R + 30;
  ctx.drawImage(tile, -R, -R, R*2, R*2);

  // danger band between the live boundary and the original rim
  if (arenaRadius < BASE_R - 2){
    ctx.save();
    ctx.beginPath(); ctx.arc(0,0,BASE_R,0,Math.PI*2);
    ctx.arc(0,0,arenaRadius,0,Math.PI*2,true);
    ctx.fillStyle = 'rgba(255,70,70,0.10)'; ctx.fill();
    ctx.restore();
  }

  ctx.save();
  const pulse = 1 + Math.sin(performance.now()*0.004)*0.06;
  ctx.strokeStyle = theme.boundary; ctx.lineWidth = 5;
  ctx.shadowColor = theme.boundaryGlow; ctx.shadowBlur = glow(12*pulse);
  ctx.beginPath(); ctx.arc(0,0,arenaRadius,0,Math.PI*2); ctx.stroke();
  ctx.shadowBlur = 0;
  // 튜브 코어 — 경계색을 흰색 쪽으로 섞은 가는 선. 루미넌스 문턱 위라 블룸이 «이 선만» 번지게 한다.
  ctx.strokeStyle = mixHex(theme.boundary, '#ffffff', 0.55); ctx.lineWidth = 1.8; ctx.globalAlpha = 0.85 + (pulse-1)*2;
  ctx.beginPath(); ctx.arc(0,0,arenaRadius,0,Math.PI*2); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = theme.boundary; ctx.globalAlpha = 0.025; ctx.fill();
  ctx.restore();
}
function drawHazards(){
  if (curRule.id === 'pit' && pitRadius > 1){
    ctx.save();
    const pg = ctx.createRadialGradient(0,0,1,0,0,pitRadius);
    pg.addColorStop(0,'#000000'); pg.addColorStop(0.72,'#0a0510'); pg.addColorStop(1,'rgba(120,20,40,0.85)');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(0,0,pitRadius,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#ff5a5f'; ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(255,90,95,0.8)'; ctx.shadowBlur = glow(16);
    ctx.beginPath(); ctx.arc(0,0,pitRadius,0,Math.PI*2); ctx.stroke();
    ctx.restore();
  }
  // 2026-08-22 단계확장 A안 R3(safezone) — D안(아레나 기믹) 흡수: 색을
  // curArena.particles/boundaryGlow 에서 그대로 가져와 어느 아레나에 놓여도 그
  // 아레나의 캐릭터로 보이게 한다(보상지대이므로 pit 과 달리 위험색이 아니다).
  if (curRule.id === 'safezone'){
    ctx.save();
    ctx.translate(zoneX, zoneY);
    const zp = 1 + Math.sin(performance.now()*0.0035)*0.08;
    const zg = ctx.createRadialGradient(0,0,1,0,0,zoneR);
    zg.addColorStop(0, curArena.particles[0] + '33'); zg.addColorStop(1, curArena.particles[0] + '00');
    ctx.fillStyle = zg; ctx.beginPath(); ctx.arc(0,0,zoneR,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = curArena.boundaryGlow.replace(/[\d.]+\)$/, '0.9)');
    ctx.lineWidth = 3; ctx.shadowColor = curArena.boundaryGlow; ctx.shadowBlur = glow(14*zp);
    ctx.beginPath(); ctx.arc(0,0,zoneR*zp,0,Math.PI*2); ctx.stroke();
    ctx.restore();
  }
  // R4(pull) windup 텔레그래프 — 중심으로 수축하는 링으로 예고(무해하면
  // 유저가 대응할 수 없다 — 예고 없는 버프는 불공평하다).
  if (curRule.id === 'pull' && pullPhase === 'windup'){
    const wp = 1 - Math.max(0, pullTimer)/0.9; // 0 -> 1 진행률
    ctx.save();
    ctx.strokeStyle = 'rgba(108,122,255,0.75)'; ctx.lineWidth = 2.5;
    for (let k=0;k<3;k++){
      const rr = arenaRadius*(0.85 - k*0.16) * (1 - wp*0.5);
      ctx.globalAlpha = 0.5 - k*0.12;
      ctx.beginPath(); ctx.arc(0,0,Math.max(4,rr),0,Math.PI*2); ctx.stroke();
    }
    ctx.restore();
  }
  hazards.forEach(function(h){
    ctx.save();
    if (h.type === 'bomb'){
      const drop = h.drop > 0 ? h.drop : 0;
      const y = h.y - drop*160;
      const sc = 1 + drop*0.5;
      if (drop > 0){
        ctx.globalAlpha = 0.35; ctx.strokeStyle = '#ff8a3d'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(h.x, h.y, h.r*(1.6 - drop*0.5), 0, Math.PI*2); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      const warn = h.live && h.fuse < 1.6 && Math.floor(h.fuse*8) % 2 === 0;
      ctx.fillStyle = warn ? '#ff5a5f' : '#22262e';
      ctx.shadowColor = warn ? 'rgba(255,90,95,0.9)' : 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = glow(warn ? 18 : 8);
      ctx.beginPath(); ctx.arc(h.x, y, h.r*sc, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.24)';
      ctx.beginPath(); ctx.arc(h.x - h.r*0.34, y - h.r*0.36, h.r*0.28, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(h.x, y - h.r); ctx.quadraticCurveTo(h.x + 8, y - h.r - 12, h.x + 2, y - h.r - 17); ctx.stroke();
      ctx.fillStyle = '#ffd23f'; ctx.shadowColor = 'rgba(255,210,63,0.9)'; ctx.shadowBlur = glow(12);
      ctx.beginPath(); ctx.arc(h.x + 2, y - h.r - 18, 2.6 + Math.random()*1.4, 0, Math.PI*2); ctx.fill();
    } else if (h.type === 'guard'){
      const pulse = Math.max(0, h.pulse);
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.shadowColor = 'rgba(90,150,255,0.7)'; ctx.shadowBlur = glow(12 + pulse*22);
      // heavy steel drum: dark body, bright rim, hazard stripes
      const gg = ctx.createRadialGradient(-h.r*0.35, -h.r*0.4, 2, 0, 0, h.r*1.1);
      gg.addColorStop(0,'#7f93ad'); gg.addColorStop(0.55,'#41536e'); gg.addColorStop(1,'#1a2536');
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(0, 0, h.r, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.save();
      ctx.beginPath(); ctx.arc(0,0,h.r,0,Math.PI*2); ctx.clip();
      ctx.rotate(h.ang*2.4);
      ctx.fillStyle = pulse > 0 ? '#ffd23f' : '#e2b23c';
      for (let i=-3;i<=3;i++){
        ctx.save(); ctx.translate(i*h.r*0.52, 0); ctx.rotate(-0.6);
        ctx.fillRect(-h.r*0.11, -h.r*1.4, h.r*0.22, h.r*2.8); ctx.restore();
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(214,232,255,0.9)'; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.arc(0, 0, h.r - 1.4, 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle = '#111823';
      ctx.beginPath(); ctx.arc(0, 0, h.r*0.30, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(226,240,255,0.85)';
      for (let i=0;i<4;i++){
        const a = h.ang*2.4 + i*Math.PI/2;
        ctx.beginPath(); ctx.arc(Math.cos(a)*h.r*0.66, Math.sin(a)*h.r*0.66, h.r*0.11, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  });
}
// Every special rule gets its own unmistakable look on the floor, so players can read
// the round at a glance instead of relying on the HUD chip alone.
let skids = [];
function drawRuleOverlay(){
  const id = curRule.id;
  const t = performance.now()*0.001;
  if (id === 'normal') return;
  ctx.save();
  ctx.beginPath(); ctx.arc(0,0,BASE_R,0,Math.PI*2); ctx.clip();

  if (id === 'ice'){
    const sheen = ctx.createRadialGradient(-90,-110,20,0,0,BASE_R);
    sheen.addColorStop(0,'rgba(210,246,255,0.20)');
    sheen.addColorStop(0.5,'rgba(150,220,255,0.10)');
    sheen.addColorStop(1,'rgba(120,200,255,0.03)');
    ctx.fillStyle = sheen; ctx.fillRect(-BASE_R,-BASE_R,BASE_R*2,BASE_R*2);
    ctx.strokeStyle = 'rgba(226,250,255,0.20)'; ctx.lineWidth = 1.6;
    for (let i=0;i<9;i++){
      const a = i*0.698 + 0.3;
      ctx.beginPath();
      let x = Math.cos(a)*40, y = Math.sin(a)*40, ca = a;
      ctx.moveTo(x,y);
      for (let s=0;s<4;s++){ ca += Math.sin(i*3.7+s*2.1)*0.42; x += Math.cos(ca)*62; y += Math.sin(ca)*62; ctx.lineTo(x,y); }
      ctx.stroke();
    }
    for (let i=0;i<skids.length;i++){
      const k = skids[i];
      ctx.globalAlpha = k.life*0.42;
      ctx.strokeStyle = '#eafcff'; ctx.lineWidth = k.w; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(k.x, k.y); ctx.lineTo(k.x2, k.y2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (id === 'wind'){
    const cx = Math.cos(windAngle), cy = Math.sin(windAngle);
    ctx.strokeStyle = 'rgba(190,255,240,0.34)'; ctx.lineCap = 'round';
    for (let i=0;i<30;i++){
      const lane = ((i*53) % 640) - 320;
      const off = ((i*97 + t*420) % 900) - 450;
      const px = -cy*lane + cx*off, py = cx*lane + cy*off;
      const len = 22 + (i%4)*13;
      ctx.lineWidth = 1.2 + (i%3)*0.9;
      ctx.globalAlpha = 0.16 + (i%4)*0.08;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + cx*len, py + cy*len); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // arrow band on the upwind rim shows exactly which way the gale is blowing
    ctx.strokeStyle = 'rgba(126,246,220,0.85)'; ctx.lineWidth = 3.4;
    for (let k=-1;k<=1;k++){
      const bx = -cx*(BASE_R-34) + -cy*k*54, by = -cy*(BASE_R-34) + cx*k*54;
      ctx.beginPath();
      ctx.moveTo(bx - cy*13 - cx*11, by + cx*13 - cy*11);
      ctx.lineTo(bx + cx*13, by + cy*13);
      ctx.lineTo(bx + cy*13 - cx*11, by - cx*13 - cy*11);
      ctx.stroke();
    }
  } else if (id === 'bouncy'){
    ctx.strokeStyle = 'rgba(201,167,255,0.26)';
    for (let r=38;r<BASE_R;r+=34){
      const wob = Math.sin(t*2.6 + r*0.05)*3.4;
      ctx.lineWidth = 2 + Math.sin(t*3 + r*0.04)*1.2;
      ctx.beginPath(); ctx.arc(0,0,r+wob,0,Math.PI*2); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(150,110,255,0.07)';
    ctx.fillRect(-BASE_R,-BASE_R,BASE_R*2,BASE_R*2);
  } else if (id === 'rush'){
    const p = 0.5 + Math.sin(t*5)*0.5;
    ctx.strokeStyle = 'rgba(255,140,60,' + (0.24 + p*0.34) + ')';
    ctx.lineWidth = 3.4;
    for (let i=0;i<24;i++){
      const a = (i/24)*Math.PI*2;
      const r0 = arenaRadius - 6 - p*16;
      const ca = Math.cos(a), sa = Math.sin(a);
      ctx.beginPath();
      ctx.moveTo(ca*r0 - sa*13, sa*r0 + ca*13);
      ctx.lineTo(ca*(r0-20), sa*(r0-20));
      ctx.lineTo(ca*r0 + sa*13, sa*r0 - ca*13);
      ctx.stroke();
    }
  } else if (id === 'pit'){
    for (let i=0;i<20;i++){
      const a = t*1.5 + i*0.314;
      const rr = pitRadius + 26 + ((i*37 + t*70) % 90);
      ctx.globalAlpha = Math.max(0, 0.5 - (rr - pitRadius)/150);
      ctx.fillStyle = '#ff8a8f';
      ctx.beginPath(); ctx.arc(Math.cos(a)*rr, Math.sin(a)*rr, 2.2, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,90,95,0.30)'; ctx.lineWidth = 2;
    ctx.setLineDash([9,11]);
    ctx.beginPath(); ctx.arc(0,0,pitRadius+30,0,Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
  } else if (id === 'bombs'){
    ctx.fillStyle = 'rgba(255,120,40,0.05)';
    ctx.fillRect(-BASE_R,-BASE_R,BASE_R*2,BASE_R*2);
  } else if (id === 'orbit'){
    ctx.strokeStyle = 'rgba(120,180,255,0.20)'; ctx.lineWidth = 2;
    ctx.setLineDash([5,9]);
    ctx.beginPath(); ctx.arc(0,0,Math.min(BASE_R*0.55, Math.max(60, arenaRadius-42)),0,Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}
function updateSkids(dt){
  if (curRule.id !== 'ice'){ if (skids.length) skids = []; return; }
  [P1,P2].forEach(function(f){
    if (f.state !== 'alive') return;
    const sp = Math.sqrt(f.vx*f.vx + f.vy*f.vy);
    if (sp > 2.4){
      skids.push({x:f.x, y:f.y, x2:f.x - f.vx*3.2, y2:f.y - f.vy*3.2,
        w:Math.max(2, f.radius*0.34), life:1});
    }
  });
  for (let i=skids.length-1;i>=0;i--){
    skids[i].life -= dt*0.75;
    if (skids[i].life <= 0) skids.splice(i,1);
  }
  if (skids.length > 90) skids.splice(0, skids.length - 90);
}
function drawTrail(f){
  const n = f.trail.length;
  if (n < 2) return;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // 넓은 소프트 리본(1 스트로크) + 가늘어지는 코어(세그먼트별 폭)
  ctx.globalAlpha = 0.16; ctx.strokeStyle = f.color; ctx.lineWidth = f.radius*1.3;
  ctx.beginPath(); ctx.moveTo(f.trail[0].x, f.trail[0].y);
  for (let i=1;i<n;i++) ctx.lineTo(f.trail[i].x, f.trail[i].y);
  ctx.lineTo(f.x, f.y); ctx.stroke();
  for (let i=1;i<n;i++){
    const p = f.trail[i], q = f.trail[i-1], k = i/n;
    ctx.globalAlpha = p.opacity*0.75*k;
    ctx.strokeStyle = i > n-4 ? mixHex(f.color, '#ffffff', 0.5) : f.color;
    ctx.lineWidth = Math.max(1, f.radius*(0.18 + 0.7*k));
    ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(p.x, p.y); ctx.stroke();
  }
  ctx.restore();
}
function drawFighter(f){
  // 렌더 전용 상태 전이 감지(로직 무접촉): 링아웃 «순간» 흙먼지 링, 라운드 승리 «순간» 금 리플.
  if (f.state === 'falling'){ if (!f._fxFall){ f._fxFall = true; dustRing(f.x, f.y, f.radius, 18, f.intoPit ? '#ff8a8f' : '#d9c7a8'); } }
  else f._fxFall = false;
  if (f.winPose > 0){ if (!f._fxWin){ f._fxWin = true; shock(f.x, f.y, f.radius*4.2, '#ffc94a'); shock(f.x, f.y, f.radius*2.6, '#fff2c8'); } }
  else f._fxWin = false;
  if (f.state === 'dead') return;
  ctx.save();
  if (f.state === 'falling') ctx.globalAlpha = Math.max(0, 1 - f.fallProgress);
  else if (f.cooldown > 0) ctx.globalAlpha = 0.72;

  // ground shadow — 두 겹(넓고 옅게 + 좁고 진하게) = 접지감
  if (f.state === 'alive'){
    ctx.save(); ctx.fillStyle = '#000';
    ctx.globalAlpha *= 0.18;
    ctx.beginPath(); ctx.ellipse(f.x, f.y + f.radius*0.88, f.radius*1.15, f.radius*0.40, 0, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha *= 1.8;
    ctx.beginPath(); ctx.ellipse(f.x, f.y + f.radius*0.86, f.radius*0.86, f.radius*0.26, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
  // 2P only: a faction badge laid UNDER the fighter (색 + 셰브론 모양 + 반쪽 틴트 — 3채널, WCAG 1.4.1).
  if (!soloMode() && f.state === 'alive'){
    const fc = f.id === 1 ? '#ff5a5f' : '#4a9eff';
    const dir = f.id === 1 ? 1 : -1;                 // P1 owns BOTTOM, P2 TOP
    const ry = f.y + f.radius*0.86, rx = f.radius*1.02, rr = f.radius*0.34;
    ctx.save();
    ctx.strokeStyle = fc; ctx.lineWidth = 3; ctx.globalAlpha = 0.9;
    ctx.shadowColor = fc; ctx.shadowBlur = glow(8);
    ctx.beginPath(); ctx.ellipse(f.x, ry, rx, rr, 0, 0, Math.PI*2); ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = fc; ctx.shadowBlur = glow(6);
    const cy = ry + dir*(rr + 7), cw = 10, ch = 8;
    ctx.beginPath();
    ctx.moveTo(f.x, cy + dir*ch*0.5);
    ctx.lineTo(f.x - cw*0.5, cy - dir*ch*0.5);
    ctx.lineTo(f.x + cw*0.5, cy - dir*ch*0.5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // 모으기 중 바닥 파동(발밑에서 퍼지는 링 2개) — 힘이 «땅에서» 모인다
  if (f.isCharging && f.state === 'alive'){
    const cr0 = f.charge / CHARGE_MAX, tt = performance.now()*0.001;
    ctx.save(); ctx.strokeStyle = f.color; ctx.lineWidth = 1.5;
    for (let k=0;k<2;k++){
      const ph = ((tt*1.4 + k*0.5) % 1);
      ctx.globalAlpha = (1-ph)*0.35*(0.4+cr0*0.6);
      ctx.beginPath(); ctx.ellipse(f.x, f.y + f.radius*0.86, f.radius*(0.9+ph*1.6), f.radius*(0.3+ph*0.55), 0, 0, Math.PI*2); ctx.stroke();
    }
    ctx.restore();
  }
  drawFighterArt(ctx, f.x, f.y, f.radius, f.def, {
    charging: f.isCharging, hurt: f.hurt, blink: f.blink,
    squash: f.squash, squashAng: Math.atan2(f.squashNy, f.squashNx),
    glow: bloomActive ? 0 : (f.isCharging ? 16 + (f.charge/CHARGE_MAX)*16 : 10),
    win: f.winPose > 0, bounce: f.winPose > 0 ? f.winPose*7 : 0
  });

  if (f.isCharging){
    const cr = f.charge / CHARGE_MAX;
    const core = mixHex(f.color, '#ffffff', 0.6);
    ctx.save();
    // 회전 눈금 링(색 몸체 + 흰 코어)
    ctx.strokeStyle = f.color; ctx.lineWidth = 3;
    ctx.shadowColor = f.glow; ctx.shadowBlur = glow(10);
    const rr = f.radius*(1.12 + 0.45*((performance.now()*0.0035)%1));
    ctx.beginPath(); ctx.arc(f.x, f.y, rr, 0, Math.PI*2); ctx.stroke();
    ctx.shadowBlur = 0; ctx.strokeStyle = core; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.arc(f.x, f.y, rr, 0, Math.PI*2); ctx.stroke();
    ctx.globalAlpha = 1;
    // charge ring meter — 금 트랙 + 흰 코어(풀차지면 금이 «타오른다»)
    const full = cr > 0.92;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.radius + 11, 0, Math.PI*2); ctx.stroke();
    ctx.strokeStyle = full ? '#ffc94a' : 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 4; ctx.shadowColor = '#ffc94a'; ctx.shadowBlur = glow(full ? 14 : 0);
    ctx.beginPath(); ctx.arc(f.x, f.y, f.radius + 11, -Math.PI/2, -Math.PI/2 + cr*Math.PI*2); ctx.stroke();
    if (full){ ctx.shadowBlur = 0; ctx.strokeStyle = '#fff6d0'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.radius + 11, -Math.PI/2, -Math.PI/2 + cr*Math.PI*2); ctx.stroke(); }
    ctx.restore();

    const manual = f.aimDx*f.aimDx + f.aimDy*f.aimDy > AIM_THRESHOLD*AIM_THRESHOLD;
    let gx, gy;
    if (manual){ const d = Math.sqrt(f.aimDx*f.aimDx + f.aimDy*f.aimDy); gx = f.aimDx/d; gy = f.aimDy/d; }
    else { const o = f.id === 1 ? P2 : P1; let ox = o.x-f.x, oy = o.y-f.y;
      const od = Math.sqrt(ox*ox+oy*oy)||1; gx = ox/od; gy = oy/od; }
    const len = f.baseRadius*(2.3 + cr*3.8);
    const sx = f.x + gx*(f.radius+5), sy = f.y + gy*(f.radius+5);
    const ex = f.x + gx*len, ey = f.y + gy*len;
    const ah = 14 + cr*9, aw = ah*0.72, px = -gy, py = gx;
    ctx.save();
    ctx.shadowColor = f.glow; ctx.shadowBlur = glow(manual ? 14 : 7);
    ctx.strokeStyle = f.color; ctx.lineWidth = manual ? 5 : 2.5; ctx.lineCap = 'round';
    ctx.setLineDash(manual ? [] : [3,11]);
    ctx.globalAlpha = 0.3 + cr*0.6;
    ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(ex - gx*ah*0.72, ey - gy*ah*0.72); ctx.stroke();
    if (manual){ ctx.shadowBlur = 0; ctx.strokeStyle = core; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.5 + cr*0.5;
      ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(ex - gx*ah*0.72, ey - gy*ah*0.72); ctx.stroke(); }
    ctx.setLineDash([]); ctx.globalAlpha = 0.55 + cr*0.45; ctx.fillStyle = f.color;
    ctx.beginPath(); ctx.moveTo(ex,ey);
    ctx.lineTo(ex - gx*ah + px*aw*0.5, ey - gy*ah + py*aw*0.5);
    ctx.lineTo(ex - gx*ah - px*aw*0.5, ey - gy*ah - py*aw*0.5);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = core; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
  }
  if (f.cooldown > 0 && f.state === 'alive'){
    ctx.strokeStyle = 'rgba(255,255,255,0.42)'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.baseRadius+7, -Math.PI/2, -Math.PI/2 + (f.cooldown/0.5)*Math.PI*2);
    ctx.stroke();
  }
  ctx.restore();
}
function drawEffects(theme){
  ctx.save();
  ctx.lineCap = 'round';
  for (let i=0;i<particles.length;i++){
    const p = particles[i];
    const col = p.color || theme.particles[p.slot % theme.particles.length];
    const a = Math.max(0, p.life);
    if (p.kind === 1){
      // 스트릭 스파크: 속도 방향 선(색) + 짧은 흰 코어 — 코어만 블룸
      const L = 3.2;
      ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = p.size*1.6;
      ctx.beginPath(); ctx.moveTo(p.x - p.vx*L, p.y - p.vy*L); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.strokeStyle = '#fff6e0'; ctx.lineWidth = p.size*0.7;
      ctx.beginPath(); ctx.moveTo(p.x - p.vx*L*0.5, p.y - p.vy*L*0.5); ctx.lineTo(p.x, p.y); ctx.stroke();
    } else {
      ctx.globalAlpha = p.kind === 2 ? a*0.55 : a;
      ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = glow(p.kind === 2 ? 0 : 6);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.kind === 2 ? p.size*(1 + (1-a)*1.4) : p.size, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
  for (let i=0;i<shockwaves.length;i++){
    const s = shockwaves[i], a = Math.max(0, s.life);
    ctx.globalAlpha = a*0.55;
    ctx.strokeStyle = s.color; ctx.lineWidth = 3*s.life + 1;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.stroke();
    ctx.globalAlpha = a*0.35;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r*0.82, 0, Math.PI*2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (let i=0;i<confetti.length;i++){
    const c = confetti[i];
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot);
    ctx.fillStyle = c.color; ctx.globalAlpha = 0.92;
    ctx.fillRect(-c.w/2, -c.h/2, c.w, c.h); ctx.restore();
  }
  for (let i=0;i<floatTexts.length;i++){
    const f = floatTexts[i], a = Math.max(0, f.life);
    // 펀치: 생성 직후 1.35 → 1 (back-out 이징), 사라질 때 살짝 떠오른다
    const age = 1 - a, pop = age < 0.18 ? 1 + 0.35*(1 - age/0.18)*(1 - age/0.18) : 1;
    ctx.save(); ctx.globalAlpha = Math.min(1, a*1.6);
    ctx.translate(f.x, f.y); ctx.scale(pop, pop);
    ctx.font = "400 26px " + HUD_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(10,5,6,0.75)'; ctx.lineJoin = 'round'; ctx.strokeText(f.text, 0, 0);
    ctx.fillStyle = f.color; ctx.fillText(f.text, 0, 0); ctx.restore();
  }
  ctx.restore();
}
function fitText(text, maxWidth, weight, startPx, family){
  let px = startPx;
  ctx.font = weight + ' ' + px + "px " + (family || BODY_FONT);
  while (ctx.measureText(text).width > maxWidth && px > 12){
    px -= 2;
    ctx.font = weight + ' ' + px + "px " + (family || BODY_FONT);
  }
  return px;
}
function drawAnnounce(){
  // Solo keeps the single centred call exactly as before.
  if (soloMode()){ ctx.save(); drawAnnounceBody(); ctx.restore(); return; }
  // 2P: one copy per half so neither player reads the round call upside down.
  const ay = Math.max(BASE_R + 92, VH/4);
  ctx.save(); ctx.translate(0, ay); drawAnnounceBody(); ctx.restore();
  ctx.save(); ctx.translate(0, -ay); ctx.rotate(Math.PI); drawAnnounceBody(); ctx.restore();
}
/* 큰 글자 = 디스플레이체(Anton, 라틴만) + 먹 외곽선 오프셋 그림자. 한글 문자열은 시스템 굵은 서체로 폴백된다. */
function bigFont(txt, px){ return /^[ - -⁯]+$/.test(txt) ? ("400 " + px + "px " + HUD_FONT) : ("800 " + px + "px " + BODY_FONT); }
function bigText(txt, x, y, px, fill, shadow){
  ctx.save();
  ctx.font = bigFont(txt, px);
  ctx.lineJoin = 'round';
  ctx.fillStyle = shadow || 'rgba(10,5,6,0.85)'; ctx.fillText(txt, x + px*0.05, y + px*0.06);
  ctx.lineWidth = Math.max(2, px*0.07); ctx.strokeStyle = 'rgba(10,5,6,0.85)'; ctx.strokeText(txt, x, y);
  ctx.fillStyle = fill; ctx.fillText(txt, x, y);
  ctx.restore();
}
function drawAnnounceBody(){
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (gameState === 'READY'){
    const isGo = readyTimer <= 0.75;
    const txt = isGo ? t('aGo') : t('aReady');
    const k = isGo ? (1 - readyTimer/0.75) : (1 - (readyTimer-0.75)/0.95);
    const pop = 1 + Math.max(0, 0.35 - k*0.9);
    ctx.save(); ctx.translate(0,-16); ctx.scale(pop, pop);
    const px = fitText(txt, 560, /^[ -]+$/.test(txt) ? '400' : '800', 74, /^[ -]+$/.test(txt) ? HUD_FONT : BODY_FONT);
    bigText(txt, 0, 0, px, isGo ? '#ffc94a' : '#f6efe6');
    ctx.restore();
    // rule banner slides in under the call
    const rr = curRule;
    const slide = Math.min(1, (1.7 - readyTimer)/0.4);
    ctx.save();
    ctx.globalAlpha = Math.min(1, slide);
    ctx.translate(0, 62 + (1-slide)*24);
    ctx.fillStyle = 'rgba(14,10,11,0.86)';
    const label = t(rr.k), desc = t(rr.kd);
    ctx.font = "800 20px " + BODY_FONT;
    const w = Math.max(ctx.measureText(label).width, 250) + 60;
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(-w/2, -22, w, 44, 22); ctx.fill(); }
    else { ctx.fillRect(-w/2, -22, w, 44); }
    ctx.strokeStyle = 'rgba(255,236,214,0.12)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = rr.color;
    ctx.fillText(label, 0, 0);
    ctx.fillStyle = 'rgba(232,220,206,0.94)';
    fitText(desc, 600, '600', 16);
    ctx.fillText(desc, 0, 36);
    ctx.restore();
  }
  if (gameState === 'ROUND_OVER'){
    let col, text, sub;
    if (nextRoundWinner === 0){ col = '#ffc94a'; text = t('aDraw'); sub = t('aDrawSub'); }
    else {
      col = nextRoundWinner === 1 ? '#ff5a5f' : '#4a9eff';
      text = nextRoundWinner === 1 ? t('aWinP1') : t('aWinP2');
      sub = roundOutcome === 'time' ? t('aTimeUpSub') : t('aNext');
    }
    if (roundOutcome === 'time' && nextRoundWinner !== 0) text = t('aTimeUp');
    const k = Math.min(1, (2.1 - roundOverTimer)/0.3);
    const pop = 1 + (1-k)*0.25;
    ctx.save(); ctx.globalAlpha = k; ctx.translate(0, -10 + (1-k)*18); ctx.scale(pop, pop);
    const px = fitText(text, 620, /^[ -]+$/.test(text) ? '400' : '800', 64, /^[ -]+$/.test(text) ? HUD_FONT : BODY_FONT);
    bigText(text, 0, 0, px, col);
    ctx.fillStyle = '#c2b5a8';
    fitText(sub, 600, '600', 18);
    ctx.fillText(sub, 0, 52);
    ctx.restore();
  }
  ctx.restore();
}
let VW = 800, VH = 800;   // world-space half-extents *2 for the current viewport
let _lastDrawT = 0;
function draw(){
  _cvApplyPending();
  const W = canvas.width, H = canvas.height;
  const sctx = POST ? POST.begin(W, H) : null;
  bloomActive = !!sctx;
  ctx = sctx || ctxMain;
  if (!sctx) ctx.clearRect(0,0,W,H);
  ctx.save();
  ctx.translate(W/2, H/2);
  const s = Math.min(W, H)/780;
  VW = W/s; VH = H/s;
  ctx.scale(s,s);
  const theme = curArena;
  drawBackdrop(theme);
  if (screenShake > 0.1){
    ctx.translate((vr()-0.5)*screenShake, (vr()-0.5)*screenShake);
    screenShake *= 0.88;
  }
  drawArena(theme);
  drawRuleOverlay();
  drawHazards();
  drawTrail(P1); drawTrail(P2);
  drawFighter(P1); drawFighter(P2);
  drawEffects(theme);
  ctx.restore();
  if (sctx){
    // 세계 → 블룸 합성(WebGL). 이후 문자·비네트는 «투명 메인 캔버스»에 — 글자는 번지지 않는다.
    POST.end();
    ctx = ctxMain;
    ctx.clearRect(0,0,W,H);
    ctx.save(); ctx.translate(W/2, H/2); ctx.scale(s,s);
  } else {
    ctx.save(); ctx.translate(W/2, H/2); ctx.scale(s,s);
  }
  drawAnnounce();
  // vignette frames the ring and keeps the HUD legible over bright arenas
  const vg = ctx.createRadialGradient(0, 0, Math.min(VW,VH)*0.26, 0, 0, Math.max(VW,VH)*0.56);
  vg.addColorStop(0, 'rgba(7,4,5,0)');
  vg.addColorStop(0.62, 'rgba(7,4,5,0.18)');
  vg.addColorStop(1, 'rgba(7,4,5,0.56)');
  ctx.fillStyle = vg;
  ctx.fillRect(-VW/2, -VH/2, VW, VH);
  if (VH > VW*1.12){
    const edge = Math.min(VW, VH)*0.5;
    const band = ctx.createLinearGradient(0, -VH/2, 0, VH/2);
    band.addColorStop(0, 'rgba(7,4,5,0.92)');
    band.addColorStop(Math.max(0.02, (VH/2 - edge*1.02)/VH), 'rgba(7,4,5,0)');
    band.addColorStop(Math.min(0.98, (VH/2 + edge*1.02)/VH), 'rgba(7,4,5,0)');
    band.addColorStop(1, 'rgba(7,4,5,0.92)');
    ctx.fillStyle = band;
    ctx.fillRect(-VW/2, -VH/2, VW, VH);
  }
  ctx.restore();
  // 60fps 감시 표본(플레이 중만) — 렌더 품질 강등 판단에만 쓰인다.
  if (POST){
    const now = performance.now();
    if (gameState === 'PLAYING' && activeScreen === null){ if (_lastDrawT) POST.sample(now - _lastDrawT); _lastDrawT = now; }
    else _lastDrawT = 0;
  }
}
// ============================== UI ==============================
const $ = function(id){ return document.getElementById(id); };
let activeScreen = 'sc-title';
const SCREENS = ['sc-title','sc-help','sc-select','sc-vs','sc-result','sc-pause'];
const sel = {mode:'arcade', turn:1, c1:'kotaro', c2:'hayate', arena:'dawn', rule:'normal', focus:'kotaro'};

// A bottom-docked CTA bar must never end up parked on a row the player has to tap.
// Reserve exactly the bar's measured height as scroll runway inside the scroller, so
// every list row can always be scrolled clear of the bar. Only applied when the screen
// actually overflows, otherwise the runway would unbalance a vertically centred panel.
function syncCtaPad(el){
  const sc = el || (activeScreen ? $(activeScreen) : null);
  if (!sc) return;
  const pad = sc.querySelector('.cta-pad');
  const cta = sc.querySelector('.sticky-cta');
  if (!pad || !cta) return;
  pad.style.height = '0px';
  const overflowing = sc.scrollHeight > sc.clientHeight + 1;
  const h = Math.ceil(cta.getBoundingClientRect().height);
  try { document.documentElement.style.setProperty('--ctaPad', (h + 12) + 'px'); } catch(e){}
  pad.style.height = overflowing ? (h + 'px') : '0px';
  updScrollCue(sc);
}
// the CTA bar wears a small chevron while there is still list left underneath it
function updScrollCue(sc){
  if (!sc) return;
  sc.classList.toggle('can-scroll', (sc.scrollHeight - sc.clientHeight - sc.scrollTop) > 4);
}
// Long localized names (ja "ダイミョウジン", ru "Даймёдзин") must read in full, never ellipsize.
function shrinkToFit(el, minPx){
  if (!el) return;
  el.style.fontSize = '';
  const base = parseFloat(getComputedStyle(el).fontSize) || 12;
  const min = minPx || Math.max(8, base * 0.62);
  let size = base, guard = 0;
  while (el.scrollWidth > el.clientWidth + 0.5 && size > min && guard++ < 40){
    size = Math.max(min, size - 0.35);
    el.style.fontSize = size.toFixed(2) + 'px';
  }
}
function shrinkAll(root, q, minPx){
  const r = root || document;
  if (!r) return;
  Array.prototype.forEach.call(r.querySelectorAll(q), function(e){ shrinkToFit(e, minPx); });
}

function showScreen(id){
  SCREENS.forEach(function(s){
    const el = $(s);
    if (!el) return;
    el.classList.toggle('hidden', s !== id);
  });
  activeScreen = id;
  const ls = $('lang-switcher');
  if (ls) ls.classList.toggle('off', id === null || id === 'sc-vs' || id === 'sc-result');
  // 2026-08-22 개인정보처리방침 링크(Partner 지시) — lang-switcher 와 완전히
  // 같은 조건으로 보임/숨김을 맞춘다(플레이 화면·결과 화면에서 숨김).
  const pl = $('privacy-link');
  if (pl) pl.classList.toggle('off', id === null || id === 'sc-vs' || id === 'sc-result');
  const playing = (id === null);
  $('hud').classList.toggle('on', playing);
  $('footbar').classList.toggle('on', playing);
  if (id) syncCtaPad($(id));
  // 계측(⑤) — 비플레이 화면 진입만 수립다(id !== null 이면 비플레이).
  // showScreen 은 면당 1회만 불리는 명시적 화면전환 함수라 매 프레임 호출 위험이 없다.
  if (id) track('screen_view', {screen: id});
  bgmSync();
}
let toastTimer = null;
function toast(msg){
  const el = $('toast');
  el.textContent = msg; el.classList.add('on');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ el.classList.remove('on'); }, 1900);
}
function charName(c){ return t(c.k); }
function charTitle(c){ return t(c.kt); }

// ---------------- title ----------------
/* 트랙K 긴급수정(2026-08-03): 타이틀 화면 버튼별 실패 격리(safeSet). 피고지고와
   동일 사고 패턴(버튼 텍스트 100% JS의존, 하나 실패시 이후 전부 공백) 방지.
   [가설 수정 — 실기기 확인 필요] */
function safeSet(id,fn){
  try{const v=fn();const el=$(id);if(el)el.textContent=v}
  catch(e){console.error("[renderTitle] failed to set #"+id,e)}
}
function renderTitle(){
  safeSet('tx-tagline',()=>t('tagline'));
  safeSet('tx-m-arcade',()=>t('mArcade'));
  safeSet('tx-m-arcade-d',()=>t('mArcadeD'));
  safeSet('tx-m-versus',()=>t('mVersus'));
  safeSet('tx-m-versus-d',()=>t('mVersusD'));
  safeSet('tx-m-practice',()=>t('mPractice'));
  safeSet('tx-m-practice-d',()=>t('mPracticeD'));
  safeSet('btn-help',()=>t('howTo'));
  const cells = [
    {k:t('prgCleared'), v:SAVE.cleared + '/' + LADDER.length, gold:SAVE.champion},
    {k:t('prgFighters'), v:unlockedChars().length + '/' + CHARS.length, gold:unlockedChars().length === CHARS.length},
    {k:t('prgArenas'), v:unlockedArenas().length + '/' + ARENAS.length, gold:unlockedArenas().length === ARENAS.length}
  ];
  $('title-prog').innerHTML = cells.map(function(c){
    return '<div class="cell"><div class="k">' + c.k + '</div><div class="v' + (c.gold ? ' gold' : '') + '">' + c.v + '</div></div>';
  }).join('');
  renderDailyBout();
}
// 오늘의 대결(④) 카드 렌더 + 클릭 핸들러. 단일 DOM 요소, 반복 렌더 없음.
/* 출석표 문구 — 기존 I18N 테이블은 바이트 무접촉이라 «별도» 사전으로 둔다. */
const I18N_ATT = {
  ko:{day:'{n}일', dayShort:'{n}', peak:'특급', tomorrow:'내일 오면 {n}일째', tomorrowPeak:'내일 오면 특급 대결 · 경기장 영구 등록', peakEvery:'7일 연속 달성 · 매일 특급 대결 + 경기장 영구 등록', todayDone:'오늘 출석 완료', todayOpen:'오늘 한 판이면 {n}일째'},
  en:{day:'Day {n}', dayShort:'{n}', peak:'PEAK', tomorrow:'Come back tomorrow for day {n}', tomorrowPeak:'Tomorrow: peak bout + arena unlocked for good', peakEvery:'7-day streak · peak bout + a permanent arena every day', todayDone:'Checked in today', todayOpen:'One bout today makes it day {n}'}
};
function ta(k, n){ const L = I18N_ATT[curLang] || I18N_ATT.ko; return fmt(L[k] !== undefined ? L[k] : I18N_ATT.en[k], n); }
/* 7칸 스트립: 1~6 = DAILY_POOL 상대(고정), 7 = 특급(DAILY_PEAK, streak>=7 이면 매일 + 경기장 영구 등록).
   streak 이 8 이상이면 «7+ 매일 특급» 상태로 7칸 전부 채운다. 표시는 claimAttendance/todaysFeatured 를
   «읽기만» 한다 — 지급 규칙은 그 함수들이 그대로 갖고 있다. */
function renderAttendanceStrip(streak, claimedToday){
  const strip = $('att-strip'), cap = $('att-cap');
  if (!strip) return;
  const today = Math.max(1, streak|0);           // claimedToday 면 오늘 = streak, 아니면 오늘 받으면 될 값(previewStreak)
  const filled = claimedToday ? today : today - 1; // 이미 받은 날 수
  let html = '';
  for (let d=1; d<=7; d++){
    const isPeak = d === 7;
    const done = d <= filled || (filled >= 7);
    const isToday = !claimedToday ? (d === Math.min(7, today)) : (d === Math.min(7, today));
    const feat = isPeak ? DAILY_PEAK[0] : DAILY_POOL[d-1];
    const c = CHAR_BY_ID[feat.char];
    let cls = 'att-cell' + (isPeak ? ' peak' : '') + (done ? ' done' : '') + (isToday ? ' today' : '') + (isToday && !claimedToday ? ' open' : '');
    html += '<span class="' + cls + '" style="--c:' + c.color + '"><i class="chk" aria-hidden="true"></i>' +
      '<b>' + (isPeak ? ta('peak') : ta('dayShort', d)) + '</b></span>';
  }
  strip.innerHTML = html;
  if (cap){
    let txt;
    if (filled >= 7) txt = ta('peakEvery');
    else if (!claimedToday) txt = ta('todayOpen', today);
    else if (today === 6) txt = ta('tomorrowPeak');
    else txt = ta('tomorrow', today + 1);
    cap.textContent = txt;
  }
}
function renderDailyBout(){
  const btn = $('btn-daily');
  if (!btn) return;
  const claimedToday = (SAVE.attendance.lastClaimDateKey === kstDateKey());
  const streak = claimedToday ? SAVE.attendance.streak : previewStreak();
  const feat = todaysFeatured(streak);
  const c = CHAR_BY_ID[feat.char], a = ARENA_BY_ID[feat.arena];
  btn.classList.remove('hidden');
  btn.classList.toggle('claimed', claimedToday);
  safeSet('tx-daily-eyebrow', function(){ return claimedToday ? t('dailyClaimedTitle') : t('dailyTitle'); });
  safeSet('tx-daily-sub', function(){ return charName(c) + ' · ' + t(a.k) + ' · ' + t(RULE_BY_ID[feat.rule].k); });
  safeSet('tx-daily-streak-label', function(){ return t('dailyStreakUnit'); });
  const nEl = $('daily-streak-n'); if (nEl) nEl.textContent = String(streak);
  const cv = $('daily-portrait');
  if (cv) paintPortrait(cv, c, 40, {blink:1});
  try { renderAttendanceStrip(streak, claimedToday); } catch(e){ console.error('[attendance strip]', e); }
  btn.onclick = function(){
    playUI();
    claimAttendance();
    const p1char = CHAR_BY_ID[SAVE.lastChar] || CHARS[0];
    startMatch({mode:'practice', c1: p1char, c2: c, cpu:true,
      arena: a, rule: RULE_BY_ID[feat.rule], wins:3, pers:'balance', skill:0.5, diff: SAVE.diff});
    showScreen(null);
    renderDailyBout(); // 다음에 타이틀로 돌아왔을 때 claimed 상태가 바로 반영되도록
  };
}
// ---------------- help ----------------
function renderHelp(){
  $('tx-help-title').textContent = t('howToTitle');
  $('btn-help-back').textContent = t('bBack');
  const items = [
    {t:t('hChargeT'), d:t('hChargeD'), kbd:'HOLD'},
    {t:t('hAimT'), d:t('hAimD'), kbd:'DRAG'},
    {t:t('hSoloT'), d:t('hSoloD'), kbd:'1P'},
    {t:t('hDuoT'), d:t('hDuoD'), kbd:'2P'},
    {t:t('hGoalT'), d:t('hGoalD'), kbd:'WIN'},
    {t:t('hRulesT'), d:t('hRulesD'), kbd:'RULE'}
  ];
  $('help-list').innerHTML = items.map(function(i){
    return '<div class="hitem"><h4><span class="kbd">' + i.kbd + '</span>' + i.t + '</h4><p>' + i.d + '</p></div>';
  }).join('') +
  '<div class="hitem"><h4><span class="kbd">KEY</span>WASD / <span class="k-red">&#9654;</span></h4>' +
  '<p><span class="k-red">WASD</span> ' + t('lblP1') + ' &nbsp;·&nbsp; <span class="k-blue">&#8592; &#8593; &#8595; &#8594;</span> ' +
  t('lblP2') + '<br><span class="k-gold">Space</span> / A+D &nbsp;·&nbsp; Esc</p></div>';
}
// ---------------- select ----------------
function needTwo(){ return sel.mode !== 'arcade'; }
function selChar(n){ return CHAR_BY_ID[n === 1 ? sel.c1 : sel.c2] || CHARS[0]; }
function openSelect(m){
  sel.mode = m; sel.turn = 1;
  sel.c1 = charUnlocked(CHAR_BY_ID[SAVE.lastChar] || CHARS[0]) ? (SAVE.lastChar || 'kotaro') : 'kotaro';
  sel.focus = sel.c1;
  if (m === 'arcade'){
    stageIdx = Math.min(SAVE.cleared, LADDER.length - 1);
    sel.c2 = LADDER[stageIdx].char;
  } else {
    const pool = unlockedChars();
    sel.c2 = pool[Math.min(1, pool.length-1)].id;
    if (sel.c2 === sel.c1 && pool.length > 1) sel.c2 = pool[(pool.indexOf(CHAR_BY_ID[sel.c1])+1) % pool.length].id;
    const ua = unlockedArenas();
    sel.arena = ua[Math.floor(Math.random()*ua.length)].id;
    sel.rule = 'normal';
  }
  renderSelect();
  showScreen('sc-select');
}
function renderSelect(){
  const two = needTwo();
  $('tx-sel-eyebrow').textContent = sel.mode === 'arcade' ? t('selEyeArcade') : (sel.mode === 'versus' ? t('selEyeVersus') : t('selEyePractice'));
  $('tx-sel-title').textContent = (sel.mode === 'versus') ? t('selTitleDuo') : t('selTitleSolo');
  $('tx-sel-roster').textContent = t('selRoster');
  $('tx-diff').textContent = t('diffLabel');
  $('tx-pick-arena').textContent = t('pickArena');
  $('tx-pick-rule').textContent = t('pickRule');
  $('btn-sel-back').textContent = t('bBack');
  $('btn-sel-go').textContent = sel.mode === 'arcade' ? t('bStart') : t('bFight');

  // 2026-08-22 AI티 — '⇄' 유니코드 글리프(기기 폰트마다 모양이 다름)를
  // 텍스트에서 뺐다. CSS #sel-turn::after 가 순수 도형(전환 셰브런)으로
  // 그린다(index.html 참고, ▲▼ -> CSS 삼각형 전환과 같은 원칙).
  const turnEl = $('sel-turn');
  if (two){
    const l1 = (sel.mode === 'versus') ? t('selTurnP1') : t('lblYou');
    const l2 = (sel.mode === 'versus') ? t('selTurnP2') : t('lblCpu');
    turnEl.textContent = (sel.turn === 1 ? l1 : l2);
    turnEl.classList.add('has-swap-icon');
    turnEl.style.cursor = 'pointer';
    turnEl.style.color = sel.turn === 1 ? '#ff8a8f' : '#8cc4ff';
  } else { turnEl.textContent = ''; turnEl.classList.remove('has-swap-icon'); turnEl.style.cursor = 'default'; }

  const focus = CHAR_BY_ID[sel.focus] || CHARS[0];
  paintPortrait($('sel-portrait'), focus, 70, {blink:1});
  $('sel-name').textContent = charName(focus);
  $('sel-title').textContent = charTitle(focus);
  const bars = [['sWeight','weight'],['sPower','power'],['sSpeed','speed'],['sSize','radius']];
  $('sel-stats').innerHTML = bars.map(function(b){
    return '<div class="stat"><span class="sl">' + t(b[0]) + '</span><span class="st"><i style="width:' +
      statPct(focus, b[1]) + '%"></i></span></div>';
  }).join('');

  const grid = $('char-grid');
  grid.innerHTML = '';
  CHARS.forEach(function(c){
    const un = charUnlocked(c);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ccard' + (un ? '' : ' lock');
    let cls = '';
    if (sel.c1 === c.id && (two ? sel.c2 === c.id : false)) cls = ' sel12';
    else if (sel.c1 === c.id) cls = ' sel1';
    else if (two && sel.c2 === c.id) cls = ' sel2';
    btn.className += cls;
    const cv = document.createElement('canvas');
    btn.appendChild(cv);
    const nm = document.createElement('div');
    nm.className = 'cn'; nm.textContent = un ? charName(c) : '???';
    btn.appendChild(nm);
    if (sel.c1 === c.id){ const tg = document.createElement('span'); tg.className = 'tagn p1'; tg.textContent = '1P'; btn.appendChild(tg); }
    if (two && sel.c2 === c.id){ const tg = document.createElement('span'); tg.className = 'tagn p2'; tg.style.left = 'auto'; tg.style.right = '5px'; tg.textContent = '2P'; btn.appendChild(tg); }
    if (!un){ const lb = document.createElement('div'); lb.className = 'lockbadge';
      lb.appendChild(document.createElement('i')); btn.appendChild(lb); }
    btn.onclick = function(){
      playUI();
      if (!un){ toast(c.unlock >= LADDER.length ? t('selUnlockClear') : fmt(t('selUnlockAt'), c.unlock)); sel.focus = c.id; renderSelect(); return; }
      if (sel.turn === 1) sel.c1 = c.id; else sel.c2 = c.id;
      sel.focus = c.id;
      if (two && sel.turn === 1) sel.turn = 2;
      renderSelect();
    };
    grid.appendChild(btn);
    paintPortrait(cv, c, 52, {blink:1});
  });

  // difficulty
  const dw = $('sel-diff-wrap');
  dw.style.display = (sel.mode === 'versus') ? 'none' : 'block';
  if (sel.mode !== 'versus'){
    const names = [t('dEasy'), t('dNormal'), t('dHard')];
    const descs = [t('dEasyD'), t('dNormalD'), t('dHardD')];
    $('diff-desc').textContent = descs[diff];
    $('diff-seg').innerHTML = names.map(function(n,i){
      return '<button type="button" data-d="' + i + '" class="' + (i === diff ? 'on' : '') + '">' + n + '</button>';
    }).join('');
    Array.prototype.forEach.call($('diff-seg').children, function(b){
      b.onclick = function(){ diff = parseInt(b.dataset.d, 10); SAVE.diff = diff; persist(); playUI(); renderSelect(); };
    });
  }

  // arena + rule pickers (versus / practice)
  const ex = $('sel-extra');
  ex.style.display = (sel.mode === 'arcade') ? 'none' : 'flex';
  if (sel.mode !== 'arcade'){
    $('rule-desc').textContent = t(RULE_BY_ID[sel.rule].kd);
    $('arena-picks').innerHTML = ARENAS.map(function(a){
      const un = arenaUnlocked(a);
      return '<button type="button" class="pick' + (sel.arena === a.id ? ' on' : '') + '" data-a="' + a.id + '"' +
        (un ? '' : ' disabled style="opacity:.35"') + '><span class="sw" style="background:' + a.boundary + '"></span>' +
        (un ? t(a.k) : '???') + '</button>';
    }).join('');
    Array.prototype.forEach.call($('arena-picks').children, function(b){
      b.onclick = function(){ sel.arena = b.dataset.a; playUI(); renderSelect(); };
    });
    $('rule-picks').innerHTML = RULES.map(function(r){
      return '<button type="button" class="pick' + (sel.rule === r.id ? ' on' : '') + '" data-r="' + r.id + '">' +
        '<span class="sw" style="background:' + r.color + '"></span>' + t(r.k) + '</button>';
    }).join('');
    Array.prototype.forEach.call($('rule-picks').children, function(b){
      b.onclick = function(){ sel.rule = b.dataset.r; playUI(); renderSelect(); };
    });
  }
  shrinkToFit($('sel-name'));
  shrinkAll($('char-grid'), '.cn', 8.5);
  syncCtaPad($('sc-select'));
}
// ---------------- VS ----------------
let vsCfg = null;
function openVS(){
  const c1 = CHAR_BY_ID[sel.c1], c2 = CHAR_BY_ID[sel.c2];
  let pers = 'balance', skill = 0.5, wins = 3, arena = ARENA_BY_ID[sel.arena], rule = RULE_BY_ID[sel.rule], cpu = true;
  if (sel.mode === 'arcade'){
    const st = LADDER[stageIdx];
    pers = st.pers; skill = st.skill; wins = st.wins;
    arena = ARENA_BY_ID[st.arena]; rule = RULE_BY_ID[st.rule];
  } else if (sel.mode === 'versus'){
    cpu = false; wins = 3;
  } else {
    wins = 3; skill = 0.5; pers = 'balance';
  }
  vsCfg = {mode:sel.mode, c1:c1, c2:c2, cpu:cpu, pers:pers, skill:skill, wins:wins, arena:arena, rule:rule};
  const boss = (sel.mode === 'arcade' && stageIdx === LADDER.length - 1);
  $('vs-eyebrow').textContent = sel.mode === 'arcade'
    ? (boss ? t('vsFinalStage') : fmt(t('vsStage'), stageIdx+1))
    : (sel.mode === 'versus' ? t('vsExhibition') : t('vsPractice'));
  $('vs-b1').textContent = sel.mode === 'versus' ? t('lblP1') : t('lblYou');
  $('vs-b2').textContent = sel.mode === 'versus' ? t('lblP2') : t('lblCpu');
  $('vs-n1').textContent = charName(c1); $('vs-t1').textContent = charTitle(c1);
  $('vs-n2').textContent = charName(c2); $('vs-t2').textContent = charTitle(c2);
  paintPortrait($('vs-por1'), c1, 116, {blink:1});
  paintPortrait($('vs-por2'), c2, 116, {blink:1});
  const chips = [
    '<span class="chip"><span class="dot" style="background:' + arena.boundary + '"></span>' + t(arena.k) + '</span>',
    '<span class="chip hot"><span class="dot" style="background:' + rule.color + '"></span>' + t(rule.k) + '</span>',
    '<span class="chip">' + fmt(t('vsBest'), wins) + '</span>'
  ];
  if (cpu) chips.push('<span class="chip">' + t(PERS_KEY[pers]) + ' &middot; ' + [t('dEasy'),t('dNormal'),t('dHard')][diff] + '</span>');
  $('vs-info').innerHTML = chips.join('');
  const ld = $('vs-ladder');
  if (sel.mode === 'arcade'){
    ld.style.display = 'flex';
    ld.innerHTML = '';
    LADDER.forEach(function(st, i){
      const c = CHAR_BY_ID[st.char];
      const row = document.createElement('div');
      row.className = 'lrow' + (i < stageIdx ? ' done' : (i === stageIdx ? ' cur' : ''));
      // 2026-08-22 preflight_ait.py 실코드 글리프 검출(FAIL) — '✓' 도 기기 폰트마다
      // 모양이 다르다(▲▼/⇄/♪ 와 같은 이유). 클리어된 스테이지는 번호 대신 «빈 칸»만
      // 두고, CSS .lrow.done .no::after 가 체크 도형을 그린다(index.html 참고).
      row.innerHTML = '<div class="no">' + (i < stageIdx ? '' : (i+1)) + '</div>';
      const cv = document.createElement('canvas'); row.appendChild(cv);
      const n = document.createElement('div'); n.className = 'ln';
      n.textContent = charName(c);
      row.appendChild(n);
      const r = document.createElement('div'); r.className = 'lr';
      r.textContent = t(RULE_BY_ID[st.rule].k) + ' · ' + t(ARENA_BY_ID[st.arena].k);
      row.appendChild(r);
      ld.appendChild(row);
      paintPortrait(cv, c, 30, {blink:1});
    });
  } else ld.style.display = 'none';
  $('btn-vs-go').textContent = t('bFight');
  showScreen('sc-vs');
  shrinkToFit($('vs-n1')); shrinkToFit($('vs-n2'));
  shrinkAll(ld, '.ln', 8.5);
  syncCtaPad($('sc-vs'));
}
function launchMatch(){
  if (!vsCfg) return;
  SAVE.lastChar = vsCfg.c1.id; persist();
  showScreen(null);
  startMatch(vsCfg);
}
// ---------------- HUD ----------------
function pipHTML(score, need, cls){
  let h = '';
  for (let i=0;i<need;i++) h += '<div class="pip ' + cls + (i < score ? ' on' : '') + '"></div>';
  return h;
}
// ★2P: 정보를 «소유자 쪽»으로 옮긴다 (2026-08-14, President 「2P UX 불편」).
//   [Partner 실기기 실측] 게임은 상하로 나뉘는데 정보는 좌우 그대로여서,
//   아래쪽 플레이어(P1)의 이름·핍·게이지가 화면 «맨 위»에 있었다.
//   -> P2(위) 정보는 #hud 로, P1(아래) 정보는 #footbar 로 모은다.
//
//   ★DOM «이동»만 한다. id 는 그대로라 기존 갱신 코드는 «전부» 그대로 동작한다.
//   ★멱등이다 — 이미 옳은 부모에 있으면 아무것도 하지 않는다(매 라운드 호출된다).
//   ⛔pointer-events 는 건드리지 않는다. HUD 터치 흡수 제거는 ①레인 성과다.
//   ⛔1인 모드에서는 «원위치»로 되돌린다.
function layoutDuo(duo){
  const hud = $('hud'), foot = $('footbar');
  const s1 = $('hud-side1'), mid = hud.querySelector('.hud-mid');
  const g2 = $('gauge2');
  if (!hud || !foot || !s1 || !g2) return;
  // ★★duo 클래스를 «여기서» 붙인다. 1차 실패의 직접 원인이 이 한 줄의 부재였다:
  //   CSS 는 #hud.duo / #footbar.duo 로 썼는데 duo 는 #game-container 에만 붙어
  //   규칙 6개가 «전부» 죽어 있었다. #hud 는 #game-container 의 자손이 아니라
  //   («#app > #hud» / «#app > #stage > #game-container») 선택자로는 못 잇는다.
  hud.classList.toggle('duo', duo);
  foot.classList.toggle('duo', duo);
  if (duo){
    if (g2.parentNode !== hud) hud.appendChild(g2);      // P2 게이지 -> 위쪽
    if (s1.parentNode !== foot) foot.appendChild(s1);    // P1 이름·핍 -> 아래쪽
  } else {
    // 원위치: #hud = [side1, mid, side2, pause] / #footbar = [gauge1, gauge2]
    if (s1.parentNode !== hud) hud.insertBefore(s1, mid || hud.firstChild);
    if (g2.parentNode !== foot) foot.appendChild(g2);
  }
}
function syncHUD(){
  const n1 = charName(P1.def), n2 = charName(P2.def);
  // The HUD is laid out left/right but the ZONES are top/bottom, so the bar
  // can no longer imply ownership by its own position. Each side carries a
  // glyph naming its half instead. Shape, not colour - the .p1/.p2 classes
  // already supply the colour, and colour alone would fail SC 1.4.1.
  const duo = (mode === 'versus');
  $('game-container').classList.toggle('duo', duo);
  layoutDuo(duo);
  // 2026-08-22 AI\ud2f0 S8: \ubc29\ud5a5 \uae00\ub9ac\ud504(\u25bc/\u25b2)\ub294 \uc774\uc81c index.html \uc758 CSS
  // (#hud.duo .hud-name.p1::before / .p2::after, \uc21c\uc218 CSS \uc0bc\uac01\ud615)\uac00 \uadf8\ub9b0\ub2e4.
  // \ud14d\uc2a4\ud2b8\uc5d0\ub294 \uc774\ub984\ub9cc \ub0a8\uae34\ub2e4 \u2014 \uc720\ub2c8\ucf54\ub4dc \uae30\ud638\ub97c \ubb38\uc790\uc5f4\uc5d0 \uc11e\uc9c0 \uc54a\ub294\ub2e4.
  $('hud-name1').textContent = n1;   // P1 = bottom
  $('hud-name2').textContent = n2;   // P2 = top
  $('hud-pips1').innerHTML = pipHTML(scoreP1, winsNeeded, 'p1');
  $('hud-pips2').innerHTML = pipHTML(scoreP2, winsNeeded, 'p2');
  $('hud-round').textContent = fmt(t('hudRound'), roundNum);
  $('hud-rule-name').textContent = t(curRule.k);
  $('hud-rule').classList.toggle('hot', curRule.id !== 'normal');
  $('hud-rule').querySelector('.dot').style.background = curRule.color;
  // \u26052P \uc774\ub984 \u00ab\uc911\ubcf5\u00bb \uc81c\uac70 (2026-08-14 \uc7ac\uc791\uc5c5 2\ucc28, President \uc2e4\uae30\uae30 \uc9c0\uc801).
  //   duo \uc5d0\uc11c\ub294 \uc774\ub984\ud45c\uac00 hud-side(\ud54d \ucabd) \u00ab\ud558\ub098\u00bb\ubfd0\uc774\ub2e4. \uac8c\uc774\uc9c0\ub294 \u00ab\ub9c9\ub300\ub9cc\u00bb \ub0a8\uae34\ub2e4.
  //   [1\ucc28 \uc2e4\ud328] \uc8fd\uc740 CSS \uac00 \ub458\uc744 \ub2e4\ub978 \uc904\ub85c \uac08\ub77c\uc904 \u00ab\uc608\uc815\u00bb\uc774\uc5c8\ub294\ub370 \uaddc\uce59\uc774 \uc548 \uac78\ub824
  //   \uac19\uc740 \uc904\uc5d0 \u300c\ud558\uc57c\ud14c\u25b2+\ud54d  \ud558\uc57c\ud14c\u25b2+\ubc14\u300d\ub85c \uc774\ub984\uc774 \ub450 \ubc88 \ub098\uc654\ub2e4.
  //   \u26d41\uc778 \ubaa8\ub4dc\ub294 \uac8c\uc774\uc9c0 \uc774\ub984\uc744 \u00ab\uadf8\ub300\ub85c\u00bb \ub454\ub2e4 \u2014 \ud654\uba74 \ubc18\ub300\ucabd\uc774\ub77c \uc911\ubcf5\uc774 \uc544\ub2c8\ub2e4.
  $('g1lab').textContent = duo ? '' : n1;
  $('g2lab').textContent = duo ? '' : n2;
  $('gauge2').style.display = (mode === 'versus' || P2.isCPU) ? 'block' : 'block';
  shrinkToFit($('hud-name1')); shrinkToFit($('hud-name2'));
  shrinkToFit($('g1lab')); shrinkToFit($('g2lab'));
}
function frameHUD(){
  if (activeScreen !== null) return;
  const left = Math.max(0, 1 - roundTimer/shrinkDuration);
  const fill = $('hud-timer-fill');
  fill.style.width = (left*100).toFixed(1) + '%';
  fill.classList.toggle('warn', left < 0.35);
  const c1 = P1.isCharging ? P1.charge/CHARGE_MAX : 0;
  const c2 = P2.isCharging ? P2.charge/CHARGE_MAX : 0;
  $('g1').style.width = (c1*100).toFixed(0) + '%';
  $('g2').style.width = (c2*100).toFixed(0) + '%';
  $('gauge1').classList.toggle('full', c1 > 0.95);
  $('gauge2').classList.toggle('full', c2 > 0.95);
}
// ---------------- result ----------------
function showResultScreen(){
  const win = matchResult === 1;
  const arcadeClear = (mode === 'arcade' && win && stageIdx >= LADDER.length - 1);
  const eb = $('res-eyebrow'), big = $('res-big'), sub = $('res-sub');
  if (mode === 'versus'){
    eb.textContent = t('selEyeVersus');
    big.textContent = t('resWin');
    big.className = 'bigres win';
    sub.textContent = fmt(t('resWinSubDuo'), charName(win ? P1.def : P2.def));
  } else if (arcadeClear){
    eb.textContent = t('selEyeArcade');
    big.textContent = t('resClear');
    big.className = 'bigres win';
    sub.textContent = t('resClearSub');
  } else if (win){
    eb.textContent = mode === 'arcade' ? fmt(t('arcStageN'), stageIdx+1) : t('selEyePractice');
    big.textContent = t('resWin');
    big.className = 'bigres win';
    sub.textContent = mode === 'arcade' ? t('resWinSubArcade') : fmt(t('resWinSubDuo'), charName(P1.def));
  } else {
    eb.textContent = mode === 'arcade' ? fmt(t('arcStageN'), stageIdx+1) : t('selEyePractice');
    big.textContent = t('resLose');
    big.className = 'bigres lose';
    sub.textContent = t('resLoseSub');
  }
  const acc = stats.dashes > 0 ? Math.round(stats.hits/stats.dashes*100) : 0;
  const secs = Math.max(0, Math.round(matchElapsed/1000));
  const rows = [
    [t('stRounds'), scoreP1 + ' : ' + scoreP2, true],
    [t('stDashes'), String(stats.dashes), false],
    [t('stHits'), String(stats.hits), false],
    [t('stAcc'), acc + '%', acc >= 50],
    [t('stMaxCharge'), Math.round(stats.maxCharge*100) + '%', stats.maxCharge > 0.9],
    [t('stBestRally'), String(stats.bestRally), false],
    [t('stTime'), Math.floor(secs/60) + ':' + ('0' + (secs%60)).slice(-2), false]
  ];
  $('res-stats').innerHTML = rows.map(function(r){
    return '<div class="statrow"><span class="k">' + r[0] + '</span><span class="v' + (r[2] ? ' gold' : '') + '">' + r[1] + '</span></div>';
  }).join('');

  const ub = $('res-unlocks');
  ub.innerHTML = '';
  if (pendingUnlocks.length){
    pendingUnlocks.forEach(function(u){
      const box = document.createElement('div');
      box.className = 'unlockbox';
      const txt = document.createElement('div');
      txt.innerHTML = '<div class="t">' + (u.type === 'char' ? t('unlockedChar') : t('unlockedArena')) + '</div>' +
        '<div class="n">' + t(u.obj.k) + '</div>';
      if (u.type === 'char'){
        const cv = document.createElement('canvas'); box.appendChild(cv); box.appendChild(txt);
        paintPortrait(cv, u.obj, 44, {blink:1});
      } else {
        const sw = document.createElement('div');
        sw.style.cssText = 'width:44px;height:44px;border-radius:13px;flex:0 0 auto;background:linear-gradient(135deg,' +
          u.obj.sky[1] + ',' + u.obj.boundary + ')';
        box.appendChild(sw); box.appendChild(txt);
      }
      ub.appendChild(box);
    });
    playUnlockSfx();
  }
  const next = $('btn-res-next');
  if (mode === 'arcade' && win && !arcadeClear) next.textContent = t('bNext');
  else if (mode === 'arcade' && !win) next.textContent = t('bRetry');
  else next.textContent = t('bRematch');
  $('btn-res-menu').textContent = t('bMenu');
  // 2P: mirror ONLY the verdict for the player at the top of the phone.
  // Winner colour + a side glyph carry "who", so the copy stands alone without
  // the sub-line, which stays single.
  const dup = $('res-big-top');
  $('sc-result').classList.toggle('duo', mode === 'versus');
  if (mode === 'versus'){
    const w1 = (matchResult === 1);          // P1 = red = BOTTOM half
    // D2 \uc218\uc815(2026-08-14, Partner \uc2b9\uc778 \u00b7 \ud2b8\ub799\u2462 \uc801\uc6a9) \u2014 \uae00\ub9ac\ud504 \u00ab\uadf9\uc131 \ubc18\uc804\u00bb.
    // \uc774 \uc694\uc18c(.bigres.dup)\ub294 rotate(180deg) \ub85c \u00ab\uc704\ucabd \ud50c\ub808\uc774\uc5b4\u00bb\ub97c \ud5a5\ud574 \uc788\ub2e4.
    // \uc989 \uc5ec\uae30 \uc801\ub294 \uae00\ub9ac\ud504\ub294 \u00ab\uc704\ucabd \ud50c\ub808\uc774\uc5b4\uac00 \ubcf4\ub294 \uadf8\ub300\ub85c\u00bb\ub2e4.
    // P1(\ube68\uac15)\uc740 \ud654\uba74 \u00ab\uc544\ub798\u00bb \uc808\ubc18 = \uc704\ucabd \ud50c\ub808\uc774\uc5b4 \uae30\uc900 \u00ab\uba3c \ucabd\u00bb -> \uc704\ub97c \uac00\ub9ac\ud0a4\ub294 \u25b2 \uac00 \uc633\ub2e4.
    // P2(\ud30c\ub791)\ub294 \u00ab\uc704\u00bb \uc808\ubc18 = \uc704\ucabd \ud50c\ub808\uc774\uc5b4 \uae30\uc900 \u00ab\uac00\uae4c\uc6b4 \ucabd\u00bb -> \u25bc.
    // \u26d4D1(respopdup \ud0a4\ud504\ub808\uc784, index.html)\uacfc \u00ab\ubc18\ub4dc\uc2dc \ud568\uaed8\u00bb \uc788\uc5b4\uc57c \ud55c\ub2e4 \u2014 D1 \uc5c6\uc774 \uc774\uac83\ub9cc
    //   \uc801\uc6a9\ud558\uba74 \ud68c\uc804\uc774 \uc8fd\uc740 \ucc44 \uadf9\uc131\ub9cc \ub4a4\uc9d1\ud600 \uc5ec\uc804\ud788 \ubc18\ub300\ub85c \ubcf4\uc778\ub2e4.
    // 2026-08-22 AI\ud2f0 S8: \ubc29\ud5a5 \uae00\ub9ac\ud504\ub294 index.html \uc758 .bigres.dup.p1/.p2::before
    // (\uc21c\uc218 CSS \uc0bc\uac01\ud615)\uac00 \uadf8\ub9b0\ub2e4 \u2014 \uadf9\uc131(p1->\u25b2/p2->\u25bc)\uc740 \uadf8\ub300\ub85c \uc720\uc9c0, \ud68c\uc804\ub3c4
    // \ubc15\uc2a4 \uc804\uccb4\uc5d0 \uadf8\ub300\ub85c \uac78\ub9ac\ubbc0\ub85c \ucd5c\uc885 \uc2dc\uac01 \uacb0\uacfc\ub294 \ub3d9\uc77c\ud558\ub2e4(\uc704 D1/D2 \uc8fc\uc11d \ucc38\uace0).
    dup.textContent = big.textContent;
    dup.className = 'bigres dup ' + (w1 ? 'p1' : 'p2');
  }
  showScreen('sc-result');
}
function resultNext(){
  if (mode === 'arcade'){
    if (matchResult === 1 && stageIdx < LADDER.length - 1){
      stageIdx++;
      sel.c2 = LADDER[stageIdx].char;
      openVS();
    } else if (matchResult === 1){
      goTitle();
    } else openVS();
  } else openVS();
}
function goTitle(){
  gameState = 'MENU';
  stopCharge(1); stopCharge(2);
  confetti = []; particles = [];
  renderTitle();
  showScreen('sc-title');
}
// ---------------- pause ----------------
function togglePause(on){
  if (on){
    if (gameState === 'MENU' || gameState === 'MATCH_OVER') return;
    paused = true;
    stopCharge(1); stopCharge(2);
    P1.isCharging = false; P2.isCharging = false;
    $('tx-pause-title').textContent = t('pauseTitle');
    $('tx-pause-sub').textContent = t('pauseSub');
    $('btn-resume').textContent = t('bResume');
    $('btn-restart').textContent = t('bRestart');
    $('btn-quit').textContent = t('bQuit');
    showScreen('sc-pause');
  } else {
    paused = false;
    showScreen(null);
  }
}
// ---------------- language ----------------
function applyLang(){
  document.documentElement.lang = curLang;
  /* 트랙K 게이트3 재작업(2026-08-03) 이름통일: 정적 HTML 기본값을 이미
     "스모 바운스"(한글)로 바꿔놨다 — KO가 기본 로케일이라 JS가 실패해도
     기본값이 이미 정답이다. 여기서는 EN일 때만 영문으로 덮어쓴다.
     h1이 null이면 "조용히 넘기지 말고 로그를 남겨라"(Partner 지시) 그대로
     console.error로 남긴다. */
  try{
    const h1=$('gameTitleH1');
    if(h1){
      if(curLang!=='ko') h1.textContent='SUMO BOUNCE';
      /* curLang==='ko'면 정적 기본값을 그대로 둔다(덮어쓸 필요 없음) */
    }else{
      console.error('[applyLang] gameTitleH1 element not found in DOM — title unification may have failed');
    }
  }catch(e){console.error('[applyLang] gameTitleH1 failed',e)}
  renderTitle();
  renderHelp();
  if (activeScreen === 'sc-select') renderSelect();
  if (activeScreen === 'sc-pause'){
    $('tx-pause-title').textContent = t('pauseTitle');
    $('tx-pause-sub').textContent = t('pauseSub');
    $('btn-resume').textContent = t('bResume');
    $('btn-restart').textContent = t('bRestart');
    $('btn-quit').textContent = t('bQuit');
  }
  if (gameState !== 'MENU') syncHUD();
  const sw = $('lang-switcher');
  Array.prototype.forEach.call(sw.querySelectorAll('#lang-list .lang-btn'), function(b){
    b.classList.toggle('active', b.dataset.lang === curLang);
  });
  const tg = $('lang-toggle');
  if (tg) tg.textContent = I18N[curLang].name;
}
function setLang(l){
  if (!I18N[l]) return;
  curLang = l; lsSet('sumoLang', l); applyLang();
}
function initLang(){
  const saved = lsGet('sumoLang');
  const nav = (navigator.language||'ko').slice(0,2).toLowerCase();
  curLang = (saved && I18N[saved]) ? saved : (I18N[nav]?nav:'ko');
  const sw = $('lang-switcher');
  sw.innerHTML = '';
  const row = document.createElement('div'); row.className = 'lang-row';
  const toggle = document.createElement('button');
  toggle.type = 'button'; toggle.className = 'lang-btn active'; toggle.id = 'lang-toggle';
  toggle.setAttribute('aria-label', 'Language');
  const list = document.createElement('div'); list.id = 'lang-list'; list.className = 'off';
  toggle.onclick = function(e){ e.stopPropagation(); playUI(); list.classList.toggle('off'); };
  // 2026-08-23 President 실기기 지적 — clip-path 스피커 도형이 배율에 따라
  // 「•|」처럼 뭉개져 보였다. 인라인 SVG <path> 로 교체(index.html 의
  // #btn-mute svg 규칙 참고) — 벡터라 어느 크기에서도 정확하고 폰트 의존
  // 없음(원래 목적 그대로 달성). 관례: 켜짐=스피커+음파, 꺼짐=스피커+사선.
  const mb = document.createElement('button');
  mb.type = 'button'; mb.className = 'lang-btn'; mb.id = 'btn-mute';
  mb.setAttribute('aria-label', 'Sound');
  mb.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path d="M3 9v6h4l5 4.2V4.8L7 9H3z" fill="currentColor"/>' +
      '<path class="ic-wave" d="M15.3 8.6a5 5 0 0 1 0 6.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
      '<path class="ic-wave" d="M18 6a9 9 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
      '<path class="ic-x" d="M14.8 9.2l6 5.6M20.8 9.2l-6 5.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
    '</svg>';
  mb.onclick = function(e){
    e.stopPropagation(); initAudio(); setMuted(!muted);
    mb.classList.toggle('active', !muted);
    mb.classList.toggle('muted', muted);
    mb.setAttribute('aria-pressed', muted ? 'true' : 'false');
    if (!muted) playUI();
  };
  mb.classList.toggle('active', !muted);
  mb.classList.toggle('muted', muted);
  mb.setAttribute('aria-pressed', muted ? 'true' : 'false');
  row.appendChild(toggle); row.appendChild(mb);
  sw.appendChild(row); sw.appendChild(list);
  LANG_ORDER.forEach(function(code){
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'lang-btn'; b.textContent = I18N[code].name; b.dataset.lang = code;
    b.onclick = function(e){ e.stopPropagation(); playUI(); setLang(code); list.classList.add('off'); };
    list.appendChild(b);
  });
}
// ============================== boot ==============================
let lastStageKey = '';
function resizeCanvas(){
  const st = $('stage').getBoundingClientRect();
  const cw = Math.max(200, Math.floor(st.width)), ch = Math.max(200, Math.floor(st.height));
  const barW = Math.max(300, Math.min(Math.min(cw, ch) + 120, cw));
  $('hud').style.maxWidth = barW + 'px';
  $('footbar').style.maxWidth = barW + 'px';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.round(cw*dpr), h = Math.round(ch*dpr);
  if (canvas.width !== w || canvas.height !== h){ canvas.width = w; canvas.height = h; }
  lastStageKey = cw + 'x' + ch;
}
function checkResize(){
  const st = $('stage').getBoundingClientRect();
  const key = Math.round(st.width) + 'x' + Math.round(st.height);
  if (key !== lastStageKey) resizeCanvas();
}
// keep the CTA runway and the auto-shrunk names correct across viewport changes
function relayoutUI(){
  if (!activeScreen) return;
  const sc = $(activeScreen);
  if (!sc) return;
  shrinkAll(sc, '.ccard .cn', 8.5);
  shrinkAll(sc, '.lrow .ln', 8.5);
  shrinkAll(sc, '.detail .info .nm', 10);
  shrinkAll(sc, '.vsside .nm', 10);
  syncCtaPad(sc);
}
window.addEventListener('resize', function(){ resizeCanvas(); relayoutUI(); });
window.addEventListener('orientationchange', function(){ setTimeout(function(){ resizeCanvas(); relayoutUI(); }, 260); });
['pointerdown','keydown','touchstart'].forEach(function(ev){
  window.addEventListener(ev, armAudio, {passive:true});
});

['sc-select','sc-vs','sc-result'].forEach(function(id){
  const el = $(id);
  if (el) el.addEventListener('scroll', function(){ updScrollCue(el); }, {passive:true});
});

// UI chrome must never leak a press into the ring.
// #hud is deliberately NOT in this list any more - see the #hud.on rule. The
// pause button keeps its own guard below so a press on it never reaches the ring.
//
// #footbar IS STILL HERE EVEN THOUGH THE GUARD CURRENTLY DOES NOTHING FOR IT.
// [MEASURED 2026-08-14] #footbar carries pointer-events:none in its base rule
// and #footbar.on only flips opacity, so #footbar can never receive mousedown
// or touchstart and this listener never runs for it. It is kept ON PURPOSE:
// #footbar sits in the BOTTOM half, which is now P1's zone, so the day anything
// inside it becomes interactive (a banner, a button) an unguarded press would
// leak straight into the ring and make P1 charge - the exact bug this patch
// just removed for P2 at the top. The entry costs nothing and pre-empts that.
// ⛔ Do NOT read this line as "#footbar is already blocked here" - it is
//    blocked by its CSS, not by this. And do not make #footbar interactive.
['footbar','lang-switcher','toast'].forEach(function(id){
  const el = $(id);
  if (!el) return;
  ['mousedown','touchstart'].forEach(function(ev){
    el.addEventListener(ev, function(e){ e.stopPropagation(); }, {passive:true});
  });
});

$('btn-mode-arcade').onclick = function(){ initAudio(); playUI(); openSelect('arcade'); };
$('btn-mode-versus').onclick = function(){ initAudio(); playUI(); openSelect('versus'); };
$('btn-mode-practice').onclick = function(){ initAudio(); playUI(); openSelect('practice'); };
$('btn-help').onclick = function(){ playUI(); renderHelp(); showScreen('sc-help'); };
$('btn-help-back').onclick = function(){ playUI(); showScreen('sc-title'); };
$('btn-sel-back').onclick = function(){ playUI(); goTitle(); };
$('btn-sel-go').onclick = function(){ playUI(); openVS(); };
$('sel-turn').onclick = function(){ if (needTwo()){ sel.turn = sel.turn === 1 ? 2 : 1; sel.focus = sel.turn === 1 ? sel.c1 : sel.c2; playUI(); renderSelect(); } };
$('btn-vs-go').onclick = function(){ initAudio(); playUI(); launchMatch(); };
// ★★ 인계 경고 (Partner 지시, 원문 그대로):
//   btn-res-next / btn-res-menu 「id 변경 금지」 — 바꾸면 광고 게이트가 «조용히» 풀린다
$('btn-res-next').onclick = function(){ playUI(); resultNext(); };
$('btn-res-menu').onclick = function(){ playUI(); goTitle(); };
['mousedown','touchstart'].forEach(function(ev){
  $('btn-pause').addEventListener(ev, function(e){ e.stopPropagation(); }, {passive:true});
});
$('btn-pause').onclick = function(e){ e.stopPropagation(); playUI(); togglePause(true); };
$('btn-resume').onclick = function(){ playUI(); togglePause(false); };
$('btn-restart').onclick = function(){ playUI(); paused = false; showScreen(null); startMatch(vsCfg); };
$('btn-quit').onclick = function(){ playUI(); paused = false; if (mode === 'arcade') track('stage_exit', {id: stageIdx, reason: 'quit'}); goTitle(); };

// Platform requirement: leaving the app kills sound at once and freezes the bout.
document.addEventListener('visibilitychange', function(){
  if (document.hidden){
    audioSuspend();
    if (gameState === 'PLAYING' || gameState === 'READY' || gameState === 'ROUND_OVER'){
      if (activeScreen === null) togglePause(true);
    }
  } else {
    if (!muted) audioResume();
  }
});
window.addEventListener('blur', function(){ stopCharge(1); stopCharge(2); });

/* 결과 화면 통계 숫자 카운트업(0→값, 700ms, 의존성 0). showResultScreen()/showScreen() 은 로직 파일이라
   건드리지 않고, #sc-result 의 hidden 클래스가 벗겨지는 순간을 MutationObserver 로 잡는다. UI 전용. */
(function(){
  const sc = $('sc-result'); if (!sc || typeof MutationObserver === 'undefined') return;
  let raf = 0;
  function run(){
    const els = Array.prototype.slice.call(sc.querySelectorAll('.statrow .v'));
    const jobs = [];
    els.forEach(function(el){
      const txt = el.textContent, m = /^(\d+)(%?)$/.exec(txt.trim());
      if (!m) return;
      jobs.push({el:el, n:+m[1], suf:m[2], txt:txt});
    });
    if (!jobs.length) return;
    const t0 = performance.now();
    if (raf) cancelAnimationFrame(raf);
    function step(now){
      const k = Math.min(1, (now - t0)/700), e = 1 - Math.pow(1 - k, 3);
      jobs.forEach(function(j){ j.el.textContent = Math.round(j.n*e) + j.suf; });
      if (k < 1) raf = requestAnimationFrame(step); else { raf = 0; jobs.forEach(function(j){ j.el.textContent = j.txt; }); }
    }
    raf = requestAnimationFrame(step);
  }
  let wasHidden = sc.classList.contains('hidden');
  new MutationObserver(function(){
    const hid = sc.classList.contains('hidden');
    if (wasHidden && !hid) run();
    wasHidden = hid;
  }).observe(sc, {attributes:true, attributeFilter:['class']});
})();
let lastTime = performance.now();
function gameLoop(now){
  requestAnimationFrame(gameLoop);
  let dt = (now - lastTime)/1000;
  lastTime = now;
  if (dt > 0.1) dt = 0.1;
  if (!paused){
    let scaleT = 1;
    if (slowmo > 0) scaleT = 0.34 + Math.max(0, (1 - slowmo/1.15))*0.5;
    update(dt*scaleT);
  }
  draw();
  frameHUD();
  if ((frameNo++ & 31) === 0) checkResize();
}
let frameNo = 0;

/* 트랙K 긴급수정(2026-08-03): 부트 시퀀스 개별 try/catch 격리. initLang/applyLang
   (renderTitle 등)이 하나라도 던지면 원래는 그 아래 showScreen/requestAnimationFrame
   까지 통째로 실행되지 않아 게임 렌더 루프 자체가 시작 안 되는 구조였다(피고지고
   사고에서 발견, 4종 공통 구조라 여기도 동일 위험). 각 단계를 감싸 하나가 실패해도
   화면전환·렌더루프 시작은 반드시 실행되게 한다. [가설 수정 — 실기기 확인 필요] */
try{loadSave()}catch(e){console.error("[boot] loadSave failed",e)}
try{
  diff = Math.max(0, Math.min(2, SAVE.diff|0));
  applyChar(P1, CHARS[0]); applyChar(P2, CHARS[1]);
  curArena = ARENAS[Math.floor(Math.random()*6)];
}catch(e){console.error("[boot] char/arena init failed",e)}
try{initLang()}catch(e){console.error("[boot] initLang failed",e)}
try{applyLang()}catch(e){console.error("[boot] applyLang failed",e)}
resizeCanvas();
showScreen('sc-title');
requestAnimationFrame(gameLoop);
