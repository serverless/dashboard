from sls_sdk.lib.tag_value import limit_tag_value, MAX_VALUE_LENGTH


def test_limit_tag_value_noop_for_short_values():
    # given
    value = "this should pass as is"

    # when
    result = limit_tag_value(value)

    # then
    assert result == value


def test_limit_tag_value_truncates_long_values():
    # given
    value = "x" * (MAX_VALUE_LENGTH + 1)

    # when
    result = limit_tag_value(value)

    # then
    assert len(result) == MAX_VALUE_LENGTH
