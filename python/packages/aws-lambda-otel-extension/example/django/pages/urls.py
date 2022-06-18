from django.urls import path
from .views import homePageView, nestedPageView

urlpatterns = [
    path("", homePageView, name="home"),
    path("nested/<slug>", nestedPageView, name="nested"),
]
