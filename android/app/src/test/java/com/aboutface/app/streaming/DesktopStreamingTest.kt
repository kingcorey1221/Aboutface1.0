package com.aboutface.app.streaming

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DesktopStreamingTest {
    @Test
    fun pairingTokenIsShortLivedAndNonPersistent() {
        val token = DesktopStreamingPolicy.createShortLivedToken(nowMillis = 1000)
        assertFalse(token.persistent)
        assertTrue(token.isValid(2000))
        assertFalse(token.isValid(1000 + DesktopStreamingPolicy.TOKEN_TTL_MILLIS + 1))
    }

    @Test
    fun policyLabelsSupportedAndUnsupportedCapabilities() {
        assertTrue(
            DesktopStreamingPolicy.supportedAndroidFeatures
                .contains("Streaming generated output to About Face Desktop")
        )
        assertTrue(
            DesktopStreamingPolicy.unsupportedAndroidFeatures
                .contains("Replacing Snapchat's live camera feed")
        )
    }
}
