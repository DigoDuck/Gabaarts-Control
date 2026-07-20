from django.urls import include, path
from rest_framework.authtoken.views import obtain_auth_token
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("makers", views.MakerViewSet)
router.register("equipment", views.EquipmentViewSet)
router.register("channels", views.ChannelViewSet)

urlpatterns = [
    path("auth/token/", obtain_auth_token, name="api-token"),
    path("", include(router.urls)),
]
