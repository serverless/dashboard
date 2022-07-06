from typing import Any, Dict, List, Optional, TypeVar

DN = TypeVar("DN", bound=Any)


def default_if_none(value: Optional[DN], default: DN) -> DN:
    # Just a shortcut to avoid having to do the same thing over and over.
    if value is None:
        return default
    return value


def split_or_none(s: Optional[str]) -> Optional[List[str]]:
    if s is None:
        return None
    return [x.strip() for x in s.split(",")]


def filter_dict_values_is_not_none(d: Dict) -> Dict:
    return {k: v for k, v in d.items() if v is not None}


def extract_account_id_from_invoked_function_arn(invoked_arn: str) -> Optional[str]:
    if not invoked_arn:
        return None

    invoked_arn_parts = invoked_arn.split(":")

    if len(invoked_arn_parts) < 6:
        return None

    return invoked_arn_parts[4]
