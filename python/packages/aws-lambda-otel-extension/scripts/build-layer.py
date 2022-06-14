#!/usr/bin/env python3.9

import argparse
import logging
import pathlib
import shutil
import subprocess
import sys
import time
import zipfile
from collections import Counter

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("build")

BUILD_MATRIX = {
    # "3.6": ["manylinux_2_17_x86_64"], # Dies AUG 2022
    "3.7": ["manylinux_2_17_x86_64"],
    "3.8": ["manylinux_2_17_x86_64", "manylinux_2_17_aarch64"],
    "3.9": ["manylinux_2_17_x86_64", "manylinux_2_17_aarch64"],
    # Waiting for glib2.6 wheels to appear for wrapt/grpcio
    # "3.8": ["manylinux_2_26_x86_64", "manylinux_2_26_aarch64"],
    # "3.9": ["manylinux_2_26_x86_64", "manylinux_2_26_aarch64"],
}

PYTHON_VERSION_EXPANSION = {
    # "3.6": "3.6.15",
    "3.7": "3.7.13",
    "3.8": "3.8.13",
    "3.9": "3.9.11",
}

BUILD_PATH_NAME = "build"
DIST_PATH_NAME = "dist"
EXTENSION_PATH_NAME = "extension"
INTERNAL_PATH_NAME = "internal"
MATRIX_PATH_NAME = "matrix"
PYTHON_PATH_NAME = "python"
LIB_PATH_NAME = "lib"
SRC_PATH_NAME = "src"
ASSET_PATH_NAME = "assets"


DIST_EXTENSION_PATH_NAME = "extension.zip"

PROJECT_SCRIPTS_PATH = pathlib.Path(__file__).parent.relative_to(pathlib.Path("."))
PROJECT_PATH = PROJECT_SCRIPTS_PATH.parent
PROJECT_SRC_PATH = PROJECT_PATH.joinpath(SRC_PATH_NAME)
ASSETS_PATH = PROJECT_PATH.joinpath(ASSET_PATH_NAME)
ASSETS_INTERNAL_PATH = ASSETS_PATH.joinpath(INTERNAL_PATH_NAME)

BUILD_PATH = PROJECT_PATH.joinpath(BUILD_PATH_NAME)
BUILD_MATRIX_PATH = BUILD_PATH.joinpath(MATRIX_PATH_NAME)

BUILD_EXTENSION_PATH = BUILD_PATH.joinpath(EXTENSION_PATH_NAME)
BUILD_EXTENSION_PYTHON_PATH = BUILD_EXTENSION_PATH.joinpath(PYTHON_PATH_NAME)

DIST_PATH = PROJECT_PATH.joinpath(DIST_PATH_NAME)
DIST_PATH_EXTENSION_INTERNAL_ZIP_PATH = DIST_PATH.joinpath(DIST_EXTENSION_PATH_NAME)


class ArgumentNamespace(argparse.Namespace):
    skip_download: bool
    skip_install: bool
    no_clean: bool


def main():

    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-download", action="store_true")
    parser.add_argument("--skip-install", action="store_true")
    parser.add_argument("--no-clean", action="store_true")

    args = parser.parse_args(namespace=ArgumentNamespace())

    if not args.no_clean:
        if not args.skip_download:
            if BUILD_MATRIX_PATH.exists():
                logger.debug("rmtree:%s", BUILD_MATRIX_PATH)
                shutil.rmtree(BUILD_MATRIX_PATH)

        if BUILD_EXTENSION_PATH.exists():
            logger.debug("rmtree:%s", BUILD_EXTENSION_PATH)
            shutil.rmtree(str(BUILD_EXTENSION_PATH))

    # Ensure that the build/dist directories exists.
    BUILD_PATH.mkdir(exist_ok=True)
    DIST_PATH.mkdir(exist_ok=True)

    BUILD_EXTENSION_PATH.mkdir(parents=True, exist_ok=True)
    logger.debug("copytree:%s:%s", ASSETS_INTERNAL_PATH, BUILD_EXTENSION_PATH)
    shutil.copytree(
        str(ASSETS_INTERNAL_PATH), str(BUILD_EXTENSION_PATH), dirs_exist_ok=True, copy_function=shutil.copy2
    )

    BUILD_EXTENSION_PATH.joinpath(".serverless_aws_lambda_otel_extension").write_text(str(time.time()))

    matrix_counter = 0

    for (
        matrix_python_version,
        matrix_platforms,
    ) in BUILD_MATRIX.items():
        expanded_matrix_python_version = PYTHON_VERSION_EXPANSION[matrix_python_version]
        for matrix_platform in matrix_platforms:
            matrix_counter += 1
            target_path = BUILD_MATRIX_PATH.joinpath(
                matrix_python_version,
                matrix_platform,
            )
            target_path.mkdir(parents=True, exist_ok=True)

            if not args.skip_download:
                logger.debug("pip:downloading:target:%s", target_path)

                subprocess.check_output(
                    [
                        "pip",
                        "download",
                        "--disable-pip-version-check",
                        f"--platform={matrix_platform}",
                        f"--python-version={expanded_matrix_python_version}",
                        "--only-binary=:all:",
                        str(PROJECT_PATH),
                        "-d",
                        str(target_path),
                    ]
                )

    if not args.skip_install:
        logger.debug("pip:install:target:%s", BUILD_EXTENSION_PYTHON_PATH)
        subprocess.check_output(
            [
                "pip",
                "install",
                "--disable-pip-version-check",
                str(PROJECT_PATH),
                "--no-deps",
                "-t",
                str(BUILD_EXTENSION_PYTHON_PATH),
            ]
        )

    # Get a count of all the wheels in the build packages directories
    wheel_path_name_counts = Counter([wheel_path.name for wheel_path in BUILD_MATRIX_PATH.glob("**/*.whl")])

    uncommon_wheel_path_names = []

    for wheel_path_name, count in wheel_path_name_counts.items():
        if count != matrix_counter:
            uncommon_wheel_path_names.append(wheel_path_name)

    for (
        matrix_python_version,
        matrix_platforms,
    ) in BUILD_MATRIX.items():
        for matrix_platform in matrix_platforms:
            target_path = BUILD_MATRIX_PATH.joinpath(
                matrix_python_version,
                matrix_platform,
            )

            target_path.mkdir(parents=True, exist_ok=True)

            for wheel_path in target_path.glob("*.whl"):
                extraction_path = BUILD_EXTENSION_PYTHON_PATH

                if wheel_path.name in uncommon_wheel_path_names:
                    extraction_path = BUILD_EXTENSION_PYTHON_PATH.joinpath(
                        LIB_PATH_NAME,
                        f"{PYTHON_PATH_NAME}{matrix_python_version}",
                        "site-packages",
                    )

                extraction_path.mkdir(parents=True, exist_ok=True)

                with zipfile.ZipFile(str(wheel_path)) as zip_file:
                    logger.debug("unpacking:%s", wheel_path)
                    zip_file.extractall(str(extraction_path))

    logger.debug("unlink:%s", DIST_PATH_EXTENSION_INTERNAL_ZIP_PATH)
    DIST_PATH_EXTENSION_INTERNAL_ZIP_PATH.unlink(missing_ok=True)

    with zipfile.ZipFile(DIST_PATH_EXTENSION_INTERNAL_ZIP_PATH, "w") as zip_file:
        logger.debug("packing:%s", DIST_PATH_EXTENSION_INTERNAL_ZIP_PATH)
        for extension_file_path in BUILD_EXTENSION_PATH.glob("**/*"):
            zip_file.write(
                str(extension_file_path),
                arcname=str(extension_file_path.relative_to(BUILD_EXTENSION_PATH)),
            )


if __name__ == "__main__":
    sys.exit(main())
