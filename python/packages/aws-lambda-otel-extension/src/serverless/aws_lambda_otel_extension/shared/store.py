import threading
from typing import Set


class Store:
    def __init__(self):
        self.lock = threading.Lock()
        self.execution_ids: Set[str] = set()

    def add_execution_id(self, execution_id: str) -> None:
        with self.lock:
            self.execution_ids.add(execution_id)

    @property
    def is_cold_start(self) -> bool:
        with self.lock:
            return len(self.execution_ids) == 0


store = Store()
