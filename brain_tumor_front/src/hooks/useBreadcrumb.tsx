// Header영역 메뉴 navigator
import { useLocation } from 'react-router-dom';
import type { MenuNode } from '@/types/menu';

interface BreadcrumbItem {
  id: string;
  label: string;
  path?: string;
}

// 메뉴 기반 breadcrumb 탐색
function findBreadcrumbPath(
  menus: MenuNode[],
  pathname: string,
  role: string | null,
  parents: BreadcrumbItem[] = [],
): BreadcrumbItem[] | null {
  for (const menu of menus) {
    let matched = false;
    // path 매칭 시도
    if (menu.path) {
      const result = matchPathPattern(menu.path, pathname);
      matched = result.matched;
    }
    if (!matched && !menu.children) continue;
    // group 메뉴 (path 없음) → breadcrumb에는 제외
    if (!menu.path && menu.children) {
      const childResult = findBreadcrumbPath(
        menu.children,
        pathname,
        role,
        parents
      );
      if (childResult) return childResult;
      continue;
    }
    const roleKey = role ?? 'DEFAULT';
    const current: BreadcrumbItem = {
      id: menu.code,
      label:
        menu.labels?.[roleKey] ??
        menu.labels?.['DEFAULT'] ??
        menu.code,
      path: menu.breadcrumbOnly ? undefined : menu.path,
    };
    // children 탐색
    if (menu.children) {
      const childResult = findBreadcrumbPath(
        menu.children,
        pathname,
        role,
        [...parents, current]
      );
      if (childResult) return childResult;
    }
    // leaf 매칭
    if (matched) {
      return [...parents, current];
    }
  }
  return null;
}

// path 매칭 (prefix 허용)
function matchPathPattern(
  pattern: string,
  pathname: string
): { matched: boolean; params: Record<string, string> } {
  const paramNames: string[] = [];
  const regexPath = pattern.replace(
    /:([^/]+)/g,
    (_, key) => {
      paramNames.push(key);
      return '([^/]+)';
    }
  );
  const regex = new RegExp(`^${regexPath}$`);
  const match = pathname.match(regex);
  if (!match) return { matched: false, params: {} };
  const params = paramNames.reduce((acc, key, idx) => {
    acc[key] = match[idx + 1];
    return acc;
  }, {} as Record<string, string>);
  return { matched: true, params };
}

export default function useBreadcrumb(
  menus: MenuNode[],
  role: string | null
) {
  const location = useLocation();
  const breadcrumb =
    findBreadcrumbPath(menus, location.pathname, role) ?? [];
  return breadcrumb;
}

// 2안
// import { useLocation } from 'react-router-dom';
// import type { MenuNode } from '@/types/menu';

// interface BreadcrumbItem {
//   id: string;
//   label: string;
//   path?: string;
// }

// // 메뉴 기반 breadcrumb 탐색
// function findBreadcrumbPath(
//   menus: MenuNode[],
//   pathname: string,
//   role: string | null,
//   parents: BreadcrumbItem[] = []
// ): BreadcrumbItem[] | null {
//   const roleKey = role ?? 'DEFAULT';

//   for (const menu of menus) {
//     const current: BreadcrumbItem = {
//       id: menu.code,
//       label:
//         menu.labels?.[roleKey] ??
//         menu.labels?.['DEFAULT'] ??
//         menu.code,
//       path: menu.breadcrumbOnly ? undefined : menu.path,
//     };

//     // children 먼저
//     if (menu.children?.length) {
//       const child = findBreadcrumbPath(
//         menu.children,
//         pathname,
//         role,
//         [...parents, ...(menu.path ? [current] : [])]
//       );
//       if (child) return child;
//     }

//     // 자기 자신
//     if (menu.path && matchPathPattern(menu.path, pathname)) {
//       return [...parents, current];
//     }
//   }

//   return null;
// }

// // path 매칭 (prefix 허용)
// function matchPathPattern(
//   pattern: string,
//   pathname: string
// ): boolean {
//   const regexPath = pattern.replace(/:([^/]+)/g, '[^/]+');
//   const regex = new RegExp(`^${regexPath}(/|$)`);
//   return regex.test(pathname);
// }


// export default function useBreadcrumb(
//   menus: MenuNode[],
//   role: string | null
// ) {
//   const { pathname } = useLocation();

//   /* ✅ 환자 상세 페이지 예외 처리 */
//   const patientDetailMatch = pathname.match(/^\/patients\/\d+/);

//   if (patientDetailMatch) {
//     const roleKey = role ?? 'DEFAULT';

//     const patientList = menus
//       .flatMap(m => m.children ?? [])
//       .find(m => m.path === '/patients');

//     if (patientList) {
//       return [
//         {
//           id: patientList.code,
//           label:
//             patientList.labels?.[roleKey] ??
//             patientList.labels?.DEFAULT,
//           path: patientList.path,
//         },
//         {
//           id: 'PATIENT_DETAIL',
//           label: '환자 상세',
//         },
//       ];
//     }
//   }

//   /* ✅ 기본 메뉴 breadcrumb */
//   return findBreadcrumbPath(menus, pathname, role) ?? [];
// }


// 초안 로그버전
// // Header영역 메뉴 navigator
// import { useLocation } from 'react-router-dom';
// import type { MenuNode } from '@/types/menu';

// interface BreadcrumbItem {
//   id: string;
//   label: string;
//   path?: string;
// }

// function findBreadcrumbPath(
//   menus: MenuNode[],
//   pathname: string,
//   role: string | null,
//   parents: BreadcrumbItem[] = [],
// ): BreadcrumbItem[] | null {

//   console.log('🔍 findBreadcrumbPath START', {
//     pathname,
//     menus: menus.map(m => m.path),
//     parents: parents.map(p => p.label),
//   });

//   for (const menu of menus) {

//     console.log('➡️ checking menu:', {
//       code: menu.code,
//       path: menu.path,
//       hasChildren: !!menu.children?.length,
//     });
//     let matched = false;
//     let params: Record<string, string> = {};

//     // path 매칭 시도
//     if (menu.path) {
//       const result = matchPathPattern(menu.path, pathname);
//       matched = result.matched;
//       params = result.params;
//     }

//       console.log('🧪 match test:', {
//         menuPath: menu.path,
//         pathname,
//         matched,
//       });

//     if (!matched && !menu.children) continue;

//     // group 메뉴 (path 없음) → breadcrumb에는 제외
//     if (!menu.path && menu.children) {
//       const childResult = findBreadcrumbPath(
//         menu.children,
//         pathname,
//         role,
//         parents
//       );
//       if (childResult) return childResult;
//       continue;
//     }

//     const roleKey = role ?? 'DEFAULT';
//     const current: BreadcrumbItem = {
//       id: menu.code,
//       label:
//         menu.labels?.[roleKey] ??
//         menu.labels?.['DEFAULT'] ??
//         menu.code,
//       path: menu.breadcrumbOnly ? undefined : menu.path,
//     };

//     // children 탐색
//     if (menu.children) {
//       const childResult = findBreadcrumbPath(
//         menu.children,
//         pathname,
//         role,
//         [...parents, current]
//       );
//       if (childResult) return childResult;
//     }

//     // leaf 매칭
//     if (matched) {
//       console.log('✅ MATCH FOUND:', {
//         breadcrumb: [...parents, current].map(b => b.label),
//       });
//       return [...parents, current];
//     }
//   }

//   return null;
// }

// function matchPathPattern(
//   pattern: string,
//   pathname: string
// ): { matched: boolean; params: Record<string, string> } {
//   const paramNames: string[] = [];

//   const regexPath = pattern.replace(
//     /:([^/]+)/g,
//     (_, key) => {
//       paramNames.push(key);
//       return '([^/]+)';
//     }
//   );

//   const regex = new RegExp(`^${regexPath}$`);
//   const match = pathname.match(regex);

//   if (!match) return { matched: false, params: {} };

//   const params = paramNames.reduce((acc, key, idx) => {
//     acc[key] = match[idx + 1];
//     return acc;
//   }, {} as Record<string, string>);

//   return { matched: true, params };
// }

// export default function useBreadcrumb(
//   menus: MenuNode[],
//   role: string | null
// ) {
//   const location = useLocation();

//   console.log('📍 pathname:', location.pathname);
//   console.log('📦 menus:', menus);

//   const breadcrumb =
//     findBreadcrumbPath(menus, location.pathname, role) ?? [];

//   console.log('🧭 breadcrumb result:', breadcrumb);

//   return breadcrumb;
// }