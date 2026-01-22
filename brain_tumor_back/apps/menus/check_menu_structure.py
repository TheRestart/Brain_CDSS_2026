from apps.menus.models import Menu, MenuLabel, MenuPermission
from apps.accounts.models import Permission, RolePermission

# Check PATIENT_LIST menu structure
menu = Menu.objects.filter(code='PATIENT_LIST').first()

if menu:
    print('=== PATIENT_LIST Menu ===')
    print(f'id: {menu.id}')
    print(f'code: {menu.code}')
    print(f'path: {menu.path}')
    print(f'icon: {menu.icon}')
    print(f'group_label: {menu.group_label}')
    print(f'order: {menu.order}')
    print()

    print('=== MenuLabels ===')
    labels = MenuLabel.objects.filter(menu=menu)
    for label in labels:
        print(f'  {label.role}: {label.text}')
    print()

    print('=== MenuPermissions ===')
    menu_perms = MenuPermission.objects.filter(menu=menu)
    for mp in menu_perms:
        print(f'  Permission: {mp.permission.code} - {mp.permission.name}')

        # Check RolePermissions
        role_perms = RolePermission.objects.filter(permission=mp.permission, menu=menu)
        for rp in role_perms:
            print(f'    Role: {rp.role.code}')
    print()
else:
    print('PATIENT_LIST menu not found')
