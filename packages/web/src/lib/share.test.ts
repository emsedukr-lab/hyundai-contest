import { describe, expect, it } from 'vitest';
import { sampleTrip, type Home } from '@tteonaljido/shared';
import { newDoc, nowIso } from './trips';
import { docFromShare, exportShare, importShare, isShareFile, newPasscode } from './share';

const home: Home = { address: '서울 어딘가', latE7: 375_662_952, lonE7: 1_269_779_451 };
const makeDoc = () => newDoc({ ...sampleTrip(nowIso()), tripId: crypto.randomUUID() }, home);

describe('친구 공유 암호화 파일', () => {
  it('같은 패스코드로 왕복하면 같은 여행을 복원한다', async () => {
    const doc = await makeDoc();
    const file = await exportShare(doc, '123456');
    const r = await importShare(JSON.stringify(file), '123456');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.transfer.trip.name).toBe(doc.plan.name);
  });

  it('틀린 패스코드는 복호화에 실패한다', async () => {
    const doc = await makeDoc();
    const file = await exportShare(doc, '123456');
    const r = await importShare(JSON.stringify(file), '000000');
    expect(r).toEqual({ ok: false, reason: 'passcode' });
  });

  it('집 주소는 공유 파일에 포함되지 않는다', async () => {
    const doc = await makeDoc();
    expect(doc.home).not.toBeNull(); // the stored doc has a home…
    const file = await exportShare(doc, 'abc123');
    const r = await importShare(JSON.stringify(file), 'abc123');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.transfer.trip.home).toBeNull(); // …but the shared trip does not
  });

  it('공유 파일이 아니면 format 오류', async () => {
    expect(await importShare('{"format":"tteonaljido-backup"}', 'x')).toEqual({ ok: false, reason: 'format' });
    expect(await importShare('not json', 'x')).toEqual({ ok: false, reason: 'format' });
  });

  it('isShareFile은 공유 파일만 참', async () => {
    const file = await exportShare(await makeDoc(), '111111');
    expect(isShareFile(JSON.stringify(file))).toBe(true);
    expect(isShareFile('{"format":"tteonaljido-backup","trips":[]}')).toBe(false);
    expect(isShareFile('garbage')).toBe(false);
  });

  it('가져온 공유는 새 여행 id를 받아 친구의 기존 여행을 덮어쓰지 않는다', async () => {
    const doc = await makeDoc();
    const file = await exportShare(doc, '222222');
    const r = await importShare(JSON.stringify(file), '222222');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const imported = await docFromShare(r.transfer);
    expect(imported.tripId).not.toBe(doc.tripId);
    expect(imported.revision).toBe(1);
    expect(imported.home).toBeNull();
    expect(imported.plan.name).toBe(doc.plan.name);
  });

  it('newPasscode는 6자리 숫자', () => {
    for (let i = 0; i < 20; i++) expect(newPasscode()).toMatch(/^\d{6}$/);
  });
});
