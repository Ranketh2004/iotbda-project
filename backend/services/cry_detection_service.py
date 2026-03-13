import os
import logging
import numpy as np
# Suppress TF logs
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

logger = logging.getLogger(__name__)

# Try to import tensorflow, but don't crash if not installed yet
try:
    import tensorflow as tf
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False
    logger.warning("TensorFlow not installed. Cry detection model will not be available.")

from config import settings

logger = logging.getLogger(__name__)

class CryDetectionService:
    def __init__(self):
        self.model = None
        self.load_model()

    def load_model(self):
        """
        Load the pretrained CNN model from the config path.
        """
        if not TF_AVAILABLE:
            logger.warning("TensorFlow not available. Model cannot be loaded.")
            return
        try:
            if os.path.exists(settings.MODEL_PATH):
                self.model = tf.keras.models.load_model(settings.MODEL_PATH)
                logger.info(f"Successfully loaded model from {settings.MODEL_PATH}")
            else:
                logger.warning(f"Model file not found at {settings.MODEL_PATH}. Prediction will return False.")
        except Exception as e:
            logger.error(f"Failed to load model: {str(e)}")

    def detect_cry(self, audio_features: np.ndarray) -> bool:
        """
        Run the preprocessed audio features through the model.
        Returns True if a baby cry is detected, False otherwise.
        """
        if self.model is None:
            logger.warning("Model is not loaded. Cannot perform prediction.")
            return False

        try:
            # Predict
            predictions = self.model.predict(audio_features)
            
            # Assuming binary classification where output > 0.5 means crying
            # If the model has different output shape or activation, adjust accordingly.
            probability = predictions[0][0] if predictions.ndim > 1 else predictions[0]
            logger.info(f"Model prediction probability: {probability:.4f}")
            
            return probability > 0.5
        except Exception as e:
            logger.error(f"Error during model prediction: {str(e)}")
            return False

# Instantiate service as a singleton to load the model once when server starts
cry_service = CryDetectionService()
