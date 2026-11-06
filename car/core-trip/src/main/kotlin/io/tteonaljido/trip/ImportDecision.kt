package io.tteonaljido.trip

/**
 * What the car offers when a trip arrives (spec 24-4): never auto-merge, never overwrite without asking,
 * and an identical resend changes nothing.
 */
enum class ImportCase { NEW, SAME, NEWER, OLDER, DIVERGED }

enum class ImportChoice { IMPORT_NEW, UPDATE, SAVE_COPY, ACKNOWLEDGE_SAME, ADD_HOME, CANCEL }

/** One line of an update summary; `text` is Korean, apps localize from `code` + `args` (strings `change_<code>`). */
data class Change(val code: String, val text: String, val args: List<String> = emptyList())

data class Decision(val case: ImportCase, val existing: LocalTrip?, val choices: List<ImportChoice>, val changes: List<Change> = emptyList())

data class Applied(val trip: LocalTrip?, val resultCode: String)

object ImportDecision {
    fun decide(incoming: Trip, stored: List<LocalTrip>): Decision {
        val existing = stored.firstOrNull { it.meta.sourceTripId == incoming.tripId }
            ?: return Decision(ImportCase.NEW, null, listOf(ImportChoice.IMPORT_NEW, ImportChoice.CANCEL))
        val hash = PlanHash.of(incoming)
        return when {
            incoming.revision == existing.meta.revision && hash == existing.meta.planHash -> {
                // Home is left out of the hash, so sharing a home address later arrives as an identical resend.
                // When the stored plan still has no home, offer to fill just that in — nothing else changes.
                val addHome = incoming.home != null && existing.plan.home == null
                if (addHome)
                    Decision(ImportCase.SAME, existing, listOf(ImportChoice.ADD_HOME, ImportChoice.ACKNOWLEDGE_SAME), listOf(Change("HOME_ADDED", "집 주소 추가")))
                else
                    Decision(ImportCase.SAME, existing, listOf(ImportChoice.ACKNOWLEDGE_SAME))
            }
            incoming.revision > existing.meta.revision ->
                Decision(ImportCase.NEWER, existing, listOf(ImportChoice.UPDATE, ImportChoice.SAVE_COPY, ImportChoice.CANCEL), changes(existing.plan, incoming))
            incoming.revision < existing.meta.revision ->
                Decision(ImportCase.OLDER, existing, listOf(ImportChoice.SAVE_COPY, ImportChoice.CANCEL))
            else -> Decision(ImportCase.DIVERGED, existing, listOf(ImportChoice.SAVE_COPY, ImportChoice.CANCEL), changes(existing.plan, incoming))
        }
    }

    fun apply(choice: ImportChoice, incoming: Trip, decision: Decision, newId: String, now: Long): Applied {
        require(choice in decision.choices) { "choice $choice not offered for ${decision.case}" }
        fun meta(source: String?, copy: Boolean = false) = ImportMeta(source, incoming.revision, PlanHash.of(incoming), now, copy)
        return when (choice) {
            ImportChoice.IMPORT_NEW -> Applied(LocalTrip(newId, incoming, CarOverlay(), meta(incoming.tripId)), "IMPORTED_NEW")
            ImportChoice.UPDATE -> {
                val old = decision.existing!!
                Applied(old.copy(plan = incoming, overlay = reconcile(old.overlay, incoming), meta = meta(incoming.tripId)), "UPDATED")
            }
            // The plan is stored exactly as sent; "copy" is metadata and screens add the suffix in the UI language.
            ImportChoice.SAVE_COPY -> Applied(LocalTrip(newId, incoming, CarOverlay(), meta(null, copy = true)), "SAVED_AS_COPY")
            // Only the home address is filled in; the plan, overlay and hash (which excludes home) are otherwise untouched.
            ImportChoice.ADD_HOME -> {
                val old = decision.existing!!
                Applied(old.copy(plan = old.plan.copy(home = incoming.home), meta = old.meta.copy(importedAt = now)), "HOME_ADDED")
            }
            ImportChoice.ACKNOWLEDGE_SAME -> Applied(null, "ALREADY_IMPORTED")
            ImportChoice.CANCEL -> Applied(null, "USER_DECLINED")
        }
    }

    /** Keeps car-side knowledge that still fits the new plan; drops bindings of removed or moved places. */
    fun reconcile(overlay: CarOverlay, incoming: Trip): CarOverlay {
        val places = incoming.places.associateBy { it.placeRef }
        val bindings = overlay.poiBindings.filter { (ref, b) ->
            val p = places[ref] ?: return@filter false
            val lat = p.latE7
            val lon = p.lonE7
            lat == null || lon == null || metres(lat, lon, b.latE7, b.lonE7) <= 150.0
        }
        val visits = incoming.visits.map { it.visitId }.toSet()
        // Places that still exist but whose confirmed location no longer matches the new plan: their car-side estimates and guiding are stale too.
        val moved = overlay.poiBindings.keys.filter { it in places && it !in bindings }.toSet()
        val known = places.keys + LegKeys.HOME + LegKeys.ORIGIN
        val estimates = overlay.legEstimates.filterKeys { key -> key.split('>').let { ends -> ends.size == 2 && ends.all(known::contains) && ends.none { it in moved } } }
        val guiding = overlay.guiding?.takeIf { g -> (g.visitId == null || g.visitId in visits) && (g.placeRef == null || (g.placeRef in places && g.placeRef !in moved)) }
        return overlay.copy(
            poiBindings = bindings,
            visited = overlay.visited.filter { it in visits }.toSet(),
            visitedAt = overlay.visitedAt.filterKeys { it in visits },
            skipped = overlay.skipped.filter { it in visits }.toSet(),
            legEstimates = estimates,
            guiding = guiding,
        )
    }

    /** Short human summary of what an update would change. */
    fun changes(old: Trip, new: Trip): List<Change> {
        val out = mutableListOf<Change>()
        fun c(code: String, text: String, vararg args: Any) { out += Change(code, text, args.map(Any::toString)) }
        if (old.name != new.name) c("NAME", "이름: ${old.name} → ${new.name}", old.name, new.name)
        if (old.startDate != new.startDate || old.endDate != new.endDate) c("PERIOD", "기간: ${old.startDate}~${old.endDate} → ${new.startDate}~${new.endDate}", "${old.startDate}~${old.endDate}", "${new.startDate}~${new.endDate}")
        val oldPlaces = old.places.map { it.placeRef }.toSet()
        val newPlaces = new.places.map { it.placeRef }.toSet()
        (newPlaces - oldPlaces).size.takeIf { it > 0 }?.let { c("PLACES_ADDED", "장소 ${it}곳 추가", it) }
        (oldPlaces - newPlaces).size.takeIf { it > 0 }?.let { c("PLACES_REMOVED", "장소 ${it}곳 삭제", it) }
        val oldFixed = old.visits.filter { it.fixed != null }.associate { it.visitId to it.fixed }
        val newFixed = new.visits.filter { it.fixed != null }.associate { it.visitId to it.fixed }
        if (oldFixed != newFixed) c("FIXED", "고정 일정 변경")
        new.days.forEach { d ->
            val o = old.days.getOrNull(d.dayIndex - 1)
            if (o == null || o.visitOrder != d.visitOrder) c("ORDER", "${d.dayIndex}일차 순서 변경", d.dayIndex)
            if (o != null && o.lodgingPlaceRef != d.lodgingPlaceRef) c("LODGING", "${d.dayIndex}일차 숙소 변경", d.dayIndex)
        }
        if (old.firstDay != new.firstDay || old.origin != new.origin || old.finalDestination != new.finalDestination) c("ENDPOINTS", "출발·귀가 설정 변경")
        return out.ifEmpty { listOf(Change("DETAILS", "세부 시간·설정 변경")) }
    }
}
