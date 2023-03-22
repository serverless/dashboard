_context = None


def set(context):
    global _context
    _context = context


def get():
    return _context
