package com.aboutface.app.streaming

import java.security.SecureRandom

data class DesktopPairingToken(
    val token: String,
    val createdAtMillis: Long,
    val expiresAtMillis: Long,
    val persistent: Boolean = false
) {
    fun isValid(nowMillis: Long = System.currentTimeMillis()): Boolean = nowMillis < expiresAtMillis
}

data class DesktopStreamingHealth(
    val status: DesktopStreamingStatus = DesktopStreamingStatus.Idle,
    val resolution: String = "1280x720",
    val fps: Int = 30,
    val bitrateKbps: Int? = null,
    val droppedFrames: Int = 0,
    val warning: String? = null
)

enum class DesktopStreamingStatus {
    Idle,
    Pairing,
    Connecting,
    Connected,
    Reconnecting,
    Stopped,
    Error
}

object DesktopStreamingPolicy {
    const val TOKEN_TTL_MILLIS: Long = 5 * 60 * 1000

    val supportedAndroidFeatures = listOf(
        "Live generated preview inside About Face",
        "Photo capture",
        "Video recording",
        "Saving generated media",
        "Android share sheet",
        "About Face app-window screen sharing",
        "Streaming generated output to About Face Desktop"
    )

    val unsupportedAndroidFeatures = listOf(
        "Registering About Face as a normal systemwide Android camera",
        "Replacing Snapchat's live camera feed",
        "Replacing Instagram's live camera feed",
        "Camera injection into unrelated apps",
        "Bypassing liveness or identity checks"
    )

    fun createShortLivedToken(nowMillis: Long = System.currentTimeMillis()): DesktopPairingToken {
        val bytes = ByteArray(12)
        SecureRandom().nextBytes(bytes)
        val token = bytes.joinToString("") { "%02x".format(it) }
            .chunked(4)
            .joinToString("-")
        return DesktopPairingToken(
            token = token,
            createdAtMillis = nowMillis,
            expiresAtMillis = nowMillis + TOKEN_TTL_MILLIS
        )
    }
}
