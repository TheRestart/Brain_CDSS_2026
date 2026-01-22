"""
보고서 대시보드 메뉴 등록 스크립트

사용법:
    python manage.py register_report_menu
"""
from django.core.management.base import BaseCommand
from apps.menus.models import Menu, MenuPermission, MenuLabel
from apps.accounts.models import Permission, Role, RolePermission


class Command(BaseCommand):
    help = '보고서 대시보드 메뉴 및 권한 등록'

    def handle(self, *args, **options):
        self.stdout.write("=" * 60)
        self.stdout.write("Report Dashboard Menu Registration")
        self.stdout.write("=" * 60)

        # Step 1: Create Permissions
        self.stdout.write("\n[Step 1] Creating Permissions...")

        permissions_data = [
            {
                'code': 'REPORT_DASHBOARD_VIEW',
                'name': '보고서 대시보드 조회',
                'description': '통합 보고서 대시보드 페이지 접근'
            },
        ]

        created_permissions = {}
        for perm_data in permissions_data:
            perm, created = Permission.objects.get_or_create(
                code=perm_data['code'],
                defaults={'name': perm_data['name'], 'description': perm_data['description']}
            )
            created_permissions[perm_data['code']] = perm
            self.stdout.write(f"  {'Created' if created else 'Exists'}: {perm.code}")

        # Step 2: Create Menu
        self.stdout.write("\n[Step 2] Creating Menu...")

        # 부모 메뉴 찾기 또는 생성 (REPORT 그룹)
        report_group, _ = Menu.objects.get_or_create(
            code='REPORT',
            defaults={
                'path': None,
                'icon': 'mdi-file-document-multiple',
                'group_label': '보고서',
                'order': 60,
                'is_active': True,
                'parent': None,
            }
        )
        self.stdout.write(f"  Report Group: {report_group.code}")

        # 보고서 대시보드 메뉴
        report_dashboard, created = Menu.objects.get_or_create(
            code='REPORT_DASHBOARD',
            defaults={
                'path': '/reports',
                'icon': 'mdi-view-dashboard',
                'order': 1,
                'is_active': True,
                'parent': report_group,
            }
        )
        self.stdout.write(f"  {'Created' if created else 'Exists'}: {report_dashboard.code}")

        # Step 3: Create Menu Labels
        self.stdout.write("\n[Step 3] Creating Menu Labels...")

        labels_data = [
            {'menu': report_group, 'role': 'DEFAULT', 'text': '보고서'},
            {'menu': report_group, 'role': 'DOCTOR', 'text': '보고서'},
            {'menu': report_group, 'role': 'NURSE', 'text': '보고서'},
            {'menu': report_group, 'role': 'RIS', 'text': '보고서'},
            {'menu': report_group, 'role': 'LIS', 'text': '보고서'},
            {'menu': report_dashboard, 'role': 'DEFAULT', 'text': '보고서 대시보드'},
            {'menu': report_dashboard, 'role': 'DOCTOR', 'text': '보고서 대시보드'},
            {'menu': report_dashboard, 'role': 'NURSE', 'text': '결과 현황'},
            {'menu': report_dashboard, 'role': 'RIS', 'text': '검사 결과'},
            {'menu': report_dashboard, 'role': 'LIS', 'text': '검사 결과'},
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
            self.stdout.write(f"  {label_data['menu'].code} - {label_data['role']}: {label_data['text']}")

        # Step 4: Link Menu to Permission
        self.stdout.write("\n[Step 4] Linking Menu to Permission...")

        perm = created_permissions['REPORT_DASHBOARD_VIEW']
        mp, created = MenuPermission.objects.get_or_create(
            menu=report_dashboard,
            permission=perm
        )
        self.stdout.write(f"  {report_dashboard.code} + {perm.code}: {'Created' if created else 'Exists'}")

        # Step 5: Assign Permission to Roles
        self.stdout.write("\n[Step 5] Assigning Permission to Roles...")

        role_codes = ['DOCTOR', 'NURSE', 'RIS', 'LIS', 'SYSTEMMANAGER']

        for role_code in role_codes:
            role = Role.objects.filter(code=role_code).first()
            if not role:
                self.stdout.write(f"  Warning: Role {role_code} not found, skipping...")
                continue

            rp, created = RolePermission.objects.get_or_create(
                role=role,
                permission=perm,
                menu=report_dashboard
            )
            self.stdout.write(f"  {role.code} + {perm.code}: {'Created' if created else 'Exists'}")

        self.stdout.write("\n" + "=" * 60)
        self.stdout.write(self.style.SUCCESS('Successfully registered report dashboard menu!'))
        self.stdout.write("=" * 60)

        self.stdout.write("\n[Note] 프론트엔드에서 /reports 경로로 접근 가능합니다.")
