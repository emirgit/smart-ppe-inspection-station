"""
ai_vision.py
============
MOD-01 AI Vision Module — NCNN FP16 implementation.

Runs an Ultralytics YOLO11n PPE detector on the Raspberry Pi 5 CPU
using the NCNN inference engine. Weights are exported once with:

    yolo export model=turnstile/ai_vision/model/best.pt format=ncnn half=True

producing best.param + best.bin which must live in turnstile/ai_vision/model/.

Inputs are letterboxed to 640x640 RGB and normalised to [0,1].
The YOLO11 detect head output is parsed into per-class detections, run
through per-class non-maximum suppression, then returned to MOD-03.

Authors: Alperen Söylen (220104004024)
"""
from __future__ import annotations

import logging
import time
from typing import List, Optional, Tuple

import numpy as np

# ncnn is the only inference engine for this module. Imported lazily inside
# init() so that the dataclasses and helpers in this file remain importable on
# dev machines that have not installed the ncnn wheel.
try:
    import ncnn  # type: ignore
    _NCNN_IMPORT_ERROR: Optional[BaseException] = None
except Exception as _exc:  # pragma: no cover
    ncnn = None  # type: ignore
    _NCNN_IMPORT_ERROR = _exc

from ai_vision.include.module_ai_vision import (
    AIVisionModule,
    AIVisionConfig,
    CameraFrame,
    DetectionResult,
    PPEDetection,
    DetectedPPE,
    PPEClass,
    DetectionCallback,
    MAX_DETECTIONS,
)

logger = logging.getLogger(__name__)

# NCNN blob names produced by `yolo export ... format=ncnn`. Ultralytics' pnnx
# pipeline currently emits these names. If a new export uses different names,
# inference will fail loudly inside detect() and the names must be updated.
_INPUT_BLOB:  str = "in0"
_OUTPUT_BLOB: str = "out0"


class AIVisionImpl(AIVisionModule):
    """NCNN-backed YOLO11n PPE detector."""

    def __init__(self) -> None:
        self._config: Optional[AIVisionConfig] = None
        self._net = None  # ncnn.Net
        self._callback: Optional[DetectionCallback] = None

    # -------------------------------------------------------------------------
    # AIVisionModule interface
    # -------------------------------------------------------------------------

    def init(self, config: Optional[AIVisionConfig] = None) -> bool:
        self._config = config or AIVisionConfig()

        if ncnn is None:
            logger.error(
                "AIVisionImpl.init: ncnn module not importable (%s). "
                "Install with `pip install ncnn`.", _NCNN_IMPORT_ERROR,
            )
            return False

        net = ncnn.Net()
        # FP16 storage + arithmetic gives the best speed on Pi 5 CPU.
        net.opt.use_fp16_arithmetic = True
        net.opt.use_fp16_storage    = True
        net.opt.use_fp16_packed     = True
        net.opt.num_threads         = self._config.num_threads

        if net.load_param(self._config.param_path) != 0:
            logger.error("AIVisionImpl.init: failed to load %s", self._config.param_path)
            return False
        if net.load_model(self._config.bin_path) != 0:
            logger.error("AIVisionImpl.init: failed to load %s", self._config.bin_path)
            return False

        self._net = net
        logger.info(
            "AIVisionImpl: NCNN ready (param=%s, bin=%s, threads=%d, fp16=on)",
            self._config.param_path, self._config.bin_path, self._config.num_threads,
        )
        return True

    def detect(self, frame: CameraFrame) -> DetectionResult:
        if self._net is None or self._config is None:
            return DetectionResult(success=False)

        try:
            # 1. Unpack RGB888 bytes into an HxWx3 array.
            img = np.frombuffer(frame.data, dtype=np.uint8).reshape(
                frame.height, frame.width, 3
            )

            # 2. Letterbox to model input size, preserving aspect ratio.
            letterboxed, scale, (pad_x, pad_y) = self._letterbox(
                img, self._config.input_width, self._config.input_height
            )

            # 3. Build NCNN Mat directly from the letterboxed RGB buffer and
            #    normalise to [0,1] via substract_mean_normalize.
            mat_in = ncnn.Mat.from_pixels(
                letterboxed.tobytes(),
                ncnn.Mat.PixelType.PIXEL_RGB,
                self._config.input_width,
                self._config.input_height,
            )
            mat_in.substract_mean_normalize([0.0, 0.0, 0.0], [1.0 / 255.0] * 3)

            # 4. Run inference.
            ex = self._net.create_extractor()
            ex.input(_INPUT_BLOB, mat_in)
            ret, mat_out = ex.extract(_OUTPUT_BLOB)
            if ret != 0:
                logger.error(
                    "AIVisionImpl.detect: ncnn extract(%r) returned %d. "
                    "Check that the exported .param uses blob names %r/%r.",
                    _OUTPUT_BLOB, ret, _INPUT_BLOB, _OUTPUT_BLOB,
                )
                return DetectionResult(success=False)

            # 5. Decode YOLO11 head, NMS, undo letterbox.
            detections = self._postprocess(
                mat_out, scale, pad_x, pad_y,
                src_w=frame.width, src_h=frame.height,
            )

            result = DetectionResult(
                items=detections,
                timestamp_ms=int(time.time() * 1000),
                success=True,
            )

            if self._callback is not None:
                self._callback(result)

            return result

        except Exception as exc:
            logger.error("AIVisionImpl.detect: inference error — %s", exc, exc_info=True)
            return DetectionResult(success=False)

    def set_callback(self, callback: Optional[DetectionCallback]) -> None:
        self._callback = callback

    def deinit(self) -> None:
        self._net = None
        self._callback = None

    # -------------------------------------------------------------------------
    # Helpers
    # -------------------------------------------------------------------------

    def to_detected_ppe_list(self, result: DetectionResult) -> List[DetectedPPE]:
        """Converts a DetectionResult into MOD-03-friendly DetectedPPE objects."""
        return [
            DetectedPPE(item_key=item.ppe_class.name, confidence=item.confidence)
            for item in result.items
        ]

    @staticmethod
    def _letterbox(
        img: np.ndarray, dst_w: int, dst_h: int, pad_value: int = 114,
    ) -> Tuple[np.ndarray, float, Tuple[int, int]]:
        """Resize keeping aspect ratio, pad to (dst_h, dst_w) with `pad_value`."""
        src_h, src_w = img.shape[:2]
        scale = min(dst_w / src_w, dst_h / src_h)
        new_w = int(round(src_w * scale))
        new_h = int(round(src_h * scale))

        # Resize without OpenCV dependency in the hot path: NumPy slicing is
        # avoided here — fall back to a simple stride-free approach using
        # np.kron only for tiny images would be wasteful, so use vector ops.
        # OpenCV is already a project dep, but we keep this helper engine-free
        # by deferring the resize to OpenCV if available, else PIL-less NumPy.
        try:
            import cv2  # local import to avoid hard dep at module load
            resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
        except Exception:
            # Nearest-neighbour fallback (slow path; should never run on Pi).
            ys = (np.linspace(0, src_h - 1, new_h)).astype(np.int32)
            xs = (np.linspace(0, src_w - 1, new_w)).astype(np.int32)
            resized = img[ys][:, xs]

        canvas = np.full((dst_h, dst_w, 3), pad_value, dtype=np.uint8)
        pad_x = (dst_w - new_w) // 2
        pad_y = (dst_h - new_h) // 2
        canvas[pad_y:pad_y + new_h, pad_x:pad_x + new_w] = resized
        return canvas, scale, (pad_x, pad_y)

    def _postprocess(
        self,
        mat_out,
        scale: float,
        pad_x: int,
        pad_y: int,
        src_w: int,
        src_h: int,
    ) -> List[PPEDetection]:
        """
        Decode the YOLO11 detect head, run per-class NMS, undo letterbox.

        YOLO11 NCNN export typically emits a single output tensor with shape
        (4 + num_classes, num_anchors). The first four channels are cxcywh in
        input-image pixel space; the remaining channels are per-class scores
        already passed through sigmoid by the exported graph.
        """
        assert self._config is not None
        arr = np.array(mat_out)

        # NCNN may emit the tensor as either (C, N) or (N, C). YOLO11 detect
        # outputs C = 4 + num_classes, which is much smaller than N (anchors).
        if arr.ndim == 3:
            arr = arr[0]
        if arr.ndim != 2:
            logger.error("AIVisionImpl._postprocess: unexpected output ndim=%d", arr.ndim)
            return []
        if arr.shape[0] < arr.shape[1]:
            # Shape (C, N) — transpose to (N, C).
            arr = arr.T

        num_classes_expected = len(PPEClass)
        num_attrs = 4 + num_classes_expected
        if arr.shape[1] != num_attrs:
            logger.error(
                "AIVisionImpl._postprocess: head has %d attrs, expected %d "
                "(4 + %d PPE classes). Check that the exported model matches "
                "the PPEClass enum.", arr.shape[1], num_attrs, num_classes_expected,
            )
            return []

        boxes_xywh = arr[:, :4]
        class_scores = arr[:, 4:]
        class_ids = class_scores.argmax(axis=1)
        confidences = class_scores[np.arange(class_scores.shape[0]), class_ids]

        keep_mask = confidences >= self._config.conf_threshold
        boxes_xywh = boxes_xywh[keep_mask]
        class_ids  = class_ids[keep_mask]
        confidences = confidences[keep_mask]
        if boxes_xywh.size == 0:
            return []

        # Convert cxcywh (input-pixel space) -> xyxy (input-pixel space).
        xyxy = np.empty_like(boxes_xywh)
        xyxy[:, 0] = boxes_xywh[:, 0] - boxes_xywh[:, 2] / 2.0
        xyxy[:, 1] = boxes_xywh[:, 1] - boxes_xywh[:, 3] / 2.0
        xyxy[:, 2] = boxes_xywh[:, 0] + boxes_xywh[:, 2] / 2.0
        xyxy[:, 3] = boxes_xywh[:, 1] + boxes_xywh[:, 3] / 2.0

        keep = self._nms_per_class(xyxy, confidences, class_ids,
                                   iou_threshold=self._config.iou_threshold)
        keep = keep[: MAX_DETECTIONS]
        if not keep:
            return []

        # Undo letterbox: input pixels -> original frame pixels, then normalise
        # the bounding box to 0..1 of the original frame (PPEDetection contract).
        detections: List[PPEDetection] = []
        for idx in keep:
            cls = int(class_ids[idx])
            try:
                ppe_class = PPEClass(cls)
            except ValueError:
                continue
            x1 = (xyxy[idx, 0] - pad_x) / scale
            y1 = (xyxy[idx, 1] - pad_y) / scale
            x2 = (xyxy[idx, 2] - pad_x) / scale
            y2 = (xyxy[idx, 3] - pad_y) / scale

            cx = (x1 + x2) / 2.0 / src_w
            cy = (y1 + y2) / 2.0 / src_h
            w  = (x2 - x1) / src_w
            h  = (y2 - y1) / src_h

            detections.append(PPEDetection(
                ppe_class=ppe_class,
                confidence=float(confidences[idx]),
                x_center=float(np.clip(cx, 0.0, 1.0)),
                y_center=float(np.clip(cy, 0.0, 1.0)),
                width=float(np.clip(w, 0.0, 1.0)),
                height=float(np.clip(h, 0.0, 1.0)),
            ))
        return detections

    @staticmethod
    def _nms_per_class(
        boxes_xyxy: np.ndarray,
        scores: np.ndarray,
        class_ids: np.ndarray,
        iou_threshold: float,
    ) -> List[int]:
        """Greedy per-class non-maximum suppression. Returns kept indices."""
        kept: List[int] = []
        for cls in np.unique(class_ids):
            cls_mask = np.where(class_ids == cls)[0]
            cls_boxes = boxes_xyxy[cls_mask]
            cls_scores = scores[cls_mask]
            order = cls_scores.argsort()[::-1]

            while order.size > 0:
                i = order[0]
                kept.append(int(cls_mask[i]))
                if order.size == 1:
                    break
                rest = order[1:]
                ious = AIVisionImpl._iou(cls_boxes[i], cls_boxes[rest])
                order = rest[ious < iou_threshold]
        return kept

    @staticmethod
    def _iou(box: np.ndarray, others: np.ndarray) -> np.ndarray:
        x1 = np.maximum(box[0], others[:, 0])
        y1 = np.maximum(box[1], others[:, 1])
        x2 = np.minimum(box[2], others[:, 2])
        y2 = np.minimum(box[3], others[:, 3])
        inter = np.clip(x2 - x1, 0, None) * np.clip(y2 - y1, 0, None)
        area_box = (box[2] - box[0]) * (box[3] - box[1])
        area_oth = (others[:, 2] - others[:, 0]) * (others[:, 3] - others[:, 1])
        union = area_box + area_oth - inter + 1e-9
        return inter / union


def get_ai_vision_impl() -> AIVisionImpl:
    return AIVisionImpl()
