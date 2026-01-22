"""
OCS 알림 서비스
- OCS 상태 변경 시 WebSocket을 통해 관련 사용자에게 알림 전송

그룹 구조:
- ocs_ris: 모든 RIS 관련 알림 (RIS 작업자, 관리자가 구독)
- ocs_lis: 모든 LIS 관련 알림 (LIS 작업자, 관리자가 구독)
- ocs_doctor_{id}: 특정 의사가 처방한 오더 알림
"""
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.utils import timezone


def _debug_send(group_name, event_type, message):
    """디버깅용 로그 출력"""
    print(f"📤 [OCS 알림] group={group_name}, type={event_type}, msg={message[:50]}...")


def notify_ocs_status_changed(ocs, from_status, to_status, actor):
    """
    OCS 상태 변경 알림 전송

    Args:
        ocs: OCS 인스턴스
        from_status: 이전 상태
        to_status: 변경된 상태
        actor: 상태 변경을 수행한 사용자
    """
    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    timestamp = timezone.now().isoformat()

    # 상태별 메시지
    status_messages = {
        'ACCEPTED': f'{ocs.patient.name}님의 {ocs.job_type} 오더가 접수되었습니다.',
        'IN_PROGRESS': f'{ocs.patient.name}님의 {ocs.job_type} 작업이 시작되었습니다.',
        'RESULT_READY': f'{ocs.patient.name}님의 {ocs.job_type} 결과가 제출되었습니다.',
        'CONFIRMED': f'{ocs.patient.name}님의 {ocs.job_type} 결과가 확정되었습니다.',
        'CANCELLED': f'{ocs.patient.name}님의 {ocs.job_type} 오더가 취소되었습니다.',
    }

    message = status_messages.get(to_status, f'OCS 상태가 {to_status}(으)로 변경되었습니다.')

    event_data = {
        'type': 'ocs_status_changed',
        'ocs_id': ocs.ocs_id,
        'ocs_pk': ocs.id,
        'from_status': from_status,
        'to_status': to_status,
        'job_role': ocs.job_role,
        'patient_name': ocs.patient.name,
        'actor_name': actor.name if actor else 'System',
        'message': message,
        'timestamp': timestamp,
    }

    # 역할별 그룹에 알림 (RIS/LIS 작업자 + 관리자가 구독)
    job_role_lower = ocs.job_role.lower() if ocs.job_role else ''
    if job_role_lower in ['ris', 'lis']:
        group_name = f"ocs_{job_role_lower}"
        _debug_send(group_name, 'ocs_status_changed', message)
        async_to_sync(channel_layer.group_send)(group_name, event_data)

    # 처방 의사에게 알림 (의사 전용 그룹)
    if ocs.doctor_id:
        group_name = f"ocs_doctor_{ocs.doctor_id}"
        _debug_send(group_name, 'ocs_status_changed', message)
        async_to_sync(channel_layer.group_send)(group_name, event_data)


def notify_ocs_created(ocs, doctor):
    """
    새 OCS 생성 알림 전송

    Args:
        ocs: OCS 인스턴스
        doctor: 오더를 생성한 의사
    """
    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    timestamp = timezone.now().isoformat()
    priority_label = {'urgent': '긴급', 'normal': '일반', 'scheduled': '예약'}.get(ocs.priority, ocs.priority)

    message = f'새 {ocs.job_type} 오더가 생성되었습니다. (환자: {ocs.patient.name}, 우선순위: {priority_label})'

    event_data = {
        'type': 'ocs_created',
        'ocs_id': ocs.ocs_id,
        'ocs_pk': ocs.id,
        'job_role': ocs.job_role,
        'job_type': ocs.job_type,
        'priority': ocs.priority,
        'patient_name': ocs.patient.name,
        'doctor_name': doctor.name if doctor else 'Unknown',
        'message': message,
        'timestamp': timestamp,
    }

    # 역할별 그룹에 알림 (RIS/LIS 작업자 + 관리자가 구독)
    job_role_lower = ocs.job_role.lower() if ocs.job_role else ''
    if job_role_lower in ['ris', 'lis']:
        group_name = f"ocs_{job_role_lower}"
        _debug_send(group_name, 'ocs_created', message)
        async_to_sync(channel_layer.group_send)(group_name, event_data)


def notify_ocs_cancelled(ocs, actor, reason=''):
    """
    OCS 취소 알림 전송

    Args:
        ocs: OCS 인스턴스
        actor: 취소를 수행한 사용자
        reason: 취소 사유
    """
    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    timestamp = timezone.now().isoformat()
    message = f'{ocs.patient.name}님의 {ocs.job_type} 오더가 취소되었습니다.'
    if reason:
        message += f' (사유: {reason})'

    event_data = {
        'type': 'ocs_cancelled',
        'ocs_id': ocs.ocs_id,
        'ocs_pk': ocs.id,
        'reason': reason,
        'actor_name': actor.name if actor else 'System',
        'message': message,
        'timestamp': timestamp,
    }

    # 역할별 그룹에 알림 (RIS/LIS 작업자 + 관리자가 구독)
    job_role_lower = ocs.job_role.lower() if ocs.job_role else ''
    if job_role_lower in ['ris', 'lis']:
        group_name = f"ocs_{job_role_lower}"
        _debug_send(group_name, 'ocs_cancelled', message)
        async_to_sync(channel_layer.group_send)(group_name, event_data)

    # 처방 의사에게 알림 (의사 전용 그룹)
    if ocs.doctor_id:
        group_name = f"ocs_doctor_{ocs.doctor_id}"
        _debug_send(group_name, 'ocs_cancelled', message)
        async_to_sync(channel_layer.group_send)(group_name, event_data)
