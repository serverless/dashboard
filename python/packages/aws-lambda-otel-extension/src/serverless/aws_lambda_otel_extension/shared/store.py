import threading
from typing import Any, Dict, Iterator, List, Optional, Set, Union

from opentelemetry.sdk.trace import Span


# TODO: See about moving some of this to the OpenTelemetry Context.
class Store:
    def __init__(self):
        self._lock = threading.Lock()
        self._execution_ids: Set[str] = set()
        self._pre_instrumentation_spans: List[Span] = []

        self._request_data_by_trace_id: Dict[int, Union[Dict, str, bytes]] = {}
        self._response_data_by_trace_id: Dict[int, Union[Dict, str, bytes]] = {}

    def add_execution_id(self, execution_id: Any) -> None:
        with self._lock:
            self._execution_ids.add(str(execution_id))

    def append_pre_instrumentation_span(self, span: Span) -> None:
        with self._lock:
            self._pre_instrumentation_spans.append(span)

    def clear_pre_instrumentation_spans(self) -> None:
        with self._lock:
            self._pre_instrumentation_spans.clear()

    def set_request_data_for_trace_id(self, trace_id: int, event: Union[Dict, str, bytes]) -> None:
        with self._lock:
            self._request_data_by_trace_id[trace_id] = event

    def set_response_data_for_trace_id(self, trace_id: int, result: Union[Dict, str, bytes]) -> None:
        with self._lock:
            self._response_data_by_trace_id[trace_id] = result

    def get_request_data_for_trace_id(self, trace_id: int) -> Optional[Union[Dict, str, bytes]]:
        with self._lock:
            return self._request_data_by_trace_id.get(trace_id)

    def get_response_data_for_trace_id(self, trace_id: int) -> Optional[Union[Dict, str, bytes]]:
        with self._lock:
            return self._response_data_by_trace_id.get(trace_id)

    def clear_request_data_for_trace_id(self, trace_id: int) -> None:
        with self._lock:
            if trace_id in self._request_data_by_trace_id:
                del self._request_data_by_trace_id[trace_id]

    def clear_response_data_for_trace_id(self, trace_id: int) -> None:
        with self._lock:
            if trace_id in self._response_data_by_trace_id:
                del self._response_data_by_trace_id[trace_id]

    @property
    def pre_instrumentation_spans(self) -> Iterator[Span]:
        with self._lock:
            for pre_instrumentation_span in self._pre_instrumentation_spans:
                yield pre_instrumentation_span
        return

    @property
    def is_cold_start(self) -> bool:
        with self._lock:
            return len(self._execution_ids) <= 1


store = Store()
