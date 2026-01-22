# apps/accounts/filters.py
import django_filters
from .models import User

# 사용자 검색 필터
class UserFilter(django_filters.FilterSet):
    role__code = django_filters.CharFilter(
        field_name="role__code",
        lookup_expr="exact"
    )
    is_active = django_filters.BooleanFilter(field_name="is_active")


    class Meta:
        model = User
        fields = ["role__code", "is_active"]
