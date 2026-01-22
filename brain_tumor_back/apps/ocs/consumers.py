"""
OCS WebSocket Consumer
- OCS 상태 변경 실시간 알림
- 역할(RIS/LIS)별 그룹 구독

그룹 구조:
- ocs_ris: 모든 RIS 관련 알림 (RIS 작업자, 관리자, 간호사가 구독)
- ocs_lis: 모든 LIS 관련 알림 (LIS 작업자, 관리자, 간호사가 구독)
- ocs_doctor_{user_id}: 특정 의사가 처방한 오더 알림
"""
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from urllib.parse import parse_qs


class OCSConsumer(AsyncWebsocketConsumer):
    """
    OCS 상태 변경 알림 WebSocket Consumer

    그룹:
    - ocs_ris: RIS 관련 OCS 알림 (RIS 작업자, 관리자, 간호사)
    - ocs_lis: LIS 관련 OCS 알림 (LIS 작업자, 관리자, 간호사)
    - ocs_doctor_{user_id}: 특정 의사의 OCS 알림
    """

    async def connect(self):
        """WebSocket 연결"""
        # 쿼리 파라미터에서 토큰 추출
        query_string = self.scope.get('query_string', b'').decode()
        params = parse_qs(query_string)

        # 사용자 정보 확인
        self.user = self.scope.get('user')
        if not self.user or not self.user.is_authenticated:
            await self.close()
            return

        # 사용자 역할에 따른 그룹 구독
        self.groups_joined = []

        # 역할에 따른 그룹 구독
        role_code = await self._get_user_role()

        if role_code in ['SYSTEMMANAGER', 'ADMIN', 'NURSE']:
            # 관리자/간호사는 모든 OCS 알림 수신 (RIS + LIS)
            await self.channel_layer.group_add("ocs_ris", self.channel_name)
            self.groups_joined.append("ocs_ris")
            await self.channel_layer.group_add("ocs_lis", self.channel_name)
            self.groups_joined.append("ocs_lis")

        elif role_code == 'RIS':
            # RIS 작업자는 역할별 그룹 구독
            await self.channel_layer.group_add("ocs_ris", self.channel_name)
            self.groups_joined.append("ocs_ris")

        elif role_code == 'LIS':
            # LIS 작업자는 역할별 그룹 구독
            await self.channel_layer.group_add("ocs_lis", self.channel_name)
            self.groups_joined.append("ocs_lis")

        elif role_code == 'DOCTOR':
            # 의사는 자신의 오더 알림만 수신
            doctor_group = f"ocs_doctor_{self.user.id}"
            await self.channel_layer.group_add(doctor_group, self.channel_name)
            self.groups_joined.append(doctor_group)

        await self.accept()
        print(f"🔌 OCS WebSocket connected: user={self.user.login_id}, groups={self.groups_joined}")

    async def disconnect(self, close_code):
        """WebSocket 연결 종료"""
        # 모든 그룹에서 탈퇴
        for group in self.groups_joined:
            await self.channel_layer.group_discard(group, self.channel_name)

        print(f"❌ OCS WebSocket disconnected: user={getattr(self, 'user', None)}")

    async def receive(self, text_data):
        """클라이언트로부터 메시지 수신 (ping/pong 등)"""
        try:
            data = json.loads(text_data)
            msg_type = data.get('type')

            if msg_type == 'ping':
                await self.send(text_data=json.dumps({'type': 'pong'}))
        except json.JSONDecodeError:
            pass

    # =========================================================================
    # 그룹 메시지 핸들러
    # =========================================================================

    async def ocs_status_changed(self, event):
        """OCS 상태 변경 알림"""
        await self.send(text_data=json.dumps({
            'type': 'OCS_STATUS_CHANGED',
            'ocs_id': event['ocs_id'],
            'ocs_pk': event['ocs_pk'],
            'from_status': event['from_status'],
            'to_status': event['to_status'],
            'job_role': event['job_role'],
            'patient_name': event['patient_name'],
            'actor_name': event['actor_name'],
            'message': event['message'],
            'timestamp': event['timestamp'],
        }))

    async def ocs_created(self, event):
        """새 OCS 생성 알림"""
        await self.send(text_data=json.dumps({
            'type': 'OCS_CREATED',
            'ocs_id': event['ocs_id'],
            'ocs_pk': event['ocs_pk'],
            'job_role': event['job_role'],
            'job_type': event['job_type'],
            'priority': event['priority'],
            'patient_name': event['patient_name'],
            'doctor_name': event['doctor_name'],
            'message': event['message'],
            'timestamp': event['timestamp'],
        }))

    async def ocs_cancelled(self, event):
        """OCS 취소 알림"""
        await self.send(text_data=json.dumps({
            'type': 'OCS_CANCELLED',
            'ocs_id': event['ocs_id'],
            'ocs_pk': event['ocs_pk'],
            'reason': event.get('reason', ''),
            'actor_name': event['actor_name'],
            'message': event['message'],
            'timestamp': event['timestamp'],
        }))

    # =========================================================================
    # 헬퍼 메서드
    # =========================================================================

    @database_sync_to_async
    def _get_user_role(self):
        """사용자 역할 코드 조회"""
        if self.user and self.user.role:
            return self.user.role.code
        return None
