package io.tteonaljido.pairing

import io.tteonaljido.pairing.HandoffEvent.Approve
import io.tteonaljido.pairing.HandoffEvent.ApplyDone
import io.tteonaljido.pairing.HandoffEvent.CodeReady
import io.tteonaljido.pairing.HandoffEvent.Created
import io.tteonaljido.pairing.HandoffEvent.PayloadReady
import io.tteonaljido.pairing.HandoffEvent.Start
import io.tteonaljido.pairing.HandoffEvent.UserCancel
import io.tteonaljido.pairing.HandoffEvent.View
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CarHandoffMachineTest {
    private fun run(vararg events: HandoffEvent, from: HandoffState = HandoffState.Idle): Pair<HandoffState, List<Effect>> {
        var s = from
        val effects = mutableListOf<Effect>()
        events.forEach { e -> CarHandoffMachine.reduce(s, e).also { s = it.state; effects += it.effects } }
        return s to effects
    }
    private val qr = Created("https://x/c#v1.a.b.c", 1_000)
    private fun view(state: String, mobilePub: String? = "pub", reason: String? = null) = View(ServerView(state, mobilePub, deadline = 2_000, expireReason = reason, cancelReason = reason))

    @Test fun happyPathCreatesCodeFetchesReviewsAndApplies() {
        val (s, fx) = run(Start, qr, view("CLAIMED"), CodeReady("482913"), view("MOBILE_APPROVED"), PayloadReady, Approve, ApplyDone("IMPORTED_NEW", "L1"))
        assertEquals(HandoffState.Done("IMPORTED_NEW", "L1"), s)
        assertEquals(listOf(Effect.CreateSession, Effect.ComputeCode("pub"), Effect.FetchPayload, Effect.ApplyChoice, Effect.Disconnect), fx)
    }

    @Test fun nothingIsAppliedWithoutTheCarApproval() {
        val (s, fx) = run(Start, qr, view("CLAIMED"), CodeReady("1"), view("MOBILE_APPROVED"), PayloadReady)
        assertTrue(s is HandoffState.Review)
        assertTrue(Effect.ApplyChoice !in fx)
    }

    @Test fun decliningInReviewReportsUserDeclined() {
        val (s, fx) = run(Start, qr, view("CLAIMED"), CodeReady("1"), view("MOBILE_APPROVED"), PayloadReady, UserCancel)
        assertEquals(HandoffState.Done("USER_DECLINED", null), s)
        assertTrue(Effect.ReportRejected("USER_DECLINED") in fx)
    }

    @Test fun cancellingBeforeReviewCancelsTheServerSession() {
        val (s, fx) = run(Start, qr, UserCancel)
        assertEquals(HandoffState.Cancelled("CAR"), s)
        assertTrue(Effect.CancelRemote in fx)
    }

    @Test fun qrExpiresLocallyEvenWithoutNetwork() {
        val (s, _) = run(Start, qr, HandoffEvent.Tick(999))
        assertTrue(s is HandoffState.ShowingQr)
        assertEquals(HandoffState.Expired("QR"), run(Start, qr, HandoffEvent.Tick(1_000)).first)
    }

    @Test fun serverExpiryOrPhoneCancelEndsTheFlowAndDiscardsTheReview() {
        assertEquals(HandoffState.Expired("RESULT"), run(Start, qr, view("CLAIMED"), CodeReady("1"), view("MOBILE_APPROVED"), PayloadReady, view("EXPIRED", reason = "RESULT")).first)
        assertEquals(HandoffState.Cancelled("MOBILE"), run(Start, qr, view("CLAIMED"), CodeReady("1"), view("CANCELLED", reason = "MOBILE")).first)
    }

    @Test fun aLocalCommitCannotBeInterruptedByServerPushes() {
        val (applying, _) = run(Start, qr, view("CLAIMED"), CodeReady("1"), view("MOBILE_APPROVED"), PayloadReady, Approve)
        val (s, _) = run(view("EXPIRED", reason = "UNCONFIRMED"), ApplyDone("UPDATED", "L1"), from = applying)
        assertEquals(HandoffState.Done("UPDATED", "L1"), s)
    }

    @Test fun invalidPayloadIsReportedAndShown() {
        val (s, fx) = run(Start, qr, view("CLAIMED"), CodeReady("1"), view("MOBILE_APPROVED"), HandoffEvent.PayloadRejected(FailKind.INVALID, "INVALID_PAYLOAD"))
        assertEquals(HandoffState.Failed(FailKind.INVALID), s)
        assertTrue(Effect.ReportRejected("INVALID_PAYLOAD") in fx)
    }

    @Test fun storageFailureIsReportedAsRejected() {
        val (applying, _) = run(Start, qr, view("CLAIMED"), CodeReady("1"), view("MOBILE_APPROVED"), PayloadReady, Approve)
        val (s, fx) = run(HandoffEvent.ApplyFailed, from = applying)
        assertEquals(HandoffState.Failed(FailKind.STORAGE), s)
        assertTrue(Effect.ReportRejected("STORAGE_ERROR") in fx)
    }

    @Test fun newQrFromAnyEndStateAndReissueCancelsAShownQr() {
        for (end in listOf(HandoffState.Expired("QR"), HandoffState.Cancelled("MOBILE"), HandoffState.Failed(FailKind.NETWORK), HandoffState.Done("IMPORTED_NEW", "x"))) {
            assertEquals(HandoffState.Creating, CarHandoffMachine.reduce(end, Start).state)
        }
        assertEquals(listOf(Effect.CancelRemote, Effect.CreateSession), run(Start, qr, Start).second.drop(1))
    }

    @Test fun startIsIgnoredMidFlow() {
        val (claimed, _) = run(Start, qr, view("CLAIMED"), CodeReady("1"))
        assertEquals(claimed, CarHandoffMachine.reduce(claimed, Start).state)
    }
}
