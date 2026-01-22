import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchUsers } from '@/services/users.api';
import type { User } from '@/types/user';

interface SearchableUserDropdownProps {
  value: string;
  onChange: (userId: string, user?: User) => void;
  placeholder?: string;
  className?: string;
}

export default function SearchableUserDropdown({
  value,
  onChange,
  placeholder = '사용자 검색',
  className = '',
}: SearchableUserDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 사용자 목록 로드
  const loadUsers = useCallback(async (searchTerm: string) => {
    setLoading(true);
    try {
      const response = await fetchUsers({ search: searchTerm, size: 50 });
      setUsers(response.results || []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 초기 로드 및 검색어 변경 시
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        loadUsers(search);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [search, isOpen, loadUsers]);

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // value 변경 시 선택된 사용자 업데이트
  useEffect(() => {
    if (!value) {
      setSelectedUser(null);
      setSearch('');
    }
  }, [value]);

  const handleSelect = (user: User) => {
    setSelectedUser(user);
    setSearch('');
    setIsOpen(false);
    onChange(user.login_id, user);
  };

  const handleClear = () => {
    setSelectedUser(null);
    setSearch('');
    onChange('', undefined);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    if (!isOpen) setIsOpen(true);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    if (users.length === 0) {
      loadUsers('');
    }
  };

  return (
    <div
      ref={containerRef}
      className={`searchable-dropdown ${className}`}
      style={{ position: 'relative', width: '220px' }}
    >
      <div
        className="dropdown-input-wrapper"
        style={{
          display: 'flex',
          alignItems: 'center',
          height: '36px',
          padding: '0 12px',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          backgroundColor: '#fff',
          cursor: 'text',
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {selectedUser ? (
          <>
            <span style={{ flex: 1, fontSize: '14px', color: '#111827' }}>
              {selectedUser.login_id} ({selectedUser.name})
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                padding: '2px 4px',
                fontSize: '14px',
                color: '#9ca3af',
              }}
            >
              ✕
            </button>
          </>
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            placeholder={placeholder}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: '14px',
              backgroundColor: 'transparent',
            }}
          />
        )}
        <span style={{ marginLeft: '8px', color: '#9ca3af', fontSize: '12px' }}>▼</span>
      </div>

      {isOpen && (
        <div
          className="dropdown-list"
          style={{
            position: 'absolute',
            top: '40px',
            left: 0,
            right: 0,
            maxHeight: '240px',
            overflowY: 'auto',
            backgroundColor: '#fff',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            zIndex: 1000,
          }}
        >
          {loading ? (
            <div style={{ padding: '12px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
              로딩 중...
            </div>
          ) : users.length === 0 ? (
            <div style={{ padding: '12px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
              검색 결과가 없습니다
            </div>
          ) : (
            users.map((user) => (
              <div
                key={user.id}
                onClick={() => handleSelect(user)}
                style={{
                  padding: '10px 12px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  borderBottom: '1px solid #f3f4f6',
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fff')}
              >
                <div style={{ fontWeight: 500, color: '#111827' }}>
                  {user.login_id}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                  {user.name} · {user.role?.name || '-'}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
