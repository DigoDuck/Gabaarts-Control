import os

from .base import *  # noqa: F401,F403

DEBUG = False
SECRET_KEY = os.environ["SECRET_KEY"]  # sem default: prod exige env
ALLOWED_HOSTS = os.environ["ALLOWED_HOSTS"].split(",")
# ponytail: hardening (SSL redirect, HSTS, cookies secure) entra no deploy — checklist do CLAUDE.md
