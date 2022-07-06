import logging
import threading
from concurrent.futures import Future, ThreadPoolExecutor, wait
from typing import List
from urllib.request import Request as HTTPRequest
from urllib.request import urlopen

from opentelemetry.context import _SUPPRESS_INSTRUMENTATION_KEY
from opentelemetry.context import attach as context_attach
from opentelemetry.context import detach as context_detach
from opentelemetry.context import set_value as set_context_value
from tenacity import RetryError, Retrying, stop_after_attempt
from tenacity.wait import wait_fixed

logger = logging.getLogger(__name__)


class HTTPClientWorkerPool:
    def __init__(self, num_threads: int = 8):
        self._lock = threading.Lock()
        self._futures: List[Future] = []
        self._num_threads = num_threads
        self._executor = ThreadPoolExecutor(max_workers=num_threads)

    def _fire_and_forget(self, request: HTTPRequest):
        try:
            for attempt in Retrying(wait=wait_fixed(0.25), stop=stop_after_attempt(3)):
                with attempt:
                    token = context_attach(set_context_value(_SUPPRESS_INSTRUMENTATION_KEY, True))
                    urlopen(request, timeout=5)
                    context_detach(token)
        except RetryError:
            logger.exception("Failed to send request")

    def submit_request(self, request: HTTPRequest):
        with self._lock:
            future = self._executor.submit(self._fire_and_forget, request)
            self._futures.append(future)

    def force_flush(self, timeout: float = None):
        with self._lock:
            wait(self._futures, timeout=timeout)
            self._futures.clear()


http_client_worker_pool = HTTPClientWorkerPool()
