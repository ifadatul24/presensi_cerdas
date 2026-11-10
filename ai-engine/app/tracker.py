import numpy as np

class SimpleCentroidTracker:
    """
    Pelacak objek bergerak berdasar Euclidean distance centroid
    (atau ByteTrack / Deep SORT wrapper). Memberikan track_id stabil
    untuk setiap wajah siswa yang melintas di depan kamera.
    """
    def __init__(self, max_disappeared: int = 15):
        self.next_object_id = 1
        self.objects = {}         # object_id -> centroid
        self.disappeared = {}     # object_id -> count
        self.max_disappeared = max_disappeared

    def register(self, centroid):
        obj_id = f"ID-{self.next_object_id}"
        self.objects[obj_id] = centroid
        self.disappeared[obj_id] = 0
        self.next_object_id += 1
        return obj_id

    def deregister(self, object_id):
        if object_id in self.objects:
            del self.objects[object_id]
        if object_id in self.disappeared:
            del self.disappeared[object_id]

    def update(self, rects: list[list[int]]) -> dict[str, list[int]]:
        """
        Input: rects format [[x1, y1, x2, y2], ...]
        Output: dict { track_id: [x1, y1, x2, y2] }
        """
        if len(rects) == 0:
            for object_id in list(self.disappeared.keys()):
                self.disappeared[object_id] += 1
                if self.disappeared[object_id] > self.max_disappeared:
                    self.deregister(object_id)
            return {}

        input_centroids = []
        for (x1, y1, x2, y2) in rects:
            cx = int((x1 + x2) / 2.0)
            cy = int((y1 + y2) / 2.0)
            input_centroids.append((cx, cy))

        if len(self.objects) == 0:
            tracked_boxes = {}
            for i, centroid in enumerate(input_centroids):
                track_id = self.register(centroid)
                tracked_boxes[track_id] = rects[i]
            return tracked_boxes

        object_ids = list(self.objects.keys())
        object_centroids = list(self.objects.values())

        # Hitung jarak Euclidean
        D = np.linalg.norm(np.array(object_centroids)[:, np.newaxis] - np.array(input_centroids), axis=2)
        rows = D.min(axis=1).argsort()
        cols = D.argmin(axis=1)[rows]

        used_rows = set()
        used_cols = set()
        tracked_boxes = {}

        for (row, col) in zip(rows, cols):
            if row in used_rows or col in used_cols:
                continue

            # Jika jarak terlalu jauh, anggap objek berbeda
            if D[row, col] > 100:
                continue

            object_id = object_ids[row]
            self.objects[object_id] = input_centroids[col]
            self.disappeared[object_id] = 0
            tracked_boxes[object_id] = rects[col]

            used_rows.add(row)
            used_cols.add(col)

        unused_cols = set(range(len(input_centroids))) - used_cols
        for col in unused_cols:
            track_id = self.register(input_centroids[col])
            tracked_boxes[track_id] = rects[col]

        unused_rows = set(range(len(object_centroids))) - used_rows
        for row in unused_rows:
            object_id = object_ids[row]
            self.disappeared[object_id] += 1
            if self.disappeared[object_id] > self.max_disappeared:
                self.deregister(object_id)

        return tracked_boxes

