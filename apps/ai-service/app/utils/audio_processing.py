import io
import wave
import logging
import numpy as np
from typing import Tuple, Optional
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class AudioBuffer:
    """
    Thread-safe audio buffer for accumulating audio chunks.
    Used for WebSocket streaming.
    """
    
    def __init__(self, sample_rate: int = 16000, channels: int = 1):
        self.sample_rate = sample_rate
        self.channels = channels
        self.buffer = []
        self._total_samples = 0
    
    def append(self, audio_data: bytes):
        """Append audio chunk to buffer"""
        self.buffer.append(audio_data)
        self._total_samples += len(audio_data) // 2
    
    def get_duration_ms(self) -> int:
        """Get current buffer duration in milliseconds"""
        return int((self._total_samples / self.sample_rate) * 1000)
    
    def get_audio_array(self) -> np.ndarray:
        """Get accumulated audio as numpy array"""
        if not self.buffer:
            return np.array([], dtype=np.float32)
        
        combined = b''.join(self.buffer)
        audio_int16 = np.frombuffer(combined, dtype=np.int16)
        audio_float32 = audio_int16.astype(np.float32) / 32768.0
        
        return audio_float32
    
    def clear(self):
        """Clear the buffer"""
        self.buffer = []
        self._total_samples = 0
    
    def is_empty(self) -> bool:
        """Check if buffer is empty"""
        return len(self.buffer) == 0


def convert_audio_to_wav(
    audio_data: bytes,
    sample_rate: int = 16000,
    channels: int = 1,
    sample_width: int = 2
) -> bytes:
    """
    Convert raw audio bytes to WAV format.
    
    Args:
        audio_data: Raw audio bytes (PCM)
        sample_rate: Sample rate in Hz
        channels: Number of audio channels
        sample_width: Bytes per sample (2 for 16-bit)
        
    Returns:
        WAV formatted bytes
    """
    wav_buffer = io.BytesIO()
    
    with wave.open(wav_buffer, 'wb') as wav_file:
        wav_file.setnchannels(channels)
        wav_file.setsampwidth(sample_width)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(audio_data)
    
    return wav_buffer.getvalue()


def load_audio_from_bytes(audio_bytes: bytes, target_sample_rate: int = 16000) -> Tuple[np.ndarray, int]:
    """
    Load audio from bytes (supports WAV, raw PCM, mulaw).
    
    Args:
        audio_bytes: Audio file bytes
        target_sample_rate: Target sample rate for resampling
        
    Returns:
        Tuple of (audio_array, sample_rate)
    """
    try:
        with wave.open(io.BytesIO(audio_bytes), 'rb') as wav_file:
            sample_rate = wav_file.getframerate()
            channels = wav_file.getnchannels()
            sample_width = wav_file.getsampwidth()
            frames = wav_file.readframes(wav_file.getnframes())
            
            if sample_width == 1:
                audio_array = np.frombuffer(frames, dtype=np.uint8)
                audio_array = (audio_array.astype(np.float32) - 128) / 128.0
            elif sample_width == 2:
                audio_array = np.frombuffer(frames, dtype=np.int16)
                audio_array = audio_array.astype(np.float32) / 32768.0
            elif sample_width == 4:
                audio_array = np.frombuffer(frames, dtype=np.int32)
                audio_array = audio_array.astype(np.float32) / 2147483648.0
            else:
                raise ValueError(f"Unsupported sample width: {sample_width}")
            
            if channels > 1:
                audio_array = audio_array.reshape(-1, channels)
                audio_array = np.mean(audio_array, axis=1)
            
            if sample_rate != target_sample_rate:
                audio_array = resample_audio(audio_array, sample_rate, target_sample_rate)
                sample_rate = target_sample_rate
            
            return audio_array, sample_rate
            
    except wave.Error:
        audio_array = np.frombuffer(audio_bytes, dtype=np.int16)
        audio_array = audio_array.astype(np.float32) / 32768.0
        return audio_array, target_sample_rate


def resample_audio(audio_array: np.ndarray, orig_sr: int, target_sr: int) -> np.ndarray:
    """
    Resample audio to target sample rate.
    
    Args:
        audio_array: Input audio array
        orig_sr: Original sample rate
        target_sr: Target sample rate
        
    Returns:
        Resampled audio array
    """
    try:
        import librosa
        return librosa.resample(audio_array, orig_sr=orig_sr, target_sr=target_sr)
    except ImportError:
        from scipy import signal
        num_samples = int(len(audio_array) * target_sr / orig_sr)
        resampled = signal.resample(audio_array, num_samples)
        return resampled


def validate_audio_buffer(audio_data: bytes, min_size: int = 1000) -> bool:
    """
    Validate audio buffer size.
    
    Args:
        audio_data: Audio bytes
        min_size: Minimum size in bytes
        
    Returns:
        True if valid
    """
    if not audio_data or len(audio_data) < min_size:
        logger.warning(f"Audio buffer too small: {len(audio_data) if audio_data else 0} bytes")
        return False
    return True


def trim_silence(
    audio_array: np.ndarray,
    threshold: float = 0.01,
    sample_rate: int = 16000
) -> np.ndarray:
    """
    Trim silence from beginning and end of audio.
    
    Args:
        audio_array: Audio array
        threshold: Amplitude threshold for silence
        sample_rate: Sample rate
        
    Returns:
        Trimmed audio array
    """
    non_silent = np.abs(audio_array) > threshold
    
    if not np.any(non_silent):
        return audio_array
    
    first_sound = np.argmax(non_silent)
    last_sound = len(non_silent) - np.argmax(non_silent[::-1]) - 1
    
    return audio_array[first_sound:last_sound + 1]


def normalize_audio(audio_array: np.ndarray, target_level: float = 0.9) -> np.ndarray:
    """
    Normalize audio to target level.
    
    Args:
        audio_array: Audio array
        target_level: Target peak level (0.0 to 1.0)
        
    Returns:
        Normalized audio array
    """
    current_peak = np.abs(audio_array).max()
    
    if current_peak == 0:
        return audio_array
    
    gain = target_level / current_peak
    return audio_array * gain


class AudioMetrics(BaseModel):
    """Audio quality metrics"""
    duration_seconds: float
    sample_rate: int
    rms_level: float
    peak_level: float
    is_clipping: bool
    is_too_quiet: bool
    snr_estimate: Optional[float] = None
    
    @classmethod
    def from_audio(cls, audio_array: np.ndarray, sample_rate: int):
        """Calculate metrics from audio array"""
        duration = len(audio_array) / sample_rate
        rms = np.sqrt(np.mean(audio_array ** 2))
        peak = np.abs(audio_array).max()
        is_clipping = peak > 0.99
        is_too_quiet = rms < 0.01
        
        return cls(
            duration_seconds=duration,
            sample_rate=sample_rate,
            rms_level=float(rms),
            peak_level=float(peak),
            is_clipping=is_clipping,
            is_too_quiet=is_too_quiet
        )
