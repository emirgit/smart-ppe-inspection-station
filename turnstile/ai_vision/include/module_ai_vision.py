from __future__ import annotations
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import IntEnum
from typing import Callable, Optional, List

MAX_DETECTIONS: int = 20
"""Maximum number of objects that can be detected in a single frame."""

CONFIDENCE_THRESHOLD: float = 0.50
"""Minimum confidence threshold — detections below this value are ignored."""

NMS_IOU_THRESHOLD: float = 0.45
"""IoU threshold used by non-maximum suppression to merge overlapping boxes."""

FRAME_WIDTH: int = 640
"""Camera image width (pixels)."""

FRAME_HEIGHT: int = 640
"""Camera image height (pixels)."""

# Default NCNN model file paths, resolved relative to this file so the defaults
# work in both the dev tree and the on-Pi deployment layout.
_MODEL_DIR: str = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "model"))
PARAM_PATH: str = os.path.join(_MODEL_DIR, "best.param")
BIN_PATH:   str = os.path.join(_MODEL_DIR, "best.bin")
"""NCNN model file paths (.param topology + .bin weights)."""


# =============================================================================
# ENUM: PPE CLASSES
# =============================================================================

class PPEClass(IntEnum):
    """
    Detectable PPE equipment classes.

    Divided into positive classes (equipment present) and
    negative classes (equipment missing).
    """
    # --- Positive classes (equipment present) ---
    HELMET    = 0   # Hard hat / helmet present
    GLOVES    = 1   # Gloves present
    VEST      = 2   # Safety vest present
    BOOTS     = 3   # Safety boots present
    GOGGLES   = 4   # Protective goggles present
    NONE      = 5   # No PPE-specific class in the training label
    PERSON    = 6   # Worker / person detected

    # --- Negative classes (equipment missing) ---
    NO_HELMET = 7   # Helmet missing, access must be blocked
    NO_GOGGLE = 8   # Goggles missing
    NO_GLOVES = 9   # Gloves missing
    NO_BOOTS  = 10  # Boots missing
    NO_VEST   = 11  # Vest missing, access must be blocked


# =============================================================================
# DATACLASS: SINGLE DETECTION
# =============================================================================

@dataclass
class PPEDetection:
    """
    Data for a single object detection.

    Bounding box coordinates are normalized to the range 0.0–1.0.
    Multiply by the frame dimensions to obtain pixel values.

    Example:
        x_center_px = detection.x_center * FRAME_WIDTH
    """
    ppe_class:  PPEClass  # Detected class
    confidence: float     # Confidence score [0.0 – 1.0]
    x_center:   float     # Bounding box center X [0.0 – 1.0]
    y_center:   float     # Bounding box center Y [0.0 – 1.0]
    width:      float     # Bounding box width    [0.0 – 1.0]
    height:     float     # Bounding box height   [0.0 – 1.0]


# =============================================================================
# DATACLASS: CAMERA FRAME (provided by the caller)
# =============================================================================

@dataclass
class CameraFrame:
    """
    Raw camera frame provided by the caller.

    Format : RGB888 (3 bytes per pixel: R, G, B)
    """
    data:         bytes  # Raw image data (RGB888)
    width:        int    # Width (pixels)
    height:       int    # Height (pixels)
    timestamp_ms: int    # Capture time (Unix milliseconds)

#
@dataclass
class DetectedPPE:
    item_key: str          # e.g., "helmet", "gloves"
    confidence: float         # Confidence score [0.0 – 1.0]

# =============================================================================
# DATACLASS: DETECTION RESULT (returned to caller)
# =============================================================================

@dataclass
class DetectionResult:
    """
    Result of all PPE detections on a single frame.

    The caller uses this to determine which equipment items
    are missing and makes the access decision.

    Example:
        result = vision.detect(frame)
        for item in result.items:
            if item.ppe_class == PPEClass.NO_HELMET:
                # helmet missing, deny access
    """
    items:        list[PPEDetection] = field(default_factory=list)
    timestamp_ms: int  = 0      # Processing time (Unix milliseconds)
    success:      bool = False  # True if inference completed successfully


# =============================================================================
# DATACLASS: MODULE CONFIGURATION
# =============================================================================

@dataclass
class AIVisionConfig:
    """
    Configuration parameters for init().

    The inference engine is NCNN running YOLO11n exported with
    `yolo export model=best.pt format=ncnn half=True`. FP16 is enabled
    at runtime via NCNN options inside AIVisionImpl.init().
    """
    param_path:     str   = PARAM_PATH         # NCNN topology file (.param)
    bin_path:       str   = BIN_PATH           # NCNN weights file (.bin)
    conf_threshold: float = CONFIDENCE_THRESHOLD
    iou_threshold:  float = NMS_IOU_THRESHOLD
    input_width:    int   = FRAME_WIDTH
    input_height:   int   = FRAME_HEIGHT
    num_threads:    int   = 4                  # CPU threads for NCNN extractor


# =============================================================================
# TYPE: CALLBACK
# =============================================================================

# Optional callback invoked when detection completes (for async use).
# The caller may register this instead of using the return value directly.
#
# Usage:
#   def on_detection(result: DetectionResult) -> None:
#       pass
#   vision.set_callback(on_detection)
DetectionCallback = Callable[[DetectionResult], None]


# =============================================================================
# ABSTRACT CLASS: MODULE INTERFACE
# =============================================================================

class AIVisionModule(ABC):
    """
    Abstract interface for the MOD-01 AI & Vision module.

    The implementation inherits from this class in a separate file.
    MOD-03 depends only on this interface.
    """

    @abstractmethod
    def init(self, config: Optional[AIVisionConfig] = None) -> bool:
        """
        Loads the model and prepares the inference engine.

        Must be called once before any detect() calls.

        Args:
            config: Configuration parameters. If None, defaults are used.

        Returns:
            True on success, False on failure.
        """
        ...

    @abstractmethod
    def detect(self, frame: CameraFrame) -> DetectionResult:
        """
        Runs PPE detection on the provided frame.

        The caller is responsible for capturing the frame.

        Args:
            frame: Camera frame to analyse.

        Returns:
            DetectionResult with all detected PPE items.
            On error, result.success = False.
        """
        ...

    @abstractmethod
    def set_callback(self, callback: Optional[DetectionCallback]) -> None:
        """
        Registers a callback invoked when detection completes.

        For asynchronous use. Pass None to deregister.

        Args:
            callback: DetectionCallback function, or None.
        """
        ...

    @abstractmethod
    def deinit(self) -> None:
        """
        Releases all resources held by the module.

        Must be called when the program exits.
        """
        ...
