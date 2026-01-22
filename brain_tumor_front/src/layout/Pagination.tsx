interface PaginationProps {
  currentPage: number;
  totalPages?: number;
  totalCount?: number;  // 호환성을 위해 추가
  pageSize?: number;
  onChange?: (currentPage: number) => void;
  onPageChange?: (currentPage: number) => void;  // 호환성을 위해 추가
}

export default function Pagination({
  currentPage,
  totalPages: totalPagesProp,
  totalCount,
  pageSize = 20,
  onChange,
  onPageChange,
}: PaginationProps) {
  // totalCount가 있으면 totalPages 계산, 없으면 totalPages 사용
  const totalPages = totalPagesProp ?? Math.ceil((totalCount || 0) / pageSize);
  // onChange 또는 onPageChange 사용
  const handleChange = onChange ?? onPageChange ?? (() => {});

  if (totalPages <= 1) return null;
  const groupSize = 5; // 한 그룹에 보여줄 페이지 수
  const currentGroup = Math.floor((currentPage - 1) / groupSize);
  const startPage = currentGroup * groupSize + 1;
  const endPage = Math.min(startPage + groupSize - 1, totalPages);
  // const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  // 그룹 범위만큼만 페이지 배열 생성
  const pages = endPage >= startPage
    ? Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i)
    : [];



  return (
    <div className="pagination-bar">
      {currentGroup > 0 && (
        <button onClick={() => handleChange(startPage - groupSize)}>{'<<'}</button>
      )}


      {/* 이전 */}
      <button
        className="page-btn"
        disabled={currentPage === 1}
        onClick={() => handleChange(currentPage - 1)}
      >
        ◀
      </button>

      {/* 페이지 번호 */}
      {pages.map(p => (
        <button
          key={p}
          className={`page-btn ${p === currentPage ? 'active' : ''}`}
          onClick={() => handleChange(p)}
        >
          {p}
        </button>
      ))}

      {/* 다음 */}
      <button
        className="page-btn"
        disabled={currentPage === totalPages}
        onClick={() => handleChange(currentPage + 1)}
      >
        ▶
      </button>

      {endPage < totalPages && (
        <button onClick={() => handleChange(startPage + groupSize)}>{'>>'}</button>
      )}
    </div>
  );
}
