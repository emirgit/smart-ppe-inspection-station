"""
train_merged.py
===============
Google Colab training script for the PPE detection model.
Run this notebook on Colab to train the model, then download best.pt and
best.onnx and place them in the model/ directory on the Raspberry Pi.
Do NOT run this script on a PC or Raspberry Pi.

Usage:
    Run each cell in order on Google Colab.
"""

from google.colab import drive
from ultralytics import YOLO

# 1. Mount Drive and copy dataset
""" drive.mount('/content/drive')
!cp -r /content/drive/MyDrive/merged /content/merged
!sed -i 's|path:.*|path: /content/merged|' /content/merged/data.yaml """

# 2. Train model
model = YOLO("yolov8n.pt")
model.train(
    data="/content/merged/data.yaml",
    epochs=50,
    imgsz=640,
    batch=16,
    name="ppe_merged",
    project="/content/drive/MyDrive/runs"  # saved to Drive so it persists after runtime ends
)

# 3. Download trained model weights
from google.colab import files
files.download('/content/drive/MyDrive/runs/ppe_merged/weights/best.pt')

# 4. Export to ONNX and download
model = YOLO('/content/drive/MyDrive/runs/ppe_merged/weights/best.pt')
model.export(format='onnx', imgsz=640)
files.download('/content/drive/MyDrive/runs/ppe_merged/weights/best.onnx')