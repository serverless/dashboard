import typing


def default_if_none(value: typing.Optional[typing.Any], default: typing.Any) -> typing.Any:
    # Just a shortcut to avoid having to do the same thing over and over.
    if value is None:
        return default
    return value


def split_string_on_commas_or_none(s: typing.Optional[str]) -> typing.Optional[typing.List[str]]:
    if s is None:
        return None
    return [x.strip() for x in s.split(",")]
