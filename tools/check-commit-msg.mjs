#!/usr/bin/env node
/**
 * Commit message check (lefthook commit-msg, or `--all` for the whole history).
 *   첫 줄: "영역: 무엇을 (왜)" — 영역은 차량·휴대폰·서버·공통·문서·제출, 100자 이하. Merge·Revert는 예외.
 *   어디에도 내부 마일스톤 번호(같은 것)는 쓰지 않는다.
 *   본문은 3줄 이내를 권장(넘으면 경고만). --all(지난 기록 검사)에서는 첫 줄 길이도 경고만.
 *   --deny "a|b|c": 추가로 막을 낱말(대소문자 무시). 로컬 설정(lefthook-local.yml)에서만 넘긴다.
 * Usage: node tools/check-commit-msg.mjs <message-file> [--deny "..."]
 *        node tools/check-commit-msg.mjs --all [--deny "..."]
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const AREAS = ['차량', '휴대폰', '서버', '공통', '문서', '제출'];
const HEAD = new RegExp(`^(${AREAS.join('|')}): \\S`);
const MILESTONE = /(^|[^A-Za-z0-9])M[0-9]{1,3}([^0-9]|$)/;

const args = process.argv.slice(2);
const denyAt = args.indexOf('--deny');
const deny = denyAt >= 0 && args[denyAt + 1] ? new RegExp(args[denyAt + 1], 'i') : null;
const all = args.includes('--all');

function check(message, history = false) {
  const lines = message.replace(/\r/g, '').split('\n').filter((l) => !l.startsWith('#'));
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  const subject = lines[0] ?? '';
  const errors = [];
  const warnings = [];
  if (/^(Merge|Revert) /.test(subject)) return { errors, warnings };
  if (!HEAD.test(subject)) errors.push(`첫 줄은 "영역: 무엇을" (영역: ${AREAS.join('·')})`);
  if ([...subject].length > 100) (history ? warnings : errors).push('첫 줄은 100자 이하');
  const text = lines.join('\n');
  if (MILESTONE.test(text)) errors.push('마일스톤 번호(같은 것)는 쓰지 않음');
  if (deny && deny.test(text)) errors.push(`쓰지 않는 낱말: ${text.match(deny)[0]}`);
  const body = lines.slice(1).filter((l) => l.trim() !== '');
  if (body.length > 3) warnings.push(`본문 ${body.length}줄 (3줄 이내 권장)`);
  return { errors, warnings };
}

if (all) {
  const log = execFileSync('git', ['log', '--format=%H%x00%B%x01'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  let bad = 0;
  let warned = 0;
  for (const rec of log.split('\x01')) {
    const [hash, msg] = rec.replace(/^\n/, '').split('\x00');
    if (!hash || msg === undefined) continue;
    const { errors, warnings } = check(msg, true);
    if (errors.length) {
      bad++;
      console.log(`${hash.slice(0, 7)} ${msg.split('\n')[0]}\n    ✗ ${errors.join(' / ')}`);
    }
    if (warnings.length) warned++;
  }
  console.log(`위반 ${bad}건 · 본문 길이 경고 ${warned}건`);
  process.exit(bad ? 1 : 0);
}

const file = args.find((a, i) => !a.startsWith('--') && i !== denyAt + 1);
if (!file) {
  console.error('메시지 파일이 필요합니다');
  process.exit(2);
}
const { errors, warnings } = check(readFileSync(file, 'utf8'));
for (const w of warnings) console.error(`경고: ${w}`);
if (errors.length) {
  console.error(`커밋 메시지 규칙 위반:\n  - ${errors.join('\n  - ')}`);
  process.exit(1);
}
