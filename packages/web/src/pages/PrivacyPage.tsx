import { Button } from '@astryxdesign/core/Button';
import { Layout, LayoutContent, LayoutHeader } from '@astryxdesign/core/Layout';
import { List, ListItem } from '@astryxdesign/core/List';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Heading, Text } from '@astryxdesign/core/Text';
import { navigate } from '../lib/router';

const ROWS: Array<[string, string]> = [
  ['휴대폰', '여행·집 주소는 이 브라우저(IndexedDB)에만 저장돼요. 계정이 없어요. 브라우저 데이터를 지우면 함께 지워져요.'],
  ['QR코드', '여행·주소·비밀번호·장기 토큰이 없어요. 5분 동안 한 번만 쓸 수 있는 연결 정보만 들어 있어요.'],
  ['중계 서버', '휴대폰에서 암호화한 여행 1개를 연결이 끝날 때까지만 보관해요. 서버는 내용을 풀 수 없어요. 끝나면 즉시 지우고, 상태 기록도 10분 뒤 지워요.'],
  ['차량', '불러오기를 승인한 여행만 암호화해서 저장해요. 차량 앱 설정에서 언제든 지울 수 있어요.'],
  ['집 주소', '보내기 전에 포함 여부를 직접 골라요. 기본은 포함하지 않음이고, 이때 차량은 내비게이션의 \'집\'을 써요.'],
  ['보내지 않는 정보', '계정·결제·예약번호·비밀번호·메모는 전송 형식에 칸 자체가 없어요.'],
  ['장소 검색', '검색어는 카카오 장소 검색으로 전달되고 저장하지 않아요.'],
  ['계속 연결', '없어요. QR 불러오기는 한 번 가져오기이고, 휴대폰과 차가 계속 동기화되지 않아요.'],
];

export function PrivacyPage() {
  return (
    <Layout
      contentWidth={640}
      header={
        <LayoutHeader hasDivider>
          <HStack gap={2} vAlign="center">
            <Button label="뒤로" variant="ghost" size="sm" onClick={() => navigate('/')} />
            <Heading level={1}>개인정보 안내</Heading>
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent>
          <VStack gap={4}>
            <List hasDividers>
              {ROWS.map(([label, description]) => (
                <ListItem key={label} label={label} description={description} />
              ))}
            </List>
            <Text type="supporting" color="secondary">
              처리 위탁: Cloudflare(중계 서버 운영), 카카오(장소 검색). 문의는 공모전 운영 채널로 해 주세요.
            </Text>
          </VStack>
        </LayoutContent>
      }
    />
  );
}
