/**
 * MyLabPage - 환자 전용 검사 결과 페이지
 *
 * 표시 내용:
 * - 혈액검사, 소변검사 등 Lab 결과 목록
 * - 상태 표시
 */
import { useState, useEffect } from 'react';
import '@/assets/style/patient-portal.css';
import { getMyOCS } from '@/services/patient-portal.api';
import type { MyOCSItem } from '@/types/patient-portal';

export default function MyLabPage() {
  const [results, setResults] = useState<MyOCSItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        setError(null);
        const ocsResult = await getMyOCS({ job_role: 'LIS' });
        setResults(ocsResult.results || []);
        setTotalCount(ocsResult.count || 0);
      } catch (err) {
        console.error('Failed to fetch lab results:', err);
        setError('검사 결과를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, []);

  if (loading) {
    return (
      <div className="patient-portal-page">
        <div className="loading-state">검사 결과를 불러오는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="patient-portal-page">
        <div className="error-state">{error}</div>
      </div>
    );
  }

  return (
    <div className="patient-portal-page">
      <div className="page-header">
        <h1>내 검사 결과</h1>
        <span className="result-count">{totalCount}건</span>
      </div>

      {results.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🧪</div>
          <div className="empty-text">검사 결과가 없습니다.</div>
        </div>
      ) : (
        <div className="lab-list">
          {results.map((result) => (
            <div key={result.id} className="lab-card">
              <div className="lab-header">
                <div className="lab-info">
                  <div className="lab-name">{result.job_type}</div>
                  <div className="lab-date">{result.created_at?.split('T')[0]}</div>
                </div>
                <div className="lab-status-wrapper">
                  <span className={`status-badge status-${result.ocs_status === 'CONFIRMED' ? 'completed' : 'pending'}`}>
                    {result.ocs_status_display}
                  </span>
                </div>
              </div>

              <div className="lab-body">
                <div className="result-summary">
                  <span className="label">담당의</span>
                  <span className="value">{result.doctor_name}</span>
                </div>
                {result.confirmed_at && (
                  <div className="result-summary">
                    <span className="label">확정일</span>
                    <span className="value">{result.confirmed_at.split('T')[0]}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
