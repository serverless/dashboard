from django.http import HttpResponse


def homePageView(request):
    return HttpResponse("Hello, World!")


def nestedPageView(request, *args, **kwargs):
    return HttpResponse(f"Hello, World! (I'm in here:{args}:{kwargs})")
