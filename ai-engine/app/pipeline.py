import time
import logging
import cv2
from .config import config
from .stream_capture import VideoStreamCapture
from .detector import FaceDetector
from .tracker import SimpleCentroidTracker
from .best_frame import BestFrameSelector
from .recognizer import FaceRecognizer
from .publisher import AttendancePublisher

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("AIPipeline")

class FaceRecognitionPipeline:
    def __init__(self):
        logger.info("Initializing Video-Based Face Recognition Pipeline...")
        self.stream = VideoStreamCapture(config.rtsp_url)
        self.detector = FaceDetector(config.yolo_model_path)
        self.tracker = SimpleCentroidTracker(max_disappeared=20)
        self.best_frame_selector = BestFrameSelector(config.blur_threshold, config.min_face_size)
        self.recognizer = FaceRecognizer(config.matching_threshold)
        self.publisher = AttendancePublisher()

        # Pelacakan status per track_id: { track_id: { 'recognized': bool, 'user_id': str, 'best_score': float } }
        self.tracked_sessions = {}

    def run(self):
        self.stream.start()
        logger.info(f"Pipeline started. Monitoring RTSP Camera: {config.camera_name} ({config.camera_id})")

        fps_timer = time.time()
        frame_counter = 0

        try:
            while True:
                ret, frame = self.stream.read()
                if not ret or frame is None:
                    time.sleep(0.01)
                    continue

                frame_counter += 1
                if time.time() - fps_timer >= 5.0:
                    fps = frame_counter / (time.time() - fps_timer)
                    logger.info(f"Pipeline Throughput: {fps:.1f} FPS | Active Tracks: {len(self.tracker.objects)}")
                    fps_timer = time.time()
                    frame_counter = 0

                # 1. Deteksi Wajah (YOLOv8)
                boxes = self.detector.detect(frame)

                # 2. Tracking Objek Bergerak (Deep SORT / Centroid)
                tracked_objects = self.tracker.update(boxes)

                # 3. Proses tiap track_id
                for track_id, box in tracked_objects.items():
                    x1, y1, x2, y2 = box
                    # Pastikan koordinat dalam batas frame
                    h, w, _ = frame.shape
                    x1, y1 = max(0, x1), max(0, y1)
                    x2, y2 = min(w, x2), min(h, y2)

                    crop = frame[y1:y2, x1:x2]

                    # Jika belum teridentifikasi untuk track_id ini
                    session = self.tracked_sessions.get(track_id, {'recognized': False, 'best_blur': 0.0})

                    if not session['recognized']:
                        # 4. Filter Kualitas Gambar (Anti Motion-Blur)
                        is_sharp, blur_score = self.best_frame_selector.is_quality_acceptable(crop)

                        if is_sharp and blur_score > session['best_blur']:
                            session['best_blur'] = blur_score

                            # 5. Ekstraksi Vektor Wajah (ArcFace 512-dim)
                            embedding = self.recognizer.extract_embedding(crop)

                            if embedding is not None:
                                # 6. Pencocokan Vektor (Cosine Similarity)
                                user_id, confidence = self.recognizer.match(embedding)

                                if user_id is not None:
                                    logger.info(f"Match Confirmed: {user_id} with confidence {confidence:.3f} on {track_id}")
                                    session['recognized'] = True
                                    session['user_id'] = user_id

                                    # 7. Publish Event ke RabbitMQ / Backend
                                    self.publisher.publish_attendance(
                                        user_id=user_id,
                                        camera_id=config.camera_id,
                                        confidence=confidence,
                                        track_id=track_id,
                                        img_url=None
                                    )

                    self.tracked_sessions[track_id] = session

                # Bersihkan track_id yang sudah tidak aktif
                active_ids = set(tracked_objects.keys())
                for dead_id in list(self.tracked_sessions.keys()):
                    if dead_id not in active_ids and dead_id not in self.tracker.objects:
                        del self.tracked_sessions[dead_id]

        except KeyboardInterrupt:
            logger.info("Stopping pipeline...")
        finally:
            self.stream.stop()

if __name__ == "__main__":
    pipeline = FaceRecognitionPipeline()
    pipeline.run()

