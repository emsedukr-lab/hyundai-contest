package io.tteonaljido.trip

import org.junit.Assert.assertEquals
import org.junit.Test

class PlaceMatchTest {
    private val lake = 377_955_000 to 1_288_975_000

    @Test fun samePoiOrWithin150mBindsAutomatically() {
        assertEquals(Match.SAME, PlaceMatch.classify(lake.first, lake.second, "P1", 0, 0, "P1"))
        assertEquals(Match.SAME, PlaceMatch.classify(lake.first, lake.second, null, lake.first + 9_000, lake.second, null)) // ~100 m north
    }

    @Test fun nearAsksAndFarWarns() {
        assertEquals(Match.NEAR, PlaceMatch.classify(lake.first, lake.second, null, lake.first + 90_000, lake.second, null)) // ~1 km
        assertEquals(Match.FAR, PlaceMatch.classify(lake.first, lake.second, null, lake.first + 300_000, lake.second, null)) // ~3.3 km
    }

    @Test fun emptyPoiIdsNeverMatchEachOther() {
        assertEquals(Match.FAR, PlaceMatch.classify(lake.first, lake.second, "", 0, 0, ""))
    }

    @Test fun searchKeywordAddsTheCityOnce() {
        val p = Place("lake", "경포호", "강릉시 저동 경포호 일원", lake.first, lake.second, PlaceCategory.SIGHT, Source(Source.Provider.MANUAL, null), null, OpeningHours.Unknown)
        assertEquals("경포호 강릉시", PlaceMatch.keyword(p))
        assertEquals("강릉시청", PlaceMatch.keyword(p.copy(name = "강릉시청", address = "강릉시 강릉대로 33")))
    }
}
