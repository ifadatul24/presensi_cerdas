import os
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

class AIConfig(BaseModel):
    # Camera Stream
    rtsp_url: str = os.getenv("RTSP_URL", "rtsp://localhost:8554/cam_masuk")
    camera_id: str = os.getenv("CAMERA_ID", "d0000000-0000-0000-0000-000000000001")
    camera_name: str = os.getenv("CAMERA_NAME", "Kamera Gerbang Masuk")
    
    # AI Models & Thresholds
    yolo_model_path: str = os.getenv("YOLO_MODEL_PATH", "models/yolov8n-face.pt")
    arcface_model_name: str = os.getenv("ARCFACE_MODEL", "buffalo_l")
    matching_threshold: float = float(os.getenv("MATCHING_THRESHOLD", "0.85"))
    blur_threshold: float = float(os.getenv("BLUR_THRESHOLD", "80.0")) # Laplacian variance min score
    min_face_size: int = int(os.getenv("MIN_FACE_SIZE", "64")) # pixels
    
    # RabbitMQ
    rabbitmq_url: str = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672")
    rabbitmq_queue: str = os.getenv("RABBITMQ_QUEUE", "attendance_events")
    
    # Fallback Backend API
    backend_api_url: str = os.getenv("BACKEND_API_URL", "http://localhost:4000/api")
    
    # Cooldown & Debounce (seconds)
    track_cooldown: int = int(os.getenv("TRACK_COOLDOWN", "600"))

config = AIConfig()

