from ..imports import internally_imported

with internally_imported():
    from functools import partial


class ReplacementMethod(object):
    def __init__(self, class_, method_name, target_method) -> None:
        self.class_ = class_
        self.method_name = method_name
        self.target_method = target_method
        self.original_method = getattr(class_, method_name)

    def get_target_method(self):
        def _target_method(instance, *args, **kwargs):
            return self.target_method(
                partial(self.original_method, instance), instance, args, kwargs
            )

        _target_method.__wrapped__ = self.original_method
        return _target_method


def replace_method(class_, method_name, target_method):
    # replace class_.method_name with replacement_method
    # keep reference to original
    # pass the original instance as argument
    # pass the original method as argument, but it should be bounded to the instance

    proxy = ReplacementMethod(class_, method_name, target_method)
    setattr(class_, method_name, proxy.get_target_method())
