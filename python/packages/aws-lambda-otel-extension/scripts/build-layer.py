# Essentially just a fancy Makefile.. or maybe less fancy Makefile.. matter of perspective.

import argparse
import os
from collections import Counter
from pathlib import PosixPath
from shutil import rmtree
from subprocess import call
from textwrap import dedent
from typing import Dict, Optional, TypeVar, cast

UID = os.getuid()
GID = os.getgid()

PROJECT_PATH = PosixPath(__file__).parent.parent.absolute()
DOCKER_PROJECT_PATH = PosixPath("/project")

PYTHON_VERSION_ARCH_DOCKER_IMAGE_MATRIX = {
    # "3.6": {
    #     "amd64": "public.ecr.aws/sam/build-python3.6:latest-x86_64",
    # },
    "3.7": {
        "amd64": "public.ecr.aws/sam/build-python3.7:latest-x86_64",
    },
    "3.8": {
        "amd64": "public.ecr.aws/sam/build-python3.8:latest-x86_64",
        "arm64": "public.ecr.aws/sam/build-python3.8:latest-arm64",
    },
    "3.9": {
        "amd64": "public.ecr.aws/sam/build-python3.9:latest-x86_64",
        "arm64": "public.ecr.aws/sam/build-python3.9:latest-arm64",
    },
}


class BuildLayerNamespace(argparse.Namespace):
    build_path: PosixPath
    dist_path: PosixPath
    docker_bin_path: Optional[PosixPath]

    python_version: str
    arch: str

    skip_download: bool
    skip_install: bool

    single_arch: bool


def setup_build_environment(args: BuildLayerNamespace):

    args.build_path.mkdir(parents=True, exist_ok=True)
    args.dist_path.mkdir(parents=True, exist_ok=True)

    tmp_path = args.build_path / "tmp"
    tmp_path.mkdir(parents=True, exist_ok=True)

    cache_path = args.build_path / "cache"
    cache_path.mkdir(parents=True, exist_ok=True)

    downloads_path = args.build_path / "downloads"

    if not args.skip_download:
        if downloads_path.exists():
            rmtree(downloads_path, ignore_errors=True)

    install_path = args.build_path / "install"

    if not args.skip_install:
        if install_path.exists():
            rmtree(install_path, ignore_errors=True)


TD = TypeVar("TD", bound=Dict)


def dict_filtered_by_key_if_arg(d: TD, arg: str) -> TD:
    if arg:
        return cast(TD, {k: v for k, v in d.items() if k == arg})
    else:
        return d


def docker_download_wheels_from_matrix(args: BuildLayerNamespace):

    docker = str(args.docker_bin_path.absolute()) if args.docker_bin_path else "docker"

    for python_version, arch_docker_images in sorted(
        dict_filtered_by_key_if_arg(PYTHON_VERSION_ARCH_DOCKER_IMAGE_MATRIX, args.python_version).items()
    ):
        for arch, docker_image in sorted(dict_filtered_by_key_if_arg(arch_docker_images, args.arch).items()):
            docker_cache_path = DOCKER_PROJECT_PATH / "build" / "cache"
            docker_downloads_path = DOCKER_PROJECT_PATH / "build" / "downloads" / arch / python_version
            call(  # noqa: S603
                [
                    *[docker, "run", "--platform", f"linux/{arch}", "--user", f"{UID}:{GID}", "--rm", "-it"],
                    *["-v", f"{PROJECT_PATH}:{DOCKER_PROJECT_PATH}"],
                    docker_image,
                    *[
                        "/bin/bash",
                        "-c",
                        dedent(
                            f"""
                            set -ex
                            python{python_version} -m venv /tmp/.venv \
                                && source /tmp/.venv/bin/activate
                            python{python_version} -m pip --cache-dir {docker_cache_path} install \
                                --upgrade pip setuptools wheel
                            python{python_version} -m pip --cache-dir {docker_cache_path} download \
                                --prefer-binary /project \
                                --dest {docker_downloads_path}
                        """,
                        ),
                    ],
                ],
            )


def docker_install_wheels_from_matrix(args: BuildLayerNamespace):

    docker = str(args.docker_bin_path.absolute()) if args.docker_bin_path else "docker"

    tmp_path = args.build_path / "tmp"

    downloads_path = args.build_path / "downloads"

    arch_counter: Counter = Counter()
    file_counters_by_arch: Dict[str, Counter] = {}

    # Aggregate all the file names into a counter under an arch key.  This is just a not-so-fancy way to quickly sum up
    # how many duplicate files there are for each arch and then optionally install ones that cover every python version
    # in `/opt/python` directory and the rest will go into the respective `/opt/python/lib/python3.x/site-packages`
    # directory.
    for python_version, arch_docker_images in sorted(
        dict_filtered_by_key_if_arg(PYTHON_VERSION_ARCH_DOCKER_IMAGE_MATRIX, args.python_version).items()
    ):
        for arch in sorted(dict_filtered_by_key_if_arg(arch_docker_images, args.arch).keys()):

            if args.single_arch:
                arch_or_universal = arch
            else:
                arch_or_universal = "universal"

            arch_counter.update({arch_or_universal: 1})

            downloads_arch_python_version_path = downloads_path / arch / python_version

            file_counters_by_arch.setdefault(arch_or_universal, Counter()).update(
                [f.name for f in downloads_arch_python_version_path.glob("*") if f.is_file()]
            )

    for python_version, arch_docker_images in sorted(
        dict_filtered_by_key_if_arg(PYTHON_VERSION_ARCH_DOCKER_IMAGE_MATRIX, args.python_version).items()
    ):
        for arch, docker_image in sorted(dict_filtered_by_key_if_arg(arch_docker_images, args.arch).items()):

            if args.single_arch:
                arch_or_universal = arch
            else:
                arch_or_universal = "universal"

            docker_cache_path = DOCKER_PROJECT_PATH / "build" / "cache"
            docker_tmp_path = DOCKER_PROJECT_PATH / "build" / "tmp"

            docker_install_path = DOCKER_PROJECT_PATH / "build" / "install"
            docker_common_install_path = docker_install_path / arch_or_universal / "opt" / "python"
            docker_uncommon_install_path = (
                docker_common_install_path / "lib" / f"python{python_version}" / "site-packages"
            )

            downloads_arch_python_version_path = downloads_path / arch / python_version

            arch_count = arch_counter[arch_or_universal]

            common_dependencies = [
                DOCKER_PROJECT_PATH / f.relative_to(PROJECT_PATH)
                for f in downloads_arch_python_version_path.glob("*")
                if f.is_file() and file_counters_by_arch[arch_or_universal][f.name] == arch_count
            ]

            uncommon_dependencies = [
                DOCKER_PROJECT_PATH / f.relative_to(PROJECT_PATH)
                for f in downloads_arch_python_version_path.glob("*")
                if f.is_file() and file_counters_by_arch[arch_or_universal][f.name] < arch_count
            ]

            (tmp_path / "requirements.common.txt").write_text(
                os.linesep.join(str(f) for f in common_dependencies) + os.linesep
            )
            (tmp_path / "requirements.uncommon.txt").write_text(
                os.linesep.join(str(f) for f in uncommon_dependencies) + os.linesep
            )

            docker_common_requirements_path = docker_tmp_path / "requirements.common.txt"
            docker_uncommon_requirements_path = docker_tmp_path / "requirements.uncommon.txt"

            call(  # noqa: S603
                [
                    *[docker, "run", "--platform", f"linux/{arch}", "--user", f"{UID}:{GID}", "--rm", "-it"],
                    *["-v", f"{PROJECT_PATH}:/project"],
                    docker_image,
                    *[
                        "/bin/bash",
                        "-c",
                        dedent(
                            f"""
                            set -ex
                            python{python_version} -m venv /tmp/.venv \
                                && source /tmp/.venv/bin/activate
                            python{python_version} -m pip --cache-dir {docker_cache_path} install \
                                --upgrade pip setuptools wheel
                            python{python_version} -m pip --cache-dir {docker_cache_path} install \
                                --no-compile \
                                --requirement {docker_common_requirements_path} \
                                --target {docker_common_install_path} \
                                --no-deps
                            python{python_version} -m pip --cache-dir {docker_cache_path} install \
                                --no-compile \
                                --requirement {docker_uncommon_requirements_path} \
                                --target {docker_uncommon_install_path} \
                                --no-deps
                            python{python_version} -m pip --cache-dir {docker_cache_path} install \
                                --no-compile \
                                --upgrade --force-reinstall \
                                {DOCKER_PROJECT_PATH} \
                                --target {docker_common_install_path} \
                                --no-deps
                            find {docker_common_install_path} -name "*.so" -exec strip {{}} +
                            find {docker_uncommon_install_path} -name "*.so" -exec strip {{}} +
                        """,
                        ),
                    ],
                ],
            )


if __name__ == "__main__":

    parser = argparse.ArgumentParser()

    parser.add_argument("--build-path", type=PosixPath, default=PROJECT_PATH / "build")
    parser.add_argument("--dist-path", type=PosixPath, default=PROJECT_PATH / "dist")
    parser.add_argument("--docker-bin-path", type=PosixPath)

    parser.add_argument("--skip-download", action="store_true")
    parser.add_argument("--skip-install", action="store_true")

    parser.add_argument("--python-version", type=str)
    parser.add_argument("--arch", type=str)

    parser.add_argument("--single-arch", action="store_true")

    args = parser.parse_args(namespace=BuildLayerNamespace())

    setup_build_environment(args)

    if not args.skip_download:
        docker_download_wheels_from_matrix(args)

    if not args.skip_install:
        docker_install_wheels_from_matrix(args)
