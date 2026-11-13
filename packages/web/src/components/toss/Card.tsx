import type { CSSProperties, ReactNode } from 'react';
import { VStack } from '@astryxdesign/core/Stack';
import { Heading, Text } from '@astryxdesign/core/Text';

/**
 * 컨테이너 카드(TOSS.md): 회색 바탕 위 흰 면, 모서리 20, 보더·그림자 없음 — 모양은 shell.css `.tn-card`(시트·대화상자 안에서는
 * 그 면이 곧 컨테이너라 헤어라인으로 묶음을 보인다). `pad={0}`이면 List처럼 자체 패딩을 가진 내용을 풀블리드로 담는
 * 컨테이너가 된다(overflow hidden).
 */
export function Card({ children, pad = 16, style }: { children: ReactNode; pad?: number; style?: CSSProperties }) {
  return (
    <div className="tn-card" style={{ padding: pad, ...style }}>
      {children}
    </div>
  );
}

/** 섹션 라벨(제목)을 카드 위에 두는 토스 패턴. 폼 섹션처럼 패딩이 필요한 내용에 쓴다. */
export function Section({ title, children, pad }: { title: string; children: ReactNode; pad?: number }) {
  return (
    <VStack gap={2}>
      <Heading level={2}>{title}</Heading>
      <Card pad={pad}>{children}</Card>
    </VStack>
  );
}

/**
 * Header for a `List` inside a `Card pad={0}`. The list rows bring their own inset but Astryx's list header has none,
 * so on its own it would sit on the card's rounded edge. Pass it as the List's `header` so the list stays named for
 * screen readers (`aria-labelledby`).
 */
export function CardListHeader({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding: '12px 8px 4px' }}>
      <Text type="label" color="secondary">
        {children}
      </Text>
    </div>
  );
}
