from django.urls import include, path
from rest_framework.authtoken.views import obtain_auth_token
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
# os ViewSets entram aqui nas tasks seguintes

urlpatterns = [
    path("auth/token/", obtain_auth_token, name="api-token"),
    path("", include(router.urls)),
]
