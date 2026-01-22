// Admin 메뉴 권한 관리 구현 코드
import { useEffect, useState } from 'react';
import type { MenuNode } from '@/types/menu';
import type { Role } from '@/types/adminManager';
import PermissionHistoryPage from './PermissionHistoryPage';


import {
  fetchRoles,
  fetchMenuTree,
  fetchRoleMenus,
  saveRoleMenus,
} from '@/services/admin.permission';

import '@/assets/style/adminMenuControlPageStyle.css';
import { showSuccess } from '@/utils/alert';

export default function MenuPermissionPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [menuTree, setMenuTree] = useState<MenuNode[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const [checkedMenuIds, setCheckedMenuIds] = useState<number[]>([]);
  const [originLeafMenuIds, setOriginLeafMenuIds] = useState<number[]>([]);

  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);


  /* =========================
     초기 로딩
  ========================= */
  useEffect(() => {
    Promise.all([fetchRoles(), fetchMenuTree()])
      .then(([roles, menus]) => {
        setRoles(roles ?? []);
        setMenuTree(menus ?? []);
        if (roles && roles.length > 0) {
          setSelectedRole(roles[0]);
        }
      })
      .catch((error) => {
        console.error('메뉴 권한 데이터 로딩 실패:', error);
        setRoles([]);
        setMenuTree([]);
      });
  }, []);

  /* =========================
     Role 변경 시 권한 조회
  ========================= */
  useEffect(() => {
    if (!selectedRole) return;

    fetchRoleMenus(selectedRole.id).then(ids => {
      setCheckedMenuIds(ids);
      setOriginLeafMenuIds(ids);
    });
  }, [selectedRole]);

  /* =========================
     공통 유틸
  ========================= */
  const getMenuLabel = (node: MenuNode) =>
    node.labels?.['DEFAULT'] ??
    Object.values(node.labels ?? {})[0] ??
    node.id;

  const collectMenuIds = (node: MenuNode): number[] => {
    const ids = [node.id];
    if (node.children) {
      node.children.forEach(c => {
        ids.push(...collectMenuIds(c));
      });
    }
    return ids;
  };

  /* =========================
     체크 / 전체선택 로직
  ========================= */
  const toggleMenu = (node: MenuNode, force?: boolean) => {
    setCheckedMenuIds(prev => {
      const next = new Set(prev);
      const ids = collectMenuIds(node);

      const shouldCheck =
        typeof force === 'boolean'
          ? force
          : !next.has(node.id);

      if (shouldCheck) {
        ids.forEach(id => next.add(id));
      } else {
        ids.forEach(id => next.delete(id));
      }

      return Array.from(next);
    });
  };

  const isIndeterminate = (node: MenuNode): boolean => {
    if (!node.children || node.children.length === 0) return false;

    const childIds = node.children.flatMap(collectMenuIds);
    const checkedCount = childIds.filter(id =>
      checkedMenuIds.includes(id)
    ).length;

    return checkedCount > 0 && checkedCount < childIds.length;
  };

  /* =========================
     하위 메뉴 렌더링
  ========================= */
  const renderMenu = (nodes: MenuNode[], depth = 0) => (
    <ul>
      {nodes.map(node => {
        const checked = checkedMenuIds.includes(node.id);
        const indeterminate = isIndeterminate(node);

        return (
          <li key={node.id} style={{ marginLeft: depth * 16 }}>
            <label>
              <input
                type="checkbox"
                checked={checked}
                ref={el => {
                  if (el) el.indeterminate = indeterminate;
                }}
                onChange={() => toggleMenu(node)}
              />
              {getMenuLabel(node)}
            </label>

            {node.children && renderMenu(node.children, depth + 1)}
          </li>
        );
      })}
    </ul>
  );

  /* =========================
     카테고리 카드 렌더링
  ========================= */
  const renderCategory = (node: MenuNode) => {
    const checked = checkedMenuIds.includes(node.id);
    const indeterminate = isIndeterminate(node);

    return (
      <section key={node.id} className="menu-category">
        <div className="menu-category-header">
          <label>
            <input
              type="checkbox"
              checked={checked}
              ref={el => {
                if (el) el.indeterminate = indeterminate;
              }}
              onChange={() => toggleMenu(node)}
            />
            <strong>{getMenuLabel(node)}</strong>
          </label>

          <div className="menu-actions">
            <button onClick={() => toggleMenu(node, true)}>
              전체 선택
            </button>
            <button onClick={() => toggleMenu(node, false)}>
              전체 해제
            </button>
          </div>
        </div>

        <div className="menu-category-body">
          {node.children && renderMenu(node.children, 1)}
        </div>
      </section>
    );
  };

  /* =========================
     저장 로직
  ========================= */
  const save = async () => {
    if (!selectedRole) return;

    await saveRoleMenus(selectedRole.id, checkedMenuIds);
    setOriginLeafMenuIds([...checkedMenuIds]);

    setHistoryRefreshKey(prev => prev +1);

    showSuccess("메뉴 권한 수정 완료");    
    //alert('저장 완료');
  };

  const normalize = (arr: number[]) =>
    [...arr].sort((a, b) => a - b);

  const isChanged =
    JSON.stringify(normalize(checkedMenuIds)) !==
    JSON.stringify(normalize(originLeafMenuIds));

  /* =========================
     Render
  ========================= */
  return (
    <section className="admin-layout">
      {/* 좌측 Role 리스트 */}
      <aside className="role-panel">
        <h3>Role</h3>
        <ul className="role-list">
          {roles.map(role => (
            <li
              key={role.id}
              className={selectedRole?.id === role.id ? 'active' : ''}
              onClick={() => setSelectedRole(role)}
            >
              {role.name}
            </li>
          ))}
        </ul>
      </aside>

      {/* 우측 상세 */}
      <main className="permission-panel">
        <section className="card">
          <h4>{selectedRole?.name} 접근 가능 화면</h4>

          <div className="menu-tree">
            {menuTree.map(root => renderCategory(root))}
          </div>

          <div className="actions">
            <button disabled={!isChanged} onClick={save}>
              저장
            </button>
          </div>
        </section>

        {/* 권한 변경 이력 */}
        <PermissionHistoryPage 
          role={selectedRole} 
          refreshKey={historyRefreshKey}  
        />

      </main>
    </section>
  );
}
