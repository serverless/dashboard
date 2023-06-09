MAX_VALUE_LENGTH = 32766


def limit_tag_value(value: str) -> str:
    byte_array = value.encode(errors="ignore")
    if len(byte_array) <= MAX_VALUE_LENGTH:
        return value
    return byte_array[:MAX_VALUE_LENGTH].decode(errors="ignore")
