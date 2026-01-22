// types/menu.ts
export interface MenuNode {
  id: number;                        // PK는 숫자형
  code: string;                      // 'DASHBOARD', 'ADMIN' 등
  icon?: string;
  labels: Record<string, string>;
  breadcrumbOnly: boolean;
  path?: string;
  component?: string;
  children?: MenuNode[];
}

// // 메뉴 ID 정의
// export type MenuId =
//   // Group용 (화면 없음)
//   | 'PATIENT'
//   | 'ORDER'
//   | 'ADMIN'
//   | 'IMAGING'
//   | 'LAB'

//   // == 화면 영역 Menu == 
//   // 공통
//   | 'LOGIN'
//   | 'LOGOUT'

//   // 대시보드
//   | 'DASHBOARD'

//   // 환자
//   | 'PATIENT_LIST'
//   | 'PATIENT_DETAIL'

//   // 환자 상세 탭
//   | 'PATIENT_SUMMARY'
//   | 'PATIENT_IMAGING'
//   | 'PATIENT_LAB_RESULT'
//   | 'PATIENT_AI_SUMMARY'

//   // 오더
//   | 'ORDER_LIST'
//   | 'ORDER_CREATE'
//   | 'ORDER_STATUS_CHANGE'

//   // 영상
//   | 'IMAGE_VIEWER'

//   // AI
//   | 'AI_SUMMARY'

//   // LIS(검사)
//   | 'LAB_RESULT_UPLOAD'
//   | 'LAB_RESULT_VIEW'

//   // RIS(영상)
//   | 'RIS_WORKLIST'
//   | 'RIS_READING'

//   // 관리자
//   | 'ADMIN_USER'
//   | 'ADMIN_ROLE'
//   | 'ADMIN_MENU_PERMISSION'
//   | 'ADMIN_AUDIT_LOG'
//   | 'ADMIN_SYSTEM_MONITOR'
;