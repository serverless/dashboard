from pkg_resources import get_distribution

_package_distribution = get_distribution("serverless-aws-lambda-otel-extension")

__package_name__ = _package_distribution.project_name
