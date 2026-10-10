/**
 * 게임 필수 SDK ③ — 네이티브 Storage
 *
 * 미적용 시 앱인토스 심사 반려 사유다(원본 제출체크리스트 F2/F3).
 *
 * ── 왜 localStorage 로만 때우면 안 되는가 ────────────────────────────────────
 * 미니앱 WebView 의 localStorage 는 영속을 보장하지 않는다. 토스 앱이 WebView
 * 데이터를 비우거나 origin 이 바뀌면 통째로 날아간다. 네이티브 Storage 는
 * 앱 데이터 영역에 저장되어 살아남는다.
 *
 * ── 이 래퍼가 하는 일 (기본 구조는 트랙 D storage.ts 재사용) ─────────────────
 *  1) 토스 안 → 네이티브 Storage, 토스 밖 → localStorage 로 자동 분기.
 *  2) safeBridge 로 타임아웃(3초)+실패 흡수(절대 throw 안 함).
 *  3) 로컬에도 항상 같이 써서(localSet) 네이티브가 느리거나 실패해도 세션
 *     내에서는 값이 살아있게 한다.
 *
 * 출처/변경: 트랙 D(territory-clash) src/toss/storage.ts 의 storage 객체를
 * 그대로 가져오고(venture-cto 지시), 네임스페이스만 'sumo:' 로 바꿨다.
 * createCoalescedWriter 는 이 게임엔 필요 없어(원본 게임이 이산적 시점에만
 * lsSet 을 부른다, persist() 1곳) 가져오지 않았다.
 *
 * ── 스모 바운스 전용 확장: primeGameStorage / mirrorGameWrite ───────────────
 * 원본 게임(public/game/sumo-bounce-game.js)은 localStorage 를 동기로 직접
 * 쓰는 lsGet/lsSet 함수를 그대로 갖고 있다(게임 코드는 안 건드림, 미션 지시).
 * 그 함수들이 이 파일의 `storage` 를 직접 부르진 않는다 — 대신:
 *   - lsSet() 이 매 쓰기마다 window.__nativeStorageMirror 훅을 통해
 *     mirrorGameWrite() 를 부른다 (sdk-boot.ts 가 훅을 연결).
 *   - 부팅 시 primeGameStorage() 가 네이티브에 미러링된 값을 읽어와
 *     localStorage 에 없는 키만 역주입한다(재설치 등 대비 안전망).
 * src/sdk/storage.ts(구버전) 의 "알려진 한계" 설명은 그대로 유효하다.
 */
import { Storage } from '@apps-in-toss/web-framework';
import { isInToss, safeBridge } from './env';

const NS = 'sumo:';
/** 원본 게임이 실제로 쓰는 localStorage 키 3개(grep 실측, 원본 644~687·3352·3355행). */
export const GAME_STORAGE_KEYS = ['sumoSave', 'sumoMuted', 'sumoLang'] as const;

function localGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function localSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* quota / private mode — 무시 */
  }
}

export const storage = {
  async getItem(key: string): Promise<string | null> {
    if (!isInToss()) return localGet(key);
    return safeBridge(`Storage.getItem(${key})`, () => Storage.getItem(key), localGet(key));
  },

  async setItem(key: string, value: string): Promise<void> {
    localSet(key, value);
    if (!isInToss()) return;
    await safeBridge(`Storage.setItem(${key})`, () => Storage.setItem(key, value), undefined);
  },

  async removeItem(key: string): Promise<void> {
    if (!isInToss()) return;
    await safeBridge(`Storage.removeItem(${key})`, () => Storage.removeItem(key), undefined);
  },
};

/** 게임 전역 저장 키 정본(이 SDK 레이어 자체가 쓰는 키. 원본 게임 키와는 별도). */
export const KEYS = {
  /** SDK 연동 self-test 용 (심사/디버그 확인 목적) */
  sdkSelfTest: `${NS}sdkSelfTest`,
  /** 원본 게임 키를 네이티브에 미러링할 때 쓰는 접두사 */
  gameMirrorPrefix: `${NS}game.mirror.`,
  /**
   * ★전면광고 카운터 v2 (src/toss/interstitialAd.ts).
   *  값 = {"plays": number, "adPending": boolean}
   *  ⛔GAME_STORAGE_KEYS 에는 «넣지 않는다» — 거긴 게임 세이브 프라이밍 전용이라
   *    의미가 섞인다. 광고 카운터는 storage.getItem/setItem 을 «직접» 쓴다.
   */
  adCounter: `${NS}ads.v2`,
} as const;

function nativeKeyFor(gameKey: string): string {
  return `${KEYS.gameMirrorPrefix}${gameKey}`;
}

/**
 * public/game/sumo-bounce-game.js 의 패치된 lsSet() 이 window 훅으로 호출한다.
 * Fire-and-forget — 게임 루프를 막지 않는다.
 */
export function mirrorGameWrite(key: string, value: string): void {
  void storage.setItem(nativeKeyFor(key), value);
}

/**
 * 부팅 시 1회. 네이티브에 미러링된 값이 있고 localStorage 에는 해당 키가
 * 아직 없을 때만 역주입한다(재설치/기기 저장소 초기화 대비 안전망).
 * 이미 localStorage 에 값이 있으면 그쪽이 정본이라 덮어쓰지 않는다.
 */
export async function primeGameStorage(keys: readonly string[] = GAME_STORAGE_KEYS): Promise<void> {
  await Promise.all(
    keys.map(async (key) => {
      if (localGet(key) !== null) return;
      const mirrored = await storage.getItem(nativeKeyFor(key));
      if (mirrored !== null) {
        localSet(key, mirrored);
      }
    })
  );
}
