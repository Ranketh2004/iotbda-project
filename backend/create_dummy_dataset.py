import os
import wave
import struct
import math
import random

# Must match ESP32 audio: 3 seconds, 16kHz, mono, 16-bit
SAMPLE_RATE = 16000
DURATION = 3.0  # seconds, matches ESP32's AUDIO_SEND_SECONDS


def create_dummy_wav(filename, duration, sample_rate, frequencies, amplitude=10000, noise_level=800):
    """
    Creates a dummy WAV file with mixed sine waves and noise.
    frequencies: list of (freq, weight) tuples to mix together.
    """
    num_samples = int(duration * sample_rate)

    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)

        for i in range(num_samples):
            value = 0.0
            for freq, weight in frequencies:
                # Add slight frequency wobble for realism
                f = freq + random.uniform(-5, 5)
                value += weight * math.sin(2.0 * math.pi * f * i / sample_rate)
            # Add noise
            value += random.uniform(-1, 1) * noise_level / amplitude
            sample = int(amplitude * max(-1.0, min(1.0, value)))
            wav_file.writeframesraw(struct.pack('<h', sample))


def generate_dataset():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    crying_dir = os.path.join(base_dir, "data", "crying")
    not_crying_dir = os.path.join(base_dir, "data", "not_crying")

    os.makedirs(crying_dir, exist_ok=True)
    os.makedirs(not_crying_dir, exist_ok=True)

    # ── Crying samples: high-pitched, harmonic-rich tones (300-1200 Hz range) ──
    # Baby cries typically have fundamental freq 300-600 Hz with strong harmonics
    crying_profiles = [
        [(400, 0.6), (800, 0.3), (1200, 0.1)],
        [(350, 0.5), (700, 0.35), (1050, 0.15)],
        [(500, 0.5), (1000, 0.3), (1500, 0.2)],
        [(450, 0.6), (900, 0.25), (1350, 0.15)],
        [(380, 0.55), (760, 0.3), (1140, 0.15)],
        [(420, 0.5), (840, 0.35), (1260, 0.15)],
        [(550, 0.5), (1100, 0.3), (1650, 0.2)],
        [(480, 0.6), (960, 0.25), (1440, 0.15)],
        [(320, 0.55), (640, 0.3), (960, 0.15)],
        [(600, 0.5), (1200, 0.3), (1800, 0.2)],
        [(370, 0.6), (740, 0.25), (1110, 0.15)],
        [(430, 0.5), (860, 0.35), (1290, 0.15)],
        [(510, 0.55), (1020, 0.3), (1530, 0.15)],
        [(440, 0.6), (880, 0.25), (1320, 0.15)],
        [(390, 0.5), (780, 0.35), (1170, 0.15)],
        [(530, 0.55), (1060, 0.3), (1590, 0.15)],
        [(460, 0.6), (920, 0.25), (1380, 0.15)],
        [(340, 0.5), (680, 0.35), (1020, 0.15)],
        [(580, 0.55), (1160, 0.3), (1740, 0.15)],
        [(410, 0.6), (820, 0.25), (1230, 0.15)],
    ]

    # ── Not-crying samples: low ambient noise, single low tones, silence-like ──
    not_crying_profiles = [
        [(100, 0.3)],                        # low hum
        [(60, 0.2), (120, 0.1)],             # electrical hum
        [(200, 0.2)],                        # fan noise
        [(80, 0.15)],                        # very low rumble
        [(150, 0.2), (300, 0.05)],           # ambient
        [(50, 0.1)],                         # near-silence
        [(180, 0.25)],                       # white noise-ish
        [(90, 0.2), (180, 0.1)],             # gentle hum
        [(110, 0.15), (220, 0.08)],          # room tone
        [(70, 0.12)],                        # very quiet
        [(130, 0.2), (260, 0.05)],           # quiet ambient
        [(40, 0.1)],                         # near-silence
        [(160, 0.18)],                       # soft tone
        [(95, 0.15), (190, 0.08)],           # quiet hum
        [(75, 0.12), (150, 0.06)],           # room ambient
        [(55, 0.1)],                         # almost silent
        [(140, 0.2)],                        # low ambient
        [(85, 0.15), (170, 0.08)],           # gentle room
        [(65, 0.1)],                         # very soft
        [(120, 0.18), (240, 0.05)],          # quiet background
    ]

    print(f"Generating {len(crying_profiles)} 'crying' samples ({DURATION}s each) in {crying_dir}...")
    for i, freqs in enumerate(crying_profiles):
        filename = os.path.join(crying_dir, f"dummy_cry_{i}.wav")
        create_dummy_wav(filename, DURATION, SAMPLE_RATE, freqs,
                         amplitude=random.randint(8000, 15000),
                         noise_level=random.randint(500, 1500))

    print(f"Generating {len(not_crying_profiles)} 'not_crying' samples ({DURATION}s each) in {not_crying_dir}...")
    for i, freqs in enumerate(not_crying_profiles):
        filename = os.path.join(not_crying_dir, f"dummy_not_cry_{i}.wav")
        create_dummy_wav(filename, DURATION, SAMPLE_RATE, freqs,
                         amplitude=random.randint(3000, 8000),
                         noise_level=random.randint(200, 600))


if __name__ == "__main__":
    generate_dataset()
    print(f"\nDummy dataset generated! ({DURATION}s samples matching ESP32 audio)")
    print("Now run: python train_model.py")
