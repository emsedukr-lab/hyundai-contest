import { Button } from '@astryxdesign/core/Button';
import { Layout, LayoutContent, LayoutHeader } from '@astryxdesign/core/Layout';
import { List, ListItem } from '@astryxdesign/core/List';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Heading, Text } from '@astryxdesign/core/Text';
import { t } from '../lib/i18n';
import { navigate } from '../lib/router';

const ROWS: Array<[string, string]> = [
  [t('privacy.phone.label'), t('privacy.phone.text')],
  [t('privacy.qr.label'), t('privacy.qr.text')],
  [t('privacy.relay.label'), t('privacy.relay.text')],
  [t('privacy.car.label'), t('privacy.car.text')],
  [t('common.homeAddress'), t('privacy.home.text')],
  [t('privacy.notSent.label'), t('privacy.notSent.text')],
  [t('privacy.search.label'), t('privacy.search.text')],
  [t('privacy.ongoing.label'), t('privacy.ongoing.text')],
];

export function PrivacyPage() {
  return (
    <Layout
      contentWidth={640}
      header={
        <LayoutHeader hasDivider>
          <HStack gap={2} vAlign="center">
            <Button label={t('common.back')} variant="ghost" size="sm" onClick={() => navigate('/')} />
            <Heading level={1}>{t('privacy.title')}</Heading>
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
              {t('privacy.processors')}
            </Text>
          </VStack>
        </LayoutContent>
      }
    />
  );
}
