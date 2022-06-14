from typing import Dict


def split_resource_attributes(s: str) -> Dict[str, str]:
    if not s:
        return {}
    return dict([_.split("=", maxsplit=1) for _ in s.split(",")])
