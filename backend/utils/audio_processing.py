import io
import librosa
import numpy as np
import logging

from config import settings

logger = logging.getLogger(__name__)

def preprocess_audio(audio_bytes: bytes):
    """
    Convert raw audio bytes to MFCC features for the CNN.
    Expected audio format: raw PCM or WAV mono, 16kHz

    Returns:
        (features, rms_energy): features shape (1, n_mfcc, T, 1); rms_energy is waveform
        RMS in [0, 1] on librosa's float waveform (use for silence / noise gating).
    """
    try:
        # Load audio from bytes
        # librosa.load can take a file-like object. 
        # ESP32 usually sends WAV or raw PCM. Assuming WAV for standard librosa loading.
        audio_file = io.BytesIO(audio_bytes)
        
        # Load with target sample rate, mono
        y, sr = librosa.load(audio_file, sr=settings.SAMPLE_RATE, mono=True)

        # RMS on float waveform — silence is near 0; gating avoids bogus CNN input after normalization
        rms_energy = float(np.sqrt(np.mean(np.square(y.astype(np.float64)))))

        mfcc = librosa.feature.mfcc(y=y, 
                                    sr=sr, 
                                    n_mfcc=20,
                                    n_mels=40,
                                    n_fft=512,
                                    hop_length=256,
                                    center=True,
                                    norm='ortho')
        
        if mfcc.shape[1] > settings.EXPECTED_FRAMES:
            mfcc = mfcc[:, :settings.EXPECTED_FRAMES]
        elif mfcc.shape[1] < settings.EXPECTED_FRAMES:
            mfcc = np.pad(mfcc, ((0, 0), (0, settings.EXPECTED_FRAMES - mfcc.shape[1])), mode='constant')

        mfcc = mfcc[..., np.newaxis]  # Add channel dimension for CNN input

        # Add batch dimension so shape becomes (1, n_mfcc, T, 1)
        mfcc = np.expand_dims(mfcc, axis=0)

        mfcc = (mfcc - np.mean(mfcc)) / (np.std(mfcc) + 1e-6)  # Normalize MFCC features
        return mfcc, rms_energy
    
        # # Extract Mel Spectrogram
        # mel_spectrogram = librosa.feature.melspectrogram(
        #     y=y, 
        #     sr=sr, 
        #     n_mels=settings.MEL_BINS,
        #     fmax=settings.MAX_FREQ
        # )
        
        # Convert to decibels
        # mel_spectrogram_db = librosa.power_to_db(mel_spectrogram, ref=np.max)
        
        # # Normalize features (Standardization)
        # # Using mean and standard deviation
        # mean = np.mean(mel_spectrogram_db)
        # std = np.std(mel_spectrogram_db)
        # if std != 0:
        #     normalized_features = (mel_spectrogram_db - mean) / std
        # else:
        #     normalized_features = mel_spectrogram_db
            
        # # Add a batch and channel dimension assuming a standard CNN 2D input
        # # (batch_size, height, width, channels)
        # features = np.expand_dims(normalized_features, axis=-1)
        # features = np.expand_dims(features, axis=0)
        # return features

    except Exception as e:
        logger.error(f"Error during audio preprocessing: {str(e)}")
        raise
