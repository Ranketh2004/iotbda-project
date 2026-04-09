from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import logging
import asyncio
import struct
import time
import json
from typing import List

from utils.audio_processing import preprocess_audio
from services.cry_detection_service import cry_service
from services.state_manager import state_manager

router = APIRouter(tags=["AudioStream"])
logger = logging.getLogger(__name__)

# ── Connected listener clients (browser) ─────────────────────
listener_clients: List[WebSocket] = []

# ── Track ESP32 audio source ─────────────────────────────────
esp_audio_connected: bool = False

# ── Real-time cry detection settings ─────────────────────────
SAMPLE_RATE = 16000
SAMPLE_BITS = 16
CHANNELS = 1
CRY_DETECT_SECONDS = 5
CRY_DETECT_BYTES = SAMPLE_RATE * (SAMPLE_BITS // 8) * CRY_DETECT_SECONDS  # 96000 bytes
WAV_HEADER_SIZE = 44
MIN_DETECT_INTERVAL = 2.0  # seconds between detections to avoid spam


def build_wav_header(data_size: int) -> bytes:
    """Build a minimal WAV header for raw PCM data."""
    byte_rate = SAMPLE_RATE * CHANNELS * (SAMPLE_BITS // 8)
    block_align = CHANNELS * (SAMPLE_BITS // 8)
    file_size = data_size + WAV_HEADER_SIZE - 8

    header = struct.pack('<4sI4s', b'RIFF', file_size, b'WAVE')
    header += struct.pack('<4sIHHIIHH', b'fmt ', 16, 1, CHANNELS,
                          SAMPLE_RATE, byte_rate, block_align, SAMPLE_BITS)
    header += struct.pack('<4sI', b'data', data_size)
    return header


async def run_cry_detection(pcm_data: bytes):
    """Run cry detection on accumulated PCM audio and broadcast result."""
    try:
        # Build WAV from raw PCM
        wav_header = build_wav_header(len(pcm_data))
        wav_bytes = wav_header + pcm_data

        # Preprocess and detect (run in thread to not block event loop)
        loop = asyncio.get_event_loop()
        features = await loop.run_in_executor(None, preprocess_audio, wav_bytes)
        prediction = await loop.run_in_executor(None, cry_service.detect_cry, features)

        is_crying = True if prediction in ['belly pain', 'burping', 'cold_hot', 'discomfort', 'hungry', 'laugh', 'noise', 'silence', 'tired'] else False

        result = {
            "cry_detected": bool(is_crying),
            "message": "Baby is crying! 🚨" if is_crying else "No cry detected",
            "timestamp": time.time(),
            "source": "realtime_stream"
        }

        # Update state manager (broadcasts to main /ws clients)
        await state_manager.update_cry_status(result)

        # Also send cry alert directly to audio-listen clients as text
        if is_crying:
            logger.warning("[CryDetect] 🚨 BABY CRYING DETECTED from real-time stream!")
            alert_msg = json.dumps({"type": "cry_alert", "data": result})
            dead = []
            for client in listener_clients:
                try:
                    await client.send_text(alert_msg)
                except Exception:
                    dead.append(client)
            for d in dead:
                if d in listener_clients:
                    listener_clients.remove(d)
        else:
            logger.info("[CryDetect] No cry detected in stream chunk.")

    except Exception as e:
        logger.error(f"[CryDetect] Error during real-time detection: {e}")


@router.websocket("/ws/audio-stream")
async def audio_stream_from_esp(ws: WebSocket):
    """
    ESP32 connects here and continuously sends raw PCM audio frames.
    Each binary frame is relayed to every connected browser listener.
    Also accumulates audio for real-time cry detection.
    Protocol: ESP32 sends binary frames (raw 16-bit PCM, 16 kHz, mono).
    """
    global esp_audio_connected
    await ws.accept()
    esp_audio_connected = True
    logger.info("[AudioStream] ESP32 audio source connected.")

    # Accumulation buffer for cry detection
    pcm_buffer = bytearray()
    last_detection_time = 0

    try:
        while True:
            data = await ws.receive_bytes()

            # Relay to all browser listeners
            dead: List[WebSocket] = []
            for client in listener_clients:
                try:
                    await client.send_bytes(data)
                except Exception:
                    dead.append(client)
            for d in dead:
                if d in listener_clients:
                    listener_clients.remove(d)

            # Accumulate for cry detection
            pcm_buffer.extend(data)

            if len(pcm_buffer) >= CRY_DETECT_BYTES:
                now = time.time()
                if now - last_detection_time >= MIN_DETECT_INTERVAL:
                    last_detection_time = now
                    # Take exactly CRY_DETECT_BYTES and run detection
                    chunk = bytes(pcm_buffer[:CRY_DETECT_BYTES])
                    pcm_buffer = pcm_buffer[CRY_DETECT_BYTES:]
                    # Run detection without blocking the relay loop
                    asyncio.create_task(run_cry_detection(chunk))
                else:
                    # Discard old data to prevent memory growth
                    pcm_buffer = pcm_buffer[-CRY_DETECT_BYTES:]

    except WebSocketDisconnect:
        logger.info("[AudioStream] ESP32 audio source disconnected.")
    except Exception as e:
        logger.error(f"[AudioStream] ESP32 error: {e}")
    finally:
        esp_audio_connected = False


@router.websocket("/ws/audio-listen")
async def audio_listen(ws: WebSocket):
    """
    Browser clients connect here to receive real-time audio
    AND cry detection alerts as text JSON messages.
    They receive binary PCM frames (16-bit, 16 kHz, mono) decoded via Web Audio API.
    """
    await ws.accept()
    listener_clients.append(ws)
    count = len(listener_clients)
    logger.info(f"[AudioStream] Browser listener connected. Total: {count}, ESP32 source: {esp_audio_connected}")

    try:
        # Send a text message so the browser knows the connection is live
        await ws.send_text("connected")

        while True:
            # Keep alive — client may send ping/control messages
            msg = await ws.receive_text()
            if msg == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"[AudioStream] Listener error: {e}")
    finally:
        if ws in listener_clients:
            listener_clients.remove(ws)
        logger.info(f"[AudioStream] Browser listener disconnected. Total: {len(listener_clients)}")
