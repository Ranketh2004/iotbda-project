import os
import logging
import numpy as np
from typing import Any, Optional, Tuple

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

logger = logging.getLogger(__name__)

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
        self._output_dim: Optional[int] = None
        self.load_model()
        self.class_names = [
            "belly pain", "burping", "cold_hot", "discomfort", "hungry", "tired",
        ]

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
                out = self.model.output_shape
                self._output_dim = int(out[-1]) if out[-1] is not None else None
                logger.info(
                    f"Successfully loaded model from {settings.MODEL_PATH} (output_dim={self._output_dim})"
                )
            else:
                logger.warning(
                    f"Model file not found at {settings.MODEL_PATH}. Prediction will return False."
                )
        except Exception as e:
            logger.error(f"Failed to load model: {str(e)}")

    def detect_cry(self, audio_features: np.ndarray) -> Tuple[bool, Optional[float], dict[str, Any]]:
        """
        Run preprocessed audio features through the model.

        Trained model (train_model.py) is binary: single sigmoid = P(crying).
        Returns (cry_detected, probability) where probability is P(crying) for binary models,
        or None if unavailable / error.
        """
        if self.model is None:
            logger.warning("Model is not loaded. Cannot perform prediction.")
            return False, None, {}

        try:
            pred = self.model.predict(audio_features, verbose=0)
            out_dim = self._output_dim if self._output_dim is not None else int(pred.shape[-1])

            if out_dim == 1:
                prob_cry = float(np.squeeze(pred))
                detected = prob_cry >= settings.CRY_PROBABILITY_THRESHOLD
                logger.info(
                    f"P(crying)={prob_cry:.4f} threshold={settings.CRY_PROBABILITY_THRESHOLD} -> {detected}"
                )
                return detected, prob_cry, {
                    "prediction_type": "binary",
                    "cry_label": "cry" if detected else "no_cry",
                }

            idx = int(np.argmax(pred, axis=-1).flat[0])
            max_prob = float(np.max(pred))
            label = self.class_names[idx] if idx < len(self.class_names) else "unknown"
            min_conf = settings.CRY_MULTICLASS_MIN_CONFIDENCE
            logger.info(
                f"Multi-class prediction: index={idx} label={label} max_prob={max_prob:.4f} "
                f"(need max_prob>={min_conf})"
            )
            detected = max_prob >= min_conf
            return detected, max_prob, {
                "prediction_type": "multiclass",
                "prediction_index": idx,
                "cry_label": label,
                "max_prob": max_prob,
                "min_required_prob": min_conf,
            }

        except Exception as e:
            logger.error(f"Error during model prediction: {str(e)}")
            return False, None, {}


cry_service = CryDetectionService()
