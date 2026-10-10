# -*- coding: utf-8 -*-
"""
전면형 «정책 가드» 검사가 살아 있는가 — 상수를 «지운 사본»으로 증명한다. (2026-09-10 레인 E)

  python scripts/prove_ad_guards.py

무엇을 하나: `src/toss/interstitialAd.ts` 의 가드 상수 3개를 0(=끔)으로 바꾼 사본으로 «실제로 빌드»하고
하네스를 돌린다. 가드가 꺼졌으니 G1/G3/G5(차단 방향)가 «반드시» 실패해야 한다 → exit 1.
원본으로 되돌려 다시 빌드하면 exit 0.

⛔이걸 하는 이유: 「가드를 넣었다」는 말과 「가드가 검사되고 있다」는 다른 문장이다.
   상수를 지웠는데도 초록이면 그 검사는 죽은 것이고, 그때 초록은 근거가 되지 못한다.
⛔headless 전용. 끝나면 소스를 «반드시» 원복한다(finally).
"""
import os
import re
import shutil
import subprocess
import sys

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, 'src', 'toss', 'interstitialAd.ts')
BAK = os.path.join(ROOT, '_banner_xpromo_evidence_260910', 'interstitialAd.ts.provebak')
ENV = dict(os.environ, PYTHONIOENCODING='utf-8')

WEAKEN = [
    ('const MIN_SESSION_AGE_MS = 60_000;', 'const MIN_SESSION_AGE_MS = 0;'),
    ('const MIN_GAP_MS = 600_000;', 'const MIN_GAP_MS = 0;'),
    ('const DAILY_SHOW_CAP = 3;', 'const DAILY_SHOW_CAP = 0;'),
]


def run(cmd, **kw):
    return subprocess.run(cmd, cwd=ROOT, shell=True, capture_output=True, text=True,
                          encoding='utf-8', errors='replace', env=ENV, **kw)


def build():
    r = run('npx vite build --mode toss')
    if r.returncode != 0:
        print(r.stdout[-2000:])
        raise SystemExit('빌드 실패 — 증명 중단')


def harness():
    r = run('python scripts/verify_banner_headless.py --quick '
            '--baseline "_banner_xpromo_evidence_260910\\old_web" '
            '--out "_banner_xpromo_evidence_260910\\prove_guards.json"')
    tail = [ln for ln in (r.stdout or '').splitlines() if ' G1 ' in ln or ' G3 ' in ln or ' G5 ' in ln or ln.startswith('RESULT')]
    return r.returncode, tail


def main():
    os.makedirs(os.path.dirname(BAK), exist_ok=True)
    shutil.copyfile(SRC, BAK)
    try:
        src = open(SRC, encoding='utf-8').read()
        for a, _ in WEAKEN:
            if a not in src:
                raise SystemExit('대상 상수를 못 찾았다(이 증명이 낡았다): ' + a)
        weak = src
        for a, b in WEAKEN:
            weak = weak.replace(a, b)
        open(SRC, 'w', encoding='utf-8').write(weak)
        print('--- 약화 사본(가드 상수 3개 = 0)으로 빌드 후 하네스 ---')
        build()
        rc_weak, tail_weak = harness()
        for ln in tail_weak:
            print('   ' + ln.strip()[:150])
        print('   exit =', rc_weak)
    finally:
        shutil.copyfile(BAK, SRC)
        os.remove(BAK)
    print('--- 원본 복구 후 재빌드·하네스(대조군) ---')
    build()
    rc_ok, tail_ok = harness()
    for ln in tail_ok:
        print('   ' + ln.strip()[:150])
    print('   exit =', rc_ok)

    print()
    if rc_weak != 0 and rc_ok == 0:
        print('RESULT: PASS — 가드 상수를 지우면 exit %d, 원본은 exit %d. 이 검사는 «살아 있다».' % (rc_weak, rc_ok))
        sys.exit(0)
    print('RESULT: FAILED — 약화본 exit %d / 원본 exit %d (기대 !=0 / 0). 검사가 가드를 안 보고 있다.' % (rc_weak, rc_ok))
    sys.exit(1)


if __name__ == '__main__':
    main()
