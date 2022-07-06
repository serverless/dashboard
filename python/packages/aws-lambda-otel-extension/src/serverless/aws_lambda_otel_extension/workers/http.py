from urllib.request import Request as HTTPRequest
import threading
from concurrent.futures import Future, ThreadPoolExecutor, wait
from typing import List


class HTTPClientWorkerPool:
    def __init__(self, num_threads: int = 2):
        self._lock = threading.Lock()
        self._futures: List[Future] = []
        self._num_threads = num_threads
        self._executor = ThreadPoolExecutor(max_workers=num_threads)

    def _fire_and_forget(self, request: HTTPRequest):
        print(request)

    def submit_request(self, request: HTTPRequest):
        with self._lock:
            future = self._executor.submit(self._fire_and_forget, request)
            self._futures.append(future)

    def force_flush(self, timeout: float = None):
        with self._lock:
            wait(self._futures, timeout=timeout)
            self._futures.clear()


http_client_worker_pool = HTTPClientWorkerPool()
