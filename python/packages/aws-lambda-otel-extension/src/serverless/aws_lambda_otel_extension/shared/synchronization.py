import threading

otel_server_active_event = threading.Event()
log_server_active_event = threading.Event()

extension_registered_event = threading.Event()
log_registered_event = threading.Event()

extension_theading_lock = threading.Lock()
