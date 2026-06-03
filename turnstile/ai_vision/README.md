## Dataset

The training dataset was obtained from Roboflow.

- [Construction PPE Dataset](add roboflow link here)

After downloading, extract it into the `datasets/` folder and run `merge_datasets.py`.

## Retraining

1. Upload `train_merged.py` to Google Colab
2. Runtime → Change runtime type → select T4 GPU
3. Run cells in order
4. Place the downloaded `best.pt` and `best.onnx` files into the `model/` folder

## Model

The trained model files (`best.pt`, `best.onnx`) are not included in the repository due to their file size.
