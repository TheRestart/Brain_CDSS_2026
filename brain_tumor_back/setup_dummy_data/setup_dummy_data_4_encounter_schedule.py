"""
진료 예약(Encounter) 스케줄 데이터 생성 스크립트

목적: 의사 대시보드의 '금일 예약 환자' 리스트를 충분히 채우기 위한 데이터 생성

사용법:
    # 기본 사용 (오늘 기준 -7일 ~ +30일)
    python manage.py shell -c "from setup_dummy_data.setup_dummy_data_4_encounter_schedule import create_scheduled_encounters; create_scheduled_encounters()"

    # 기간 지정
    python manage.py shell -c "from setup_dummy_data.setup_dummy_data_4_encounter_schedule import create_scheduled_encounters; create_scheduled_encounters('2026-03-01', '2026-03-31')"

    # 강제 재생성 (기존 데이터 무시)
    python manage.py shell -c "from setup_dummy_data.setup_dummy_data_4_encounter_schedule import create_scheduled_encounters; create_scheduled_encounters(force=True)"
"""

import random
from datetime import datetime, timedelta, time as dt_time, date
from django.utils import timezone


def create_scheduled_encounters(
    start_date: str = None,
    end_date: str = None,
    per_doctor_per_day: int = 10,
    exclude_weekends: bool = True,
    time_interval_minutes: int = 30,
    force: bool = False
):
    """
    지정 기간 동안 의사별 진료 예약 데이터 생성

    Args:
        start_date: 시작 날짜 (YYYY-MM-DD 형식, None이면 오늘-7일)
        end_date: 종료 날짜 (YYYY-MM-DD 형식, None이면 오늘+30일)
        per_doctor_per_day: 의사당 하루 예약 수 (기본: 10)
        exclude_weekends: 주말 제외 여부 (기본: True)
        time_interval_minutes: 예약 시간 간격 (분, 기본: 30)
        force: 기존 데이터 무시하고 강제 생성 (기본: False)

    Returns:
        dict: 생성 결과 통계
    """
    # 기본값: 오늘 기준 -7일 ~ +30일
    if start_date is None:
        start_date = (date.today() - timedelta(days=7)).strftime('%Y-%m-%d')
    if end_date is None:
        end_date = (date.today() + timedelta(days=30)).strftime('%Y-%m-%d')

    print(f"\n{'='*60}")
    print(f"진료 예약 스케줄 데이터 생성")
    print(f"{'='*60}")
    print(f"기간: {start_date} ~ {end_date}")
    print(f"의사당 하루 예약: {per_doctor_per_day}건")
    print(f"주말 제외: {'예' if exclude_weekends else '아니오'}")
    print(f"시간 간격: {time_interval_minutes}분")
    print(f"{'='*60}\n")

    from apps.encounters.models import Encounter
    from apps.patients.models import Patient
    from django.contrib.auth import get_user_model
    User = get_user_model()

    # 날짜 파싱
    try:
        start = datetime.strptime(start_date, '%Y-%m-%d').date()
        end = datetime.strptime(end_date, '%Y-%m-%d').date()
    except ValueError as e:
        print(f"[ERROR] 날짜 형식 오류: {e}")
        print("  올바른 형식: YYYY-MM-DD (예: 2026-01-15)")
        return None

    if start > end:
        print("[ERROR] 시작 날짜가 종료 날짜보다 늦습니다.")
        return None

    # 의사 목록 조회
    doctors = list(User.objects.filter(role__code='DOCTOR', is_active=True))
    if not doctors:
        print("[ERROR] 활성 DOCTOR 역할 사용자가 없습니다.")
        return None
    print(f"[INFO] 의사 수: {len(doctors)}명")
    for doc in doctors:
        print(f"  - {doc.name} ({doc.login_id})")

    # 환자 목록 조회
    patients = list(Patient.objects.filter(is_deleted=False, status='active'))
    if not patients:
        print("[ERROR] 활성 환자가 없습니다.")
        return None
    print(f"[INFO] 환자 수: {len(patients)}명")

    # 예약 시간 슬롯 생성 (09:00 ~ 17:00)
    time_slots = generate_time_slots(
        start_hour=9,
        end_hour=17,
        interval_minutes=time_interval_minutes
    )
    print(f"[INFO] 시간 슬롯: {len(time_slots)}개 ({time_slots[0].strftime('%H:%M')} ~ {time_slots[-1].strftime('%H:%M')})")

    # 진료과 및 주호소 데이터
    departments = ['neurology', 'neurosurgery']
    chief_complaints = [
        '정기 진료', '추적 검사', '상담', '재진',
        '두통 상담', '어지러움 검진', '경과 관찰',
        'MRI 결과 상담', '투약 상담', '검사 결과 확인',
        '증상 악화', '약 처방', '신경학적 검사',
    ]

    # 날짜별 생성
    current_date = start
    total_created = 0
    skipped_dates = 0
    skipped_existing = 0

    stats = {
        'total_created': 0,
        'by_doctor': {doc.login_id: 0 for doc in doctors},
        'by_date': {},
        'skipped_weekends': 0,
        'skipped_existing': 0,
    }

    while current_date <= end:
        # 주말 체크
        if exclude_weekends and current_date.weekday() >= 5:  # 5=토, 6=일
            stats['skipped_weekends'] += 1
            current_date += timedelta(days=1)
            continue

        date_str = current_date.strftime('%Y-%m-%d')
        stats['by_date'][date_str] = 0

        # 해당 날짜의 datetime 생성 (timezone aware)
        date_aware = timezone.make_aware(
            datetime.combine(current_date, dt_time(0, 0)),
            timezone.get_current_timezone()
        )

        for doctor in doctors:
            # 기존 예약 확인 (force가 아닌 경우)
            if not force:
                existing_count = Encounter.objects.filter(
                    attending_doctor=doctor,
                    admission_date__date=current_date,
                    status='scheduled',
                    is_deleted=False
                ).count()

                if existing_count >= per_doctor_per_day:
                    stats['skipped_existing'] += per_doctor_per_day
                    continue

                # 부족한 만큼만 생성
                to_create = per_doctor_per_day - existing_count
            else:
                to_create = per_doctor_per_day

            # 시간 슬롯 랜덤 선택 (중복 없이)
            available_slots = time_slots.copy()
            random.shuffle(available_slots)
            selected_slots = available_slots[:to_create]
            selected_slots.sort()  # 시간순 정렬

            for slot_time in selected_slots:
                # 환자 선택 (같은 날 같은 의사에게 중복 예약 방지)
                patient = random.choice(patients)

                # 예약 시간 생성
                scheduled_datetime = timezone.make_aware(
                    datetime.combine(current_date, slot_time),
                    timezone.get_current_timezone()
                )

                try:
                    Encounter.objects.create(
                        patient=patient,
                        attending_doctor=doctor,
                        admission_date=date_aware,
                        scheduled_time=slot_time,
                        status='scheduled',
                        encounter_type='outpatient',
                        department=random.choice(departments),
                        chief_complaint=random.choice(chief_complaints),
                    )

                    stats['total_created'] += 1
                    stats['by_doctor'][doctor.login_id] += 1
                    stats['by_date'][date_str] += 1

                except Exception as e:
                    print(f"  [ERROR] {current_date} {doctor.name} {slot_time}: {e}")

        # 진행 상황 출력 (10일마다)
        days_done = (current_date - start).days + 1
        if days_done % 10 == 0:
            print(f"  진행 중... {current_date} ({stats['total_created']}건 생성)")

        current_date += timedelta(days=1)

    # 결과 출력
    print(f"\n{'='*60}")
    print(f"생성 완료!")
    print(f"{'='*60}")
    print(f"총 생성: {stats['total_created']}건")
    print(f"건너뛴 주말: {stats['skipped_weekends']}일")
    print(f"건너뛴 기존 예약: {stats['skipped_existing']}건")
    print(f"\n의사별 생성 현황:")
    for doc_id, count in stats['by_doctor'].items():
        print(f"  - {doc_id}: {count}건")

    # 현재 전체 예약 현황
    total_scheduled = Encounter.objects.filter(status='scheduled', is_deleted=False).count()
    print(f"\n현재 전체 예약 진료: {total_scheduled}건")

    return stats


def generate_time_slots(start_hour=9, end_hour=17, interval_minutes=30):
    """
    예약 시간 슬롯 목록 생성

    Args:
        start_hour: 시작 시간 (기본: 9시)
        end_hour: 종료 시간 (기본: 17시)
        interval_minutes: 간격 (분, 기본: 30)

    Returns:
        list[datetime.time]: 시간 슬롯 목록
    """
    slots = []
    current = datetime(2000, 1, 1, start_hour, 0)
    end = datetime(2000, 1, 1, end_hour, 0)

    while current < end:
        slots.append(current.time())
        current += timedelta(minutes=interval_minutes)

    return slots


def delete_scheduled_encounters(start_date: str, end_date: str, confirm: bool = False):
    """
    지정 기간의 예약 진료 데이터 삭제

    Args:
        start_date: 시작 날짜 (YYYY-MM-DD)
        end_date: 종료 날짜 (YYYY-MM-DD)
        confirm: 삭제 확인 (True여야 실제 삭제)
    """
    from apps.encounters.models import Encounter

    start = datetime.strptime(start_date, '%Y-%m-%d').date()
    end = datetime.strptime(end_date, '%Y-%m-%d').date()

    encounters = Encounter.objects.filter(
        admission_date__date__gte=start,
        admission_date__date__lte=end,
        status='scheduled'
    )

    count = encounters.count()
    print(f"삭제 대상: {start_date} ~ {end_date} 예약 진료 {count}건")

    if not confirm:
        print("실제 삭제하려면 confirm=True로 호출하세요.")
        return

    deleted, _ = encounters.delete()
    print(f"삭제 완료: {deleted}건")


# main.py에서 호출할 수 있는 간단한 래퍼
def run_default():
    """기본 설정으로 실행 (2026-01-15 ~ 2026-02-28)"""
    return create_scheduled_encounters()


if __name__ == '__main__':
    run_default()
