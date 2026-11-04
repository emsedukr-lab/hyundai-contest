package io.tteonaljido.car.handoff

import android.os.SystemClock
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.tteonaljido.car.BuildConfig
import io.tteonaljido.car.storage.ActiveSession
import io.tteonaljido.car.storage.PendingResult
import io.tteonaljido.car.storage.SessionStore
import io.tteonaljido.car.storage.TripRepository
import io.tteonaljido.pairing.CarHandoffMachine
import io.tteonaljido.pairing.Effect
import io.tteonaljido.pairing.FailKind
import io.tteonaljido.pairing.HandoffCrypto
import io.tteonaljido.pairing.HandoffEvent
import io.tteonaljido.pairing.HandoffState
import io.tteonaljido.pairing.ServerView
import io.tteonaljido.trip.CarOverlay
import io.tteonaljido.trip.Decision
import io.tteonaljido.trip.ImportChoice
import io.tteonaljido.trip.ImportDecision
import io.tteonaljido.trip.IntegrityCode
import io.tteonaljido.trip.ParseResult
import io.tteonaljido.trip.TransferParser
import io.tteonaljido.trip.TripTransfer
import io.tteonaljido.trip.TripValidator
import io.tteonaljido.trip.ValidationReport
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.security.PrivateKey
import java.time.LocalDate
import java.time.ZoneId
import java.util.UUID

data class ReviewData(val transfer: TripTransfer, val decision: Decision, val report: ValidationReport)

/**
 * Runs the effects of [CarHandoffMachine]. Every network step can be repeated: payload GET, lock and
 * result are idempotent on the relay, and an unacknowledged result is persisted and re-sent.
 */
class ImportViewModel(
    private val client: PairingClient,
    private val trips: () -> TripRepository,
    private val sessions: SessionStore,
    private val webOrigin: String,
    private val onTripsChanged: () -> Unit,
    private val clock: () -> Long = SystemClock::elapsedRealtime,
) : ViewModel() {
    private val _state = MutableStateFlow<HandoffState>(HandoffState.Idle)
    val state: StateFlow<HandoffState> = _state
    private val _review = MutableStateFlow<ReviewData?>(null)
    val review: StateFlow<ReviewData?> = _review
    private val _now = MutableStateFlow(clock())
    val now: StateFlow<Long> = _now
    private val _offline = MutableStateFlow(false)
    val offline: StateFlow<Boolean> = _offline

    private class Live(val sid: String, val token: String, val privateKey: PrivateKey, val carPub: ByteArray, val qrUrl: String)
    private var live: Live? = null
    private var sessionKey: ByteArray? = null
    private var choice: ImportChoice? = null
    private var lastView: ServerView? = null
    private var jobs = mutableListOf<Job>()

    init {
        viewModelScope.launch { flushPending() }
        viewModelScope.launch { restore() }
    }

    fun start() = dispatch(HandoffEvent.Start)
    fun cancel() = dispatch(HandoffEvent.UserCancel)
    fun choose(c: ImportChoice) {
        if (c == ImportChoice.CANCEL) return dispatch(HandoffEvent.UserCancel)
        choice = c
        dispatch(HandoffEvent.Approve)
    }

    /** Leaves the import screen; a finished session is forgotten, a live one keeps running in the background. */
    fun dismissIfFinished() {
        if (CarHandoffMachine.isTerminal(_state.value)) {
            _state.value = HandoffState.Idle
            _review.value = null
        }
    }

    private fun dispatch(e: HandoffEvent) {
        val step = CarHandoffMachine.reduce(_state.value, e)
        _state.value = step.state
        step.effects.forEach(::perform)
        // A view that arrived before the code was ready is replayed once the car can act on it.
        if (e is HandoffEvent.CodeReady) lastView?.let { if (it.state != "CLAIMED") dispatch(HandoffEvent.View(it)) }
    }

    private fun perform(effect: Effect) {
        when (effect) {
            Effect.CreateSession -> viewModelScope.launch { create() }
            is Effect.ComputeCode -> viewModelScope.launch { computeCode(effect.mobilePub) }
            Effect.FetchPayload -> viewModelScope.launch { fetchPayload() }
            Effect.ApplyChoice -> viewModelScope.launch { apply() }
            is Effect.ReportRejected -> live.let { s -> viewModelScope.launch { report("REJECTED", effect.resultCode, null, s) } }
            Effect.CancelRemote -> live?.let { s -> viewModelScope.launch { runCatching { client.cancel(s.sid, s.token) } } }
            Effect.Disconnect -> disconnect()
        }
    }

    private suspend fun create() {
        disconnect()
        try {
            val kp = HandoffCrypto.generateKeyPair()
            val pub = HandoffCrypto.publicRaw(kp.public)
            val r = client.create(HandoffCrypto.b64url(pub), BuildConfig.VERSION_NAME)
            val url = HandoffCrypto.qrUrl(webOrigin, r.sid, r.scanSecret, HandoffCrypto.fingerprint(pub))
            live = Live(r.sid, r.carToken, kp.private, pub, url)
            sessions.saveActive(ActiveSession(r.sid, r.carToken, HandoffCrypto.b64url(HandoffCrypto.privateScalar(kp.private)), HandoffCrypto.b64url(pub), url, System.currentTimeMillis()))
            if (BuildConfig.DEBUG) Log.d("Tteonaljido", "QR $url") // debug builds only, so a desktop browser can play the phone
            dispatch(HandoffEvent.Created(url, clock() + (r.qrExpiresAt - r.serverTime)))
            follow()
        } catch (e: Exception) {
            dispatch(HandoffEvent.CreateFailed(if (e is ApiException) FailKind.SERVER else FailKind.NETWORK))
        }
    }

    private fun toView(d: SessionViewDto) = ServerView(d.state, d.mobilePub, clock() + (d.deadline - d.serverTime), d.carFetched, d.expireReason, d.cancelReason)

    private fun onView(d: SessionViewDto) {
        _offline.value = false
        val v = toView(d)
        lastView = v
        dispatch(HandoffEvent.View(v))
    }

    /** WebSocket push with reconnect, a slow snapshot poll as a safety net, and a 1-second clock for countdowns. */
    private fun follow() {
        val s = live ?: return
        jobs += viewModelScope.launch {
            var backoff = 1_000L
            while (isActive && live === s) {
                try {
                    onView(client.snapshot(s.sid, s.token))
                    client.events(s.sid, s.token).collect { onView(it); backoff = 1_000L }
                } catch (e: ApiException) {
                    if (e.status == 404) { dispatch(HandoffEvent.View(ServerView("EXPIRED", expireReason = "QR"))); return@launch }
                } catch (e: Exception) {
                    _offline.value = true
                }
                delay(backoff)
                backoff = (backoff * 2).coerceAtMost(15_000L)
            }
        }
        jobs += viewModelScope.launch {
            while (isActive && live === s) {
                delay(5_000)
                runCatching { client.snapshot(s.sid, s.token) }.onSuccess(::onView)
            }
        }
        jobs += viewModelScope.launch {
            while (isActive && live === s) {
                _now.value = clock()
                dispatch(HandoffEvent.Tick(_now.value))
                delay(1_000)
            }
        }
    }

    private fun computeCode(mobilePub: String) {
        val s = live ?: return
        try {
            val mp = HandoffCrypto.fromB64url(mobilePub)
            val z = HandoffCrypto.sharedSecret(s.privateKey, HandoffCrypto.publicFromRaw(mp))
            val keys = HandoffCrypto.deriveSessionKeys(z, s.sid, s.carPub, mp)
            sessionKey = keys.key
            dispatch(HandoffEvent.CodeReady(keys.confirmCode))
        } catch (e: Exception) {
            viewModelScope.launch { runCatching { client.cancel(s.sid, s.token) } }
            disconnect()
            _state.value = HandoffState.Failed(FailKind.SECURITY)
        }
    }

    private suspend fun fetchPayload() {
        val s = live ?: return
        var attempt = 0
        while (live === s) {
            try {
                val p = client.payload(s.sid, s.token)
                if (p.mobilePub != null && p.mobilePub != lastView?.mobilePub) return dispatch(HandoffEvent.PayloadRejected(FailKind.SECURITY, "DECRYPT_FAILED"))
                val plain = try {
                    HandoffCrypto.decrypt(sessionKey!!, p.iv, p.ct, HandoffCrypto.aad(s.sid, p.schemaVersion)).decodeToString()
                } catch (e: Exception) {
                    return dispatch(HandoffEvent.PayloadRejected(FailKind.DECRYPT, "DECRYPT_FAILED"))
                }
                when (val r = TransferParser.parse(plain)) {
                    is ParseResult.Rejected -> dispatch(
                        if (r.code == IntegrityCode.UNSUPPORTED_VERSION) HandoffEvent.PayloadRejected(FailKind.UNSUPPORTED, "UNSUPPORTED_VERSION")
                        else HandoffEvent.PayloadRejected(FailKind.INVALID, "INVALID_PAYLOAD"),
                    )
                    is ParseResult.Ok -> {
                        val trip = r.transfer.trip
                        val stored = trips().load().trips
                        val decision = ImportDecision.decide(trip, stored)
                        val today = runCatching { LocalDate.now(ZoneId.of(trip.timezone)) }.getOrNull()
                        val report = TripValidator.validate(trip, decision.existing?.overlay ?: CarOverlay(), today)
                        _review.value = ReviewData(r.transfer, decision, report)
                        dispatch(HandoffEvent.PayloadReady)
                    }
                }
                return
            } catch (e: ApiException) {
                if (e.status == 410 || e.status == 404) return dispatch(HandoffEvent.View(ServerView("EXPIRED", expireReason = "RESULT")))
                return dispatch(HandoffEvent.PayloadRejected(FailKind.SERVER, "INVALID_PAYLOAD"))
            } catch (e: Exception) {
                _offline.value = true
                delay(minOf(15_000L, 1_000L shl attempt++))
            }
        }
    }

    private suspend fun apply() {
        val s = live ?: return
        val review = _review.value ?: return dispatch(HandoffEvent.ApplyFailed)
        val c = choice ?: return dispatch(HandoffEvent.ApplyFailed)
        try {
            retrying { client.lock(s.sid, s.token) }
        } catch (e: ApiException) {
            // The session ended before the commit gate: nothing is written.
            _review.value = null
            disconnect()
            _state.value = HandoffState.Expired("RESULT")
            return
        }
        val applied = try {
            ImportDecision.apply(c, review.transfer.trip, review.decision, UUID.randomUUID().toString(), System.currentTimeMillis()).also { a ->
                a.trip?.let { trips().save(it) }
            }
        } catch (e: Exception) {
            return dispatch(HandoffEvent.ApplyFailed)
        }
        onTripsChanged()
        dispatch(HandoffEvent.ApplyDone(applied.resultCode, applied.trip?.localId ?: review.decision.existing?.localId))
        report("APPLIED", applied.resultCode, review.transfer.trip.revision, s)
        _review.value = null
    }

    /** Persists the result before sending it, so an app kill or network loss cannot lose the answer. */
    private suspend fun report(outcome: String, code: String, revision: Int?, s: Live?) {
        s ?: return
        val p = PendingResult(s.sid, s.token, outcome, code, revision)
        runCatching { sessions.savePending(p) }
        if (send(p)) sessions.clearPending()
    }

    private suspend fun send(p: PendingResult): Boolean = try {
        retrying { client.result(p.sid, p.carToken, ResultRequest(p.outcome, p.resultCode, p.appliedRevision)) }
        true
    } catch (e: ApiException) {
        true // the session ended or the result was already recorded: nothing left to retry
    } catch (e: Exception) {
        false
    }

    private suspend fun flushPending() {
        val p = sessions.loadPending() ?: return
        if (send(p)) sessions.clearPending()
    }

    /** After an app restart within the session lifetime, picks the flow up where the server says it is. */
    private suspend fun restore() {
        val a = sessions.loadActive() ?: return
        if (System.currentTimeMillis() - a.createdAt > 30 * 60_000L) return sessions.clearActive()
        val view = runCatching { client.snapshot(a.sid, a.carToken) }.getOrNull() ?: return sessions.clearActive()
        if (view.state in listOf("APPLIED", "REJECTED", "CANCELLED", "EXPIRED")) return sessions.clearActive()
        live = Live(a.sid, a.carToken, HandoffCrypto.privateFromScalar(HandoffCrypto.fromB64url(a.privateScalar)), HandoffCrypto.fromB64url(a.carPub), a.qrUrl)
        _state.value = HandoffState.ShowingQr(a.qrUrl, clock() + (view.qrExpiresAt - view.serverTime))
        onView(view)
        follow()
    }

    private fun disconnect() {
        jobs.forEach { it.cancel() }
        jobs.clear()
        live = null
        sessionKey?.fill(0)
        sessionKey = null
        lastView = null
        runCatching { sessions.clearActive() }
    }

    private suspend fun <T> retrying(block: suspend () -> T): T {
        var wait = 1_000L
        repeat(4) {
            try {
                return block()
            } catch (e: ApiException) {
                throw e
            } catch (e: Exception) {
                _offline.value = true
                delay(wait)
                wait *= 2
            }
        }
        return block()
    }

    override fun onCleared() {
        jobs.forEach { it.cancel() }
    }
}
