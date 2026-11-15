import { describe, expect, it } from 'vitest';
import { distanceM, planRequest, routeDurations, routePaths, sectionPath, simplify } from '../src/route';

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
    const fetcher = kakao({ routes: [{ result_code: 0, sections: [{ duration: 610, distance: 7342 }, { duration: 1500, distance: 16050.4 }] }] });
    const res = await routeDurations({ points: [gyeongpo, anmok, sameAsAnmok, jumunjin] }, 'key', fetcher);
    expect(await res.json()).toEqual({ provider: 'KAKAO', minutes: [11, 0, 25], meters: [7342, 0, 16050] });
  });

  it('no drivable route leaves the legs empty; Kakao refusing is an unavailable answer', async () => {
    const none = await routeDurations({ points: [gyeongpo, jumunjin] }, 'key', kakao({ routes: [{ result_code: 104 }] }));
    expect(await none.json()).toEqual({ provider: 'KAKAO', minutes: [null], meters: [null] });
    const denied = await routeDurations({ points: [gyeongpo, jumunjin] }, 'key', kakao({ msg: 'denied' }, 401));
    expect(denied.status).toBe(502);
    const noKey = await routeDurations({ points: [gyeongpo, jumunjin] }, undefined, kakao({}));
    expect(noKey.status).toBe(503);
  });

  it('rejects malformed points', async () => {
    expect((await routeDurations({ points: [gyeongpo] }, 'key', kakao({}))).status).toBe(400);
    expect((await routeDurations({ points: [gyeongpo, { latE7: 1.5, lonE7: 2 }] }, 'key', kakao({}))).status).toBe(400);
  });

  it('road lines per leg: roads joined, same spot = [], no route = null', async () => {
    // section 0 bends through a corner; its two roads share an end point
    const road = (pairs: number[][]) => ({ vertexes: pairs.flat() });
    const sec0 = { duration: 610, roads: [road([[128.8965, 37.7953], [128.91, 37.7953]]), road([[128.91, 37.7953], [128.948, 37.7717]])] };
    const sec1 = { duration: 1500, roads: [road([[128.948, 37.7717], [128.826, 37.893]])] };
    const fetcher = kakao({ routes: [{ result_code: 0, sections: [sec0, sec1] }] });
    const res = await routePaths({ points: [gyeongpo, anmok, sameAsAnmok, jumunjin] }, 'key', fetcher);
    const body = (await res.json()) as { provider: string; paths: (number[] | null)[] };
    expect(body.provider).toBe('KAKAO');
    expect(body.paths[0]).toEqual([3779530, 12889650, 3779530, 12891000, 3777170, 12894800]); // corner kept, shared end once
    expect(body.paths[1]).toEqual([]);
    expect(body.paths[2]).toEqual([3777170, 12894800, 3789300, 12882600]);
    const none = await routePaths({ points: [gyeongpo, jumunjin] }, 'key', kakao({ routes: [{ result_code: 104 }] }));
    expect(((await none.json()) as { paths: unknown[] }).paths).toEqual([null]);
    expect((await routePaths({ points: [gyeongpo] }, 'key', kakao({}))).status).toBe(400);
    expect((await routePaths({ points: [gyeongpo, jumunjin] }, undefined, kakao({}))).status).toBe(503);
    expect((await routePaths({ points: [gyeongpo, jumunjin] }, 'key', kakao({}, 500))).status).toBe(502);
  });

  it('simplifies a straight run of road points down to its ends, keeps real bends', () => {
    const line: [number, number][] = Array.from({ length: 200 }, (_, i) => [37.7 + i * 0.0001, 128.9 + i * 0.0001]);
    expect(simplify(line, 5)).toEqual([line[0], line[199]]);
    const bend: [number, number][] = [[37.7, 128.9], [37.7, 128.91], [37.71, 128.91]];
    expect(simplify(bend, 5)).toEqual(bend);
    expect(sectionPath({ roads: [{ vertexes: [128.9, 37.7] }] })).toBeNull(); // a single point is no line
    const wiggle = { roads: [{ vertexes: Array.from({ length: 6000 }, (_, i) => (i % 2 ? 37.7 + (i % 4 === 1 ? 0.001 : 0) : 128.9 + i * 0.00001)) }] };
    expect(sectionPath(wiggle)!.length).toBeLessThanOrEqual(1500);
  });
});
