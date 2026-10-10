# -*- coding: utf-8 -*-
"""
.ait 프로모션 훅 검사기 — 스모 바운스 「다이묘진 해금하기」 30원 (2026-08-29)
«0건은 부재의 증거가 아니다» — L2 양성대조 내장.

  python scripts/ait_scan_promo.py <file.ait> --mode canon
  python scripts/ait_scan_promo.py <file.ait> --mode testonly

  검사표                                        canon      testonly
    __PROMOTION_CODE__ (bare, TEST_ 미접두)  >=1        == 0
    TEST_01M16Q                                   == 0       >=1
    지급 문턱 `const PROMO_DAIMYOJIN_STAGE = N;`     N == 8     N == 1
    data-promo-daimyojin-amount="30"              == 1       == 1
    grantPromotionReward (web/assets)             >=1        >=1
    __sumoPromoUnlock (game js + assets)          >=2        >=2
    광고 지면 ID 4종 == 라이브(20260824-15)          동일       동일
    부팅 소급: web/assets 에 installPromoHook 다음에 claim 호출이 없다 — 정적으로는 못 본다(주석 참고)

  함정 대응
    trap 1: .ait 은 zip → raw grep 무효. 풀어서 본다.
    trap 2: `TEST_` 만 찾으면 광고 SDK 의 TEST_MODE 가 잡힌다 → `TEST_01M16Q` 로 찾는다.
    trap 3: TEST_ 코드는 bare 코드를 «포함»한다 → bare 카운트는 (?<!TEST_) 로 센다.
    trap 4: RN 번들은 «셸»이라 앱 로직이 없다 → web/ 를 본다. 그래도 전 엔트리를 훑는다.
    trap 5: 검사기 자체가 죽어 있을 수 있다 → L2: 실제 .ait 를 «변조한 가짜 zip»을 같은 함수에 태워
            불합격이 나는지(양성), 원본은 통과하는지(음성) 본다.
"""
import io
import re
import sys
import zipfile

try:  # Windows 콘솔(cp949)에서 한글·특수문자 출력 깨짐/예외 방지
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

CODE = '__PROMOTION_CODE__'
TEST_PREFIX = 'TEST_01M16Q'
BARE_RE = re.compile(r'(?<!TEST_)' + CODE)
# 산출물 game.js 는 terser(compress:false, mangle:false)로 공백만 빠진다 → `const PROMO_DAIMYOJIN_STAGE=8;` 형태
STAGE_RE = re.compile(r'const PROMO_DAIMYOJIN_STAGE\s*=\s*(\d+);')
AD_RE = re.compile(r'ait\.v2\.live\.[0-9a-f]{16}')
# 라이브 20260824-15(deploymentId 01a02f84-…) web/ 실측 + 콘솔 iaa_placement_group_list 4종 ENABLED (2026-08-29)
# -- 2026-09-10 레인 E(광고 시청률 7.6% 대책): 경기장 상·하 배너 2종은 «제거». REMOVED_ADS 로 옮겨 «번들 0회»를 강제한다.
LIVE_ADS = {
    'ait.v2.live.XXXXXXXXXXXXXXXX',  # 전면형(interstitial) — web/assets
    'ait.v2.live.XXXXXXXXXXXXXXXX',  # 시작화면하단 배너 — web/index.html data-ad-start-bottom
}
# 제거된 지면 — 번들 어디에도 «0회». 1회라도 나오면 「호출만 뺐고 ID 는 실려 나간」 상태다(콘솔 지면 삭제는 Partner).
REMOVED_ADS = {
    'ait.v2.live.XXXXXXXXXXXXXXXX': '경기장상단 배너 - src/arenaBanner.ts 삭제(2026-09-10)',
    'ait.v2.live.XXXXXXXXXXXXXXXX': '경기장하단 배너 - src/arenaBanner.ts 삭제(2026-09-10)',
}
# 정확히 1회여야 하는 지면(파일 한 곳). 0=배선 끊김 / 2+=복사됨.
EXACT_ONE_ADS = {
    'ait.v2.live.XXXXXXXXXXXXXXXX': '시작화면하단 배너 - web/index.html #ad-slots',
}
# 교차추천(2026-09-10 레인 E): 「머니 리그」 딥링크가 web/assets 에 «있어야» 한다(양성). 웹 산출물엔 0 이어야 하지만 그건 이 검사기 범위 밖.
DEEPLINK = 'intoss://moneyleague'
# -- 2026-08-31 추가 승인 (Partner) ---------------------------------------------
# 부활 리워드 지면. Partner 가 오늘 토스 콘솔에서 직접 생성한 정식 지면이다
# (REWARDED, 보상 단위 부활권 1). src/reviveAd.ts 의 REVIVE_AD_GROUP_ID 정본과 같아야 한다.
# * 뱀(tools/scan_ads.mjs)과 같은 엄격도로 넣는다 -- 목록에 있음만이 아니라
#   번들 내 등장 횟수까지 1회로 고정한다. 지면ID 는 파일 한 곳에만 있어야 하므로
#   2회 이상 나오면 복사됐다는 뜻이고, 0회면 트리셰이킹으로 배선이 끊겼다는 뜻이다.
NEW_ADS = {
    'ait.v2.live.XXXXXXXXXXXXXXXX': '부활 1회 리워드 - src/reviveAd.ts',
}
LIVE_ADS_ALL = LIVE_ADS | set(NEW_ADS)

EXPECT_STAGE = {'canon': '8', 'testonly': '1'}
ESC = re.compile(r"\\u([0-9a-fA-F]{4})")


def unescape(s):
    return ESC.sub(lambda m: chr(int(m.group(1), 16)), s)


def scan(src):
    z = zipfile.ZipFile(io.BytesIO(src) if isinstance(src, bytes) else src)
    r = {'bare': 0, 'test': 0, 'stages': [], 'amount30': 0, 'grant': 0, 'hook': 0, 'ads': set(), 'ads_n': {},
         'entries': 0, 'web_entries': [], 'hits': [], 'cond_hook': 0, 'uncond_hook': 0, 'deeplink': 0}
    for n in z.namelist():
        if n.endswith('.map'):
            continue
        r['entries'] += 1
        u = unescape(z.read(n).decode('utf-8', errors='replace'))
        if n.startswith('web/'):
            r['web_entries'].append(n)
        b = len(BARE_RE.findall(u))
        t = u.count(TEST_PREFIX)
        if b or t:
            r['hits'].append((n, b, t))
        r['bare'] += b
        r['test'] += t
        r['stages'] += STAGE_RE.findall(u)
        r['amount30'] += u.count('data-promo-daimyojin-amount="30"')
        r['grant'] += u.count('grantPromotionReward')
        r['hook'] += u.count('__sumoPromoUnlock')
        # 정본 = 문턱 조건부 호출 / TESTONLY = 승리 시 무조건 호출(President 08-29). terser 공백 제거 형태로 센다.
        r['cond_hook'] += u.count('if(prevCleared<PROMO_DAIMYOJIN_STAGE&&SAVE.cleared>=PROMO_DAIMYOJIN_STAGE)promoNotifyDaimyojinUnlock()')
        r['uncond_hook'] += u.count('persist();promoNotifyDaimyojinUnlock()')
        found = AD_RE.findall(u)
        r['ads'] |= set(found)
        for _id in found:
            r['ads_n'][_id] = r['ads_n'].get(_id, 0) + 1
        if n.startswith('web/'):
            r['deeplink'] += u.count(DEEPLINK)
    return r


def judge(r, mode):
    f = []
    if mode == 'canon':
        if r['bare'] < 1: f.append(f"bare 코드 0건 (>=1 필요)")
        if r['test'] != 0: f.append(f"TEST_ 코드 {r['test']}건 (0 필요) ← 검수 사고")
    else:
        if r['bare'] != 0: f.append(f"bare 코드 {r['bare']}건 (0 필요)")
        if r['test'] < 1: f.append("TEST_ 코드 0건 (>=1 필요)")
    if r['stages'] != [EXPECT_STAGE[mode]]:
        f.append(f"지급 문턱 {r['stages']} (기대 [{EXPECT_STAGE[mode]}])")
    if mode == 'canon' and (r['cond_hook'], r['uncond_hook']) != (1, 0):
        f.append(f"정본 훅이 조건부여야 한다: cond={r['cond_hook']} uncond={r['uncond_hook']}")
    if mode == 'testonly' and (r['cond_hook'], r['uncond_hook']) != (0, 1):
        f.append(f"TESTONLY 훅이 무조건이어야 한다: cond={r['cond_hook']} uncond={r['uncond_hook']}")
    if r['amount30'] != 1: f.append(f"amount=30 속성 {r['amount30']}건 (1 필요)")
    if r['grant'] < 1: f.append("grantPromotionReward 0건 — 브릿지가 안 실림")
    if r['hook'] < 2: f.append(f"__sumoPromoUnlock {r['hook']}건 (game js + assets >=2)")
    if r['ads'] != LIVE_ADS_ALL:
        f.append(f"광고 지면 ID 불일치: 번들={sorted(r['ads'])} 허용={sorted(LIVE_ADS_ALL)}")
    for _id, _why in sorted(REMOVED_ADS.items()):
        _n = r['ads_n'].get(_id, 0)
        if _n != 0:
            f.append(f"제거 지면 {_id} ({_why}) {_n}회 (0 필요 - 호출만 뺐고 ID 가 실려 나간다)")
    for _id, _why in sorted(list(NEW_ADS.items()) + list(EXACT_ONE_ADS.items())):
        _n = r['ads_n'].get(_id, 0)
        if _n != 1:
            f.append(f"지면 {_id} ({_why}) {_n}회 (정확히 1회 필요 - 0=배선끊김 / 2+=복사됨)")
    if r['deeplink'] < 1: f.append(f"교차추천 딥링크 {DEEPLINK} 0건 — crossPromo.ts 배선이 번들에 없다(트리셰이킹/shim 오적용)")
    if not any(n == 'web/index.html' for n in r['web_entries']): f.append('web/index.html 없음')
    return f


def mutate(src, old, new):
    zin = zipfile.ZipFile(io.BytesIO(src))
    out = io.BytesIO()
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zo:
        for n in zin.namelist():
            d = zin.read(n)
            if not n.endswith('.map'):
                d = d.replace(old.encode(), new.encode())
            zo.writestr(n, d)
    return out.getvalue()


def selftest(src, mode):
    """L2 양성대조 — 같은 scan/judge 에 «변조본»을 태워 불합격이 나야 한다."""
    other = 'testonly' if mode == 'canon' else 'canon'
    cases = []
    # (1) 코드 접두 뒤집기 → 반대 모드 판정이 «잡아야» 한다
    if mode == 'canon':
        m1 = mutate(src, CODE, 'TEST_' + CODE)
    else:
        m1 = mutate(src, 'TEST_' + CODE, CODE)
    cases.append(('코드 접두 변조', bool(judge(scan(m1), mode))))
    # (2) 문턱 변조
    m2 = mutate(src, f"const PROMO_DAIMYOJIN_STAGE={EXPECT_STAGE[mode]};", "const PROMO_DAIMYOJIN_STAGE=5;")
    cases.append(('문턱 변조(5)', bool(judge(scan(m2), mode))))
    # (3) 광고 지면 ID 변조(미출시 지면이 섞인 상황)
    m3 = mutate(src, 'ait.v2.live.XXXXXXXXXXXXXXXX', 'ait.v2.live.XXXXXXXXXXXXXXXX')
    cases.append(('광고 지면 변조', bool(judge(scan(m3), mode))))
    # (4) 훅 제거
    m4 = mutate(src, '__sumoPromoUnlock', '__sumoPromoXXXXXX')
    cases.append(('훅 제거', bool(judge(scan(m4), mode))))
    # (5) 반대 모드로 원본 판정 → 불합격이어야(모드 구분이 산다)
    cases.append((f'원본을 {other} 로 판정', bool(judge(scan(src), other))))
    # (6) 2026-09-10 제거 지면 «재주입» — 시작 배너 ID 를 경기장 상단 ID 로 바꾼 사본은 두 검사(제거 0회·시작 1회) 모두에 걸려야 한다
    m6 = mutate(src, 'ait.v2.live.XXXXXXXXXXXXXXXX', 'ait.v2.live.XXXXXXXXXXXXXXXX')
    cases.append(('제거 지면 재주입', bool(judge(scan(m6), mode))))
    # (7) 교차추천 딥링크 변조 → 「배선 없음」으로 잡혀야 한다
    m7 = mutate(src, DEEPLINK, 'intoss://xxxxxxxxxxx')
    cases.append(('딥링크 변조', bool(judge(scan(m7), mode))))
    return cases


def main():
    path = sys.argv[1]
    mode = sys.argv[sys.argv.index('--mode') + 1] if '--mode' in sys.argv else 'canon'
    src = open(path, 'rb').read()
    r = scan(src)
    print(f"[ait_scan_promo] {path} mode={mode} entries={r['entries']} web={len(r['web_entries'])}")
    print(f"  bare={r['bare']} test={r['test']} stage={r['stages']} amount30={r['amount30']} grant={r['grant']} hook={r['hook']} deeplink={r['deeplink']}")
    print(f"  ads={sorted(r['ads'])} ads_n={dict(sorted(r['ads_n'].items()))}")
    for n, b, t in r['hits']:
        print(f"  hit {n}: bare={b} test={t}")
    st = selftest(src, mode)
    ok_st = all(v for _, v in st)
    for name, v in st:
        print(f"  L2 양성대조 {name}: {'잡음' if v else '★못 잡음'}")
    f = judge(r, mode)
    if f or not ok_st:
        print('[ait_scan_promo] FAIL')
        for x in f:
            print('  - ' + x)
        if not ok_st:
            print('  - L2 양성대조 실패 — 검사기 자체가 죽어 있다')
        sys.exit(1)
    print(f'[ait_scan_promo] PASS ({mode})')


if __name__ == '__main__':
    main()
