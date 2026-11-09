package io.tteonaljido.car.handoff

/** How the car reads a relay error status (`schema/pairing-protocol.v1.json` `errors`). */
internal object RelayStatus {
    /** Overload (429) and server errors (5xx) may pass, so they are worth another try. Every other status is a definite answer. */
    fun transient(status: Int): Boolean = status == 429 || status >= 500

    /**
     * True when the relay can never take this result, so it is not kept for re-sending: malformed (400), gone (404, 410)
     * or already answered (409). Overload, server errors and lost connections leave it for a later retry.
     */
    fun resultFinal(status: Int): Boolean = status == 400 || status == 404 || status == 409 || status == 410
}
