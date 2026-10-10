/**
 * 빌드 산출물 주석 제거 키트 — 조직 내부 주석(트랙·Partner·President·Chief·
 * 무접촉·사고이력 등)이 «출하물»에 그대로 실려 나가는 걸 막는다.
 *
 * === 왜 필요한가 (실측, 2026-08-22) ===
 *   public/game/*.js 는 vite 의 publicDir 경로라 esbuild 번들/트랜스폼을
 *   "안 탄다" — 그래서 원본 그대로 dist 에 복사된다. 그 결과 스모는 373개
 *   주석·내부 표지 46개(트랙x20·Partnerx6·Presidentx6·무접촉x4·함정x3·
 *   Chiefx3)가 유저가 여는 최종 산출물에 그대로 노출됐다.
 *   index.html 도 두 갈래로 샌다:
 *     1) <script>/<style> 밖의 HTML 주석
 *     2) <style> 안에 인라인으로 박힌 CSS 의 블록 주석
 *        - 실측: 스모 index.html 은 CSS 를 <style> 인라인으로 갖고 있고
 *          52개 CSS 주석에 조직 표지가 그대로 있었다(트랙9·Partner3·
 *          President5·Chief1). 1)만 처리하면 안 잡힌다 - 별도 처리 필수.
 *   src/** 는 esbuild 기본 minify 를 거치므로 이미 코멘트가 0 이다
 *   (dist/assets/*.js 실측 확인 - sourceMappingURL 주석 1줄만 남음, 정상).
 *
 * === 절대 하지 마라 - 정규식 통짜 제거 ===
 *   블록/라인 주석을 정규식 하나로 지우면 문자열 리터럴·정규식 리터럴·
 *   URL(https://) 안의 슬래시-슬래시를 같이 먹어 조용히 코드가 깨진다
 *   (에러 없이). 그래서:
 *     - JS   -> terser 의 진짜 파서에 맡긴다(compress:false, mangle:false,
 *              format:{comments:false} - 압축·이름변경 안 함, 주석만 제거).
 *     - 인라인 CSS(<style>) -> esbuild 의 CSS 파서(loader:'css',
 *              minifyWhitespace:true, minifySyntax:false,
 *              minifyIdentifiers:false) - 문자열 리터럴 안의 comment-like
 *              텍스트를 코드로 오인하지 않는다(실측 확인).
 *     - HTML -> 자체 파서 없이, <script>/<style> 블록의 범위를 먼저
 *              식별해 그 안은 통째로 건드리지 않고, 범위 밖의
 *              HTML 주석만 지운다(스크립트 안의 <!-- 문자열 보존).
 *
 * === 소스는 절대 안 건드린다 ===
 *   이 모듈은 빌드 산출물 경로(dist/**)만 받는다. src/**·public/** 원본은
 *   호출부에서 절대 넘기지 마라 - 주석은 우리 유지보수 자산이다.
 *
 * === 이식 방법 (다른 게임 레인) ===
 *   1. 이 파일을 그대로 복사한다(수정 불필요 - 범용).
 *   2. vite.config.ts 에 플러그인 하나를 추가한다(closeBundle 훅에서
 *      stripPublicGameJs() + stripHtmlFileComments() 호출). 예시는
 *      _COMMENT_STRIP_KIT.md 참고.
 *   3. dist/game/*.js · dist/index.html 경로 이름이 다르면 인자만 바꾼다.
 */
import { minify } from 'terser';
import { transform as esbuildTransform } from 'esbuild';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * JS 파일 하나에서 주석만 제거한다(압축·이름변경 없음).
 * @param {string} filePath 절대/상대 경로 - 빌드 산출물이어야 한다.
 */
export async function stripJsFileComments(filePath) {
  const src = await readFile(filePath, 'utf8');
  const result = await minify(src, {
    compress: false,
    mangle: false,
    format: { comments: false },
  });
  if (result.error || typeof result.code !== 'string') {
    return { ok: false, error: result.error ?? new Error('terser returned no code') };
  }
  await writeFile(filePath, result.code, 'utf8');
  return { ok: true, before: src.length, after: result.code.length };
}

/**
 * dist 산출물 아래 game/*.js (public/game/*.js 가 복사된 자리) 전부를 처리한다.
 * @param {string} distDir 예: 'dist' 또는 'dist/web'
 * @param {string} subdir  기본 'game' - public 폴더 구조가 다르면 바꿔라.
 */
export async function stripPublicGameJs(distDir, subdir = 'game') {
  const dir = path.join(distDir, subdir);
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }
  const results = [];
  for (const name of entries) {
    if (!name.endsWith('.js')) continue;
    const fp = path.join(dir, name);
    const r = await stripJsFileComments(fp);
    results.push({ file: fp, ...r });
  }
  return results;
}

/**
 * HTML 문자열에서 <script>/<style> 블록 범위 밖의 HTML 주석만 제거한다.
 * 블록 안은 통째로 건드리지 않는다(문자열 안의 <!-- 보존).
 */
export function stripHtmlCommentsOutsideScriptStyle(html) {
  const blockOpenClose = new RegExp('<(script|style)\\b[^>]*>[\\s\\S]*?<\\/\\1>', 'gi');
  const blocks = [];
  let m;
  while ((m = blockOpenClose.exec(html)) !== null) {
    blocks.push([m.index, m.index + m[0].length]);
  }
  function insideAnyBlock(idx) {
    for (const pair of blocks) {
      if (idx >= pair[0] && idx < pair[1]) return true;
    }
    return false;
  }
  const commentRe = new RegExp('<!--[\\s\\S]*?-->', 'g');
  /*
   * ★2026-08-23 Partner — 「기계가 읽는 주석」은 «보존»한다.
   *
   *   privacy.html 을 이 처리 대상에 넣은 뒤 «SDK-DECLARE 가 같이 지워졌다»
   *   (실측: bloomcircuit.ait 의 방침에 선언 0개, 다른 2종은 1개).
   *   그 한 줄은 `check_game_privacy_sdk.mjs` 가 «방침이 사실과 맞는지» 판정하는
   *   유일한 결정적 근거다. 지우면 검사기가 프로즈 모드로 떨어져 «확인 불가»가 되고,
   *   그건 fail-closed 설계상 FAIL 이다.
   *   ⇒ **주석 제거의 목적은 「사람이 쓴 내부 메모」를 없애는 것**이지 기계 판독
   *     메타데이터를 없애는 게 아니다. 목적에 맞게 예외를 둔다.
   *
   * ⛔이 목록에 «편의로» 항목을 늘리지 마라 — 면제는 자란다.
   *   기계가 읽고, 사람에게 의미가 없고, 없으면 검사가 죽는 것만 넣는다.
   */
  const KEEP_MACHINE_READABLE = /SDK-DECLARE/;
  return html.replace(commentRe, function (match, offset) {
    if (KEEP_MACHINE_READABLE.test(match)) return match;
    return insideAnyBlock(offset) ? match : '';
  });
}

/**
 * HTML 문자열의 <style>...</style> 블록 안에서 CSS 주석만 제거한다.
 * esbuild 의 진짜 CSS 파서를 쓴다(minifyWhitespace:true 만 켜고
 * minifySyntax/minifyIdentifiers 는 끈다 - 규칙·값 자체는 안 바뀐다).
 * 태그 경계 탐색은 정규식 lastIndex 누적이 아니라 매번 indexOf 로 직접
 * 찾는다 - backslash-escape 관련 정규식 리터럴 버그를 원천 차단하기 위해
 * 가장 단순한 문자열 탐색만 쓴다.
 */
export async function stripStyleBlockComments(html) {
  const openTagRe = new RegExp('<style([^>]*)>', 'gi');
  const parts = [];
  let match;
  while ((match = openTagRe.exec(html)) !== null) {
    const openTag = match[0];
    const attrs = match[1];
    const openStart = match.index;
    const openEnd = match.index + openTag.length;
    const closeIdx = html.indexOf('</style>', openEnd);
    if (closeIdx === -1) break;
    const css = html.slice(openEnd, closeIdx);
    parts.push({ openStart: openStart, openEnd: openEnd, closeIdx: closeIdx, attrs: attrs, css: css });
    openTagRe.lastIndex = closeIdx + 8; // '</style>'.length
  }
  if (parts.length === 0) return html;
  let out = '';
  let cursor = 0;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    out += html.slice(cursor, p.openStart);
    let code = p.css;
    if (p.css.trim()) {
      const r = await esbuildTransform(p.css, {
        loader: 'css',
        minifyWhitespace: true,
        minifySyntax: false,
        minifyIdentifiers: false,
      });
      code = r.code;
    }
    out += '<style' + p.attrs + '>' + code + '</style>';
    cursor = p.closeIdx + 8; // '</style>'.length
  }
  out += html.slice(cursor);
  return out;
}

/**
 * HTML 문자열의 인라인 <script>...</script>(외부 src 없는 것만) 안에서
 * JS 주석을 제거한다. 이 프로젝트의 index.html 은 전부 외부 src 참조라
 * 해당 없지만(실측 확인), 다른 게임 레인이 inline <script> 를 쓸 수 있어
 * 이식성을 위해 넣는다.
 */
export async function stripInlineScriptComments(html) {
  const openTagRe = new RegExp('<script([^>]*)>', 'gi');
  const parts = [];
  let match;
  while ((match = openTagRe.exec(html)) !== null) {
    const openTag = match[0];
    const attrs = match[1];
    const openStart = match.index;
    const openEnd = match.index + openTag.length;
    const closeIdx = html.indexOf('</script>', openEnd);
    if (closeIdx === -1) break;
    const js = html.slice(openEnd, closeIdx);
    parts.push({ openStart: openStart, openEnd: openEnd, closeIdx: closeIdx, attrs: attrs, js: js });
    openTagRe.lastIndex = closeIdx + 9; // '</script>'.length
  }
  if (parts.length === 0) return html;
  let out = '';
  let cursor = 0;
  const srcAttrRe = new RegExp('\\bsrc\\s*=');
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    out += html.slice(cursor, p.openStart);
    let code = p.js;
    const hasSrc = srcAttrRe.test(p.attrs);
    if (!hasSrc && p.js.trim()) {
      const r = await minify(p.js, { compress: false, mangle: false, format: { comments: false } });
      if (!r.error && typeof r.code === 'string') code = r.code;
    }
    out += '<script' + p.attrs + '>' + code + '</script>';
    cursor = p.closeIdx + 9; // '</script>'.length
  }
  out += html.slice(cursor);
  return out;
}

/**
 * 산출물 index.html 파일 하나를 제자리에서 처리한다.
 * 순서: 1) HTML 주석(script/style 밖) 2) <style> 안 CSS 주석 3) 인라인 <script> 안 JS 주석.
 * @param {string} filePath dist 산출물의 index.html 경로.
 */
export async function stripHtmlFileComments(filePath) {
  let html;
  try {
    html = await readFile(filePath, 'utf8');
  } catch {
    return { ok: false, error: 'not found' };
  }
  let stripped = stripHtmlCommentsOutsideScriptStyle(html);
  stripped = await stripStyleBlockComments(stripped);
  stripped = await stripInlineScriptComments(stripped);
  await writeFile(filePath, stripped, 'utf8');
  return { ok: true, before: html.length, after: stripped.length };
}
