package io.tteonaljido.trip

/**
 * How a place the navigation returned relates to the place we asked for (spec 24-3 "re-confirm places").
 * Same POI or within 150 m binds automatically; 150 m–2 km asks the user; beyond that warns.
 */
enum class Match { SAME, NEAR, FAR }

object PlaceMatch {
    const val SAME_METRES = 150.0
    const val NEAR_METRES = 2_000.0

    /** Without planned coordinates nothing can be checked automatically, so the user always confirms (NEAR). */
    fun classify(wantLatE7: Int?, wantLonE7: Int?, wantPoiId: String?, gotLatE7: Int, gotLonE7: Int, gotPoiId: String?): Match {
        if (!wantPoiId.isNullOrEmpty() && wantPoiId == gotPoiId) return Match.SAME
        if (wantLatE7 == null || wantLonE7 == null) return Match.NEAR
        val d = metres(wantLatE7, wantLonE7, gotLatE7, gotLonE7)
        return when {
            d <= SAME_METRES -> Match.SAME
            d <= NEAR_METRES -> Match.NEAR
            else -> Match.FAR
        }
    }

    /** Search keyword for the navigation's own search: the place name plus its city or county. */
    fun keyword(place: Place): String {
        val region = place.address.split(' ').firstOrNull { it.endsWith("시") || it.endsWith("군") }
        return listOfNotNull(place.name, region?.takeIf { it !in place.name }).joinToString(" ").take(40)
    }
}
