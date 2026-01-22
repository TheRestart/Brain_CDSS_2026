from rest_framework.pagination import PageNumberPagination

# Pagination 클래스 추가
class UserPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "size"   # ?size=20
    page_query_param = "page"        # ?page=1
    max_page_size = 100
