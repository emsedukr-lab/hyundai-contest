import { useEffect, useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Heading, Text } from '@astryxdesign/core/Text';
import { t } from '../lib/i18n';
import { exportShare, newPasscode, type ShareFile } from '../lib/share';
import type { TripDoc } from '../lib/trips';

/**
 * 친구에게 여행 공유 (export). Builds an encrypted share file for the current trip — home address left out — and hands it
 * off via the system share sheet (navigator.share) or a download. The 6-digit passcode is shown once for the sender to
 * pass to the friend out of band. Nothing is uploaded: the file travels over whatever the two people already use.
 */
export function ShareDialog({ isOpen, doc, onClose }: { isOpen: boolean; doc: TripDoc; onClose: () => void }) {
  const [passcode, setPasscode] = useState('');
  const [file, setFile] = useState<ShareFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const code = newPasscode();
    setPasscode(code);
    setFile(null);
    setNote(null);
    void exportShare(doc, code).then(setFile);
    // Rebuild only when the dialog opens or the trip identity/revision changes.
  }, [isOpen, doc]);

  const fileName = t('share.fileName', { name: doc.plan.name.replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 40) || 'trip' });

  const asFile = (sf: ShareFile) => new File([JSON.stringify(sf)], fileName, { type: 'application/json' });

  const send = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const f = asFile(file);
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
      if (nav.canShare?.({ files: [f] }) && navigator.share) {
        await navigator.share({ files: [f], title: t('share.shareTitle'), text: t('share.shareText', { code: passcode }) });
      } else {
        download(f);
      }
    } catch {
      /* user cancelled the share sheet — nothing to do */
    } finally {
      setBusy(false);
    }
  };

  const download = (f: File = asFile(file!)) => {
    const url = URL.createObjectURL(f);
    const a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    a.click();
    URL.revokeObjectURL(url);
    setNote(t('share.saved'));
  };

  return (
    <Dialog isOpen={isOpen} onOpenChange={(o) => !o && onClose()} width={480}>
      <DialogHeader title={t('share.title')} subtitle={t('share.intro')} onOpenChange={(o) => !o && onClose()} />
      <VStack gap={4}>
        <Card padding={3}>
          <VStack gap={1} hAlign="center">
            <Text type="label" color="secondary">
              {t('share.passcode')}
            </Text>
            <Heading level={2}>{passcode}</Heading>
            <Text type="supporting" color="secondary">
              {t('share.passcodeHint')}
            </Text>
          </VStack>
        </Card>
        <Banner status="info" title={t('share.noHome')} />
        {note && <Banner status="success" title={note} isDismissable onDismiss={() => setNote(null)} />}
        <HStack gap={2} hAlign="between">
          <Button label={t('common.close')} variant="secondary" onClick={onClose} />
          <HStack gap={2}>
            <Button label={t('share.saveFile')} variant="secondary" isDisabled={!file} onClick={() => download()} />
            <Button label={busy ? t('share.building') : t('share.send')} variant="primary" isDisabled={!file || busy} onClick={send} />
          </HStack>
        </HStack>
      </VStack>
    </Dialog>
  );
}
