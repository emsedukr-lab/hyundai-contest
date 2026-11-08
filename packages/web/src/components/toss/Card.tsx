import type { CSSProperties, ReactNode } from 'react';
import { VStack } from '@astryxdesign/core/Stack';
import { Heading, Text } from '@astryxdesign/core/Text';

/**
 * 토스 룩의 기본 블록: 회색 캔버스 위에 올리는 흰색 라운드 카드(헤어라인 보더).
 * `pad={0}`이면 List처럼 자체 패딩을 가진 내용을 풀블리드로 담는 컨테이너가 된다(overflow hidden).
 */
export function Card({ children, pad = 16, style }: { children: ReactNode; pad?: number; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: 'var(--color-background-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-container)',
        overflow: 'hidden',
        padding: pad,
        ...style,
      }}>
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
