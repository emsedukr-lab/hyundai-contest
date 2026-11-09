package io.tteonaljido.car.handoff

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** The relay statuses the import flow acts on; the flow itself needs the Android Keystore and files, so its rules live here. */
class RelayStatusTest {
    /** A result the relay calls malformed (400) is never taken, so flushPending must not re-send it on every resume. */
    @Test fun aRefusedResultIsNotResentForever() {
        for (status in listOf(400, 404, 409, 410)) assertTrue("$status is final", RelayStatus.resultFinal(status))
        for (status in listOf(429, 500, 502, 503)) assertFalse("$status is kept for a retry", RelayStatus.resultFinal(status))
    }

    /** Overload and server errors while fetching the payload are retried; they say nothing about the payload itself. */
    @Test fun overloadAndServerErrorsAreRetriedNotTakenAsAVerdict() {
        for (status in listOf(429, 500, 502, 503)) assertTrue("$status is transient", RelayStatus.transient(status))
        for (status in listOf(400, 401, 404, 409, 410, 413, 422)) assertFalse("$status is a definite answer", RelayStatus.transient(status))
    }
}
