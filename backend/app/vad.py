import numpy as np

class AdaptiveVAD:
    """
    Robust, lightweight Voice Activity Detector (VAD) with adaptive noise floor estimation,
    zero-crossing rate analysis, and hangover smoothing.
    """
    def __init__(
        self,
        base_threshold: float = 0.015,
        hangover_frames: int = 4,
        noise_adapt_rate: float = 0.05
    ):
        self.base_threshold = base_threshold
        self.hangover_frames = hangover_frames
        self.noise_adapt_rate = noise_adapt_rate
        self.noise_floor = 0.005
        self.hangover_count = 0

    def compute_rms(self, audio_data: np.ndarray) -> float:
        """Computes Root Mean Square (RMS) energy of normalized float32 or int16 audio array."""
        if audio_data.size == 0:
            return 0.0
        
        # If int16, normalize to [-1.0, 1.0]
        if audio_data.dtype == np.int16:
            samples = audio_data.astype(np.float32) / 32768.0
        else:
            samples = audio_data.astype(np.float32)
            
        mean_square = np.mean(samples ** 2)
        return float(np.sqrt(np.maximum(mean_square, 1e-10)))

    def compute_zcr(self, audio_data: np.ndarray) -> float:
        """Computes Zero Crossing Rate (ZCR) to help distinguish voiced speech from low rumble."""
        if audio_data.size < 2:
            return 0.0
        zero_crossings = np.sum(np.abs(np.diff(np.sign(audio_data))) > 0)
        return float(zero_crossings / len(audio_data))

    def process_frame(self, audio_data: np.ndarray) -> tuple[bool, float, float]:
        """
        Processes an audio frame and returns:
        - is_speech: True if speech activity detected
        - rms: Root Mean Square energy
        - snr: Estimated Signal-to-Noise Ratio (dB)
        """
        rms = self.compute_rms(audio_data)
        
        # Adaptive threshold based on estimated ambient noise floor
        dynamic_threshold = max(self.base_threshold, self.noise_floor * 2.5)
        
        is_above_threshold = rms > dynamic_threshold
        
        if is_above_threshold:
            self.hangover_count = self.hangover_frames
            is_speech = True
        elif self.hangover_count > 0:
            self.hangover_count -= 1
            is_speech = True
        else:
            is_speech = False
            # Update adaptive noise floor during non-speech periods
            self.noise_floor = (1 - self.noise_adapt_rate) * self.noise_floor + self.noise_adapt_rate * rms

        snr = 20.0 * np.log10(max(rms, 1e-6) / max(self.noise_floor, 1e-6))
        return is_speech, rms, float(snr)
