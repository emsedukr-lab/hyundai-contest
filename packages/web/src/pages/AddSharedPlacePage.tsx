import { useEffect, useMemo, useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Layout, LayoutContent, LayoutHeader } from '@astryxdesign/core/Layout';
import { List, ListItem } from '@astryxdesign/core/List';
import { Selector } from '@astryxdesign/core/Selector';
import { Spinner } from '@astryxdesign/core/Spinner';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Heading, Text } from '@astryxdesign/core/Text';
import { CATEGORY_LABEL, PlaceSearch, type NewPlace } from '../editor/PlaceSearch';
import { trips } from '../lib/db';
import { t } from '../lib/i18n';
import { ApiError, searchPlaces, type PlaceHit } from '../lib/pairing';
import { sharedParamsFromSearch, sharedPlaceTerm } from '../lib/placeShare';
import { navigate } from '../lib/router';
import { addPlace, emptyPlan, newDoc, savePlan, type TripDoc } from '../lib/trips';

const NEW = 'new';

const fromHit = (h: PlaceHit): NewPlace => ({
  name: h.name,
  address: h.address,
  latE7: h.latE7,
  lonE7: h.lonE7,
  category: h.category,
  source: { provider: 'KAKAO', externalId: h.externalId },
  naviPoi: null,
  hours: { status: 'UNKNOWN' },
});

/**
 * Landing page for the GET Web Share Target (`/add?title=…&text=…&url=…`). Resolves the shared place name to coordinates
 * with the existing Kakao keyword search (same-origin relay, no new key), or adds it by name only when search is off or
 * finds nothing — the car then pins the exact spot in the Hyundai navigation. The place goes into a chosen trip (or a
 * new one), reusing the editor's own `addPlace`/`savePlan`; then it opens that trip's editor.
 */
export function AddSharedPlacePage() {
  const params = useMemo(() => sharedParamsFromSearch(location.search), []);
  const term = useMemo(() => sharedPlaceTerm(params), [params]);
  const [hits, setHits] = useState<PlaceHit[] | null>(null);
  const [busy, setBusy] = useState(true);
  const [docs, setDocs] = useState<TripDoc[]>([]);
  const [target, setTarget] = useState<string>(NEW);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const all = await trips.all();
      setDocs(all);
      if (all[0]) setTarget(all[0].tripId); // most recent trip by default
    })();
  }, []);

  useEffect(() => {
    if (!term) {
      setBusy(false);
      return;
    }
    void (async () => {
      try {
        setHits(await searchPlaces(term));
      } catch (e) {
        setHits([]); // 503 (no key) or failure → name-only path
        if (!(e instanceof ApiError && e.status === 503)) setNote(t('place.search.failed'));
      } finally {
        setBusy(false);
      }
    })();
  }, [term]);

  const addTo = async (place: NewPlace) => {
    const doc = target === NEW ? await newDoc(emptyPlan()) : (await trips.get(target)) ?? (await newDoc(emptyPlan()));
    const next = await savePlan(doc, addPlace(doc.plan, place), doc.home);
    await trips.put(next);
    navigate(`/trips/${next.tripId}`, true);
  };

  const addByName = () => term && addTo({ name: term.slice(0, 60), address: '', latE7: null, lonE7: null, category: 'OTHER', source: { provider: 'MANUAL', externalId: null }, naviPoi: null, hours: { status: 'UNKNOWN' } });

  const targetOptions = [{ value: NEW, label: t('add.newTrip') }, ...docs.map((d) => ({ value: d.tripId, label: d.plan.name }))];

  return (
    <Layout
      contentWidth={640}
      header={
        <LayoutHeader hasDivider>
          <HStack gap={2} vAlign="center">
            <Button label={t('common.back')} variant="ghost" size="sm" onClick={() => navigate('/')} />
            <Heading level={1}>{t('add.title')}</Heading>
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent>
          <VStack gap={4}>
            {!term ? (
              <Banner status="info" title={t('add.noTerm')} />
            ) : (
              <>
                <Banner status="info" title={t('add.sharedTitle', { name: term })} description={t('add.sharedHint')} />
                {note && <Banner status="warning" title={note} />}
                <Selector label={t('add.target')} options={targetOptions} value={target} onChange={setTarget} />
                {busy ? (
                  <HStack gap={2} vAlign="center">
                    <Spinner />
                    <Text color="secondary">{t('add.resolving')}</Text>
                  </HStack>
                ) : (
                  <>
                    {hits && hits.length > 0 && (
                      <VStack gap={1}>
                        <Text type="label">{t('add.candidates')}</Text>
                        <List hasDividers>
                          {hits.map((h) => (
                            <ListItem key={h.externalId} label={h.name} description={`${CATEGORY_LABEL[h.category]} · ${h.address}`} onClick={() => void addTo(fromHit(h))} />
                          ))}
                        </List>
                      </VStack>
                    )}
                    {hits && hits.length === 0 && <Banner status="info" title={t('add.noCandidates')} />}
                    <Button label={t('add.addByName', { name: term.slice(0, 20) })} variant={hits && hits.length > 0 ? 'secondary' : 'primary'} onClick={addByName} />
                    <VStack gap={1}>
                      <Text type="label" color="secondary">
                        {t('add.refine')}
                      </Text>
                      <PlaceSearch label={t('add.refine.search')} onPick={(p) => void addTo(p)} />
                    </VStack>
                  </>
                )}
              </>
            )}
          </VStack>
        </LayoutContent>
      }
    />
  );
}
