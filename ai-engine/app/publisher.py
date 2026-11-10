import json
import logging
import requests
import pika
from datetime import datetime
from .config import config

logger = logging.getLogger("Publisher")

class AttendancePublisher:
    def __init__(self):
        self.rabbitmq_channel = None
        self._init_rabbitmq()

    def _init_rabbitmq(self):
        try:
            params = pika.URLParameters(config.rabbitmq_url)
            connection = pika.BlockingConnection(params)
            self.rabbitmq_channel = connection.channel()
            self.rabbitmq_channel.queue_declare(queue=config.rabbitmq_queue, durable=True)
            logger.info(f"Connected to RabbitMQ queue: {config.rabbitmq_queue}")
        except Exception as e:
            logger.warning(f"RabbitMQ connection not ready ({e}). Will use HTTP fallback.")
            self.rabbitmq_channel = None

    def publish_attendance(self, user_id: str, camera_id: str, confidence: float, track_id: str, img_url: str = None):
        payload = {
            "user_id": user_id,
            "camera_id": camera_id,
            "confidence": float(confidence),
            "track_id": track_id,
            "img_url": img_url,
            "timestamp": datetime.utcnow().isoformat(),
        }

        # 1. Coba publish via RabbitMQ
        if self.rabbitmq_channel:
            try:
                self.rabbitmq_channel.basic_publish(
                    exchange="",
                    routing_key=config.rabbitmq_queue,
                    body=json.dumps(payload),
                    properties=pika.BasicProperties(delivery_mode=2) # Persistent
                )
                logger.info(f"[RabbitMQ] Published presence for user: {user_id} (conf: {confidence:.2f})")
                return True
            except Exception as e:
                logger.error(f"Failed to publish via RabbitMQ: {e}")
                self._init_rabbitmq()

        # 2. Fallback via HTTP REST API
        try:
            endpoint = f"{config.backend_api_url}/attendance/ai-trigger"
            res = requests.post(endpoint, json=payload, timeout=3.0)
            if res.status_code == 200:
                logger.info(f"[HTTP Fallback] Sent presence for user: {user_id}")
                return True
            else:
                logger.error(f"[HTTP Fallback] Failed ({res.status_code}): {res.text}")
        except Exception as e:
            logger.error(f"HTTP fallback error: {e}")

        return False

