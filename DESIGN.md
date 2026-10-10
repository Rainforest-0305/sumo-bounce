---
name: Sumo Bounce — 등롱 아래 도효 (lantern-lit dohyo)
surface: game (canvas ring + HTML overlay UI), mobile portrait first
reference: Ketchapp-grade 2D (Rider/네온 스레드 파일럿 기준) × 스모 흥행 포스터 — 먹빛 밤, 등롱 불빛, 붉은 마와시
mode: Experience (링이 주인공) / Operate (메뉴·선택·결과)
starting-point: awesome-design → cinematic 계열 구조(검정 무대 + 한 번의 강조색, 숫자는 크게, 라벨은 작게 트래킹) — 브랜드 토큰은 가져오지 않음. 색은 아래 정의.
colors:
  ink-0: "#0e0a0b"          # 먹(墨) — 페이지·HUD 판·실루엣 근경
  ink-1: "#181113"          # 카드
  ink-2: "#241a1d"          # 카드 hover / 세그 on
  black: "#070405"          # 비네트·상단/하단 띠·근경 실루엣 최심
  paper: "#f6efe6"          # 본문 잉크(따뜻한 흰색)
  sub: "#c2b5a8"            # 보조 텍스트  (on ink-0 8.9:1)
  dim: "#958779"            # 라벨·3차   (on ink-0 5.1:1)
  lantern: "#ffc94a"        # PRIMARY — 등롱 금. CTA·강조·타이머·연속일·클리어 표시
  lantern-deep: "#ff9d2e"   # 등롱 심지(따뜻한 오렌지) — 그라데이션 하단, 불꽃
  vermilion: "#ff5a5f"      # P1·위험·경고 (기존 faction 색 «유지» — 유저가 배운 신호)
  indigo: "#4a9eff"         # P2·차가움·「쉬움」 (기존 faction 색 «유지»)
  ink-on-lantern: "#241703" # 금 위의 잉크 (on lantern 9.6:1)
  line: "rgba(255,236,214,.09)"
  dim2: "#a89a8c"           # 게이지 라벨·잠금 배지 (on card 5.6:1)
  paper-05: "rgba(255,236,214,.05)"   # 칸·트랙 바탕(흰색 알파 대신 «종이색» 알파)
  paper-06: "rgba(255,236,214,.06)"
  paper-07: "rgba(255,236,214,.07)"
  paper-08: "rgba(255,236,214,.08)"
  paper-09: "rgba(255,236,214,.09)"
  paper-10: "rgba(255,236,214,.10)"
  paper-13: "rgba(255,236,214,.13)"
  lantern-hi: "#ffd35c"     # CTA 그라데이션 위
  lantern-lo: "#ffb42e"     # CTA 그라데이션 아래
  lantern-tint: "#ffe9a8"   # 규칙 칩(hot) 텍스트
  lantern-shadow: "#8a4a00" # 「승리」 오프셋 그림자
  vermilion-tint: "#ff9297" # P1 배지 텍스트
  vermilion-deep: "#a52a2c" # 타이틀 오프셋 그림자
  vermilion-shadow: "#5a1113" # VS 오프셋 그림자
  indigo-tint: "#8cc4ff"    # P2 배지 텍스트
  indigo-tint2: "#9fd0ff"   # P2 게이지 끝
  indigo-light: "#7fc0ff"   # 연습 배지 그라데이션
  ink-on-indigo: "#0e1a2e"
  plate-cue: "rgba(46,32,36,.97)"     # 스크롤 큐 판
  plate-hover: "rgba(52,36,40,.95)"   # 언어/링크 hover
  plate-88: "rgba(14,10,11,.88)"      # HUD 상·하 판
  overlay-lock: "rgba(12,7,8,.58)"
  card-shadow: "0 14px 28px -12px rgba(0,0,0,.6)"   # 오프셋 있는 중립 그림자만. 색 헤일로 ⛔
typography:
  display: '"Anton", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif'   # 숫자·영문·VS·READY (Google Fonts, OFL 1.1, latin 서브셋 self-host 18.6KB)
  body: '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Segoe UI", Roboto, "Noto Sans KR", "Malgun Gothic", sans-serif'
  weights: 한글 700/800(900 남발 금지) · Anton 400 단일
  numerals: tabular
rounded: { control: 16px, card: 22px, chip: 999px, cell: 10px }
spacing: 4px base (8 / 12 / 16 / 24)
glow:
  bloom-threshold: 0.80   # luminance 이하는 «절대» 안 번짐 — 하늘·바닥·선수 몸통·피부·눈 흰자(.79)·HUD 판 (2026-08-30 .66→.80: 핵심 오브젝트를 문턱에서 멀리)
  bloom-knee: 0.14        # soft-knee [.80,.94) — 트림 선·링 코어선(부분), 흰 코어·트레일·스파크(≥.94)만 완전 번짐
  bloom-tight: 0.55       # 1/4-res — 뜨거운 가장자리 (링·차지링·스파크)
  bloom-wide: 0.40        # 1/8-res — 헤일로 (등롱·석양)
  quality: 3단계(2 = bright 4×4→1/4 블러(타이트)+1/8 블러(와이드) · 1 = 4×4→1/8 와이드만 · 0 = 8×8→1/8 와이드만) + off. 22ms 초과 25%/90프레임이면 한 단계 강등
  bright-pass: «다운샘플 전» 원본 텍셀 각각에 soft-knee → N×N 평균(위상 무관, 에너지 = 덮는 면적 비례). 평균 뒤 문턱 ⛔
  precision: highp(GL_FRAGMENT_PRECISION_HIGH) · 전해상도 샘플 좌표 gl_FragCoord · scene 텍스처 NEAREST(1:1 복사)
  hysteresis: 단계 최소 체류 8s · 승격은 15s 조용(22ms 초과 <5/90) 뒤 · 세션당 승격 ≤2 · off 는 1회 불가역(컨텍스트 손실 포함)
  crossfade: 400ms — 블룸 가중치 k1/k2·파티클 상한·배경 동적 레이어(개수+알파) 보간, 페이드 중엔 비싼 경로로 렌더
  canvas-dpr: 플레이 중 변경 금지(런 시작 값 고정, 리사이즈는 라운드 종료·일시정지 때 적용)
  canvas-shadowBlur: 0 when bloom on (폴백에서만 6–16px)
particles:
  pool: 320 objects (부팅 1회 할당, 런타임 push 는 «풀 객체 재사용»)
  dots: 2/3 — 충돌 먼지·바닥 먼지, 1.4–4px, 감쇠 .95/frame
  sparks: 1/3 — 속도 방향 스트릭(길이 = 속도×3.2), 흰 코어 + 아레나 팔레트 틴트, 짧게(.2–.45s)
  rings: 충돌 충격파 2겹(흰 코어 + 팔레트), 링아웃 «흙먼지 링»
  confetti: 기존(승리) 유지
---

# Sumo Bounce — DESIGN.md (그래픽 고도화, 2026-08-30)

## 1. 세계관 한 줄
「먹빛 밤, 등롱 불빛 아래 도효 — 링 하나가 빛나고 나머지는 어둡다.」
스모의 힘은 «무게»와 «정적»이다. 배경은 가라앉고(실루엣·먹), 빛은 링과 등롱과 충돌
순간에만 있다. 네온 파일럿의 규율(3색+검정, 문턱 아래 무번짐, 풀 할당 0)을 그대로 쓰되
색은 «따뜻한 대비»로: 등롱 금 + 주홍 + 남색 + 먹.

## 2. 팔레트 규율 — 3색 + 검정
| 역할 | 토큰 | 값 | 쓰는 곳 |
|---|---|---|---|
| 검정(먹) | `ink-0`/`black` | #0e0a0b / #070405 | 페이지·HUD 판·비네트·근경 실루엣 |
| 주 강조 | `lantern` | #ffc94a | CTA·타이머·연속일·클리어·READY·결과 「승리」 |
| 열 신호 | `vermilion` | #ff5a5f | P1·위험(함정·급속축소)·「어려움」 |
| 냉 신호 | `indigo` | #4a9eff | P2·「쉬움」·순찰 가드 |

- 아레나 12개의 하늘·바닥 색은 «유지»한다(유저가 익힌 장소 정체성). 대신 «빛나는 것»은
  아레나 boundary(링 색) + 등롱 금 + 흰 코어뿐이다. 4번째 계열(민트·보라·초록)은 UI 에서
  «퇴역»: 초록(`--ok`)→남색, 보라(`--vio`)→등롱 금 틴트.
- 캐릭터 10명의 색은 유저 정체성이라 유지(화면에서 가장 작은 면적).
- 색이 곧 정보: 빨강=아래쪽 플레이어/위험, 파랑=위쪽 플레이어/보상없는 냉기, 금=진행·보상.

## 3. 글로우(블룸) 규칙
- 후처리 한 장(WebGL, `public/game/sumo-post.js`). 캔버스 `shadowBlur` 는 블룸 켜지면 «0».
- 문턱(luminance .80, soft-knee .14) 아래는 «절대» 번지지 않는다 → 하늘·바닥 무늬·선수 몸통·피부·눈 흰자·얼굴판·이름표는 또렷.
  흰 코어(차지 링·조준 화살·스파크·트레일·등롱 심지·흰 충격파, lum ≥ .94)만 완전히 번지고, 링 코어선·트림 선(.84~.93)은 부분.
  감사표: `_gfx_evidence_260830/lum_audit.json`(85색) — 핵심 오브젝트(선수 10명 몸통·피부·마와시, 눈)는 전부 문턱 아래.
- 실기기 교훈 반영: scene 캔버스 DPR 상한 2(기존) · bright-pass 는 1/2 해상도부터 ·
  동적 품질 3단계(블룸 해상도 → 파티클 상한 → 배경 동적 레이어 수).
- 단계 전환 규율(2026-08-30, 네온 -22 「깜빡거려」 사고): 체류 ≥8s · 승격은 15s 조용 뒤·세션 ≤2회 · off 1회 불가역 ·
  전환 400ms 크로스페이드(블룸 가중치·파티클 상한·동적 레이어 개수+알파) · 배경 타일은 품질과 무관(재래스터 0) ·
  캔버스 크기·DPR 플레이 중 고정 · 포스트는 게임 루프 안 동기 호출(층 간 지연 0 실측) · 전환 로그 `SumoPost.log`.
- 눈 흰자 #ece5dc(lum .79)는 문턱(.80) 아래 — 번지지 않는다(`drawFace` 는 무접촉, 문턱 쪽을 옮겼다).
- 셰이더 규율(네온 3차 사고 이식, 2026-08-30 14시): bright-pass 는 «다운샘플 전» 텍셀별 soft-knee → 블록 평균(4×4 / 8×8), `highp`,
  `gl_FragCoord` 샘플링, scene NEAREST. 증거 `_gfx_evidence_260830/harness/out/flicker/` — 합성 이동선 8프레임 max/min 구판 L0 783×·블랙아웃 18 → 신판 전 단계 ≤1.34×·블랙아웃 0.

## 4. 배경 깊이 (정적 타일 캐시 1장 + 동적 소수)
1. 하늘 3색 그라데이션(기존) + 지평선 광(기존).
2. **원경 실루엣**(아레나 계열별: 산/지붕/빌딩/대나무/기둥) — 하늘 하단색→먹 2단계.
3. **관중석 층**: 스타디움 타원(기존) 바깥으로 «관중 점묘» 2줄(어두운 점, 등롱 색 하이라이트 소수).
4. **등롱 줄**: 화면 상단 좌우로 늘어진 줄 2가닥 + 등롱 5~7개(금 코어 = 문턱 위 → 블룸).
   우주·네온 계열은 등롱 대신 간판/행성 광원.
5. 위 1~4 + 스타디움 + 바닥 무늬(기존 12종) + 외곽 어둠을 **아레나·해상도별 1회 래스터**
   (`bgTile`) → 매 프레임 `drawImage` 1회. 동적 요소(별 트윙클·눈·꽃잎·불씨·비·번개)는
   «개수 절반» 으로 위에 얹고, 품질 0 에서는 «전부 끈다».

## 5. 주스(Juice)
| 항목 | 규칙 |
|---|---|
| 충돌 | 스파크(스트릭, 흰 코어) + 먼지 점 + 충격파 2겹 + 히트스톱(기존) + 흔들림(기존) + «%» 펀치 텍스트(디스플레이체, 팝 이징) |
| 돌진 | 트레일을 «가늘어지는 리본 1스트로크»(그라데이션) — 원 12개 shadowBlur 는 폐기 |
| 모으기 | 차지 링 회전 눈금 + 링 미터(금) + 바닥에 «힘 모으는 원형 파동» |
| 링아웃 | 흙먼지 링 + 팔레트 스파크 + 슬로모(기존) |
| 라운드 승 | 승자 주위 금 링 리플 2겹 + 기존 파티클 |
| HUD | 핍 채워질 때 팝(1.25→1, 320ms), 타이머 35% 이하 붉은 맥동, 게이지 풀차지 시 금 스트로크 |
| 결과 | 제목 팝(기존) + 통계 행 스태거 등장 + 숫자 카운트업(0→값, 700ms, 인라인 트윈, 의존성 0) |
| 풀 | 파티클 320 · 충격파 16 — 부팅 1회 할당, push 는 풀 객체 재사용 |

## 6. 타이포
- 디스플레이/숫자: **Anton 400**(OFL, latin 서브셋 self-host `public/fonts/anton-400-latin.woff2`,
  18,612 B). 한글은 시스템 폰트 폴백 — 숫자·영문·VS·READY/GO 만 디스플레이체.
- 한글 굵기: 제목 800, 본문 600~700. 900 은 쓰지 않는다(뭉개짐).
- 캔버스 HUD/애나운스도 같은 스택(`HUD_FONT`).

## 7. UI 오버레이 규칙(게임 제약)
- `backdrop-filter` ⛔ (기존 .lang-btn 의 blur 제거) — 불투명도로.
- 터치 타깃 ≥ 24 CSS px(Web WCAG 2.2 AA), 주요 버튼 ≥ 44.
- 대비 4.5:1 이상 — 실렌더 픽셀로 측정(`_gfx_evidence_260830/harness/harness.mjs contrast`).
- 그라데이션 텍스트 ⛔ · 제로오프셋 색 헤일로 ⛔ · 아이브로우(제목 위 라벨) ⛔ →
  라벨은 제목 «아래» 본문형 한 줄로. 카드의 라벨(오늘의 대결)은 «제목» 자체로 승격.
- 주 CTA = 등롱 금 그라데이션 + 잉크 #241703. 보조 = 반투명 먹판(유리 없음).

## 8. 출석표(오늘의 대결) UI
- 규칙·금액 «무접촉»(`claimAttendance`/`todaysFeatured` 바이트 동일). UI 만:
  7칸 스트립(1~6 = DAILY_POOL 상대, 7 = 특급/경기장 영구 등록), 받은 날 체크·오늘 강조·
  7번째 칸 크게(금 테두리), 캡션 「내일 오면 N일째 · …」. 연속 8일 이상은 «7+ 매일 특급».
- 옛 세이브(attendance 없음/부분) 는 기존 loadSave 보정을 그대로 탄다 — 표시만 읽는다.

## 9. 하지 않는 것
- 이미지 에셋 0장(배경·등롱·이펙트·선수 전부 코드). 3D 없음.
- 조작·물리·점수·해금·저장·프로모션·광고 지면 코드는 바이트 단위 무접촉(`scripts/check_logic_bytes.mjs`).
