import environ
import os
from pathlib import Path
from datetime import timedelta
from .base import * # 공통 설정
from corsheaders.defaults import default_headers
from dotenv import load_dotenv
load_dotenv()


# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# env 초기화 (.env 파일에서 환경변수 로드)
env = environ.Env()
environ.Env.read_env(os.path.join(BASE_DIR, '.env'))


SECRET_KEY = env('SECRET_KEY')
DEBUG = env.bool('DEBUG', default=False)

# ALLOWED_HOSTS 설정
# 운영 환경에서는 .env에서 ALLOWED_HOSTS를 명시적으로 설정하세요
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["127.0.0.1", "localhost"])


# Application definition
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django_filters",
    "corsheaders",
    "channels",
    "rest_framework",
    "drf_spectacular",
    # 기존 시스템 앱들 (유지)
    "apps.accounts",        # 사용자 관리
    "apps.audit",           # 감사 로그
    "apps.authorization",   # 인증/권한 (로그인 시스템)
    "apps.common",          # 공통 모델
    "apps.menus",           # 메뉴 관리
    # CDSS 앱들
    "apps.patients",        # 환자 관리
    "apps.encounters",      # 진료 관리
    "apps.imaging",         # 영상 관리
    "apps.ocs",             # OCS (Order Communication System)
    "apps.ai_inference",    # AI 추론 관리

    "apps.treatment",       # 치료 관리
    "apps.followup",        # 경과 추적
    "apps.prescriptions",   # 처방 관리
    "apps.orthancproxy",    # Orthanc 프록시
    "apps.reports",         # 진료 보고서 관리
    "apps.schedules",       # 의사 일정 관리
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",  # 반드시 CommonMiddleware보다 위에
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]



# Database
# https://docs.djangoproject.com/en/5.2/ref/settings/#databases

# 데이터베이스 설정
DATABASES = {
    # MYSQL_DB 설정
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': env('MYSQL_DB'),
        'USER': env('MYSQL_USER'),
        'PASSWORD': env('MYSQL_PASSWORD'),
        'HOST': env('MYSQL_HOST'),
        'PORT': env('MYSQL_PORT'),
        'OPTIONS': {
            'charset': 'utf8mb4',
            'init_command': "SET time_zone='+09:00'",
        },
    },

}



# Password validation
# https://docs.djangoproject.com/en/5.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


# Internationalization
# https://docs.djangoproject.com/en/5.2/topics/i18n/

LANGUAGE_CODE = "ko-kr"

TIME_ZONE = "Asia/Seoul"

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.2/howto/static-files/

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "static"

# Default primary key field type
# https://docs.djangoproject.com/en/5.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# DB와 연결된 로그인 정보 호출
AUTH_USER_MODEL = "accounts.User"

# 로그인 로직 (있어야만 로그인 처리 가능)
AUTHENTICATION_BACKENDS = [
    "apps.accounts.backends.LoginBackend",
]

# SimpleJWT 설정
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME" : timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME" : timedelta(days=1),
    "AUTH_HEADER_TYPES" : ("Bearer",),
}

# CORS 옵션 추가
# 허용할 오리진 지정
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",   # Vite 개발 서버
    "http://127.0.0.1:5173",   # Vite 개발 서버
    "http://localhost:5174",   # Vite 개발 서버 (대체 포트)
    "http://127.0.0.1:5174",   # Vite 개발 서버 (대체 포트)
    "http://localhost",        # Nginx (로컬)
    "http://127.0.0.1",        # Nginx (로컬)
    "http://34.46.109.203",    # GCP 외부 IP (운영)
]

# 헤더 허용 (Authorization 등) : default_headers(기본 헤더) +  Authorization 추가
CORS_ALLOW_HEADERS = list(default_headers) + [
    "authorization",
]
# 쿠키를 포함한 cross-origin 요청
CORS_ALLOW_CREDENTIALS = True


# Swagger 설정
REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ]
}

SPECTACULAR_SETTINGS = {
    "TITLE": "NeuroNova CDSS API",
    "DESCRIPTION": "Clinical Decision Support System API",
    "VERSION": "1.0.0",
    "USE_SESSION_AUTH": False,
    "SERVE_INCLUDE_SCHEMA": False,  # 문서 로드시 자동 호출 방지
    "SECURITY_SCHEMES": {
        "bearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
        },
    },
}


# 보안 기능 활성화 여부 (True/False)
ENABLE_SECURITY = True  # 운영 환경
# ENABLE_SECURITY = False  # 개발 환경

# 이메일 발송
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = "smtp.gmail.com"
EMAIL_PORT = 587
EMAIL_USE_TLS = True

EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD")
DEFAULT_FROM_EMAIL = f"BrainTumor System <{EMAIL_HOST_USER}>"

# Docker로 띄운 Orthanc (docker-compose에서 8042:8042 라고 가정)
ORTHANC_BASE_URL = os.getenv("ORTHANC_URL", "http://localhost:8042")
DATA_UPLOAD_MAX_NUMBER_FILES = None
ORTHANC_DEBUG_LOG = True

# ==================================================
# External Patient Raw Data
# (TCGA, MRI, RNA, Genomics, etc.)
# ==================================================
PATIENT_DATA_ROOT: Path = Path(
    os.environ.get(
        "PATIENT_DATA_ROOT",
        str(BASE_DIR.parent / "patient_data")  # ✅ 안전한 기본값
    )
)

# ==================================================
# CDSS STORAGE (Single Source of Truth)
# brain_tumor_dev/CDSS_STORAGE를 기준으로 통일
# Docker 환경: /CDSS_STORAGE (볼륨 마운트)
# 로컬 환경: BASE_DIR.parent / "CDSS_STORAGE"
# ==================================================
_docker_cdss_path = Path("/CDSS_STORAGE")
CDSS_STORAGE_ROOT = _docker_cdss_path if _docker_cdss_path.exists() else BASE_DIR.parent / "CDSS_STORAGE"

CDSS_LIS_STORAGE = CDSS_STORAGE_ROOT / "LIS"
CDSS_RIS_STORAGE = CDSS_STORAGE_ROOT / "RIS"
CDSS_AI_STORAGE = CDSS_STORAGE_ROOT / "AI"

CDSS_STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
CDSS_LIS_STORAGE.mkdir(parents=True, exist_ok=True)
CDSS_RIS_STORAGE.mkdir(parents=True, exist_ok=True)
CDSS_AI_STORAGE.mkdir(parents=True, exist_ok=True)

# ==================================================
# AI MODEL PATHS
# ==================================================
MODAI_ROOT = BASE_DIR.parent / "modAI"

MODAI_MODEL_DIR = MODAI_ROOT / "model"

M1_CLS_WEIGHTS = MODAI_MODEL_DIR / "M1_Cls_best.pth"
M1_SEG_WEIGHTS = MODAI_MODEL_DIR / "M1_Seg_separate_best.pth"