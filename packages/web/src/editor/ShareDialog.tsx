import { useEffect, useRef, useState } from 'react';
import { ToastNotice } from '../components/ToastNotice';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Heading, Text } from '@astryxdesign/core/Text';
import { saveFile } from '../lib/fileOut';
import { t } from '../lib/i18n';
import { isNativeApp } from '../lib/platform';
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

  // The trip as it is when the dialog opens. The editor hands a fresh `doc` object on every render (an auto-save on
  // switching to the messenger, a Kakao travel-time fill); rebuilding on those would change the passcode under the
  // file that was already sent, so the file and its code are made once per opening.
  const docRef = useRef(doc);
  docRef.current = doc;
  useEffect(() => {
    if (!isOpen) return;
    let current = true;
    const code = newPasscode();
    setPasscode(code);
    setFile(null);
    setNote(null);
    void exportShare(docRef.current, code).then((f) => current && setFile(f)); // a slower older build never wins
    return () => {
      current = false;
    };
  }, [isOpen]);

  const fileName = t('share.fileName', { name: doc.plan.name.replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 40) || 'trip' });

  const asFile = (sf: ShareFile) => new File([JSON.stringify(sf)], fileName, { type: 'application/json' });

  const send = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const f = asFile(file);
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
      if (isNativeApp) {
        // The app's web view has no Web Share for files: use the system share sheet through the app.
        await saveFile(f, { title: t('share.shareTitle'), text: t('share.shareTextNoCode') });
      } else if (nav.canShare?.({ files: [f] }) && navigator.share) {
        // The passcode stays out of the message: sent together with the file, it would open it for anyone who sees it.
        await navigator.share({ files: [f], title: t('share.shareTitle'), text: t('share.shareTextNoCode') });
      } else {
        await download(f);
      }
    } catch {
      /* user cancelled the share sheet — nothing to do */
    } finally {
      setBusy(false);
    }
  };

  const download = async (f: File = asFile(file!)) => {
    // Web: a download. App: the share sheet (save to files); nothing is claimed when it was closed without a choice.
    if (await saveFile(f)) setNote(t('share.saved'));
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
        <ToastNotice status="info" title={t('share.noHome')} />
        {note && <ToastNotice status="success" title={note} isDismissable onDismiss={() => setNote(null)} />}
        <HStack gap={2} hAlign="between">
          <Button label={t('common.close')} variant="secondary" onClick={onClose} />
          <HStack gap={2}>
            <Button label={t('share.saveFile')} variant="secondary" isDisabled={!file} onClick={() => void download()} />
            <Button label={busy ? t('share.building') : t('share.send')} variant="primary" isDisabled={!file || busy} onClick={send} />
          </HStack>
        </HStack>
      </VStack>
    </Dialog>
  );
}
