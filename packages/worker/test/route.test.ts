import { describe, expect, it } from 'vitest';
import { distanceM, planRequest, routeDurations } from '../src/route';

const gyeongpo = { latE7: 377_953_000, lonE7: 1_288_965_000 };
const anmok = { latE7: 377_717_000, lonE7: 1_289_480_000 };
const jumunjin = { latE7: 378_930_000, lonE7: 1_288_260_000 };
const sameAsAnmok = { latE7: anmok.latE7 + 50, lonE7: anmok.lonE7 + 50 };

const kakao = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch;

describe('이동시간 경로 요청 (route)', () => {
  it('measures distance roughly right', () => {
    expect(Math.round(distanceM(gyeongpo, anmok) / 100) * 100).toBeGreaterThan(4000);
    expect(distanceM(anmok, sameAsAnmok)).toBeLessThan(30);
  });

  it('drops a same-spot point and maps legs to Kakao sections', () => {
    const { route, sectionOf } = planRequest([gyeongpo, anmok, sameAsAnmok, jumunjin]);
    expect(route).toEqual([gyeongpo, anmok, jumunjin]);
    expect(sectionOf).toEqual([0, null, 1]);
  });

  it('turns section seconds into minutes per leg (same spot = 0)', async () => {
    const fetcher = kakao({ routes: [{ result_code: 0, sections: [{ duration: 610 }, { duration: 1500 }] }] });
    const res = await routeDurations({ points: [gyeongpo, anmok, sameAsAnmok, jumunjin] }, 'key', fetcher);
    expect(await res.json()).toEqual({ provider: 'KAKAO', minutes: [11, 0, 25] });
  });

  it('no drivable route leaves the legs empty; Kakao refusing is an unavailable answer', async () => {
    const none = await routeDurations({ points: [gyeongpo, jumunjin] }, 'key', kakao({ routes: [{ result_code: 104 }] }));
    expect(await none.json()).toEqual({ provider: 'KAKAO', minutes: [null] });
    const denied = await routeDurations({ points: [gyeongpo, jumunjin] }, 'key', kakao({ msg: 'denied' }, 401));
    expect(denied.status).toBe(502);
    const noKey = await routeDurations({ points: [gyeongpo, jumunjin] }, undefined, kakao({}));
    expect(noKey.status).toBe(503);
  });

  it('rejects malformed points', async () => {
    expect((await routeDurations({ points: [gyeongpo] }, 'key', kakao({}))).status).toBe(400);
    expect((await routeDurations({ points: [gyeongpo, { latE7: 1.5, lonE7: 2 }] }, 'key', kakao({}))).status).toBe(400);
  });
});
