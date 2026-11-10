import cv2
import time
import threading
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("RTSPStream")

class VideoStreamCapture:
    """
    RTSP Stream Ingestion dengan threading asinkron.
    Menjamin frame yang diproses selalu frame terbaru (zero-latency buffer drop).
    """
    def __init__(self, rtsp_url: str):
        self.rtsp_url = rtsp_url
        self.cap = None
        self.frame = None
        self.is_running = False
        self.lock = threading.Lock()
        self.reconnect_delay = 3.0

    def start(self):
        self.is_running = True
        self.thread = threading.Thread(target=self._capture_loop, daemon=True)
        self.thread.start()
        logger.info(f"Stream capture thread started for: {self.rtsp_url}")
        return self

    def _connect(self):
        logger.info(f"Connecting to RTSP source: {self.rtsp_url}...")
        self.cap = cv2.VideoCapture(self.rtsp_url, cv2.CAP_FFMPEG)
        # Kurangi buffer internal OpenCV agar selalu real-time
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        if not self.cap.isOpened():
            logger.warning(f"Could not open RTSP stream: {self.rtsp_url}")
            return False
        logger.info("RTSP connection established successfully.")
        return True

    def _capture_loop(self):
        while self.is_running:
            if self.cap is None or not self.cap.isOpened():
                if not self._connect():
                    time.sleep(self.reconnect_delay)
                    continue

            ret, frame = self.cap.read()
            if not ret or frame is None:
                logger.warning("Failed to grab frame from RTSP stream. Reconnecting...")
                if self.cap:
                    self.cap.release()
                time.sleep(self.reconnect_delay)
                continue

            with self.lock:
                self.frame = frame

    def read(self):
        with self.lock:
            if self.frame is None:
                return False, None
            return True, self.frame.copy()

    def stop(self):
        self.is_running = False
        if self.cap:
            self.cap.release()
        logger.info("RTSP Stream capture stopped.")

