#!/usr/bin/env python3
import sys
import os
import importlib
from pathlib import Path


# This script is executed by AWS Lambda Runtime as follows:
# /opt/sls-sdk-python/exec_wrapper.py /var/lang/bin/python3 /var/runtime/bootstrap.py
def main():
    from base import initialize

    initialize()

    # AWS Lambda Runtime sets "LAMBDA_RUNTIME_DIR" env variable to "/var/runtime"
    # which is needed in the path for the import to work.
    sys.path.append(os.environ["LAMBDA_RUNTIME_DIR"])

    module_name = Path(sys.argv[2]).stem
    bootstrap = importlib.import_module(module_name)
    bootstrap.main()


if __name__ == "__main__":
    main()
