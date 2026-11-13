package io.tteonaljido.trip

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** M63: the navigation's waypoint routes time the legs, and the day's order follows the navigation's own times. */
class NaviPlanTest {
    private val schemaDir = File(System.getProperty("schemaDir"))
    private val sample = (TransferParser.parse(File(schemaDir, "fixtures/valid/sample.json").readText()) as ParseResult.Ok).transfer.trip
    private val seongnam = NaviBinding("", "", "", 374_127_212, 1_270_946_810, "", "수정구 시흥동")
    private fun est(minutes: Int, metres: Int = minutes * 500) = LegEstimate(minutes, metres, 1_000, NaviMeasure.SOURCE)

    /* ---------- which legs, and how they are strung onto routes ---------- */

    @Test fun tripLegsFollowTheDrivingOrderAndSkipEndsTheCarCannotPlace() {
        // The sample starts and ends at a home the car has no address for: those two legs cannot be laid on a route.
        val keys = NaviMeasure.tripLegs(sample, CarOverlay()).map { it.key }
        assertEquals(
            listOf(
                "cheolttuk>youngjin", "youngjin>bohemian", "bohemian>skybay",
                "skybay>lake", "lake>donghwa", "donghwa>mandong", "mandong>umji", "umji>shilla",
                "shilla>gyodong", "gyodong>terarosa", "terarosa>topsten",
                "topsten>badabuchae",
            ),
            keys,
        )
        // With the day-1 start pinned to the car and the navigation's home, both ends join in.
        val known = CarOverlay(originOverrides = mapOf(1 to seongnam), home = seongnam.copy(latE7 = 375_665_000, lonE7 = 1_269_780_000))
        val all = NaviMeasure.tripLegs(sample, known).map { it.key }
        assertEquals("@origin>cheolttuk", all.first())
        assertEquals("badabuchae>@home", all.last())
        assertEquals(14, all.size)
        // From day 3 on: only what is still ahead.
        assertEquals(listOf("shilla>gyodong", "gyodong>terarosa", "terarosa>topsten", "topsten>badabuchae"), NaviMeasure.tripLegs(sample, CarOverlay(), 3).map { it.key })
    }

    @Test fun oneRouteCarriesNineWaypointsAndTheNextStartsWhereItEnded() {
        val legs = NaviMeasure.tripLegs(sample, CarOverlay())
        val chains = NaviMeasure.chains(legs)
        assertEquals(2, chains.size)
        assertEquals(10, chains[0].size) // nine waypoints and the destination
        assertEquals(chains[0].last(), chains[1].first())
        // Between them the routes drive every leg exactly once.
        val driven = chains.flatMap { c -> c.zipWithNext().map { (a, b) -> "${a.key}>${b.key}" } }
        assertEquals(legs.map { it.key }, driven)
    }

    @Test fun aNavigationThatKeepsTwoWaypointsGetsShorterRoutes() {
        val legs = NaviMeasure.tripLegs(sample, CarOverlay())
        val chains = NaviMeasure.chains(legs, maxWaypoints = 2)
        assertTrue(chains.all { it.size <= 3 })
        assertEquals(legs.map { it.key }.toSet(), chains.flatMap { c -> c.zipWithNext().map { (a, b) -> "${a.key}>${b.key}" } }.toSet())
        // One waypoint is the least a route needs to measure a leg the car is not on.
        assertTrue(NaviMeasure.chains(legs, maxWaypoints = 1).all { it.size == 2 })
    }

    @Test fun aDaysMatrixIsEveryLegAnOrderCouldUseAndFitsInAFewRoutes() {
        val matrix = NaviMeasure.dayMatrix(sample, CarOverlay(), 2)
        assertEquals(4 * 5, matrix.size) // start → 4, 4·3 between stops, 4 → end
        assertTrue(matrix.any { it.key == "skybay>mandong" } && matrix.any { it.key == "umji>lake" } && matrix.any { it.key == "lake>shilla" })
        val chains = NaviMeasure.chains(matrix)
        val driven = chains.flatMap { c -> c.zipWithNext().map { (a, b) -> "${a.key}>${b.key}" } }.toSet()
        assertTrue(driven.containsAll(matrix.map { it.key }))
        assertTrue("20 legs should not need more than 4 routes, was ${chains.size}", chains.size <= 4)
        assertTrue(chains.all { it.size <= NaviMeasure.MAX_WAYPOINTS + 1 })
        // No route asks for a leg between two points on one spot.
        assertTrue(chains.all { c -> c.zipWithNext().none { (a, b) -> NaviMeasure.Edge(a, b).sameSpot } })
    }

    @Test fun aLegLeavingWhereTheCarStandsOpensARouteAndIsNeverDrivenBackTo() {
        // Day 1 from the car's own position: three legs leave it. Each opens a route; no route returns to the car midway.
        val o = CarOverlay(originOverrides = mapOf(1 to seongnam))
        val matrix = NaviMeasure.dayMatrix(sample, o, 1)
        assertEquals(3 * 4, matrix.size)
        val chains = NaviMeasure.chains(matrix, atCar = { it.key == LegKeys.ORIGIN })
        assertEquals(3, chains.count { it.first().key == LegKeys.ORIGIN })
        assertTrue(chains.all { c -> c.drop(1).none { it.key == LegKeys.ORIGIN } })
        assertTrue(chains.flatMap { c -> c.zipWithNext().map { (a, b) -> "${a.key}>${b.key}" } }.containsAll(matrix.map { it.key }))
    }

    /* ---------- readings → legs ---------- */

    @Test fun neighbouringReadingsGiveTheLegBetweenThem() {
        // The emulator's numbers for 스카이베이 → 경포호 → 동화가든 → 만동제과 → 엄지네 → 신라모노그램, read from Seongnam (docs/evidence/navi-waypoints, T5).
        val chain = NaviMeasure.chains(NaviMeasure.dayLegs(sample, CarOverlay(), 2)).single()
        val readings = listOf(9840 to 199_000, 10_020 to 201_000, 10_440 to 204_000, 11_220 to 209_000, 11_640 to 212_000, 12_180 to 216_000).map { NaviMeasure.Reading(it.first, it.second) }
        val legs = NaviMeasure.legs(chain, readings, at = 42)
        assertEquals(listOf(3, 7, 13, 7, 9), listOf("skybay>lake", "lake>donghwa", "donghwa>mandong", "mandong>umji", "umji>shilla").map { legs.getValue(it).minutes })
        assertEquals(listOf(2000, 3000, 5000, 3000, 4000), legs.values.map { it.metres })
        assertTrue(legs.values.all { it.source == NaviMeasure.SOURCE && it.at == 42L })
    }

    @Test fun readingsThatDoNotAddUpAreNotKept() {
        val chain = NaviMeasure.chains(NaviMeasure.dayLegs(sample, CarOverlay(), 3)).single() // shilla → gyodong → terarosa → topsten
        // The second point is no further than the first: that leg is left out, the next one still stands.
        val legs = NaviMeasure.legs(chain, listOf(600, 600, 1500, 3000).map { NaviMeasure.Reading(it, it * 10) }, 0)
        assertEquals(setOf("gyodong>terarosa", "terarosa>topsten"), legs.keys)
        assertEquals(15, legs.getValue("gyodong>terarosa").minutes)
        // A list of another length is not the answer to this route.
        assertTrue(NaviMeasure.legs(chain, listOf(NaviMeasure.Reading(60, 100)), 0).isEmpty())
    }

    @Test fun twoEndsOnOneSpotAreZeroWithoutARoute() {
        // 2일차 without stops would run lodging → lodging; here: a home that sits on the last stop.
        val o = CarOverlay(home = seongnam.copy(latE7 = 376_658_000, lonE7 = 1_290_480_000))
        val legs = NaviMeasure.dayLegs(sample, o, 4)
        assertEquals(listOf("topsten>badabuchae", "badabuchae>@home"), legs.map { it.key })
        assertEquals(mapOf("badabuchae>@home" to 0), NaviMeasure.zeroLegs(legs, 7).mapValues { it.value.minutes })
        assertEquals(1, NaviMeasure.chains(legs).single().size - 1)
    }

    /* ---------- the navigation's time is the leg's time ---------- */

    @Test fun aLegTheNavigationTimedReplacesThePhonesValue() {
        assertEquals(LegValue(10, LegFrom.USER), TripValidator.leg(sample, CarOverlay(), 2, 1))
        val o = CarOverlay(legEstimates = mapOf("lake>donghwa" to est(7, 3_000)))
        assertEquals(LegValue(7, LegFrom.NAVI, 3_000), TripValidator.leg(sample, o, 2, 1))
        // The rest of the day keeps the phone's values, and the day's distance shows only once every leg is measured.
        assertEquals(LegValue(15, LegFrom.USER), TripValidator.leg(sample, o, 2, 2))
        assertNull(TripOverview.daySummary(sample, o, 2).driveMetres)
        val all = CarOverlay(legEstimates = mapOf("skybay>lake" to est(3, 2_000), "lake>donghwa" to est(7, 3_000), "donghwa>mandong" to est(13, 5_000), "mandong>umji" to est(7, 3_000), "umji>shilla" to est(9, 4_000)))
        val s = TripOverview.daySummary(sample, all, 2)
        assertEquals(39, s.driveMinutes)
        assertEquals(17_000, s.driveMetres)
        val cover = NaviMeasure.coverage(sample, all)
        assertEquals(5 to 12, cover.measured to cover.total)
    }

    /* ---------- the day's order by the navigation's times ---------- */

    /** Day 3 (shilla → 교동반점 → 테라로사 → topsten) with every leg an order could use. */
    private fun day3(gyodongFirst: Int, terarosaFirst: Int) = mapOf(
        "shilla>gyodong" to est(10), "gyodong>terarosa" to est(15), "terarosa>topsten" to est(gyodongFirst - 25),
        "shilla>terarosa" to est(12), "terarosa>gyodong" to est(15), "gyodong>topsten" to est(terarosaFirst - 27),
    )

    @Test fun anOrderIsOfferedOnlyWhenEveryLegIsMeasuredAndItSavesTenMinutes() {
        // Nothing measured yet: all six legs are wanted.
        assertEquals(RouteOptimizer.Outcome.NeedsMeasure(6), RouteOptimizer.suggest(sample, CarOverlay(), 3))
        // 60 min as planned, 45 the other way round: 15 saved.
        val faster = RouteOptimizer.suggest(sample, CarOverlay(legEstimates = day3(60, 45)), 3) as RouteOptimizer.Outcome.Faster
        assertEquals(listOf("v9", "v8"), faster.order)
        assertEquals(45 to 15, faster.minutes to faster.savedMinutes)
        // 9 minutes is under the bar: the order stays.
        assertEquals(RouteOptimizer.Outcome.Best(60, 60 * 500), RouteOptimizer.suggest(sample, CarOverlay(legEstimates = day3(60, 51)), 3))
        // One stop has nothing to reorder; a day already under way is the driver's.
        assertEquals(RouteOptimizer.Outcome.NotApplicable(RouteOptimizer.Why.FEW_STOPS), RouteOptimizer.suggest(sample, CarOverlay(), 4))
        assertEquals(RouteOptimizer.Outcome.NotApplicable(RouteOptimizer.Why.STARTED), RouteOptimizer.suggest(sample, CarOverlay(visited = setOf("v8")), 3))
        // Day 1 starts from a home the car cannot place.
        assertEquals(RouteOptimizer.Outcome.NotApplicable(RouteOptimizer.Why.OPEN_ENDS), RouteOptimizer.suggest(sample, CarOverlay(), 1))
    }

    /** Day 2 with every leg an order could use at `other` minutes, except the legs named in `cheap`. */
    private fun day2(cheap: List<String>, cheapMinutes: Int, other: Int = 20): Map<String, LegEstimate> {
        val refs = listOf("skybay", "lake", "donghwa", "mandong", "umji", "shilla")
        return refs.flatMap { a -> refs.filter { it != a }.map { b -> "$a>$b" to est(if ("$a>$b" in cheap) cheapMinutes else other) } }.toMap()
    }

    @Test fun aFasterOrderThatLeavesAFixedTimeShortIsNotOffered() {
        // 경포호 → 만동제과 → 엄지네 → 동화가든 would be far less driving, but it puts three hours of stays before the 13:00 table.
        val chain = listOf("skybay>lake", "lake>mandong", "mandong>umji", "umji>donghwa", "donghwa>shilla")
        // 6 minutes a leg: the table is reached 12:54, inside its 15-minute margin → not offered; what is left saves nothing.
        assertEquals(RouteOptimizer.Outcome.Best(72, 72 * 500), RouteOptimizer.suggest(sample, CarOverlay(legEstimates = day2(chain, 6)), 2))
        // 2 minutes a leg: 12:38, the margin holds → offered.
        val roomy = RouteOptimizer.suggest(sample, CarOverlay(legEstimates = day2(chain, 2)), 2) as RouteOptimizer.Outcome.Faster
        assertEquals(listOf("v4", "v6", "v7", "v5"), roomy.order)
        assertEquals(10 to 54, roomy.minutes to roomy.savedMinutes)
    }

    @Test fun aFasterOrderThatArrivesBeforeOpeningIsNotOffered() {
        // 엄지네 first would be the least driving, but it opens at 11:00 and the day leaves at 09:30.
        val o = CarOverlay(legEstimates = day2(listOf("skybay>umji", "umji>lake", "lake>mandong", "mandong>donghwa", "donghwa>shilla"), 2))
        val out = RouteOptimizer.suggest(sample, o, 2) as RouteOptimizer.Outcome.Faster
        // The offer is the fastest order that adds no conflict: 경포호 → 만동제과 → 동화가든 → 엄지네.
        assertEquals(listOf("v4", "v6", "v5", "v7"), out.order)
        assertEquals(64 to 36, out.minutes to out.savedMinutes)
        val applied = o.copy(orderOverrides = mapOf(2 to out.order))
        assertEquals(0, TripValidator.validate(CarOrder.apply(sample, applied), applied).forDay(2).count { it.severity == Severity.CONFLICT })
    }

    /* ---------- an order chosen in the car ---------- */

    @Test fun theCarsOrderLiesOverThePlanWhichStaysAsSent() {
        val o = CarOverlay(orderOverrides = mapOf(3 to listOf("v9", "v8")), legEstimates = day3(60, 45))
        val view = CarOrder.apply(sample, o)
        assertEquals(listOf("v9", "v8"), view.days[2].visitOrder)
        assertEquals(listOf("v8", "v9"), sample.days[2].visitOrder)
        // No leg of the old order survives (none of its neighbours stayed neighbours); the navigation's times fill the day.
        assertEquals(listOf(null, null, null), view.days[2].legs)
        assertEquals(listOf(12, 15, 18), (0..2).map { TripValidator.leg(view, o, 3, it)!!.minutes })
        assertEquals(TripValidator.minutes("10:30") + 12, TripValidator.timeline(view, 3, o).first().arrive)
        // Other days are the same objects; without an override the plan itself comes back.
        assertSame(sample.days[1], view.days[1])
        assertSame(sample, CarOrder.apply(sample, CarOverlay()))
        // After the switch the day is in its fastest order.
        assertEquals(RouteOptimizer.Outcome.Best(45, 45 * 500), RouteOptimizer.suggest(sample, o, 3))
    }

    @Test fun aPlanLegSurvivesWhereItsTwoPlacesStillFollowEachOther() {
        // Day 2 with only the last two stops swapped: skybay → lake → donghwa keep their planned legs.
        val o = CarOverlay(orderOverrides = mapOf(2 to listOf("v4", "v5", "v7", "v6")))
        assertEquals(listOf(5, 10, null, null, null), CarOrder.apply(sample, o).days[1].legs.map { it?.minutes })
    }

    @Test fun anOrderThatNoLongerMatchesTheDayIsIgnoredAndANewPlanDropsIt() {
        // A stop the day does not have, or one missing: not this day's order.
        assertNull(CarOrder.of(sample, CarOverlay(orderOverrides = mapOf(3 to listOf("v9", "v1"))), 3))
        assertNull(CarOrder.of(sample, CarOverlay(orderOverrides = mapOf(3 to listOf("v9"))), 3))
        assertNull(CarOrder.of(sample, CarOverlay(orderOverrides = mapOf(3 to listOf("v8", "v9"))), 3)) // the plan's own order is no override
        // The phone sends a newer plan: its order is the one to follow.
        val o = CarOverlay(orderOverrides = mapOf(3 to listOf("v9", "v8")))
        assertTrue(ImportDecision.reconcile(o, sample.copy(revision = sample.revision + 1)).orderOverrides.isEmpty())
    }
}
