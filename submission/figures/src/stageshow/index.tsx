import { Bar, Phone, Stage } from '../../kit'
import { ChevronLeft, Lock } from 'lucide-react'
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import './tt.css'

// 떠날지도 product shot: a device pair for the application form and brochure.
// Hero: the car's centre display (Pleos Connect, landscape app window) showing
// day 1 of the sample Gangneung trip after the Hyundai navigation measured every
// leg; the payoff is the faster order card ("운전 22분 줄어요") with the one blue
// button. Satellite: the phone the trip was planned on, straddling the display's
// right edge over its quiet margin (the next-destination panel's filler rows).
// Real strings: the trip name, 1일차, the card title and payoff, the button, two
// place names, two measured legs, the fixed time. Everything else is a bar.
// Built for print (a full-width figure), so there is no compact design.

type Stop = { n: number; name?: string; time?: string; fixed?: boolean; w?: number }
type Leg = { label?: string; w?: number }

// Day 1 of the sample trip as the Hyundai navigation measured it (docs/evidence/m63, figure fig06).
const CAR_DAY: (Stop | Leg)[] = [
  { label: '내비 2시간 13분 · 203km' },
  { n: 1, name: '철뚝소머리집', time: '10:13 ~ 11:13' },
  { label: '내비 6분 · 3km' },
  { n: 2, name: '강릉영진횟집', time: '11:19 ~ 12:34' },
  { label: '내비 10분 · 5km' },
  { n: 3, name: '보헤미안박이추커피', time: '12:44 ~ 13:44' },
  { w: 52 },
  { n: 4, w: 88 },
]

// The phone holds the same day as planned; its legs are the phone's estimates, so they stay placeholder here.
const PHONE_DAY: (Stop | Leg)[] = [
  { w: 64 },
  { n: 1, name: '철뚝소머리집', time: '10:13 ~ 11:13' },
  { w: 48 },
  { n: 2, name: '강릉영진횟집', time: '11:19 ~ 12:34' },
  { w: 52 },
  { n: 3, name: '보헤미안박이추커피', time: '12:44 ~ 13:44' },
  { w: 44 },
  { n: 4, w: 92 },
]

const isStop = (x: Stop | Leg): x is Stop => 'n' in x

function Timeline({ items, kind }: { items: (Stop | Leg)[]; kind: 'car' | 'phone' }) {
  return (
    <ol className={`tt-tl tt-tl--${kind}`}>
      {items.map((it, i) =>
        isStop(it) ? (
          <li key={i} className="tt-stop">
            <span className="tt-num">{it.n}</span>
            <span className="tt-stop__text">
              {it.name ? <span className="tt-stop__name">{it.name}</span> : <Bar w={it.w ?? 90} h={kind === 'car' ? 9 : 8} tone={3} />}
              {it.time ? (
                <span className={`tt-stop__time${it.fixed ? ' is-fixed' : ''}`}>
                  {it.fixed && <Lock size={kind === 'car' ? 11 : 10} strokeWidth={2.4} />}
                  {it.time}
                </span>
              ) : (
                <Bar w={kind === 'car' ? 70 : 60} h={6} tone={2} />
              )}
            </span>
          </li>
        ) : (
          <li key={i} className="tt-leg">
            {it.label ? <span className="tt-leg__label">{it.label}</span> : <Bar w={it.w ?? 50} h={6} tone={2} />}
          </li>
        ),
      )}
    </ol>
  )
}

export default function TteonaljidoPair() {
  return (
    <Stage width={1040} height={540} className="tt-section" greys="cool">
      {() => (
        <>
          <div className="tt-car">
            <div className="tt-car__screen">
              <header className="tt-car__head">
                <ChevronLeft size={20} strokeWidth={2.2} className="tt-car__back" />
                <span className="tt-car__title">강릉 3박 4일</span>
                <Bar w={112} h={7} tone={2} />
              </header>
              <div className="tt-seg">
                {['1일차', '2일차', '3일차', '4일차'].map((d, i) => (
                  <span key={d} className="tt-seg__item" data-on={i === 0 || undefined}>{d}</span>
                ))}
              </div>
              <div className="tt-car__cols">
                <section className="tt-card tt-card--day">
                  <div className="tt-card__head">
                    <span className="tt-card__title">현대차 내비로 잰 동선</span>
                    <span className="tt-badge">내비 측정</span>
                  </div>
                  <div className="tt-bar-start">
                    <span className="tt-chip-tag">출발</span>
                    <Bar w={76} h={7} tone={3} />
                    <Bar w={34} h={7} tone={2} style={{ marginLeft: 'auto' }} />
                  </div>
                  <Timeline items={CAR_DAY} kind="car" />
                </section>
                <div className="tt-car__side">
                  <section className="tt-card tt-card--faster">
                    <span className="tt-eyebrow">더 빠른 순서</span>
                    <span className="tt-payoff">운전 22분 줄어요</span>
                    <span className="tt-order">
                      <Bar w={58} h={7} tone={2} />
                      <Bar w={46} h={7} tone={2} />
                      <Bar w={66} h={7} tone={2} />
                    </span>
                    <span className="tt-actions">
                      <span className="tt-btn tt-btn--primary">이 순서로 바꾸기</span>
                      <span className="tt-btn tt-btn--secondary"><Bar w={34} h={7} tone={3} /></span>
                    </span>
                  </section>
                  <section className="tt-card tt-card--next">
                    <Bar w={48} h={7} tone={2} />
                    <Bar w={138} h={11} tone={3} style={{ marginTop: 10 }} />
                    <Bar w={92} h={7} tone={2} style={{ marginTop: 10 }} />
                    <span className="tt-btn tt-btn--ghost-bar" />
                    <span className="tt-row-bars">
                      <Bar w={56} h={7} tone={2} />
                      <Bar w={44} h={7} tone={2} />
                    </span>
                  </section>
                  <section className="tt-card tt-card--more">
                    <Bar w={64} h={7} tone={2} />
                    <span className="tt-row-bars"><Bar w={120} h={9} tone={3} /><Bar w={40} h={7} tone={2} style={{ marginLeft: 'auto' }} /></span>
                    <span className="tt-row-bars"><Bar w={96} h={9} tone={3} /><Bar w={48} h={7} tone={2} style={{ marginLeft: 'auto' }} /></span>
                    <span className="tt-row-bars"><Bar w={108} h={9} tone={3} /><Bar w={36} h={7} tone={2} style={{ marginLeft: 'auto' }} /></span>
                  </section>
                </div>
              </div>
            </div>
          </div>

          <Phone width={300} frame="pro" className="tt-phone">
            <div className="tt-app">
              <header className="tt-app__bar">
                <ChevronLeft size={20} strokeWidth={2.2} />
                <span className="tt-app__title">강릉 3박 4일</span>
              </header>
              <div className="tt-chips">
                <span className="tt-chip">여행 정보</span>
                <span className="tt-chip" data-on>1일차</span>
                <span className="tt-chip">2일차</span>
                <span className="tt-chip">3일차</span>
              </div>
              <section className="tt-pcard">
                <div className="tt-pcard__head">
                  <span className="tt-pcard__title">1일차</span>
                  <Bar w={86} h={6} tone={2} />
                </div>
                <Timeline items={PHONE_DAY} kind="phone" />
              </section>
            </div>
          </Phone>
        </>
      )}
    </Stage>
  )
}
