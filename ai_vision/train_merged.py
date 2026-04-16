"""
train_merged.py
===============
PPe detection model eğitimini hızlandırmak için Google Colab'da çalıştırılacak bir script.
Eğitim tamamlandıktan sonra best.onnx dosyasını indirip Raspberry Pi'ya
PPE detection modelini Google Colab'da eğitmek için kullanılır.
PC'de veya Raspberry Pi'da çalıştırılmaz.

Kullanım:
    Google Colab'da her hücreyi sırayla çalıştır.
"""

from google.colab import drive
from ultralytics import YOLO

# 1. Drive'ı bağla ve dataseti kopyala
""" drive.mount('/content/drive')
!cp -r /content/drive/MyDrive/merged /content/merged
!sed -i 's|path:.*|path: /content/merged|' /content/merged/data.yaml """

# 2. Modeli eğit
model = YOLO("yolov8n.pt")
model.train(
    data="/content/merged/data.yaml",
    epochs=50,
    imgsz=640,
    batch=16,
    name="ppe_merged",
    project="/content/drive/MyDrive/runs"  # Drive'a kaydeder, runtime kapanınca kaybolmaz
)

# 3. Eğitim bittikten sonra modeli indir
from google.colab import files
files.download('/content/drive/MyDrive/runs/ppe_merged/weights/best.pt')

# 4. ONNX export et ve indir
model = YOLO('/content/drive/MyDrive/runs/ppe_merged/weights/best.pt')
model.export(format='onnx', imgsz=640)
files.download('/content/drive/MyDrive/runs/ppe_merged/weights/best.onnx')