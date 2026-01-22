// src/pages/admin/PermissionHistoryPage.tsx
import { useEffect, useState } from 'react';
import type { Role } from '@/types/adminManager';
import { fetchPermissionHistory } from '@/services/permissionHistory';
import Pagination from '@/layout/Pagination';

interface Props {
  role: Role | null;
  refreshKey : number;
}

interface HistoryItem {
  id: number;
  changed_at: string;
  changed_by_name: string;
  action: 'ADD' | 'REMOVE';
  menu_name: string;
}

const PAGE_SIZE = 10;

export default function PermissionHistoryPage({ role, refreshKey }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [page, setPage] = useState(1);              // 현재 페이지
  const [totalCount, setTotalCount] = useState(0); // 전체 개수

  useEffect(() => {
    if (!role) return;

    fetchPermissionHistory(role.id)
    load();
  }, [role, refreshKey, page]);

  const load = async () => {
    if (!role) return;

    const res = await fetchPermissionHistory(role.id, {
        action,
        from,
        to,
        page,
        page_size: PAGE_SIZE,
    });

    setRows(res.results);
    setTotalCount(res.count);
    };


  const renderAction = (item: HistoryItem) => {
    if (item.action === 'ADD') {
      return `+ ${item.menu_name} 접근 권한 부여`;
    }
    return `- ${item.menu_name} 접근 권한 제거`;
  };


  return (
    <section className="card">
      <h4>접근 권한 변경 이력</h4>

      {/* 필터 */}
      <div className="filter-row">
        <select 
            value={action} 
            onChange={
                e => {
                    setAction(e.target.value);
                    setPage(1);
                }
            }
        >
          <option value="">전체</option>
          <option value="ADD">추가</option>
          <option value="REMOVE">제거</option>
        </select>

        <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        <input type="date" value={to} onChange={e => setTo(e.target.value)} />

        <button onClick={load}>조회</button>
      </div>

      {/* 테이블 */}
      <table className="history-table">
        <thead>
          <tr>
            <th>변경일시</th>
            <th>변경자</th>
            <th>메뉴</th>
            <th>변경이력</th>
            <th>사유</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5}>변경 이력이 없습니다.</td>
            </tr>
          )}
          {rows.map(row => (
            <tr key={row.id}>
              <td>{new Date(row.changed_at).toLocaleString()}</td>
              <td>{row.changed_by_name ?? '-'}</td>
              <td>{row.menu_name}</td>
              <td className={row.action === 'ADD' ? 'add' : 'remove'}>
                {renderAction(row)}
              </td>
              <td>{row.reason || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ================= 페이징 ================= */}
      <section className="pagination-bar">
        <Pagination
          currentPage={page}
          totalPages={Math.ceil(totalCount / PAGE_SIZE)}
          onChange={(p) => setPage(p)}
          pageSize={PAGE_SIZE}
        />
      </section>
      
    </section>
  );
}
