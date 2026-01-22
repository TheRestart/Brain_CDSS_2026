// Admin 사용자가 controller 하는 관리 대상 엔티티 인터페이스 모음
// 1. Role 인터페이스
export interface Role {
  id: number;
  code: string; // ex) 'DOCTOR'
  name: string; // es) '의사'
}