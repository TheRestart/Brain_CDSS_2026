from django.contrib.auth.backends import ModelBackend
from apps.accounts.models import User

class LoginBackend(ModelBackend):
    def authenticate(self, request, login_id = None, password = None, **kwargs):
        try:
            user = User.objects.get(login_id =login_id)
        except User.DoesNotExist :
            return None
        
        if user.check_password(password):
            return user
        return None