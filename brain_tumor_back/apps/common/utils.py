# apps/common/utils.py

def get_client_ip(request):
    """
    클라이언트 실제 IP 주소 추출
    (프록시 / 로드밸런서 고려)
    """
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        # 첫 번째 IP가 실제 클라이언트 IP
        return x_forwarded_for.split(",")[0].strip()

    return request.META.get("REMOTE_ADDR")
