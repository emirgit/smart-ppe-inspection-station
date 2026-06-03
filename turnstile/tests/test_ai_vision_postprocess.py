import numpy as np

from ai_vision.ai_vision import AIVisionImpl
from ai_vision.include.module_ai_vision import AIVisionConfig, PPEClass


def test_postprocess_accepts_twelve_class_model_head():
    """The exported NCNN model has 12 classes, including none and Person."""
    ai = AIVisionImpl()
    ai._config = AIVisionConfig(conf_threshold=0.5)

    output = np.zeros((16, 8400), dtype=np.float32)
    output[:4, 0] = [320.0, 320.0, 160.0, 160.0]
    output[4 + PPEClass.HELMET.value, 0] = 0.91
    output[:4, 1] = [160.0, 160.0, 120.0, 120.0]
    output[4 + PPEClass.VEST.value, 1] = 0.88

    detections = ai._postprocess(
        output,
        scale=1.0,
        pad_x=0,
        pad_y=0,
        src_w=640,
        src_h=640,
    )

    assert [det.ppe_class for det in detections] == [PPEClass.HELMET, PPEClass.VEST]
