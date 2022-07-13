import threading
from typing import Dict, Iterator, List, Optional, Set, Union

from diskcache import Cache  # type: ignore
from opentelemetry.sdk.trace import Span


# TODO: See about moving some of this to the OpenTelemetry Context.
class Store:
    def __init__(self):
        self._lock = threading.Lock()
        self._execution_ids: Set[str] = set()
        self._pre_instrumentation_spans: List[Span] = []

        self._request_data_by_trace_id = Cache()
        self._response_data_by_trace_id = Cache()

    def is_cold_start_for_optional_execution_id(self, execution_id: Optional[str] = None) -> bool:
        with self._lock:
            if execution_id:
                # If an execution ID is offered then it is added to the set and if the set is only length 1 after then
                # we are definately a cold start execution.
                self._execution_ids.add(str(execution_id))
                if len(self._execution_ids) == 1:
                    return True
            else:
                # If no execution ID is offered then we want to return True if the length of the set is only 0.
                if len(self._execution_ids) == 0:
                    return True
        return False

    def append_pre_instrumentation_span(self, span: Span) -> None:
        with self._lock:
            self._pre_instrumentation_spans.append(span)

    def clear_pre_instrumentation_spans(self) -> None:
        with self._lock:
            self._pre_instrumentation_spans.clear()

    def set_request_data_for_trace_id(self, trace_id: int, event: Union[Dict, str, bytes]) -> None:
        with self._lock:
            self._request_data_by_trace_id.set(trace_id, event)

    def set_response_data_for_trace_id(self, trace_id: int, result: Union[Dict, str, bytes]) -> None:
        with self._lock:
            self._response_data_by_trace_id.set(trace_id, result)

    def get_request_data_for_trace_id(self, trace_id: int) -> Optional[Union[Dict, str, bytes]]:
        with self._lock:
            return self._request_data_by_trace_id.get(trace_id)

    def get_response_data_for_trace_id(self, trace_id: int) -> Optional[Union[Dict, str, bytes]]:
        with self._lock:
            return self._response_data_by_trace_id.get(trace_id)

    def clear_request_data_for_trace_id(self, trace_id: int) -> None:
        with self._lock:
            if trace_id in self._request_data_by_trace_id:
                self._request_data_by_trace_id.delete(trace_id)

    def clear_response_data_for_trace_id(self, trace_id: int) -> None:
        with self._lock:
            if trace_id in self._response_data_by_trace_id:
                self._response_data_by_trace_id.delete(trace_id)

    @property
    def pre_instrumentation_spans(self) -> Iterator[Span]:
        with self._lock:
            yield from self._pre_instrumentation_spans
        return


store = Store()
