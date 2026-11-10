import numpy as np
import logging
from typing import Optional, List, Dict

logger = logging.getLogger("Recognizer")

class FaceRecognizer:
    """
    Ekstraksi vektor wajah (ArcFace 512-dimensi) dan pencocokan cosine similarity.
    """
    def __init__(self, matching_threshold: float = 0.85):
        self.matching_threshold = matching_threshold
        # Cache memory database wajah siswa: List of dict {user_id, embedding}
        self.known_embeddings: List[Dict] = []
        self._init_model()

    def _init_model(self):
        try:
            import insightface
            from insightface.app import FaceAnalysis
            self.app = FaceAnalysis(name='buffalo_l', providers=['CUDAExecutionProvider', 'CPUExecutionProvider'])
            self.app.prepare(ctx_id=0, det_size=(640, 640))
            logger.info("ArcFace (InsightFace) model initialized successfully.")
        except Exception as e:
            logger.warning(f"Could not initialize InsightFace GPU model: {e}. Fallback to simulated matcher for testing.")
            self.app = None

    def update_known_embeddings(self, embeddings_data: List[Dict]):
        """
        Sinkronisasi embedding dari database PostgreSQL
        Format: [{'user_id': '...', 'vector': [512 floats]}]
        """
        self.known_embeddings = []
        for item in embeddings_data:
            vec = np.array(item['vector'], dtype=np.float32)
            # Normalize vector L2
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec = vec / norm
            self.known_embeddings.append({
                'user_id': item['user_id'],
                'vector': vec
            })
        logger.info(f"Loaded {len(self.known_embeddings)} student face embeddings into memory.")

    def extract_embedding(self, face_crop: np.ndarray) -> Optional[np.ndarray]:
        """
        Mengekstrak 512-dimensi vektor embedding dari gambar crop wajah
        """
        if self.app is None:
            # Simulated dummy normalized vector for offline development/test
            np.random.seed(42)
            dummy = np.random.randn(512).astype(np.float32)
            return dummy / np.linalg.norm(dummy)

        faces = self.app.get(face_crop)
        if len(faces) == 0:
            return None
        # Ambil wajah dengan deteksi paling yakin
        embedding = faces[0].embedding
        norm = np.linalg.norm(embedding)
        return (embedding / norm) if norm > 0 else embedding

    def match(self, embedding: np.ndarray) -> tuple[Optional[str], float]:
        """
        Mencocokkan embedding wajah dengan database menggunakan Cosine Similarity.
        Return: (user_id, similarity_score)
        """
        if embedding is None or len(self.known_embeddings) == 0:
            return None, 0.0

        best_user_id = None
        highest_similarity = -1.0

        for item in self.known_embeddings:
            # Cosine similarity antara dua vektor yang sudah di-normalisasi L2 adalah dot product: A . B
            sim = float(np.dot(embedding, item['vector']))
            if sim > highest_similarity:
                highest_similarity = sim
                best_user_id = item['user_id']

        if highest_similarity >= self.matching_threshold:
            return best_user_id, highest_similarity

        return None, highest_similarity

