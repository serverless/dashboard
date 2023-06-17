from .imports import internally_imported

with internally_imported():
    import time
    from typing import Optional


_DIFF = time.time_ns() - time.perf_counter_ns()


def to_protobuf_epoch_timestamp(relative_time: Optional[int]) -> Optional[int]:
    if relative_time is not None:
        return _DIFF + relative_time
    else:
        return None
