/**
 * 게임 필수 SDK ① — 사용자 식별키
 *
 * 미적용 시 앱인토스 심사 반려 사유다. 절대 다른 식별자(디바이스 ID, 자체
 * 생성 UUID)를 토스 사용자 키 대신 쓰지 않는다 — 다만 토스 밖(로컬 개발)
 * 에서는 브릿지 자체가 없으므로 로컬 익명 ID 로 폴백한다(source 필드로 구분,
 * 절대 토스 키와 섞지 않는다).
 *
 * ── 두 채널을 모두 시도하는 이유 (bridge.ts 참고) ────────────────────────────
 *   웹 경로에서 getAnonymousKey/getUserKeyForGame 은 서로 다른 네이티브
 *   메서드다. 신규 이름(getAnonymousKey)을 3초 타임아웃으로 먼저 시도하고,
 *   실패하면 레거시 이름(getUserKeyForGame)으로 폴백한다 — 어느 쪽이 살아
 *   있든 뚫린다.
 *
 * 출처/변경: 트랙 D(territory-clash) src/toss/identity.ts 를 그대로 가져와
 * (venture-cto 지시) 로컬 ID 저장 키 이름만 이 프로젝트의 storage.ts 로
 * 바꿨다.
 */
import { getUserKeyForGame, getAnonymousKey } from './bridge';
import { safeBridge, isInToss } from './env';
import { storage } from './storage';

const LOCAL_ID_KEY = 'sumo:localAnonId';

export type IdentitySource = 'toss' | 'local';
/**
 * 실기기 검증용 — 정확히 어느 채널로 뚫렸는지 (Chief 지시 2026-08-02:
 * "진단 패널에 via getAnonymousKey / via getUserKeyForGame / via local 을
 * 찍게 해둬라. 어느 채널이 실제로 동작하는지는 실기기에서만 확정된다.")
 */
export type IdentityChannel = 'getAnonymousKey' | 'getUserKeyForGame' | 'local';

export interface Identity {
  userKey: string;
  source: IdentitySource;
  /** 화면 진단 패널에 그대로 표시하는 채널명 */
  channel: IdentityChannel;
  /** 토스 브릿지가 카테고리 미설정을 반환했는가 (콘솔 설정 필요 신호) */
  invalidCategory: boolean;
}

let cached: Identity | null = null;

function makeLocalId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return `local-${c.randomUUID()}`;
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

async function resolveLocalIdentity(): Promise<Identity> {
  const existing = await storage.getItem(LOCAL_ID_KEY);
  if (existing) {
    return { userKey: existing, source: 'local', channel: 'local', invalidCategory: false };
  }
  const fresh = makeLocalId();
  await storage.setItem(LOCAL_ID_KEY, fresh);
  return { userKey: fresh, source: 'local', channel: 'local', invalidCategory: false };
}

/**
 * 사용자 식별키를 확보한다. 앱 부팅 시 1회 호출하고 결과를 캐시한다.
 * 절대 throw 하지 않는다 — 실패해도 게임은 떠야 한다.
 */
export async function resolveIdentity(): Promise<Identity> {
  if (cached) return cached;

  if (!isInToss()) {
    cached = await resolveLocalIdentity();
    console.log('[toss-sdk][identity] not in Toss, local id:', cached.userKey);
    return cached;
  }

  const modern = await safeBridge('getAnonymousKey', () => getAnonymousKey(), undefined);
  if (modern && modern !== 'ERROR' && modern.type === 'HASH') {
    cached = { userKey: modern.hash, source: 'toss', channel: 'getAnonymousKey', invalidCategory: false };
    console.log('[toss-sdk][identity] getAnonymousKey ok, userKey=', cached.userKey);
    return cached;
  }

  const legacy = await safeBridge('getUserKeyForGame', () => getUserKeyForGame(), undefined);
  if (legacy && legacy !== 'ERROR' && legacy !== 'INVALID_CATEGORY' && legacy.type === 'HASH') {
    cached = { userKey: legacy.hash, source: 'toss', channel: 'getUserKeyForGame', invalidCategory: false };
    console.log('[toss-sdk][identity] getUserKeyForGame ok, userKey=', cached.userKey);
    return cached;
  }

  if (legacy === 'INVALID_CATEGORY') {
    console.error(
      '[toss-sdk][identity] INVALID_CATEGORY — 토스 콘솔의 앱 카테고리가 게임이 아닙니다. ' +
        '콘솔 설정을 고쳐야 사용자 식별키를 받을 수 있습니다.'
    );
    const local = await resolveLocalIdentity();
    cached = { ...local, invalidCategory: true };
    return cached;
  }

  console.warn('[toss-sdk][identity] Toss user key unavailable, falling back to local id');
  cached = await resolveLocalIdentity();
  return cached;
}

/** 이미 확보된 식별자(부팅 이후에만 유효). 부팅 전이면 null. */
export function currentIdentity(): Identity | null {
  return cached;
}
