package io.tteonaljido.car.handoff

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.io.IOException
import java.util.concurrent.TimeUnit

/** Wire types of the relay (packages/shared/src/protocol.ts). */
@Serializable
data class SessionViewDto(
    val sid: String,
    val state: String,
    val serverTime: Long,
    val qrExpiresAt: Long,
    val deadline: Long,
    val claimed: Boolean,
    val carFetched: Boolean,
    val outcome: String? = null,
    val resultCode: String? = null,
    val appliedRevision: Int? = null,
    val cancelReason: String? = null,
    val expireReason: String? = null,
    val mobilePub: String? = null,
    val supportedSchemaVersions: List<Int> = emptyList(),
    val carAppVersion: String = "",
)

@Serializable data class CreateRequest(val carPub: String, val appVersion: String, val supportedSchemaVersions: List<Int>)
@Serializable data class CreateResponse(val sid: String, val scanSecret: String, val carToken: String, val qrExpiresAt: Long, val serverTime: Long)
@Serializable data class PayloadDto(val iv: String, val ct: String, val schemaVersion: Int, val mobilePub: String? = null)
@Serializable data class ResultRequest(val outcome: String, val resultCode: String, val appliedRevision: Int?)
@Serializable private data class StateMessage(val type: String, val session: SessionViewDto)
@Serializable private data class ErrorBody(val error: String)

class ApiException(val code: String, val status: Int) : IOException("$status $code")

class PairingClient(private val base: String, private val http: OkHttpClient = defaultClient()) {
    private val json = Json { ignoreUnknownKeys = true }
    private val jsonType = "application/json; charset=utf-8".toMediaType()

    private suspend inline fun <reified T> call(method: String, path: String, token: String?, body: String? = null): T = withContext(Dispatchers.IO) {
        val req = Request.Builder()
            .url("$base/api/v1$path")
            .method(method, body?.toRequestBody(jsonType) ?: if (method == "POST" || method == "PUT") "".toRequestBody(jsonType) else null)
            .apply { if (token != null) header("Authorization", "Bearer $token") }
            .build()
        http.newCall(req).execute().use { res -> decode(res) }
    }

    private inline fun <reified T> decode(res: Response): T {
        val text = res.body?.string().orEmpty()
        if (!res.isSuccessful) throw ApiException(runCatching { json.decodeFromString<ErrorBody>(text).error }.getOrDefault("HTTP"), res.code)
        return json.decodeFromString(text)
    }

    suspend fun create(carPub: String, appVersion: String): CreateResponse =
        call("POST", "/sessions", null, json.encodeToString(CreateRequest.serializer(), CreateRequest(carPub, appVersion, listOf(1))))

    suspend fun snapshot(sid: String, token: String): SessionViewDto = call("GET", "/sessions/$sid", token)
    suspend fun payload(sid: String, token: String): PayloadDto = call("GET", "/sessions/$sid/payload", token)
    suspend fun lock(sid: String, token: String): SessionViewDto = call("POST", "/sessions/$sid/lock", token)
    suspend fun cancel(sid: String, token: String): SessionViewDto = call("POST", "/sessions/$sid/cancel", token)
    suspend fun result(sid: String, token: String, r: ResultRequest): SessionViewDto =
        call("POST", "/sessions/$sid/result", token, json.encodeToString(ResultRequest.serializer(), r))

    /** Server pushes; the flow ends (normally or with an error) when the socket closes, and the caller reconnects. */
    fun events(sid: String, token: String): Flow<SessionViewDto> = callbackFlow {
        val req = Request.Builder().url("$base/api/v1/sessions/$sid/events").header("Authorization", "Bearer $token").build()
        val ws = http.newWebSocket(req, object : WebSocketListener() {
            override fun onMessage(webSocket: WebSocket, text: String) {
                runCatching { json.decodeFromString<StateMessage>(text) }.getOrNull()?.takeIf { it.type == "state" }?.let { trySend(it.session) }
            }
            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) { close() }
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) { close(t) }
        })
        awaitClose { ws.cancel() }
    }

    companion object {
        fun defaultClient(): OkHttpClient = OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .pingInterval(20, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()
    }
}
