from typing import Dict, Union


def split_resource_attributes(s: str) -> Dict[str, Union[str, bool, int, float]]:
    if not s:
        return {}
    return dict([_.split("=", maxsplit=1) for _ in s.split(",")])
