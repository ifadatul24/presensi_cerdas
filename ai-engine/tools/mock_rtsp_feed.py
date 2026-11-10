"""
Utility untuk memancarkan feed video sampel ke RTSP server (MediaMTX)
atau menguji pipeline menggunakan file rekaman video lokal / webcam laptop.
"""
import cv2
import time
import argparse
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("MockRTSP")

def stream_video(video_source, fps=25):
    logger.info(f"Opening video source: {video_source}")
    cap = cv2.VideoCapture(video_source)
    
    if not cap.isOpened():
        logger.error(f"Failed to open video source: {video_source}")
        return

    delay = 1.0 / fps
    logger.info(f"Streaming started at ~{fps} FPS. Press Ctrl+C to stop.")

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                logger.info("Looping video to beginning...")
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue

            # Frame siap dikirim ke pipeline atau RTSP streamer
            time.sleep(delay)
    except KeyboardInterrupt:
        logger.info("Streaming stopped.")
    finally:
        cap.release()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Mock Video Streamer")
    parser.add_argument("--source", type=str, default="0", help="Webcam index (0) or path to mp4 video")
    parser.add_argument("--fps", type=int, default=25, help="Frame rate")
    args = parser.parse_args()

    src = int(args.source) if args.source.isdigit() else args.source
    stream_video(src, args.fps)

