def default_if_none(value, default):
    if value is None:
        return default
    return value


def split_string_on_commas_or_none(s):
    if s is None:
        return None
    return [x.strip() for x in s.split(",")]
