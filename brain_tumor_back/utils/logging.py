import re

def mask_ssn(ssn):
    """주민등록번호 마스킹 (앞 6자리만 노출)"""
    if not ssn or len(ssn) < 6:
        return ssn
    return f"{ssn[:6]}-*******"

def mask_email(email):
    """이메일 마스킹"""
    if not email or '@' not in email:
        return email
    prefix, domain = email.split('@')
    masked_prefix = prefix[:2] + '*' * (len(prefix) - 2)
    return f"{masked_prefix}@{domain}"

def mask_phone(phone):
    """전화번호 마스킹"""
    if not phone:
        return phone
    return re.sub(r'(\d{3})-(\d{4})-(\d{4})', r'\1-****-\3', phone)

def mask_sensitive_data(data):
    """딕셔너리 내 민감 정보 일괄 마스킹"""
    if not isinstance(data, dict):
        return data
    
    masked_data = data.copy()
    if 'ssn' in masked_data:
        masked_data['ssn'] = mask_ssn(masked_data['ssn'])
    if 'email' in masked_data:
        masked_data['email'] = mask_email(masked_data['email'])
    if 'phone' in masked_data:
        masked_data['phone'] = mask_phone(masked_data['phone'])
    if 'password' in masked_data:
        masked_data['password'] = '********'
    
    return masked_data
