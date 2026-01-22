import Swal from 'sweetalert2';

let is403AlertOpen = false;

export function show403Alert() {
  if (is403AlertOpen) return;

  is403AlertOpen = true;

  Swal.fire({
    icon: 'warning',
    title: '접근 권한 없음',
    text: '이 메뉴에 접근할 권한이 없습니다.',
    width: 360,
    padding: '1.25rem',
    confirmButtonText: '확인',
    confirmButtonColor: '#1d4ed8',
  }).finally(() => {
    is403AlertOpen = false;
  });
}

export const showSuccess = (title: string, text?: string) => {
  return Swal.fire({
    icon: 'success',
    title,
    text,
    timer: 1200,
    width: 424,
    padding: '1.25rem',
    showConfirmButton: false,
  });
};

export const showError = (title: string, text?: string) => {
 return Swal.fire({
    icon: 'error',
    title,
    text,
    width: 424,
    padding: '1.25rem',
    showConfirmButton: true,
  });
};

export const showQuestion = (title: string, text?: string) => {
  return Swal.fire({
    icon: 'question',
    title,
    text,
    padding: '1.25rem',
    showConfirmButton: true,          // 확인 버튼 표시
    confirmButtonText: '확인',        // 확인 버튼 텍스트
    confirmButtonColor: '#1d4ed8',    // 확인 버튼 색상
    showCancelButton: true,           // 취소 버튼 표시
    cancelButtonText: '취소',         // 취소 버튼 텍스트
    cancelButtonColor: '#6b7280',     // 취소 버튼 색상
  });

};


export const showWarning = (title: string, text?: string) => {
  return Swal.fire({
      icon: 'warning',
      title,
      text,
      width: 424,
      padding: '1.25rem',
      showConfirmButton: true,
      didOpen: () => {
        const container = Swal.getContainer();
        if (container) {
          container.style.zIndex = '99999';
        }
      },
    });
};