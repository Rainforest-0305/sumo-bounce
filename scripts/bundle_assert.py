# -*- coding: utf-8 -*-
"""
.ait «실물» 단언 — 검사기(ait_scan_promo)와 «독립»된 두 번째 눈. (2026-09-10 레인 E)

  python scripts/bundle_assert.py <file.ait>

왜 따로 두나: 레인 A 리뷰 지적 「소스는 고쳤는데 제출용 .ait 는 변경 전 패키지였다」.
검사기 하나가 통과했다는 사실은 «그 검사기가 본 파일»에 대해서만 참이다. 이 스크립트는
zip 을 직접 열어 web/ 안의 «문자열 사실»만 센다 — 판정 로직을 공유하지 않으므로 같은 이유로 같이 죽지 않는다.

⛔통과 여부는 «종료코드»로 나온다(0=PASS, 1=FAIL). 화면만 보고 넘기지 마라.
"""
import io
import re
import sys
import zipfile

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

ESC = re.compile(r"\\u([0-9a-fA-F]{4})")

DOC = 'web/privacy.html'

# ★2026-09-10 Codex 리뷰 결함 5 — «어디서» 세는지를 명시한다.
#   예전엔 web/ 전체를 «합친» 문자열 하나에서만 셌다. 그래서 방침에서 저장 키를 지우고 JS 에만 남겨도
#   숫자가 그대로라 위반이 0 으로 나왔다 — 「두 번째 눈」이 이 축에서는 눈을 감고 있었다.
#   scope: 'doc'  = 방침 문서(web/privacy.html)에서만 센다      → «고지»를 본다
#          'code' = 방침을 «뺀» 나머지 web/ 파일에서만 센다      → «배선»을 본다
#          'any'  = web/ 전체(지면 ID·금칙 표식처럼 어디에 있든 문제인 것)
# (패턴, scope, 기대 횟수 또는 (최소,최대), 설명)
EXPECT = [
    ('ait.v2.live.XXXXXXXXXXXXXXXX', 'any', 0, '제거된 경기장 상단 배너 지면'),
    ('ait.v2.live.XXXXXXXXXXXXXXXX', 'any', 0, '제거된 경기장 하단 배너 지면'),
    ('arena-ad-', 'any', 0, '삭제된 경기장 배너 호스트 id'),
    ('data-ad-arena', 'any', 0, '삭제된 경기장 배너 DOM 속성'),
    ('ait.v2.live.XXXXXXXXXXXXXXXX', 'any', 1, '시작화면 배너 지면(#ad-slots)'),
    ('ait.v2.live.XXXXXXXXXXXXXXXX', 'any', 1, '전면형 지면(무접촉)'),
    ('ait.v2.live.XXXXXXXXXXXXXXXX', 'any', 1, '부활 리워드 지면(무접촉)'),
    # ── 배선(코드) 축 ─────────────────────────────────────────────
    ('intoss://moneyleague', 'code', 1, '교차추천 딥링크가 «코드»에 실렸다'),
    ('sb-xpromo', 'code', (1, 99), '교차추천 카드 DOM id'),
    ('sumobounce.xpromo.v1', 'code', (1, 99), '교차추천 저장 키를 «코드»가 쓴다'),
    ('ad_guard_blocked', 'code', (1, 99), '신규 요청 가드 계측(방문 상태기계가 실렸다는 증거)'),
    # ── 고지(방침) 축 ─────────────────────────────────────────────
    # ★선언은 «선언 줄 전체»로 센다. 토큰 조각(rewardAds=on)만 세면 산문이 옛 값을 «인용»하기만 해도 숫자가 흔들린다
    #   (실측 2026-09-10: 변경 이력 문장에 옛 값을 인용했다가 이 검사가 잡았다 — 기계 판독 토큰은 문서에 «한 벌»만 있어야 한다).
    ('<!-- SDK-DECLARE: ads=on analytics=on rewardAds=on -->', 'doc', 1, '방침 기계 판독 선언(보상형 광고 있음) 정확히 1개'),
    ('rewardAds=off', 'any', 0, '옛 오기 선언·그 인용이 번들 어디에도 남아 있으면 안 된다'),
    ('rewardAds=', 'doc', 1, '기계 판독 토큰은 방침 전체에 «한 벌»뿐이어야 한다'),
    ('sumo:ads.v2', 'doc', (1, 99), '방침이 실제 광고 카운터 키를 «고지»한다'),
    ('sumobounce.revive.v1', 'doc', (1, 99), '방침이 부활 리워드 하루 사용 기록 키를 고지한다'),
    ('sumobounce.xpromo.v1', 'doc', (1, 99), '방침이 교차추천 기록 키를 «고지»한다'),
    ('sumo:promo.v1:', 'doc', (1, 99), '방침이 이벤트 보상 지급 기록 키를 고지한다'),
    ('sumo:promo.plays.v1:', 'doc', (1, 99), '방침이 5판 이벤트 지급 기록 키를 고지한다'),
    ('sumo:localAnonId', 'doc', (1, 99), '방침이 로컬 임시 식별자를 고지한다'),
    # ── 금칙 ─────────────────────────────────────────────────────
    ('TESTONLY', 'any', 0, '개발용 표식'),
    ('TEST_01M16Q', 'any', 0, '프로모션 TEST_ 코드(다이묘진)'),
    ('TEST_01M1DTT3', 'any', 0, '프로모션 TEST_ 코드(5판)'),
]


def read_web(z):
    """web/ 엔트리를 «파일별»로 읽는다. 엔트리명은 정규화한다(.ait 는 Windows 에서 만들어져 역슬래시다)."""
    per_file = {}
    for n in z.namelist():
        nn = n.replace('\\', '/')
        if not nn.startswith('web/') or nn.endswith('.map'):
            continue
        try:
            per_file[nn] = ESC.sub(lambda m: chr(int(m.group(1), 16)), z.read(n).decode('utf-8', errors='replace'))
        except Exception:
            continue
    return per_file


def judge(per_file, verbose=True):
    """EXPECT 를 scope 별로 판정한다. 반환 = 실패 목록."""
    doc_txt = per_file.get(DOC, '')
    code_txt = ''.join(v for k, v in per_file.items() if k != DOC)
    all_txt = doc_txt + code_txt
    fails = []
    for pat, scope, want, why in EXPECT:
        hay = {'doc': doc_txt, 'code': code_txt, 'any': all_txt}[scope]
        n = hay.count(pat)
        if isinstance(want, tuple):
            ok = want[0] <= n <= want[1]
            want_s = '%d~%d' % want
        else:
            ok = n == want
            want_s = str(want)
        where = ','.join(sorted(k for k, v in per_file.items() if pat in v)) or '-'
        if verbose:
            print('  %-52s [%-4s] %3d  (기대 %-5s) %s   %s' % (pat[:52], scope, n, want_s, 'OK ' if ok else 'FAIL', why))
        if not ok:
            fails.append('%s [%s]: %d회 (기대 %s) — %s [위치 %s]' % (pat, scope, n, want_s, why, where))
    # 자기검사: 이 스크립트가 실제로 «세고 있는가». 확실히 존재하는 문자열이 0이면 읽기 자체가 깨진 것이다.
    if all_txt.count('<!DOCTYPE') < 1 or len(all_txt) < 100000:
        fails.append('자기검사 실패 — web/ 내용을 제대로 못 읽었다(%d B)' % len(all_txt))
    if not doc_txt:
        fails.append('자기검사 실패 — 번들에서 %s 를 못 읽었다(엔트리명 정규화 확인)' % DOC)
    return fails


def selftest(per_file):
    """★양성대조 — 「방침에서만 지우고 코드엔 남긴다」를 잡는가(결함 5의 형태)."""
    cases = []
    # (1) 방침에서 저장 키 한 개를 지운다. 코드에는 그대로 있다 → «고지» 축이 잡아야 한다.
    v1 = dict(per_file)
    v1[DOC] = v1[DOC].replace('sumobounce.xpromo.v1', 'xxxxx')
    cases.append(('방침에서만 저장 키 삭제(코드엔 유지)', bool(judge(v1, verbose=False))))
    # (2) 방침에서 선언을 지운다 → 선언 축이 잡아야 한다.
    v2 = dict(per_file)
    v2[DOC] = v2[DOC].replace('<!-- SDK-DECLARE: ads=on analytics=on rewardAds=on -->', '')
    cases.append(('방침에서 SDK-DECLARE 삭제', bool(judge(v2, verbose=False))))
    # (3) 코드에서 딥링크를 지운다(방침은 그대로) → «배선» 축이 잡아야 한다.
    v3 = {k: (v.replace('intoss://moneyleague', 'intoss://xxxx') if k != DOC else v) for k, v in per_file.items()}
    cases.append(('코드에서 딥링크 삭제(방침 무관)', bool(judge(v3, verbose=False))))
    # (4) 음성대조 — 원본은 조용해야 한다.
    cases.append(('음성대조: 원본은 위반 0', not judge(per_file, verbose=False)))
    return cases


def main():
    path = sys.argv[1]
    z = zipfile.ZipFile(path)
    per_file = read_web(z)
    print('[bundle_assert] %s  web/ 엔트리 %d개' % (path, len(per_file)))
    fails = judge(per_file)
    st = selftest(per_file)
    for name, caught in st:
        print('  양성대조 %-34s %s' % (name, '잡음' if caught else '★못 잡음'))
    if not all(c for _, c in st):
        fails.append('양성대조 실패 — 이 검사기 자체가 죽어 있다(그 결과를 근거로 쓰지 마라)')
    if fails:
        print('[bundle_assert] FAIL')
        for f in fails:
            print('  - ' + f)
        sys.exit(1)
    print('[bundle_assert] PASS — 번들 실물이 소스 변경과 일치한다(고지 축·배선 축 각각 확인)')


if __name__ == '__main__':
    main()
