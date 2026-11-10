import cv2
import numpy as np

class BestFrameSelector:
    """
    Menilai kualitas crop wajah:
    1. Mengukur ketajaman (Laplacian Variance).
    2. Mengukur rasio aspek & ukuran bounding box.
    """
    def __init__(self, blur_threshold: float = 80.0, min_size: int = 64):
        self.blur_threshold = blur_threshold
        self.min_size = min_size

    def calculate_blur(self, image: np.ndarray) -> float:
        """
        Menghitung variansi Laplacian. Nilai lebih tinggi = gambar lebih tajam.
        Jika di bawah blur_threshold, gambar dianggap blur karena gerak cepat.
        """
        if image is None or image.size == 0:
            return 0.0
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        score = cv2.Laplacian(gray, cv2.CV_64F).var()
        return float(score)

    def is_quality_acceptable(self, crop: np.ndarray) -> tuple[bool, float]:
        if crop is None or crop.shape[0] < self.min_size or crop.shape[1] < self.min_size:
            return False, 0.0

        blur_score = self.calculate_blur(crop)
        is_acceptable = blur_score >= self.blur_threshold
        return is_acceptable, blur_score

