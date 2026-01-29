-- ============================================
-- 메뉴 아이콘 확인 및 수정 SQL
-- ============================================

-- 1. 현재 AI 메뉴 아이콘 확인
SELECT id, code, name, icon, path
FROM menus_menu
WHERE code LIKE 'AI_%'
ORDER BY id;

-- 2. M1, MG, MM 아이콘 수정 (FontAwesome 5 solid 아이콘 사용)
-- 참고: FontAwesome 5에서 solid 아이콘은 'fas fa-icon' 형식이지만,
-- 현재 코드가 'fa fa-{icon}' 형식을 사용하므로 그에 맞게 설정

-- M1 MRI 분석 - brain 아이콘 (FA5 solid)
UPDATE menus_menu
SET icon = 'brain'
WHERE code = 'AI_M1_INFERENCE';

-- MG Gene 분석 - dna 아이콘 (FA5 solid)
UPDATE menus_menu
SET icon = 'dna'
WHERE code = 'AI_MG_INFERENCE';

-- MM 멀티모달 - layer-group 아이콘 (FA5 solid, 'layers'는 없음)
UPDATE menus_menu
SET icon = 'layer-group'
WHERE code = 'AI_MM_INFERENCE';

-- 3. 수정 후 확인
SELECT id, code, name, icon, path
FROM menus_menu
WHERE code IN ('AI_M1_INFERENCE', 'AI_MG_INFERENCE', 'AI_MM_INFERENCE');
