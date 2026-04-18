from __future__ import annotations
import time
import numpy as np
import onnxruntime as ort
from typing import Callable, Optional, List
from ai_vision.include.module_ai_vision import (
    AIVisionModule, AIVisionConfig, CameraFrame,
    DetectionResult, PPEDetection, DetectedPPE, PPEClass,
    DetectionCallback, CONFIDENCE_THRESHOLD, MAX_DETECTIONS
)
from dataclasses import dataclass

class AIVisionImpl(AIVisionModule):
    def __init__(self):
        self.session= None #ONNx model session
        self._config= None # [AIVisionConfig]
        self._callback=None

    def init(self, config: Optional[AIVisionConfig] = None) -> bool:
        self._config = config or AIVisionConfig()
        try:
            self._session = ort.InferenceSession(self._config.model_path)
            return True
        except Exception as e:
            print(f"Failed to load model: {e}")
            return False
    
    def detect(self, frame: CameraFrame) -> DetectionResult:
        if self._session is None:
            return DetectionResult(success=False)
        try:
            # 1. Prepare frame for model input
            img = np.frombuffer(frame.data, dtype=np.uint8)
            img = img.reshape((frame.height, frame.width, 3))
            img = img.astype(np.float32) / 255.0
            img = np.transpose(img, (2, 0, 1))   # HWC → CHW
            img = np.expand_dims(img, axis=0)     # add batch dimension

            # 2. Run inference
            input_name = self._session.get_inputs()[0].name
            outputs = self._session.run(None, {input_name: img})

            # 3. Parse outputs
            detections = self._parse_outputs(outputs)

            result = DetectionResult(
                items=detections,
                timestamp_ms=int(time.time() * 1000),
                success=True
            )

            # 4. Fire callback if registered
            if self._callback:
                self._callback(result)

            return result

        except Exception as e:
            print(f"Inference error: {e}")
            return DetectionResult(success=False)

    def _parse_outputs(self, outputs) -> list[PPEDetection]:
        """Parses raw model outputs into a list of PPEDetection objects."""
        detections = []
        raw = outputs[0][0]  # shape: [num_detections, 6]
                             # [x_center, y_center, width, height, confidence, class_id]

        for det in raw[:MAX_DETECTIONS]:
            confidence = float(det[4])
            if confidence < self._config.conf_threshold:
                continue

            class_id = int(det[5])
            try:
                ppe_class = PPEClass(class_id)
            except ValueError:
                continue

            detections.append(PPEDetection(
                ppe_class=ppe_class,
                confidence=confidence,
                x_center=float(det[0]),
                y_center=float(det[1]),
                width=float(det[2]),
                height=float(det[3]),
            ))

        return detections

    def to_detected_ppe_list(self, result: DetectionResult) -> List[DetectedPPE]:
        """Converts a DetectionResult into a list of DetectedPPE objects for MOD-03."""
        return [
            DetectedPPE(
                item_key=item.ppe_class.name,   # PPEClass.HELMET → "HELMET"
                confidence=item.confidence
            )
            for item in result.items
        ]

    def set_callback(self, callback: Optional[DetectionCallback]) -> None:
        self._callback = callback

    def deinit(self) -> None:
        self._session = None
        self._callback = None


def get_ai_vision_impl() -> AIVisionImpl:
    return AIVisionImpl()
