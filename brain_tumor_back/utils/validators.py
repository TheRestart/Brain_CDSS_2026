"""
공통 검증 유틸리티

작성일: 2025-12-30
목적: 프로젝트 전체에서 사용할 수 있는 재사용 가능한 검증 함수들
"""
import re
from datetime import date
from rest_framework import serializers


class ValidationPatterns:
    """검증 정규표현식 패턴"""

    # 한국 전화번호 (하이픈 있거나 없거나)
    PHONE_KR = r'^0\d{1,2}-?\d{3,4}-?\d{4}$'

    # 이메일
    EMAIL = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'

    # 주민등록번호 (13자리)
    SSN_KR = r'^\d{13}$'

    # UUID (표준 형식)
    UUID = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'

    # ICD-10 코드 (예: I60.0, G40.1)
    ICD10 = r'^[A-Z]\d{2}(\.\d{1,2})?$'

    # LOINC 코드 (예: 2345-7)
    LOINC = r'^\d{4,5}-\d$'


def validate_phone_kr(value):
    """
    한국 전화번호 검증

    Args:
        value: 전화번호 문자열

    Returns:
        검증된 전화번호

    Raises:
        serializers.ValidationError: 형식이 올바르지 않은 경우
    """
    if not value:
        return value

    if not re.match(ValidationPatterns.PHONE_KR, value):
        raise serializers.ValidationError(
            '전화번호 형식이 올바르지 않습니다. (예: 010-1234-5678 또는 01012345678)'
        )
    return value


def validate_email(value):
    """
    이메일 주소 검증

    Args:
        value: 이메일 문자열

    Returns:
        검증된 이메일

    Raises:
        serializers.ValidationError: 형식이 올바르지 않은 경우
    """
    if not value:
        return value

    if not re.match(ValidationPatterns.EMAIL, value):
        raise serializers.ValidationError(
            '이메일 형식이 올바르지 않습니다. (예: user@example.com)'
        )
    return value


def validate_ssn_kr(value):
    """
    주민등록번호 검증 (형식만, 체크섬은 옵션)

    Args:
        value: 주민등록번호 문자열

    Returns:
        검증된 주민등록번호

    Raises:
        serializers.ValidationError: 형식이 올바르지 않은 경우
    """
    if not value:
        return value

    # 길이 및 숫자 검증
    if len(value) != 13 or not value.isdigit():
        raise serializers.ValidationError(
            '주민등록번호는 13자리 숫자여야 합니다.'
        )

    # 체크섬 검증 (선택적)
    if not _validate_ssn_checksum(value):
        raise serializers.ValidationError(
            '주민등록번호 체크섬이 올바르지 않습니다.'
        )

    return value


def _validate_ssn_checksum(ssn):
    """
    주민등록번호 체크섬 검증

    Args:
        ssn: 13자리 주민등록번호

    Returns:
        bool: 체크섬 유효 여부
    """
    if len(ssn) != 13:
        return False

    # 주민등록번호 체크섬 알고리즘
    multipliers = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5]
    total = sum(int(ssn[i]) * multipliers[i] for i in range(12))
    checksum = (11 - (total % 11)) % 10

    return checksum == int(ssn[12])


def validate_birth_date(value):
    """
    생년월일 검증 (미래 날짜 불가)

    Args:
        value: 날짜 객체

    Returns:
        검증된 날짜

    Raises:
        serializers.ValidationError: 미래 날짜인 경우
    """
    if not value:
        return value

    if value > date.today():
        raise serializers.ValidationError(
            '생년월일은 미래 날짜일 수 없습니다.'
        )

    return value


def validate_icd10_code(value):
    """
    ICD-10 진단 코드 형식 검증

    Args:
        value: ICD-10 코드 문자열

    Returns:
        검증된 코드

    Raises:
        serializers.ValidationError: 형식이 올바르지 않은 경우
    """
    if not value:
        return value

    if not re.match(ValidationPatterns.ICD10, value):
        raise serializers.ValidationError(
            'ICD-10 코드 형식이 올바르지 않습니다. (예: I60.0, G40)'
        )

    return value


def validate_loinc_code(value):
    """
    LOINC 검사 코드 형식 검증

    Args:
        value: LOINC 코드 문자열

    Returns:
        검증된 코드

    Raises:
        serializers.ValidationError: 형식이 올바르지 않은 경우
    """
    if not value:
        return value

    if not re.match(ValidationPatterns.LOINC, value):
        raise serializers.ValidationError(
            'LOINC 코드 형식이 올바르지 않습니다. (예: 2345-7)'
        )

    return value


def validate_positive_number(value, field_name='값'):
    """
    양수 검증

    Args:
        value: 숫자 값
        field_name: 필드명 (에러 메시지용)

    Returns:
        검증된 값

    Raises:
        serializers.ValidationError: 양수가 아닌 경우
    """
    if value is None:
        return value

    if value <= 0:
        raise serializers.ValidationError(
            f'{field_name}은(는) 양수여야 합니다.'
        )

    return value


def validate_age_range(birth_date, min_age=0, max_age=150):
    """
    나이 범위 검증

    Args:
        birth_date: 생년월일
        min_age: 최소 나이
        max_age: 최대 나이

    Returns:
        검증된 생년월일

    Raises:
        serializers.ValidationError: 나이가 범위를 벗어난 경우
    """
    if not birth_date:
        return birth_date

    today = date.today()
    age = today.year - birth_date.year - (
        (today.month, today.day) < (birth_date.month, birth_date.day)
    )

    if age < min_age or age > max_age:
        raise serializers.ValidationError(
            f'나이는 {min_age}세 이상 {max_age}세 이하여야 합니다.'
        )

    return birth_date


class UniqueFieldValidator:
    """
    중복 필드 검증 클래스

    사용 예:
        def validate_ssn(self, value):
            return UniqueFieldValidator.validate(
                self, 'ssn', value, '주민등록번호'
            )
    """

    @staticmethod
    def validate(serializer_instance, field_name, value, field_display_name=None):
        """
        필드 중복 검증

        Args:
            serializer_instance: Serializer 인스턴스
            field_name: 검증할 필드명
            value: 검증할 값
            field_display_name: 에러 메시지에 표시할 필드명

        Returns:
            검증된 값

        Raises:
            serializers.ValidationError: 중복된 경우
        """
        if not value:
            return value

        model_class = serializer_instance.Meta.model
        queryset = model_class.objects.filter(**{field_name: value})

        # 수정 모드일 경우 자기 자신은 제외
        if serializer_instance.instance:
            queryset = queryset.exclude(pk=serializer_instance.instance.pk)

        if queryset.exists():
            display_name = field_display_name or field_name
            raise serializers.ValidationError(
                f'이미 등록된 {display_name}입니다.'
            )

        return value
