package io.tteonaljido.car

import io.tteonaljido.car.navi.RouteOutcome
import io.tteonaljido.trip.Match
import io.tteonaljido.trip.NaviBinding
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** '오늘 경로 전송' counts as sent only when the navigation settled on the last stop (same POI or within 150 m). */
class TodayRouteTest {
    private val elsewhere = NaviBinding("", "", "", 375_547_000, 1_269_706_000, "서울역", "")

    @Test fun aRouteSettledElsewhereIsNotReportedAsSent() {
        val g = todayRouteGuide(RouteOutcome.Different(elsewhere, Match.FAR), 3)
        assertTrue("$g", g is Guide.Failed)
        assertEquals(R.string.live_navi_elsewhere, (g as Guide.Failed).msg.id)
        assertEquals(listOf<Any>("서울역"), g.msg.args)
    }

    @Test fun aConfirmedLastStopIsSent() {
        val g = todayRouteGuide(RouteOutcome.Confirmed(elsewhere), 3)
        assertEquals(Guide.Done(io.tteonaljido.car.ui.Msg(R.string.guide_today_done, "3")), g)
    }
}
