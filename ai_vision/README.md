## Dataset

Eğitim dataseti Roboflow'dan temin edilmiştir.

- [Construction PPE Dataset](buraya roboflow linkini koy)

İndirdikten sonra `datasets/` klasörüne çıkartıp `merge_datasets.py` çalıştırın.

## Yeniden Eğitim

1. `train_merged.py` dosyasını Google Colab'a yükle
2. Runtime → Change runtime type → T4 GPU seç
3. Hücreleri sırayla çalıştır
4. İnen `best.pt` ve `best.onnx` dosyalarını `model/` klasörüne koy

## Model

Eğitilmiş model dosyaları (`best.pt`, `best.onnx`) büyüklükleri nedeniyle repoya eklenmemiştir.