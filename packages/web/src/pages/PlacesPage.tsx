import { useEffect, useRef, useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Selector } from '@astryxdesign/core/Selector';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TRANSFER_LIMITS } from '@tteonaljido/shared';
import { CloseIcon, PinIcon, ShareIcon } from '../components/shell/icons';
import { Row, Section } from '../components/shell/rows';
import { PushScreen } from '../components/shell/Screens';
import { BulkAddDialog } from '../editor/BulkAddDialog';
import { CATEGORY_LABEL, type NewPlace } from '../editor/PlaceSearch';
import { favorites, trips } from '../lib/db';
import type { FavoritePlace } from '../lib/favorites';
import { t } from '../lib/i18n';
import type { ResolvedList } from '../lib/pairing';
import { readPaste, takeHandOff } from '../lib/pasteImport';
import { navigate } from '../lib/router';
import { defaultHome } from '../lib/settings';
import { addPlace, emptyPlan, newDoc, placeRoom, savePlan, type TripDoc } from '../lib/trips';

const COLLECTION = '__collection__';

/**
 * 장소 tab: put places from map apps into a trip, and manage saved places. A paste — a name, several lines, a share
 * link or a whole Naver 저장 목록 link — is handled here, into the trip picked above it (the most recent by default; with
 * no trip yet, a new "받은 장소"), through the same review dialog as the editor. The pasted text never goes in the URL.
 */
export function PlacesPage() {
  const [favs, setFavs] = useState<FavoritePlace[]>([]);
  const [manage, setManage] = useState(false);
  const [paste, setPaste] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [docs, setDocs] = useState<TripDoc[] | null>(null);
  const [target, setTarget] = useState<string>(COLLECTION);
  const [reading, setReading] = useState(false);
  const [review, setReview] = useState<{ terms?: string[]; list?: ResolvedList } | null>(null);
  const [done, setDone] = useState<{ tripId: string; text: string } | null>(null);
  const handed = useRef(false);

  useEffect(() => {
    void favorites.all().then(setFavs);
    void trips.all().then((all) => {
      setDocs(all);
      if (all[0]) setTarget(all[0].tripId);
    });
  }, []);

  const targetDoc = docs?.find((d) => d.tripId === target) ?? null;

  const run = async (text: string) => {
    if (!text.trim() || reading) return;
    setNote(null);
    setDone(null);
    setReading(true);
    try {
      const out = await readPaste(text);
      if (out.kind === 'list') setReview({ list: out.list });
      else if (out.kind === 'terms') setReview({ terms: out.terms });
      else setNote(t(out.kind === 'kakao' ? 'place.paste.kakao' : out.kind === 'failed' ? 'place.resolve.failed' : 'place.paste.noName'));
      if (out.kind === 'kakao') setPaste('');
    } finally {
      setReading(false);
    }
  };

  // A whole list shared to /add lands here (handed over in memory).
  useEffect(() => {
    if (handed.current || docs === null) return;
    handed.current = true;
    const text = takeHandOff();
    if (text) void run(text);
  }, [docs]);

  /** Saves the reviewed places into the picked trip (or a new "받은 장소"), up to the trip's room. */
  const save = async (places: NewPlace[]) => {
    try {
      const fresh = target === COLLECTION ? null : await trips.get(target);
      const doc = fresh ?? (await newDoc({ ...emptyPlan(), name: t('add.collectionName') }, defaultHome()));
      const fit = places.slice(0, placeRoom(doc.plan));
      if (!fit.length) return setNote(t('trip.placeLimit', { n: TRANSFER_LIMITS.maxPlaces }));
      const next = await savePlan(doc, fit.reduce((pl, p) => addPlace(pl, p), doc.plan), defaultHome());
      await trips.put(next);
      const all = await trips.all();
      setDocs(all);
      setTarget(next.tripId);
      setPaste('');
      setDone({ tripId: next.tripId, text: t('places.addedTo', { n: fit.length, trip: next.plan.name }) });
      if (fit.length < places.length) setNote(t('trip.placeLimit', { n: TRANSFER_LIMITS.maxPlaces }));
    } catch {
      setNote(t('add.failed'));
    }
  };

  const targetOptions = [
    ...(docs ?? []).map((d) => ({ value: d.tripId, label: d.plan.name })),
    ...(docs && docs.length === 0 ? [{ value: COLLECTION, label: t('add.collectionName') }] : []),
  ];

  const remove = async (id: string) => {
    await favorites.remove(id);
    setFavs(await favorites.all());
  };

  const readClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) setPaste(text);
      else setNote(t('place.paste.clipboardEmpty'));
    } catch {
      setNote(t('place.paste.clipboardFail'));
    }
  };

  return (
    <PushScreen title={t('nav.places')} onBack={() => navigate('/')}>
      <div className="tn-intro">
        <p>{t('places.intro')}</p>
      </div>

      <Section title={t('places.paste.title')}>
        <div className="tn-panel">
          {docs && <Selector label={t('places.target')} options={targetOptions} value={target} onChange={setTarget} />}
          <TextArea label={t('place.paste.label')} isLabelHidden value={paste} onChange={setPaste} placeholder={t('place.paste.placeholder')} description={t('places.paste.hint')} rows={3} />
          {note && <Banner status="info" title={note} isDismissable onDismiss={() => setNote(null)} />}
          {done && (
            <Banner
              status="success"
              title={done.text}
              isDismissable
              onDismiss={() => setDone(null)}
              endContent={<Button label={t('add.open')} variant="ghost" size="sm" onClick={() => navigate(`/trips/${done.tripId}`)} />}
            />
          )}
          {/* Side by side where both labels fit; on a narrow phone (320) they stack at full width instead of clipping (M66). */}
          <div className="tn-btnrow">
            <Button label={t('place.paste.fromClipboard')} variant="secondary" size="lg" onClick={() => void readClipboard()} />
            <Button label={t('places.paste.action')} variant="primary" size="lg" isDisabled={!paste.trim()} isLoading={reading} onClick={() => void run(paste)} />
          </div>
        </div>
      </Section>

      {review && (
        <BulkAddDialog
          isOpen
          terms={review.terms}
          list={review.list}
          existing={targetDoc?.plan.places}
          room={targetDoc ? placeRoom(targetDoc.plan) : TRANSFER_LIMITS.maxPlaces}
          lodgingOnly={false}
          onClose={() => setReview(null)}
          onAdd={(places) => void save(places)}
        />
      )}

      <Section title={t('places.howTo')}>
        <ul className="tn-cards">
          <li>
            <Row lead={<ShareIcon />} title={t('places.share.title')} subtitle={t('places.share.detail')} />
          </li>
        </ul>
      </Section>

      <Section
        title={t('favorites.title')}
        action={favs.length > 0 ? <Button label={manage ? t('favorites.done') : t('favorites.manage')} variant="ghost" size="sm" onClick={() => setManage((m) => !m)} /> : undefined}>
        {favs.length === 0 ? (
          <p className="tn-note" style={{ marginTop: 0 }}>
            {t('places.favorites.empty')}
          </p>
        ) : (
          <ul className="tn-cards">
            {favs.map((f) => (
              <li key={f.id}>
                <Row
                  lead={<PinIcon />}
                  title={f.name}
                  subtitle={f.address || CATEGORY_LABEL[f.category]}
                  end={
                    manage ? (
                      <button type="button" className="tn-iconbtn" aria-label={`${f.name} · ${t('favorites.remove')}`} onClick={() => void remove(f.id)}>
                        <CloseIcon />
                      </button>
                    ) : undefined
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </PushScreen>
  );
}
