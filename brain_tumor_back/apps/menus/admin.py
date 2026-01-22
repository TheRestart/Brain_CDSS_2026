from django.contrib import admin
from .models import Menu, MenuPermission, MenuLabel


# Admin 등록
admin.site.register(Menu)
admin.site.register(MenuPermission)
admin.site.register(MenuLabel)
