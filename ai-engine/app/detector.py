import cv2
import numpy as np
import logging

logger = logging.getLogger("Detector")

class FaceDetector:
    """
    Pendeteksi wajah berbasis YOLOv8.
    """
    def __init__(self, model_path: str = "yolov8n.pt", conf_threshold: float = 0.5):
        self.conf_threshold = conf_threshold
        self.model = None
        self._load_model(model_path)

    def _load_model(self, model_path: str):
        try:
            from ultralytics import YOLO
            self.model = YOLO(model_path)
            logger.info(f"YOLO model loaded successfully from: {model_path}")
        except Exception as e:
            logger.warning(f"Could not load ultralytics YOLO ({e}). Running in fallback OpenCV Haar-Cascade mode.")
            # Fallback OpenCV Haar Cascade
            self.cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

    def detect(self, frame: np.ndarray) -> list[list[int]]:
        """
        Mendeteksi koordinat wajah dalam frame.
        Return: [[x1, y1, x2, y2], ...]
        """
        if frame is None:
            return []

        if self.model is not None:
            # Gunakan YOLOv8 inference
            results = self.model(frame, verbose=False, conf=self.conf_threshold)
            boxes = []
            for r in results:
                for b in r.boxes:
                    # Ambil bounding box [x1, y1, x2, y2]
                    coords = b.xyxy[0].cpu().numpy().astype(int).tolist()
                    boxes.append(coords)
            return boxes
        else:
            # Fallback Haar Cascade
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = self.cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
            boxes = []
            for (x, y, w, h) in faces:
                boxes.append([x, y, x + w, y + h])
            return boxes

