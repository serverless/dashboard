import pytest
from unittest.mock import MagicMock
from serverless_sdk.lib.emitter import EventEmitter, EVENT_TYPE


@pytest.mark.parametrize("event_type", EVENT_TYPE.__args__)
def test_event_emitter(event_type: EVENT_TYPE):
    # given
    mock = MagicMock()

    def handler(*args, **kwargs):
        mock(*args, **kwargs)

    event_emitter = EventEmitter()
    event_emitter.on(event_type, handler)

    # when
    event_emitter.emit(event_type, "foo", bar="foo-bar")

    # then
    mock.assert_called_once_with("foo", bar="foo-bar")
