import { useEffect, useState, useRef } from 'react';
import {
  getSystemMonitorStats,
  getMonitorAlertConfig,
  updateMonitorAlertConfig,
  acknowledgeAlert,
  getLoginFailLogs,
  startDummyDataSetup,
  getDummyDataSetupStatus,
  cancelDummyDataSetup,
  type SystemMonitorStats,
  type MonitorAlertConfig,
  type MonitorAlertItem,
  type LoginFailLog,
  type DummyDataSetupOptions,
  type DummyDataSetupExecution
} from '@/services/monitor.api';
import '@/assets/style/adminPageStyle.css';

type DetailModalType = 'server' | 'cpu' | 'memory' | 'disk' | 'session' | 'login' | 'error' | null;

export default function SystemMonitorPage() {
  const [stats, setStats] = useState<SystemMonitorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 알림 설정 상태
  const [alertConfig, setAlertConfig] = useState<MonitorAlertConfig | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<MonitorAlertConfig | null>(null);
  const [saving, setSaving] = useState(false);

  // 상세 모달 상태
  const [detailModal, setDetailModal] = useState<DetailModalType>(null);

  // 새 경고 추가 모달 상태
  const [showAddAlertModal, setShowAddAlertModal] = useState(false);
  const [newAlert, setNewAlert] = useState<MonitorAlertItem>({
    id: '',
    title: '',
    description: '',
    metric: '',
    threshold: null,
    isBuiltIn: false,
    actions: []
  });

  // 로그인 실패 상세 보기 상태
  const [showLoginFailDetail, setShowLoginFailDetail] = useState(false);
  const [loginFailLogs, setLoginFailLogs] = useState<LoginFailLog[]>([]);
  const [loginFailLoading, setLoginFailLoading] = useState(false);

  // 더미 데이터 설정 상태
  const [showDummyDataModal, setShowDummyDataModal] = useState(false);
  const [dummyDataOptions, setDummyDataOptions] = useState<DummyDataSetupOptions>({});
  const [dummyDataExecution, setDummyDataExecution] = useState<DummyDataSetupExecution | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showFullscreenLog, setShowFullscreenLog] = useState(false);
  const outputLogRef = useRef<HTMLPreElement>(null);
  const fullscreenLogRef = useRef<HTMLPreElement>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSystemMonitorStats();
      setStats(data);
    } catch (err) {
      setError('시스템 모니터링 데이터를 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlertConfig = async () => {
    try {
      const config = await getMonitorAlertConfig();
      setAlertConfig(config);
    } catch (err) {
      console.error('Failed to fetch alert config:', err);
    }
  };

  // 로그인 실패 상세 로그 조회
  const fetchLoginFailLogs = async () => {
    setLoginFailLoading(true);
    try {
      const logs = await getLoginFailLogs();
      setLoginFailLogs(logs);
    } catch (err) {
      console.error('Failed to fetch login fail logs:', err);
    } finally {
      setLoginFailLoading(false);
    }
  };

  // 로그인 실패 상세 보기 클릭 핸들러
  const handleShowLoginFailDetail = () => {
    setShowLoginFailDetail(true);
    fetchLoginFailLogs();
  };

  // 더미 데이터 설정 모달 열기
  const handleOpenDummyDataModal = async () => {
    setShowDummyDataModal(true);
    setDummyDataOptions({});
    setShowResetConfirm(false);
    // 현재 실행 상태 조회
    try {
      const status = await getDummyDataSetupStatus();
      setDummyDataExecution(status);
      // 실행 중이면 폴링 재시작
      if (status.status === 'pending' || status.status === 'running') {
        setTimeout(pollDummyDataStatus, 1000);
      }
    } catch {
      setDummyDataExecution(null);
    }
  };

  // 더미 데이터 설정 실행
  const handleStartDummyDataSetup = async () => {
    // reset 옵션이 선택되었고 아직 확인하지 않은 경우
    if (dummyDataOptions.reset && !showResetConfirm) {
      setShowResetConfirm(true);
      return;
    }

    setShowResetConfirm(false);

    try {
      await startDummyDataSetup(dummyDataOptions);
      // 상태 폴링 시작
      pollDummyDataStatus();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      alert(error.response?.data?.detail || '실행 시작에 실패했습니다.');
    }
  };

  // 더미 데이터 설정 상태 폴링
  const pollDummyDataStatus = async () => {
    try {
      const status = await getDummyDataSetupStatus();
      setDummyDataExecution(status);

      // 로그 출력창 자동 스크롤
      if (outputLogRef.current) {
        outputLogRef.current.scrollTop = outputLogRef.current.scrollHeight;
      }

      // 아직 실행 중이면 계속 폴링
      if (status.status === 'pending' || status.status === 'running') {
        setTimeout(pollDummyDataStatus, 1000);
      }
    } catch {
      // 에러 시 폴링 중단
    }
  };

  // 더미 데이터 설정 취소
  const handleCancelDummyDataSetup = async () => {
    if (!window.confirm('실행 중인 작업을 취소하시겠습니까?')) return;

    try {
      await cancelDummyDataSetup();
      const status = await getDummyDataSetupStatus();
      setDummyDataExecution(status);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      alert(error.response?.data?.detail || '취소에 실패했습니다.');
    }
  };

  useEffect(() => {
    fetchStats();
    fetchAlertConfig();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ok': return '정상';
      case 'warning': return '주의';
      case 'error': return '오류';
      default: return status;
    }
  };

  // 알림 항목 찾기 헬퍼
  const findAlert = (alertId: string): MonitorAlertItem | undefined => {
    return alertConfig?.alerts.find(a => a.id === alertId);
  };

  // 현재 활성화된 알림 목록 계산
  const getActiveAlerts = (): { id: string; alert: MonitorAlertItem; currentValue: number | string; isAcknowledged: boolean }[] => {
    if (!stats || !alertConfig) return [];

    const alerts: { id: string; alert: MonitorAlertItem; currentValue: number | string; isAcknowledged: boolean }[] = [];
    const acknowledgedList = stats.acknowledged_alerts || [];

    // 서버 상태 체크
    if (stats.server.status === 'error') {
      const alert = findAlert('server_error');
      if (alert) {
        alerts.push({
          id: 'server_error',
          alert,
          currentValue: 'DB 연결 실패',
          isAcknowledged: acknowledgedList.includes('server_error')
        });
      }
    } else if (stats.server.status === 'warning') {
      const alert = findAlert('server_warning');
      if (alert) {
        alerts.push({
          id: 'server_warning',
          alert,
          currentValue: '주의',
          isAcknowledged: acknowledgedList.includes('server_warning')
        });
      }
    }

    // CPU 체크
    const cpuAlert = findAlert('cpu_warning');
    if (cpuAlert && cpuAlert.threshold && stats.resources.cpu_percent > cpuAlert.threshold) {
      alerts.push({
        id: 'cpu_warning',
        alert: cpuAlert,
        currentValue: stats.resources.cpu_percent,
        isAcknowledged: acknowledgedList.includes('cpu_warning')
      });
    }

    // 메모리 체크
    const memoryAlert = findAlert('memory_warning');
    if (memoryAlert && memoryAlert.threshold && stats.resources.memory_percent > memoryAlert.threshold) {
      alerts.push({
        id: 'memory_warning',
        alert: memoryAlert,
        currentValue: stats.resources.memory_percent,
        isAcknowledged: acknowledgedList.includes('memory_warning')
      });
    }

    // 디스크 체크
    const diskAlert = findAlert('disk_warning');
    if (diskAlert && diskAlert.threshold && stats.resources.disk_percent > diskAlert.threshold) {
      alerts.push({
        id: 'disk_warning',
        alert: diskAlert,
        currentValue: stats.resources.disk_percent,
        isAcknowledged: acknowledgedList.includes('disk_warning')
      });
    }

    // 오류 발생 체크
    const errorAlert = findAlert('error_warning');
    if (errorAlert && errorAlert.threshold && stats.errors.count > errorAlert.threshold) {
      alerts.push({
        id: 'error_warning',
        alert: errorAlert,
        currentValue: stats.errors.count,
        isAcknowledged: acknowledgedList.includes('error_warning')
      });
    }

    return alerts;
  };

  const openSettingsModal = () => {
    if (alertConfig) {
      setEditingConfig(JSON.parse(JSON.stringify(alertConfig)));
      setShowSettingsModal(true);
    }
  };

  const handleSaveSettings = async () => {
    if (!editingConfig) return;

    setSaving(true);
    try {
      await updateMonitorAlertConfig(editingConfig);
      setAlertConfig(editingConfig);
      setShowSettingsModal(false);
    } catch (err) {
      console.error('Failed to save config:', err);
      alert('설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const updateAlertItemInArray = (
    alertId: string,
    field: keyof MonitorAlertItem,
    value: string | number | null | string[] | boolean
  ) => {
    if (!editingConfig) return;
    setEditingConfig({
      ...editingConfig,
      alerts: editingConfig.alerts.map(alert =>
        alert.id === alertId ? { ...alert, [field]: value } : alert
      )
    });
  };

  const handleAddAlert = () => {
    if (!newAlert.id || !newAlert.title) {
      alert('ID와 제목은 필수입니다.');
      return;
    }

    if (editingConfig?.alerts.some(a => a.id === newAlert.id)) {
      alert('이미 존재하는 ID입니다.');
      return;
    }

    if (editingConfig) {
      setEditingConfig({
        ...editingConfig,
        alerts: [...editingConfig.alerts, { ...newAlert }]
      });
    }

    setNewAlert({
      id: '',
      title: '',
      description: '',
      metric: '',
      threshold: null,
      isBuiltIn: false,
      actions: []
    });
    setShowAddAlertModal(false);
  };

  const handleDeleteAlert = (alertId: string) => {
    if (!editingConfig) return;
    const alert = editingConfig.alerts.find(a => a.id === alertId);
    if (alert?.isBuiltIn) {
      window.alert('기본 알림은 삭제할 수 없습니다.');
      return;
    }
    if (window.confirm('이 알림을 삭제하시겠습니까?')) {
      setEditingConfig({
        ...editingConfig,
        alerts: editingConfig.alerts.filter(a => a.id !== alertId)
      });
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      await acknowledgeAlert(alertId);
      await fetchStats(); // 새로고침
    } catch (err) {
      console.error('Failed to acknowledge:', err);
      alert('확인 처리에 실패했습니다.');
    }
  };

  const activeAlerts = getActiveAlerts();
  const unacknowledgedAlerts = activeAlerts.filter(a => !a.isAcknowledged);

  // 알림에 대한 임계값 가져오기
  const getThreshold = (alertId: string): number => {
    const alert = findAlert(alertId);
    return alert?.threshold || 90;
  };

  if (loading && !stats) {
    return (
      <div className="admin-page">
        <div className="monitor-loading">데이터를 불러오는 중...</div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="admin-page">
        <div className="monitor-error">
          <p>{error}</p>
          <button onClick={fetchStats}>다시 시도</button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      {/* 헤더 */}
      <div className="monitor-header">
        <h2>시스템 모니터링</h2>
        <div className="header-buttons">
          <button className="settings-btn dummy-data-btn" onClick={handleOpenDummyDataModal}>
            Dummy Data Setup
          </button>
          <button className="settings-btn" onClick={openSettingsModal}>
            설정
          </button>
        </div>
      </div>

      {/* 모니터링 그리드 */}
      <div className="monitor-grid">
        {/* 서버 상태 */}
        <div
          className={`monitor-card clickable ${stats?.server.status || 'ok'}`}
          onClick={() => setDetailModal('server')}
        >
          <h3>서버 상태</h3>
          <p>{getStatusText(stats?.server.status || 'ok')}</p>
          <span className="sub-text">DB: {stats?.server.database || '-'}</span>
        </div>

        {/* CPU */}
        <div
          className={`monitor-card clickable ${(stats?.resources.cpu_percent || 0) > getThreshold('cpu_warning') ? 'warning' : 'ok'}`}
          onClick={() => setDetailModal('cpu')}
        >
          <h3>CPU 사용률</h3>
          <p>{stats?.resources.cpu_percent || 0}%</p>
          <span className="sub-text">기준: {getThreshold('cpu_warning')}%</span>
        </div>

        {/* Memory */}
        <div
          className={`monitor-card clickable ${(stats?.resources.memory_percent || 0) > getThreshold('memory_warning') ? 'warning' : 'ok'}`}
          onClick={() => setDetailModal('memory')}
        >
          <h3>메모리 사용률</h3>
          <p>{stats?.resources.memory_percent || 0}%</p>
          <span className="sub-text">
            {stats?.resources.memory_used_gb || 0}GB / {stats?.resources.memory_total_gb || 0}GB
          </span>
        </div>

        {/* 디스크 */}
        <div
          className={`monitor-card clickable ${(stats?.resources.disk_percent || 0) > getThreshold('disk_warning') ? 'warning' : 'ok'}`}
          onClick={() => setDetailModal('disk')}
        >
          <h3>디스크 사용률</h3>
          <p>{stats?.resources.disk_percent || 0}%</p>
          <span className="sub-text">기준: {getThreshold('disk_warning')}%</span>
        </div>

        {/* 활성 세션 */}
        <div
          className="monitor-card clickable"
          onClick={() => setDetailModal('session')}
        >
          <h3>활성 세션</h3>
          <p>{stats?.sessions.active_count || 0}</p>
          <span className="sub-text">최근 30분 기준</span>
        </div>

        {/* 금일 로그인 */}
        <div
          className="monitor-card clickable"
          onClick={() => setDetailModal('login')}
        >
          <h3>금일 로그인</h3>
          <p>{stats?.logins.today_total || 0}</p>
          <span className="sub-text">
            성공 {stats?.logins.today_success || 0} / 실패 {stats?.logins.today_fail || 0}
          </span>
        </div>

        {/* 오류 발생 */}
        <div
          className={`monitor-card clickable ${(stats?.errors.count || 0) > getThreshold('error_warning') ? 'warning' : 'ok'}`}
          onClick={() => setDetailModal('error')}
        >
          <h3>오류 발생</h3>
          <p>{stats?.errors.count || 0}건</p>
          <span className="sub-text">기준: {getThreshold('error_warning')}건</span>
        </div>

        {/* 마지막 갱신 */}
        <div className="monitor-card">
          <h3>마지막 갱신</h3>
          <p style={{ fontSize: '14px' }}>
            {stats?.timestamp
              ? new Date(stats.timestamp).toLocaleTimeString('ko-KR')
              : '-'}
          </p>
          <span className="sub-text">30초마다 자동 갱신</span>
        </div>
      </div>

      {/* 활성 알림 표시 (확인되지 않은 것만) */}
      {unacknowledgedAlerts.length > 0 && (
        <div className="alert-section">
          <h3>주의/경고 상태 안내</h3>
          {unacknowledgedAlerts.map(({ id, alert, currentValue }) => (
            <div key={id} className="alert-box">
              <div className="alert-header">
                <div className="alert-title">{alert.title}</div>
                <button
                  className="acknowledge-btn"
                  onClick={() => handleAcknowledge(id)}
                >
                  확인 완료
                </button>
              </div>
              <div className="alert-description">
                {/* 현재 수치와 임계값 표시 */}
                {id === 'cpu_warning' && (
                  <>현재 CPU 사용률: <strong>{currentValue}%</strong> (기준: {alert.threshold}%)</>
                )}
                {id === 'memory_warning' && (
                  <>현재 메모리 사용률: <strong>{currentValue}%</strong> ({stats?.resources.memory_used_gb}GB / {stats?.resources.memory_total_gb}GB, 기준: {alert.threshold}%)</>
                )}
                {id === 'disk_warning' && (
                  <>현재 디스크 사용률: <strong>{currentValue}%</strong> (기준: {alert.threshold}%)</>
                )}
                {id === 'error_warning' && (
                  <>로그인 실패 {stats?.errors.login_fail}건 + 계정 잠금 {stats?.errors.login_locked}건 = 총 <strong>{currentValue}건</strong> (기준: {alert.threshold}건)</>
                )}
                {(id === 'server_warning' || id === 'server_error') && (
                  <>{alert.description}</>
                )}
              </div>
              <ul className="alert-actions">
                {alert.actions.map((action, idx) => (
                  <li key={idx}>{action}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* 상세 모달 - 서버 */}
      {detailModal === 'server' && (
        <div className="modal-overlay" onClick={() => setDetailModal(null)}>
          <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>서버 상태 상세</h3>
              <button className="close-btn" onClick={() => setDetailModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-item">
                <label>상태</label>
                <span className={`status-badge ${stats?.server.status}`}>
                  {getStatusText(stats?.server.status || 'ok')}
                </span>
              </div>
              <div className="detail-item">
                <label>데이터베이스</label>
                <span>{stats?.server.database === 'connected' ? '연결됨' : '연결 끊김'}</span>
              </div>
              <div className="detail-item">
                <label>마지막 확인</label>
                <span>{stats?.timestamp ? new Date(stats.timestamp).toLocaleString('ko-KR') : '-'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 상세 모달 - CPU */}
      {detailModal === 'cpu' && (
        <div className="modal-overlay" onClick={() => setDetailModal(null)}>
          <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>CPU 상태 상세</h3>
              <button className="close-btn" onClick={() => setDetailModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-item">
                <label>현재 사용률</label>
                <span className="value-large">{stats?.resources.cpu_percent || 0}%</span>
              </div>
              <div className="detail-item">
                <label>경고 임계값</label>
                <span>{getThreshold('cpu_warning')}%</span>
              </div>
              <div className="detail-item">
                <label>상태</label>
                <span className={`status-badge ${(stats?.resources.cpu_percent || 0) > getThreshold('cpu_warning') ? 'warning' : 'ok'}`}>
                  {(stats?.resources.cpu_percent || 0) > getThreshold('cpu_warning') ? '주의' : '정상'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 상세 모달 - 메모리 */}
      {detailModal === 'memory' && (
        <div className="modal-overlay" onClick={() => setDetailModal(null)}>
          <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>메모리 상태 상세</h3>
              <button className="close-btn" onClick={() => setDetailModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-item">
                <label>현재 사용률</label>
                <span className="value-large">{stats?.resources.memory_percent || 0}%</span>
              </div>
              <div className="detail-item">
                <label>사용량</label>
                <span>{stats?.resources.memory_used_gb || 0}GB / {stats?.resources.memory_total_gb || 0}GB</span>
              </div>
              <div className="detail-item">
                <label>경고 임계값</label>
                <span>{getThreshold('memory_warning')}%</span>
              </div>
              <div className="detail-item">
                <label>상태</label>
                <span className={`status-badge ${(stats?.resources.memory_percent || 0) > getThreshold('memory_warning') ? 'warning' : 'ok'}`}>
                  {(stats?.resources.memory_percent || 0) > getThreshold('memory_warning') ? '주의' : '정상'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 상세 모달 - 디스크 */}
      {detailModal === 'disk' && (
        <div className="modal-overlay" onClick={() => setDetailModal(null)}>
          <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>디스크 상태 상세</h3>
              <button className="close-btn" onClick={() => setDetailModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-item">
                <label>현재 사용률</label>
                <span className="value-large">{stats?.resources.disk_percent || 0}%</span>
              </div>
              <div className="detail-item">
                <label>경고 임계값</label>
                <span>{getThreshold('disk_warning')}%</span>
              </div>
              <div className="detail-item">
                <label>상태</label>
                <span className={`status-badge ${(stats?.resources.disk_percent || 0) > getThreshold('disk_warning') ? 'warning' : 'ok'}`}>
                  {(stats?.resources.disk_percent || 0) > getThreshold('disk_warning') ? '주의' : '정상'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 상세 모달 - 세션 */}
      {detailModal === 'session' && (
        <div className="modal-overlay" onClick={() => setDetailModal(null)}>
          <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>활성 세션 상세</h3>
              <button className="close-btn" onClick={() => setDetailModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-item">
                <label>현재 활성 세션</label>
                <span className="value-large">{stats?.sessions.active_count || 0}명</span>
              </div>
              <div className="detail-item">
                <label>기준</label>
                <span>최근 30분 이내 활동한 사용자</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 상세 모달 - 로그인 */}
      {detailModal === 'login' && (
        <div className="modal-overlay" onClick={() => setDetailModal(null)}>
          <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>금일 로그인 상세</h3>
              <button className="close-btn" onClick={() => setDetailModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-item">
                <label>총 로그인 시도</label>
                <span className="value-large">{stats?.logins.today_total || 0}건</span>
              </div>
              <div className="detail-item">
                <label>로그인 성공</label>
                <span className="success">{stats?.logins.today_success || 0}건</span>
              </div>
              <div className="detail-item">
                <label>로그인 실패</label>
                <span className="fail">{stats?.logins.today_fail || 0}건</span>
              </div>
              <div className="detail-item">
                <label>계정 잠금</label>
                <span className="fail">{stats?.logins.today_locked || 0}건</span>
              </div>
              <div className="detail-info">
                금일 00:00 기준으로 집계됩니다.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 상세 모달 - 오류 발생 */}
      {detailModal === 'error' && (
        <div className="modal-overlay" onClick={() => setDetailModal(null)}>
          <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>오류 발생 상세</h3>
              <button className="close-btn" onClick={() => setDetailModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-item">
                <label>총 오류 발생</label>
                <span className="value-large">{stats?.errors.count || 0}건</span>
              </div>
              <div className="detail-item clickable-row" onClick={handleShowLoginFailDetail}>
                <label>로그인 실패</label>
                <span className="clickable-value">
                  {stats?.errors.login_fail || 0}건
                  <span className="view-detail-hint">상세보기 →</span>
                </span>
              </div>
              <div className="detail-item">
                <label>계정 잠금</label>
                <span>{stats?.errors.login_locked || 0}건</span>
              </div>
              <div className="detail-item">
                <label>경고 임계값</label>
                <span>{getThreshold('error_warning')}건 초과 시 경고</span>
              </div>
              <div className="detail-item">
                <label>상태</label>
                <span className={`status-badge ${(stats?.errors.count || 0) > getThreshold('error_warning') ? 'warning' : 'ok'}`}>
                  {(stats?.errors.count || 0) > getThreshold('error_warning') ? '주의' : '정상'}
                </span>
              </div>
              <div className="detail-info">
                금일 00:00 기준으로 집계됩니다.
              </div>
              {(stats?.errors.count || 0) > getThreshold('error_warning') && (
                <div className="detail-actions">
                  <button
                    className="acknowledge-btn"
                    onClick={() => {
                      handleAcknowledge('error_warning');
                      setDetailModal(null);
                    }}
                  >
                    확인 완료 (경고 해제)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 로그인 실패 상세 목록 모달 */}
      {showLoginFailDetail && (
        <div className="modal-overlay" onClick={() => setShowLoginFailDetail(false)}>
          <div className="modal-content login-fail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>로그인 실패 상세 (금일)</h3>
              <button className="close-btn" onClick={() => setShowLoginFailDetail(false)}>×</button>
            </div>
            <div className="modal-body">
              {loginFailLoading ? (
                <div className="loading-small">로딩 중...</div>
              ) : loginFailLogs.length === 0 ? (
                <div className="empty-message">금일 로그인 실패 기록이 없습니다.</div>
              ) : (
                <div className="login-fail-list">
                  <table className="login-fail-table">
                    <thead>
                      <tr>
                        <th>시간</th>
                        <th>시도 ID</th>
                        <th>사용자명</th>
                        <th>IP 주소</th>
                        <th>유저 에이전트</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loginFailLogs.map((log) => (
                        <tr key={log.id}>
                          <td>{new Date(log.created_at).toLocaleTimeString('ko-KR')}</td>
                          <td>{log.user_login_id || '-'}</td>
                          <td>{log.user_name || '-'}</td>
                          <td>{log.ip_address || '-'}</td>
                          <td className="detail-cell">{log.user_agent || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 설정 모달 */}
      {showSettingsModal && editingConfig && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal-content settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>알림 설정</h3>
              <button className="close-btn" onClick={() => setShowSettingsModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="settings-actions">
                <button className="add-alert-btn" onClick={() => setShowAddAlertModal(true)}>
                  + 새 경고 추가
                </button>
              </div>
              {editingConfig.alerts.map((alert) => (
                <div key={alert.id} className="alert-config-item">
                  <div className="config-header">
                    <h4>{alert.title}</h4>
                    {!alert.isBuiltIn && (
                      <button
                        className="delete-alert-btn"
                        onClick={() => handleDeleteAlert(alert.id)}
                      >
                        삭제
                      </button>
                    )}
                  </div>
                  <div className="config-field">
                    <label>제목</label>
                    <input
                      type="text"
                      value={alert.title}
                      onChange={(e) => updateAlertItemInArray(alert.id, 'title', e.target.value)}
                    />
                  </div>
                  <div className="config-field">
                    <label>설명</label>
                    <textarea
                      value={alert.description}
                      onChange={(e) => updateAlertItemInArray(alert.id, 'description', e.target.value)}
                    />
                  </div>
                  {alert.threshold !== null && alert.threshold !== undefined && (
                    <div className="config-field">
                      <label>임계값 {alert.metric === 'error_count' ? '(건)' : '(%)'}</label>
                      <input
                        type="number"
                        value={alert.threshold}
                        onChange={(e) => updateAlertItemInArray(alert.id, 'threshold', parseInt(e.target.value) || 0)}
                      />
                    </div>
                  )}
                  <div className="config-field">
                    <label>대처 방안 (줄바꿈으로 구분)</label>
                    <textarea
                      value={alert.actions.join('\n')}
                      onChange={(e) => updateAlertItemInArray(alert.id, 'actions', e.target.value.split('\n').filter(a => a.trim()))}
                      rows={3}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setShowSettingsModal(false)}>
                취소
              </button>
              <button className="save-btn" onClick={handleSaveSettings} disabled={saving}>
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 새 경고 추가 모달 */}
      {showAddAlertModal && (
        <div className="modal-overlay" onClick={() => setShowAddAlertModal(false)}>
          <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>새 경고 추가</h3>
              <button className="close-btn" onClick={() => setShowAddAlertModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="config-field">
                <label>ID (고유값)</label>
                <input
                  type="text"
                  value={newAlert.id}
                  onChange={(e) => setNewAlert({ ...newAlert, id: e.target.value })}
                  placeholder="예: custom_warning_1"
                />
              </div>
              <div className="config-field">
                <label>제목</label>
                <input
                  type="text"
                  value={newAlert.title}
                  onChange={(e) => setNewAlert({ ...newAlert, title: e.target.value })}
                  placeholder="예: 사용자 정의 경고"
                />
              </div>
              <div className="config-field">
                <label>설명</label>
                <textarea
                  value={newAlert.description}
                  onChange={(e) => setNewAlert({ ...newAlert, description: e.target.value })}
                  placeholder="경고 설명..."
                />
              </div>
              <div className="config-field">
                <label>대처 방안 (줄바꿈으로 구분)</label>
                <textarea
                  value={newAlert.actions.join('\n')}
                  onChange={(e) => setNewAlert({ ...newAlert, actions: e.target.value.split('\n').filter(a => a.trim()) })}
                  rows={3}
                  placeholder="각 줄에 하나씩 입력"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setShowAddAlertModal(false)}>
                취소
              </button>
              <button className="save-btn" onClick={handleAddAlert}>
                추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 전체 화면 로그 모달 */}
      {showFullscreenLog && dummyDataExecution?.output && (
        <div className="modal-overlay fullscreen-overlay" onClick={() => setShowFullscreenLog(false)}>
          <div className="modal-content fullscreen-log-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>실행 로그</h3>
              <button className="close-btn" onClick={() => setShowFullscreenLog(false)}>×</button>
            </div>
            <div className="modal-body fullscreen-log-body">
              <pre className="output-log fullscreen-log" ref={fullscreenLogRef}>
                {dummyDataExecution.output}
              </pre>
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setShowFullscreenLog(false)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dummy Data Setup 모달 */}
      {showDummyDataModal && (
        <div className="modal-overlay" onClick={() => setShowDummyDataModal(false)}>
          <div className="modal-content dummy-data-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Dummy Data Setup</h3>
              <button className="close-btn" onClick={() => setShowDummyDataModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {/* 옵션 선택 */}
              <div className="dummy-data-options">
                <h4>실행 옵션</h4>
                <p className="options-desc">옵션을 선택하지 않으면 전체 설정이 실행됩니다.</p>

                <label className="option-item danger-option">
                  <input
                    type="checkbox"
                    checked={dummyDataOptions.reset || false}
                    onChange={(e) => {
                      setDummyDataOptions({ ...dummyDataOptions, reset: e.target.checked });
                      setShowResetConfirm(false);
                    }}
                    disabled={dummyDataExecution?.status === 'running' || dummyDataExecution?.status === 'pending'}
                  />
                  <span className="option-label">--reset</span>
                  <span className="option-desc danger">기존 데이터 삭제 후 재생성 (주의: 모든 데이터가 삭제됩니다)</span>
                </label>

                <label className="option-item">
                  <input
                    type="checkbox"
                    checked={dummyDataOptions.base || false}
                    onChange={(e) => setDummyDataOptions({ ...dummyDataOptions, base: e.target.checked })}
                    disabled={dummyDataExecution?.status === 'running' || dummyDataExecution?.status === 'pending'}
                  />
                  <span className="option-label">--base</span>
                  <span className="option-desc">기본 데이터만 (역할, 사용자, 메뉴)</span>
                </label>

                <label className="option-item">
                  <input
                    type="checkbox"
                    checked={dummyDataOptions.clinical || false}
                    onChange={(e) => setDummyDataOptions({ ...dummyDataOptions, clinical: e.target.checked })}
                    disabled={dummyDataExecution?.status === 'running' || dummyDataExecution?.status === 'pending'}
                  />
                  <span className="option-label">--clinical</span>
                  <span className="option-desc">임상 데이터만 (환자, 진료, OCS)</span>
                </label>

                <label className="option-item">
                  <input
                    type="checkbox"
                    checked={dummyDataOptions.sync || false}
                    onChange={(e) => setDummyDataOptions({ ...dummyDataOptions, sync: e.target.checked })}
                    disabled={dummyDataExecution?.status === 'running' || dummyDataExecution?.status === 'pending'}
                  />
                  <span className="option-label">--sync</span>
                  <span className="option-desc">동기화만 (Orthanc, LIS)</span>
                </label>

                <label className="option-item">
                  <input
                    type="checkbox"
                    checked={dummyDataOptions.extended || false}
                    onChange={(e) => setDummyDataOptions({ ...dummyDataOptions, extended: e.target.checked })}
                    disabled={dummyDataExecution?.status === 'running' || dummyDataExecution?.status === 'pending'}
                  />
                  <span className="option-label">--extended</span>
                  <span className="option-desc">확장 데이터만 (추가 진료, 일정)</span>
                </label>

                <label className="option-item">
                  <input
                    type="checkbox"
                    checked={dummyDataOptions.menu || false}
                    onChange={(e) => setDummyDataOptions({ ...dummyDataOptions, menu: e.target.checked })}
                    disabled={dummyDataExecution?.status === 'running' || dummyDataExecution?.status === 'pending'}
                  />
                  <span className="option-label">--menu</span>
                  <span className="option-desc">메뉴/권한만</span>
                </label>

                <label className="option-item">
                  <input
                    type="checkbox"
                    checked={dummyDataOptions.schedule || false}
                    onChange={(e) => setDummyDataOptions({ ...dummyDataOptions, schedule: e.target.checked })}
                    disabled={dummyDataExecution?.status === 'running' || dummyDataExecution?.status === 'pending'}
                  />
                  <span className="option-label">--schedule</span>
                  <span className="option-desc">진료 일정 생성</span>
                </label>
              </div>

              {/* Reset 확인 경고 */}
              {showResetConfirm && (
                <div className="reset-warning">
                  <strong>경고:</strong> --reset 옵션은 모든 기존 데이터를 삭제합니다. 정말 실행하시겠습니까?
                  <div className="warning-actions">
                    <button className="cancel-btn" onClick={() => setShowResetConfirm(false)}>취소</button>
                    <button className="danger-btn" onClick={handleStartDummyDataSetup}>확인, 실행</button>
                  </div>
                </div>
              )}

              {/* 실행 상태 */}
              {dummyDataExecution && dummyDataExecution.status && (
                <div className="execution-status">
                  <div className="status-header">
                    <h4>실행 상태</h4>
                    <span className={`status-badge ${dummyDataExecution.status}`}>
                      {dummyDataExecution.status === 'pending' && '대기 중'}
                      {dummyDataExecution.status === 'running' && '실행 중'}
                      {dummyDataExecution.status === 'completed' && '완료'}
                      {dummyDataExecution.status === 'failed' && '실패'}
                      {dummyDataExecution.status === 'cancelled' && '취소됨'}
                    </span>
                  </div>

                  {dummyDataExecution.started_by && (
                    <div className="execution-info">
                      <span>실행자: {dummyDataExecution.started_by}</span>
                      {dummyDataExecution.started_at && (
                        <span>시작: {new Date(dummyDataExecution.started_at).toLocaleString('ko-KR')}</span>
                      )}
                    </div>
                  )}

                  {dummyDataExecution.output && (
                    <pre
                      className="output-log clickable-log"
                      ref={outputLogRef}
                      onClick={() => setShowFullscreenLog(true)}
                      title="클릭하여 전체 화면으로 보기"
                    >
                      {dummyDataExecution.output}
                    </pre>
                  )}

                  {dummyDataExecution.error_message && (
                    <div className="error-message">
                      {dummyDataExecution.error_message}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setShowDummyDataModal(false)}>
                닫기
              </button>
              {(dummyDataExecution?.status === 'running' || dummyDataExecution?.status === 'pending') ? (
                <button className="danger-btn" onClick={handleCancelDummyDataSetup}>
                  실행 취소
                </button>
              ) : (
                <button
                  className="save-btn"
                  onClick={handleStartDummyDataSetup}
                  disabled={showResetConfirm}
                >
                  실행
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
