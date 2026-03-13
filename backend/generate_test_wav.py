import wave
import struct
import math

def create_dummy_wav(filename="test.wav", duration=2.0, sample_rate=16000, frequency=440.0):
    """
    Creates a dummy WAV file with a simple sine wave tone.
    useful for testing the API endpoint.
    """
    num_samples = int(duration * sample_rate)
    
    with wave.open(filename, 'w') as wav_file:
        # Set parameters: 1 channel (mono), 2 bytes per sample (16-bit), sample rate
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        
        # Generate raw audio data (sine wave)
        for i in range(num_samples):
            value = int(32767.0 * math.sin(2.0 * math.pi * frequency * i / sample_rate))
            data = struct.pack('<h', value)
            wav_file.writeframesraw(data)

if __name__ == "__main__":
    create_dummy_wav()
    print("Created test.wav successfully!")
