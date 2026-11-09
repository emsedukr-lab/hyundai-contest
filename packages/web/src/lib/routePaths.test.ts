import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRoadLines, decodePath, roadLines } from './routePaths';
import type { LegRun } from './routeTimes';

const a = { latE7: 377_953_000, lonE7: 1_288_965_000 };
const b = { latE7: 377_717_000, lonE7: 1_289_480_000 };
const c = { latE7: 378_930_000, lonE7: 1_288_260_000 };
const run: LegRun = { dayIndex: 1, fromK: 0, points: [a, b, c], keys: ['p1>p2', 'p2>p3'] };

const answer = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch & ReturnType<typeof vi.fn>;

describe('road lines for the day map (M54)', () => {
  beforeEach(() => clearRoadLines());

  it('decodes E5 pairs into degrees', () => {
    expect(decodePath([3779530, 12889650, 3777170, 12894800])).toEqual([
      [37.7953, 128.8965],
      [37.7717, 128.948],
    ]);
  });

  it('gives each leg its ends and road; a missing road stays null (dashed on the map)', async () => {
    const f = answer({ provider: 'KAKAO', paths: [[3779530, 12889650, 3778000, 12892000, 3777170, 12894800], null] });
    const lines = await roadLines([run], f);
    expect(lines.map((l) => l.key)).toEqual(['p1>p2', 'p2>p3']);
    expect(lines[0].from).toEqual(a);
    expect(lines[0].to).toEqual(b);
    expect(lines[0].path).toHaveLength(3);
    expect(lines[1].path).toBeNull();
  });

  it('asks once per session for the same stops; a failure is retried next time', async () => {
    const ok = answer({ paths: [[1, 2, 3, 4], [5, 6, 7, 8]] });
    await roadLines([run], ok);
    await roadLines([run], ok);
    expect(ok).toHaveBeenCalledTimes(1);

    const other: LegRun = { ...run, points: [a, c, b] };
    const down = answer({ error: 'ROUTE_UNAVAILABLE' }, 502);
    expect((await roadLines([other], down)).every((l) => l.path === null)).toBe(true);
    await roadLines([other], down);
    expect(down).toHaveBeenCalledTimes(2);
  });

  it('an answer that does not fit the legs counts as no answer', async () => {
    const lines = await roadLines([run], answer({ paths: [[1, 2, 3, 4]] }));
    expect(lines.every((l) => l.path === null)).toBe(true);
  });
});
