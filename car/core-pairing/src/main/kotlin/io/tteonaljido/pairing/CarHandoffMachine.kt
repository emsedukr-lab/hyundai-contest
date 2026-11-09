package io.tteonaljido.pairing

/**
 * Car side of one handoff as a pure reducer: (state, event) -> (state, effects).
 * The ViewModel performs the effects; this file decides what is allowed, so it is fully unit-tested.
 * Driving restrictions are a separate input to the UI (the session keeps running while hidden).
 */
sealed interface HandoffState {
    data object Idle : HandoffState
    data object Creating : HandoffState
    data class ShowingQr(val qrUrl: String, val deadline: Long) : HandoffState
    data class Claimed(val code: String, val deadline: Long) : HandoffState
    data class Receiving(val code: String, val deadline: Long) : HandoffState
    data class Review(val code: String, val deadline: Long) : HandoffState
    data object Applying : HandoffState
    data class Done(val resultCode: String, val localId: String?) : HandoffState
    data class Expired(val reason: String) : HandoffState
    data class Cancelled(val by: String) : HandoffState
    data class Failed(val kind: FailKind) : HandoffState
}

enum class FailKind { NETWORK, SERVER, DECRYPT, INVALID, UNSUPPORTED, STORAGE, SECURITY }

/** What the server says, reduced to what the machine needs. Deadlines are already on the local monotonic clock. */
data class ServerView(
    val state: String,
    val mobilePub: String? = null,
    val deadline: Long = 0,
    val carFetched: Boolean = false,
    val expireReason: String? = null,
    val cancelReason: String? = null,
)

sealed interface HandoffEvent {
    data object Start : HandoffEvent
    data class Created(val qrUrl: String, val deadline: Long) : HandoffEvent
    data class CreateFailed(val kind: FailKind) : HandoffEvent
    data class View(val view: ServerView) : HandoffEvent
    data class CodeReady(val code: String) : HandoffEvent
    data object PayloadReady : HandoffEvent
    data class PayloadRejected(val kind: FailKind, val resultCode: String) : HandoffEvent
    /** The relay would not hand the payload over (a refusal, or server errors past the retries): nothing was judged, nothing is reported. */
    data class FetchFailed(val kind: FailKind) : HandoffEvent
    data object Approve : HandoffEvent
    data class ApplyDone(val resultCode: String, val localId: String?) : HandoffEvent
    data object ApplyFailed : HandoffEvent
    data object UserCancel : HandoffEvent
    data class Tick(val now: Long) : HandoffEvent
}

sealed interface Effect {
    data object CreateSession : Effect
    data class ComputeCode(val mobilePub: String) : Effect
    data object FetchPayload : Effect
    data object ApplyChoice : Effect
    data class ReportRejected(val resultCode: String) : Effect
    data object CancelRemote : Effect
    data object Disconnect : Effect
}

data class Step(val state: HandoffState, val effects: List<Effect> = emptyList())

object CarHandoffMachine {
    fun isTerminal(s: HandoffState) = s is HandoffState.Idle || s is HandoffState.Done || s is HandoffState.Expired || s is HandoffState.Cancelled || s is HandoffState.Failed

    fun reduce(s: HandoffState, e: HandoffEvent): Step {
        // Starting over is allowed from any finished state ("새 QR 받기"); the old session is cancelled first.
        if (e is HandoffEvent.Start) {
            return if (isTerminal(s) || s is HandoffState.ShowingQr) Step(HandoffState.Creating, listOfNotNull(Effect.CancelRemote.takeIf { s is HandoffState.ShowingQr }, Effect.CreateSession)) else Step(s)
        }
        if (e is HandoffEvent.View && s !is HandoffState.Applying && !isTerminal(s)) {
            when (e.view.state) {
                "EXPIRED" -> return Step(HandoffState.Expired(e.view.expireReason ?: "QR"), listOf(Effect.Disconnect))
                "CANCELLED" -> return Step(HandoffState.Cancelled(e.view.cancelReason ?: "MOBILE"), listOf(Effect.Disconnect))
            }
        }
        return when (s) {
            is HandoffState.Creating -> when (e) {
                is HandoffEvent.Created -> Step(HandoffState.ShowingQr(e.qrUrl, e.deadline))
                is HandoffEvent.CreateFailed -> Step(HandoffState.Failed(e.kind))
                else -> Step(s)
            }
            is HandoffState.ShowingQr -> when (e) {
                // Claimed: from here the server's deadline (upload window) counts, not the QR countdown; the code inherits it.
                is HandoffEvent.View -> when {
                    e.view.mobilePub != null && e.view.state != "CREATED" -> Step(s.copy(deadline = if (e.view.deadline > 0) e.view.deadline else s.deadline), listOf(Effect.ComputeCode(e.view.mobilePub)))
                    else -> Step(s.copy(deadline = if (e.view.deadline > 0) e.view.deadline else s.deadline))
                }
                is HandoffEvent.CodeReady -> Step(HandoffState.Claimed(e.code, s.deadline))
                is HandoffEvent.Tick -> if (e.now >= s.deadline) Step(HandoffState.Expired("QR"), listOf(Effect.Disconnect)) else Step(s)
                is HandoffEvent.UserCancel -> Step(HandoffState.Cancelled("CAR"), listOf(Effect.CancelRemote, Effect.Disconnect))
                else -> Step(s)
            }
            is HandoffState.Claimed -> when (e) {
                is HandoffEvent.View -> when (e.view.state) {
                    "MOBILE_APPROVED", "CAR_APPLYING" -> Step(HandoffState.Receiving(s.code, if (e.view.deadline > 0) e.view.deadline else s.deadline), listOf(Effect.FetchPayload))
                    else -> Step(s.copy(deadline = if (e.view.deadline > 0) e.view.deadline else s.deadline))
                }
                // With no network the countdown would otherwise sit at 0:00 forever; expire when the upload window passes.
                is HandoffEvent.Tick -> if (e.now >= s.deadline) Step(HandoffState.Expired("UPLOAD"), listOf(Effect.Disconnect)) else Step(s)
                is HandoffEvent.UserCancel -> Step(HandoffState.Cancelled("CAR"), listOf(Effect.CancelRemote, Effect.Disconnect))
                else -> Step(s)
            }
            is HandoffState.Receiving -> when (e) {
                is HandoffEvent.PayloadReady -> Step(HandoffState.Review(s.code, Long.MAX_VALUE))
                is HandoffEvent.PayloadRejected -> Step(HandoffState.Failed(e.kind), listOf(Effect.ReportRejected(e.resultCode), Effect.Disconnect))
                // The car gives up on a session it could not read from: cancel it so the phone is not left waiting.
                is HandoffEvent.FetchFailed -> Step(HandoffState.Failed(e.kind), listOf(Effect.CancelRemote, Effect.Disconnect))
                is HandoffEvent.View -> Step(s.copy(deadline = if (e.view.deadline > 0) e.view.deadline else s.deadline))
                // Fetching the payload retries, but not past the window: give up instead of hanging on "수신 중".
                is HandoffEvent.Tick -> if (e.now >= s.deadline) Step(HandoffState.Expired("RESULT"), listOf(Effect.Disconnect)) else Step(s)
                is HandoffEvent.UserCancel -> Step(HandoffState.Cancelled("CAR"), listOf(Effect.CancelRemote, Effect.Disconnect))
                else -> Step(s)
            }
            is HandoffState.Review -> when (e) {
                is HandoffEvent.View -> Step(s.copy(deadline = if (e.view.deadline > 0) e.view.deadline else s.deadline))
                is HandoffEvent.Approve -> Step(HandoffState.Applying, listOf(Effect.ApplyChoice))
                // Declining here is an answer, not a cancellation: the phone learns "차량에서 취소".
                is HandoffEvent.UserCancel -> Step(HandoffState.Done("USER_DECLINED", null), listOf(Effect.ReportRejected("USER_DECLINED"), Effect.Disconnect))
                is HandoffEvent.Tick -> if (e.now >= s.deadline) Step(HandoffState.Expired("RESULT"), listOf(Effect.Disconnect)) else Step(s)
                else -> Step(s)
            }
            is HandoffState.Applying -> when (e) {
                is HandoffEvent.ApplyDone -> Step(HandoffState.Done(e.resultCode, e.localId), listOf(Effect.Disconnect))
                is HandoffEvent.ApplyFailed -> Step(HandoffState.Failed(FailKind.STORAGE), listOf(Effect.ReportRejected("STORAGE_ERROR"), Effect.Disconnect))
                else -> Step(s) // server pushes (even EXPIRED) cannot interrupt a local commit
            }
            else -> Step(s)
        }
    }
}
