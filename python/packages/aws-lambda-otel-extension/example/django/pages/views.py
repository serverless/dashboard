import os

import boto3
from django.http import HttpResponse
import requests


def homePageView(request):
    return HttpResponse("Hello, World!")


def nestedPageView(request, *args, **kwargs):
    if "slug" in kwargs:
        if kwargs["slug"] == "boom":
            raise Exception("boom")
        if kwargs["slug"] == "invoke":
            print(boto3.client("lambda").invoke(FunctionName=os.environ["TEST_HANDLER_FUNCTION"]))
        if kwargs["slug"] == "webhookinvoke":
            print(
                boto3.client(
                    "lambda",
                    endpoint_url="https://webhook.site/9fe27a37-8ebd-4a3b-9969-e446cfb03951/webhookinvoke",
                ).invoke(FunctionName=os.environ["TEST_HANDLER_FUNCTION"])
            )
        if kwargs["slug"] == "webhook":
            requests.get("https://webhook.site/9fe27a37-8ebd-4a3b-9969-e446cfb03951/webhook")

    return HttpResponse(f"Hello, World! (I'm in here:{args}:{kwargs})")
