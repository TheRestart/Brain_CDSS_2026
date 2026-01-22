from rest_framework import serializers
from .models import Menu, MenuLabel
from apps.authorization.serializers import RoleSerializer

# 프론트에 내려줄 형태
# MenuLabel 직렬화
class MenuLabelSerializer(serializers.ModelSerializer):
    # role = RoleSerializer(read_only=True)  # Role 전체 객체 직렬화
    class Meta:
        model = MenuLabel        
        # fields = ["role", "text"]
        fields = ["language", "text"]


# MenuRole 직렬화
# class MenuRoleSerializer(serializers.ModelSerializer):
#     role = RoleSerializer(read_only=True)  # Role 전체 객체 직렬화

#     class Meta:
#         model = MenuRole
#         fields = ["role"]

# Menu 직렬화
class MenuSerializer(serializers.ModelSerializer):
    labels = MenuLabelSerializer(many=True)
    # roles = MenuRoleSerializer(many=True)
    children = serializers.SerializerMethodField()

    class Meta:
        model = Menu
        fields = [
            "id",
            "code",
            "path",
            "icon",
            "group_label",
            "breadcrumb_only",
            "labels",
            "roles",
            "children",
        ]

    def get_children(self, obj):
        # children = obj.children.all()
        children = obj.children.filter(is_active=True)
        return MenuSerializer(children, many=True).data