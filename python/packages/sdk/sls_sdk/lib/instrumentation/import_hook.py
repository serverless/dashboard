from ..imports import internally_imported

with internally_imported():
    import sys
    from importlib.machinery import PathFinder, SourceFileLoader


class CustomImporter:
    def __init__(self, module_name, hook_fn=None):
        self._hook_fn = hook_fn
        self._module_name = module_name

    def find_spec(self, fullname, path, target=None):
        if path is not None or fullname != self._module_name:
            return None

        class CustomLoader(SourceFileLoader):
            def exec_module(_self, module):
                super().exec_module(module)
                self._hook_fn(module)

        spec = PathFinder.find_spec(fullname, path, target)
        if spec:
            spec.loader = CustomLoader(spec.loader.name, spec.loader.path)
        return spec


class ImportHook:
    def __init__(self, module_name):
        self._module_name = module_name
        self._importer = None
        self.enabled = False

    def enable(self, hook_fn):
        self.enabled = True

        already_enabled = bool(
            [
                p
                for p in sys.meta_path
                if isinstance(p, CustomImporter) and p._module_name == self._module_name
            ]
        )
        if already_enabled:
            return

        self._importer = CustomImporter(self._module_name, hook_fn)
        sys.meta_path.insert(0, self._importer)
        sys.path_importer_cache.clear()

        if self._module_name in sys.modules:
            # if the module is already loaded, run the hook immediately
            hook_fn(sys.modules[self._module_name])

    def disable(self, undo_hook_fn=None):
        self.enabled = False
        if undo_hook_fn and self._module_name in sys.modules:
            undo_hook_fn(sys.modules[self._module_name])

        importers = [
            p
            for p in sys.meta_path
            if isinstance(p, CustomImporter) and p._module_name == self._module_name
        ]
        if importers:
            for importer in importers:
                sys.meta_path.remove(importer)
            sys.path_importer_cache.clear()
