import io
import librosa
import numpy as np
import logging

from config import settings

logger = logging.getLogger(__name__)

def preprocess_audio(audio_bytes: bytes) -> np.ndarray:
    """
    Convert raw audio bytes to a mel spectrogram.
    Expected audio format: raw PCM or WAV mono, 16kHz
    Returns a numpy array representing the normalized mel spectrogram features.
    """
    try:
        # Load audio from bytes
        # librosa.load can take a file-like object. 
        # ESP32 usually sends WAV or raw PCM. Assuming WAV for standard librosa loading.
        audio_file = io.BytesIO(audio_bytes)
        
        # Load with target sample rate, mono
        y, sr = librosa.load(audio_file, sr=settings.SAMPLE_RATE, mono=True)
        
        # Extract Mel Spectrogram
        mel_spectrogram = librosa.feature.melspectrogram(
            y=y, 
            sr=sr, 
            n_mels=settings.MEL_BINS,
            fmax=settings.MAX_FREQ
        )
        
        # Convert to decibels
        mel_spectrogram_db = librosa.power_to_db(mel_spectrogram, ref=np.max)
        
        # Normalize features (Standardization)
        # Using mean and standard deviation
        mean = np.mean(mel_spectrogram_db)
        std = np.std(mel_spectrogram_db)
        if std != 0:
            normalized_features = (mel_spectrogram_db - mean) / std
        else:
            normalized_features = mel_spectrogram_db
            
        # Add a batch and channel dimension assuming a standard CNN 2D input
        # (batch_size, height, width, channels)
        features = np.expand_dims(normalized_features, axis=-1)
        features = np.expand_dims(features, axis=0)
        
        return features

    except Exception as e:
        logger.error(f"Error during audio preprocessing: {str(e)}")
        raise
