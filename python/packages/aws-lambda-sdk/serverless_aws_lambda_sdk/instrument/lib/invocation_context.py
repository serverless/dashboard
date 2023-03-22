_context: any = None


def set(context: any):
    global _context
    _context = context


def get():
    return _context
