from django.core.management.base import BaseCommand
from apps.menus.models import Menu, MenuPermission, MenuLabel
from apps.accounts.models import Permission, Role, RolePermission


class Command(BaseCommand):
    help = 'Register Imaging Study Management menus and permissions'

    def handle(self, *args, **options):
        self.stdout.write("="*60)
        self.stdout.write("Imaging Menus Registration")
        self.stdout.write("="*60)

        # Step 1: Create Permissions
        self.stdout.write("\n[Step 1] Creating Permissions...")

        permissions_data = [
            {'code': 'IMAGING_STUDY_LIST_VIEW', 'name': '영상 검사 목록 조회', 'description': '영상 검사 목록 페이지 접근'},
            {'code': 'IMAGING_STUDY_CREATE', 'name': '영상 검사 오더 생성', 'description': '영상 검사 오더 생성 권한'},
            {'code': 'IMAGING_STUDY_UPDATE', 'name': '영상 검사 정보 수정', 'description': '영상 검사 정보 수정 권한'},
            {'code': 'IMAGING_STUDY_DELETE', 'name': '영상 검사 삭제', 'description': '영상 검사 삭제 권한'},
            {'code': 'IMAGING_WORKLIST_VIEW', 'name': 'RIS 워크리스트 조회', 'description': 'RIS 워크리스트 페이지 접근'},
            {'code': 'IMAGING_REPORT_CREATE', 'name': '판독문 작성', 'description': '영상 검사 판독문 작성 권한'},
            {'code': 'IMAGING_REPORT_SIGN', 'name': '판독문 서명', 'description': '판독문 서명 권한'},
        ]

        created_permissions = {}
        for perm_data in permissions_data:
            perm, created = Permission.objects.get_or_create(
                code=perm_data['code'],
                defaults={'name': perm_data['name'], 'description': perm_data['description']}
            )
            created_permissions[perm_data['code']] = perm
            self.stdout.write(f"  {'Created' if created else 'Exists'}: {perm.code}")

        # Step 2: Create Menus
        self.stdout.write("\n[Step 2] Creating Menus...")

        menu1, created1 = Menu.objects.get_or_create(
            menu_id='IMAGING_STUDY_LIST',
            defaults={'path': '/imaging/studies', 'icon': 'mdi-camera', 'order': 30, 'is_active': True}
        )
        self.stdout.write(f"  Menu 1: {'Created' if created1 else 'Exists'} - {menu1.menu_id}")

        menu2, created2 = Menu.objects.get_or_create(
            menu_id='IMAGING_WORKLIST',
            defaults={'path': '/imaging/worklist', 'icon': 'mdi-clipboard-list', 'order': 31, 'is_active': True}
        )
        self.stdout.write(f"  Menu 2: {'Created' if created2 else 'Exists'} - {menu2.menu_id}")

        # Step 3: Create MenuLabels (for each role)
        self.stdout.write("\n[Step 3] Creating Menu Labels...")

        labels_data = [
            {'menu': menu1, 'role': 'DEFAULT', 'text': '영상 검사 목록'},
            {'menu': menu1, 'role': 'DOCTOR', 'text': '영상 검사 목록'},
            {'menu': menu1, 'role': 'RADIOLOGIST', 'text': '영상 검사 목록'},
            {'menu': menu1, 'role': 'NURSE', 'text': '영상 검사 목록'},
            {'menu': menu2, 'role': 'DEFAULT', 'text': 'RIS 워크리스트'},
            {'menu': menu2, 'role': 'DOCTOR', 'text': 'RIS 워크리스트'},
            {'menu': menu2, 'role': 'RADIOLOGIST', 'text': 'RIS 워크리스트'},
            {'menu': menu2, 'role': 'NURSE', 'text': 'RIS 워크리스트'},
        ]

        for label_data in labels_data:
            label, created = MenuLabel.objects.get_or_create(
                menu=label_data['menu'],
                role=label_data['role'],
                defaults={'text': label_data['text']}
            )
            if not created:
                label.text = label_data['text']
                label.save()

        # Step 4: Link Menus to Permissions (MenuPermission)
        self.stdout.write("\n[Step 4] Linking Menus to Permissions...")

        menu_permission_map = {
            menu1: ['IMAGING_STUDY_LIST_VIEW'],
            menu2: ['IMAGING_WORKLIST_VIEW'],
        }

        for menu, perm_codes in menu_permission_map.items():
            for perm_code in perm_codes:
                perm = created_permissions[perm_code]
                mp, created = MenuPermission.objects.get_or_create(
                    menu=menu,
                    permission=perm
                )
                self.stdout.write(f"  {menu.menu_id} + {perm.code}: {'Created' if created else 'Exists'}")

        # Step 5: Assign Permissions to Roles (RolePermission)
        self.stdout.write("\n[Step 5] Assigning Permissions to Roles...")

        roles = {
            'DOCTOR': Role.objects.filter(code='DOCTOR').first(),
            'RADIOLOGIST': Role.objects.filter(code='RADIOLOGIST').first(),
            'NURSE': Role.objects.filter(code='NURSE').first(),
            'SYSTEMMANAGER': Role.objects.filter(code='SYSTEMMANAGER').first(),
        }

        # Role-Permission mapping with menu context
        role_permission_config = {
            'DOCTOR': {
                menu1: ['IMAGING_STUDY_LIST_VIEW', 'IMAGING_STUDY_CREATE', 'IMAGING_STUDY_UPDATE'],
                menu2: ['IMAGING_WORKLIST_VIEW', 'IMAGING_STUDY_CREATE', 'IMAGING_STUDY_UPDATE'],
            },
            'RADIOLOGIST': {
                menu1: ['IMAGING_STUDY_LIST_VIEW', 'IMAGING_STUDY_CREATE', 'IMAGING_STUDY_UPDATE', 'IMAGING_REPORT_CREATE', 'IMAGING_REPORT_SIGN'],
                menu2: ['IMAGING_WORKLIST_VIEW', 'IMAGING_STUDY_CREATE', 'IMAGING_STUDY_UPDATE', 'IMAGING_REPORT_CREATE', 'IMAGING_REPORT_SIGN'],
            },
            'NURSE': {
                menu1: ['IMAGING_STUDY_LIST_VIEW'],
                menu2: ['IMAGING_WORKLIST_VIEW'],
            },
            'SYSTEMMANAGER': {
                menu1: ['IMAGING_STUDY_LIST_VIEW', 'IMAGING_STUDY_CREATE', 'IMAGING_STUDY_UPDATE', 'IMAGING_STUDY_DELETE'],
                menu2: ['IMAGING_WORKLIST_VIEW', 'IMAGING_STUDY_CREATE', 'IMAGING_STUDY_UPDATE', 'IMAGING_STUDY_DELETE'],
            },
        }

        for role_code, role in roles.items():
            if not role:
                self.stdout.write(f"  Warning: Role {role_code} not found, skipping...")
                continue

            self.stdout.write(f"\n  [{role.name}]")

            for menu, perm_codes in role_permission_config.get(role_code, {}).items():
                for perm_code in perm_codes:
                    perm = created_permissions[perm_code]
                    rp, created = RolePermission.objects.get_or_create(
                        role=role,
                        permission=perm,
                        menu=menu
                    )
                    self.stdout.write(f"    {menu.menu_id} + {perm.code}: {'Created' if created else 'Exists'}")

        self.stdout.write("\n" + "="*60)
        self.stdout.write(self.style.SUCCESS('Successfully registered imaging menus and permissions!'))
        self.stdout.write("="*60)
