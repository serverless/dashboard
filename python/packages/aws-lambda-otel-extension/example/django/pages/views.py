import os

import boto3
from django.http import HttpResponse


def homePageView(request):
    return HttpResponse("Hello, World!")


def nestedPageView(request, *args, **kwargs):
    if "slug" in kwargs:
        if kwargs["slug"] == "boom":
            raise Exception("boom")
        if kwargs["slug"] == "invoke":
            print(boto3.client("lambda").invoke(FunctionName=os.environ["TEST_HANDLER_FUNCTION"]))
    return HttpResponse(f"Hello, World! (I'm in here:{args}:{kwargs})")
