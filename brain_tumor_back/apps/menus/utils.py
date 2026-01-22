def build_menu_tree(menus):
    menu_map = {}
    tree = []

    # 모든 메뉴 노드 생성
    for menu in menus:
        labels = {lbl.role: lbl.text for lbl in menu.labels.all()}
        menu_map[menu.id] = {
            "id": menu.id,      # 숫자 PK
            "code": menu.code,  # 문자열 코드도 내려주면 프론트에서 쓰기 편함
            "path": menu.path,
            "icon": menu.icon,
            "groupLabel": menu.group_label,
            "breadcrumbOnly": menu.breadcrumb_only,
            "labels": labels,
            "children": [],
        }
        
    # 메뉴 : 부모-자식 관계 연결
    for menu in menus:
        node = menu_map[menu.id]

        if menu.parent_id:
            parent = menu_map.get(menu.parent_id)
            if parent:
                parent["children"].append(node)
        else:
            tree.append(menu_map[menu.id])

    return tree