// WebSocket 연결 - 권한 변경 이벤트 수신
export function connectPermissionSocket(onChanged: () => void) {
  const wsBaseUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';
  const ws = new WebSocket(`${wsBaseUrl}/permissions/`);

  ws.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.type === 'PERMISSION_CHANGED' ||
      data.type === 'MENU_PERMISSION_UPDATED') {
      onChanged();
    }
  };

  return ws;
}
