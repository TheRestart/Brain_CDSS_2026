#!/usr/bin/env python3
"""
Docker 배포 사전 설정 스크립트

실행 방법:
    python setup.py

기능:
    1. 시스템 환경 체크 (Docker, GPU, 포트 등)
    2. GPU 감지 → .env 파일에 USE_GPU 자동 설정
    3. .env 파일 생성 (없는 경우)
    4. docker-compose.yml GPU 설정 자동 활성화
"""

import subprocess
import sys
import os
import socket
import re
import shutil
from pathlib import Path

try:
    import yaml
except ImportError:
    print("PyYAML이 설치되어 있지 않습니다. 설치 중...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pyyaml"])
    import yaml


# =============================================================
# 설정 (동적으로 docker-compose에서 로드)
# =============================================================


# =============================================================
# 색상 출력
# =============================================================

class Colors:
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    BOLD = "\033[1m"
    END = "\033[0m"


def print_header(title):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}  {title}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}")


def print_ok(msg, detail=""):
    detail_text = f" - {detail}" if detail else ""
    print(f"  {Colors.GREEN}✓{Colors.END} {msg}{detail_text}")


def print_warn(msg, detail=""):
    detail_text = f" - {detail}" if detail else ""
    print(f"  {Colors.YELLOW}!{Colors.END} {msg}{detail_text}")


def print_fail(msg, detail=""):
    detail_text = f" - {detail}" if detail else ""
    print(f"  {Colors.RED}✗{Colors.END} {msg}{detail_text}")


def print_info(msg):
    print(f"  {Colors.CYAN}→{Colors.END} {msg}")


# =============================================================
# 유틸리티
# =============================================================

def run_command(cmd, timeout=10):
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            shell=isinstance(cmd, str)
        )
        return result.returncode == 0, result.stdout.strip()
    except:
        return False, ""


def check_port(port):
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(1)
            return s.connect_ex(('127.0.0.1', port)) != 0
    except:
        return True


def get_script_dir():
    return Path(__file__).resolve().parent


def get_project_root():
    script_dir = get_script_dir()
    if script_dir.name == "docker":
        return script_dir.parent
    return script_dir


def detect_compose_file():
    """docker-compose 파일 감지 (unified > fastapi 우선순위)"""
    script_dir = get_script_dir()
    unified = script_dir / "docker-compose.unified.yml"
    fastapi = script_dir / "docker-compose.fastapi.yml"

    if unified.exists():
        return unified, "unified"
    elif fastapi.exists():
        return fastapi, "fastapi"
    return None, None


def parse_ports_from_compose(compose_file):
    """docker-compose 파일에서 포트 정보 파싱"""
    if not compose_file or not compose_file.exists():
        return {}

    with open(compose_file, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)

    ports = {}
    services = data.get('services', {})
    for service_name, service_config in services.items():
        service_ports = service_config.get('ports', [])
        for port_mapping in service_ports:
            # "8000:8000" 또는 "80:80" 형식 처리
            port_str = str(port_mapping).split(':')[0]
            try:
                port = int(port_str)
                ports[port] = service_name
            except ValueError:
                continue
    return ports


# =============================================================
# 체크 함수
# =============================================================

def check_docker():
    """Docker 설치 확인"""
    print_header("1. Docker 체크")

    # Docker
    success, output = run_command(["docker", "--version"])
    if not success:
        print_fail("Docker가 설치되지 않았습니다")
        print_info("https://docs.docker.com/get-docker/ 에서 설치하세요")
        return False
    print_ok("Docker", output.split(",")[0])

    # Docker Compose
    success, output = run_command(["docker", "compose", "version"])
    if not success:
        success, output = run_command(["docker-compose", "--version"])
    if not success:
        print_fail("Docker Compose가 설치되지 않았습니다")
        return False
    print_ok("Docker Compose", output.split("\n")[0] if output else "")

    # Docker 실행 상태
    success, _ = run_command(["docker", "info"])
    if not success:
        print_fail("Docker 서비스가 실행되지 않았습니다")
        print_info("Docker Desktop을 시작하세요")
        return False
    print_ok("Docker 서비스 실행 중")

    return True


def check_gpu():
    """GPU 환경 확인 및 CUDA 버전 반환"""
    print_header("2. GPU 체크")

    success, output = run_command(["nvidia-smi"])
    if not success:
        print_warn("NVIDIA GPU 없음", "CPU 모드로 설정됩니다")
        return None

    # CUDA 버전 추출
    cuda_version = None
    match = re.search(r"CUDA Version:\s*(\d+\.\d+)", output)
    if match:
        cuda_version = match.group(1)

    # GPU 이름 추출
    gpu_name = "Unknown"
    for line in output.split("\n"):
        if "NVIDIA" in line and "Driver" not in line:
            parts = line.split("|")
            if len(parts) >= 2:
                gpu_name = parts[1].strip().split()[0:3]
                gpu_name = " ".join(gpu_name)
                break

    print_ok(f"GPU 감지됨", gpu_name)
    print_ok(f"CUDA Version", cuda_version or "Unknown")

    # NVIDIA Container Toolkit 체크
    success, _ = run_command(
        ["docker", "run", "--rm", "--gpus", "all",
         "hello-world"],
        timeout=30
    )
    if success:
        print_ok("NVIDIA Container Toolkit", "Docker GPU 지원 확인됨")
    else:
        print_warn("NVIDIA Container Toolkit 필요")
        print_info("설치: apt install nvidia-container-toolkit && systemctl restart docker")

    return cuda_version


def check_ports(required_ports: dict):
    """포트 사용 가능 여부 확인"""
    print_header("3. 포트 체크")

    if not required_ports:
        print_warn("체크할 포트 정보가 없습니다")
        return True

    all_ok = True
    for port, service in required_ports.items():
        if check_port(port):
            print_ok(f"Port {port}", f"{service} 사용 가능")
        else:
            print_fail(f"Port {port}", f"{service} 이미 사용 중")
            all_ok = False

    return all_ok


# =============================================================
# 설정 파일 업데이트
# =============================================================

def setup_env_file(use_gpu: bool, cuda_version: str = None):
    """환경 변수 파일 설정"""
    print_header("4. 환경 변수 설정")

    script_dir = get_script_dir()
    env_example = script_dir / ".env.example"
    env_file = script_dir / ".env"

    # .env 파일이 없으면 생성
    if not env_file.exists():
        if env_example.exists():
            shutil.copy(env_example, env_file)
            print_ok(".env 파일 생성됨", ".env.example에서 복사")
        else:
            print_fail(".env.example 파일이 없습니다")
            return False
    else:
        print_ok(".env 파일 존재")

    # .env 파일 읽기
    with open(env_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # USE_GPU 업데이트
    use_gpu_value = "true" if use_gpu else "false"
    if "USE_GPU=" in content:
        content = re.sub(r'USE_GPU=\w+', f'USE_GPU={use_gpu_value}', content)
        print_ok(f"USE_GPU={use_gpu_value}", "자동 설정됨")
    else:
        content += f"\nUSE_GPU={use_gpu_value}\n"
        print_ok(f"USE_GPU={use_gpu_value}", "추가됨")

    # 파일 저장
    with open(env_file, 'w', encoding='utf-8') as f:
        f.write(content)

    # 경고: 수정 필요한 항목
    if "192.168.x.x" in content:
        print_warn("MAIN_VM_IP 설정 필요", "실제 IP로 변경하세요")
    if "your-" in content.lower():
        print_warn("기본 비밀번호 변경 필요", ".env 파일을 확인하세요")

    return True


def setup_docker_compose_gpu(enable_gpu: bool, compose_file: Path = None):
    """docker-compose GPU 설정 (YAML 파싱 방식)"""
    print_header("5. Docker Compose GPU 설정")

    if compose_file is None:
        compose_file, _ = detect_compose_file()

    if not compose_file or not compose_file.exists():
        print_fail("docker-compose 파일 없음")
        return False

    print_info(f"대상 파일: {compose_file.name}")

    # YAML 파일 로드
    with open(compose_file, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)

    # GPU deploy 설정 정의
    gpu_deploy_config = {
        'resources': {
            'reservations': {
                'devices': [{
                    'driver': 'nvidia',
                    'count': 1,
                    'capabilities': ['gpu']
                }]
            }
        }
    }

    # GPU가 필요한 서비스 목록
    gpu_services = ['fastapi', 'fastapi-celery']
    modified = False

    for service_name in gpu_services:
        if service_name not in data.get('services', {}):
            continue

        service = data['services'][service_name]

        if enable_gpu:
            # GPU 활성화: deploy 섹션 추가
            if 'deploy' not in service:
                service['deploy'] = gpu_deploy_config
                print_ok(f"{service_name}: GPU 설정 추가됨")
                modified = True
            else:
                print_ok(f"{service_name}: GPU 설정 이미 존재")
        else:
            # GPU 비활성화: deploy 섹션 제거
            if 'deploy' in service:
                del service['deploy']
                print_ok(f"{service_name}: GPU 설정 제거됨 (CPU 모드)")
                modified = True
            else:
                print_ok(f"{service_name}: 이미 CPU 모드")

    if modified:
        # 원본 파일의 주석 보존을 위해 ruamel.yaml 사용 시도
        # 없으면 기본 yaml로 저장 (주석 손실 가능)
        try:
            from ruamel.yaml import YAML
            ryaml = YAML()
            ryaml.preserve_quotes = True
            ryaml.indent(mapping=2, sequence=4, offset=2)

            # 원본 파일 다시 로드 (주석 포함)
            with open(compose_file, 'r', encoding='utf-8') as f:
                original_data = ryaml.load(f)

            # GPU 서비스 설정 업데이트
            for service_name in gpu_services:
                if service_name in original_data.get('services', {}):
                    if enable_gpu:
                        original_data['services'][service_name]['deploy'] = gpu_deploy_config
                    elif 'deploy' in original_data['services'][service_name]:
                        del original_data['services'][service_name]['deploy']

            with open(compose_file, 'w', encoding='utf-8') as f:
                ryaml.dump(original_data, f)

        except ImportError:
            # ruamel.yaml 없으면 기본 yaml 사용
            # 헤더 주석 보존
            with open(compose_file, 'r', encoding='utf-8') as f:
                original_content = f.read()

            # 헤더 주석 추출 (services: 이전까지)
            header_match = re.match(r'^(#.*?\n)*', original_content)
            header = header_match.group(0) if header_match else ""

            # YAML 저장
            with open(compose_file, 'w', encoding='utf-8') as f:
                if header:
                    f.write(header + "\n")
                yaml.dump(data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)

        print_info(f"파일 저장됨: {compose_file.name}")
    else:
        mode = "GPU" if enable_gpu else "CPU"
        print_info(f"변경 없음 - 이미 {mode} 모드")

    return True


# =============================================================
# 메인
# =============================================================

def main():
    print(f"""
{Colors.BOLD}{Colors.CYAN}{'='*60}
   Brain Tumor CDSS - Docker 배포 설정
{'='*60}{Colors.END}
""")

    errors = []

    # 0. docker-compose 파일 감지
    print_header("0. Docker Compose 파일 감지")
    compose_file, compose_type = detect_compose_file()
    if compose_file:
        print_ok(f"감지됨: {compose_file.name}", f"타입: {compose_type}")
    else:
        print_fail("docker-compose.unified.yml 또는 docker-compose.fastapi.yml 없음")
        errors.append("Docker Compose 파일")

    # 포트 정보 파싱
    required_ports = parse_ports_from_compose(compose_file) if compose_file else {}
    if required_ports:
        print_info(f"포트 {len(required_ports)}개 감지됨: {list(required_ports.keys())}")

    # 1. Docker 체크
    if not check_docker():
        errors.append("Docker")

    # 2. GPU 체크
    cuda_version = check_gpu()
    use_gpu = cuda_version is not None

    # 3. 포트 체크
    if not check_ports(required_ports):
        print_warn("일부 포트가 사용 중입니다. 충돌이 발생할 수 있습니다.")

    # 4. 환경 변수 설정
    if not setup_env_file(use_gpu, cuda_version):
        errors.append("환경 변수")

    # 5. Docker Compose GPU 설정
    setup_docker_compose_gpu(use_gpu, compose_file)

    # 결과 요약
    print_header("설정 완료")

    if errors:
        print(f"\n  {Colors.RED}✗ 오류 발생: {', '.join(errors)}{Colors.END}")
        print(f"  {Colors.RED}  위 문제를 해결한 후 다시 실행하세요.{Colors.END}\n")
        sys.exit(1)

    print(f"\n  {Colors.GREEN}✓ 설정 완료!{Colors.END}\n")

    # 다음 단계 안내
    print(f"  {Colors.BOLD}다음 단계:{Colors.END}")
    print(f"  1. .env 파일에서 IP 주소와 비밀번호를 수정하세요")
    print(f"  2. 아래 명령어로 Docker를 실행하세요:\n")

    if compose_type == "unified":
        print(f"     {Colors.CYAN}# 통합 배포 (Single VM){Colors.END}")
        print(f"     docker compose -f docker-compose.unified.yml up -d --build\n")
    elif use_gpu:
        print(f"     {Colors.CYAN}# FastAPI VM (GPU){Colors.END}")
        print(f"     docker compose -f docker-compose.fastapi.yml up -d --build\n")
    else:
        print(f"     {Colors.CYAN}# 메인 VM{Colors.END}")
        print(f"     docker compose -f docker-compose.yml \\")
        print(f"                    -f docker-compose.django.yml \\")
        print(f"                    -f docker-compose.emr.yml up -d --build\n")

        print(f"     {Colors.CYAN}# FastAPI VM (CPU){Colors.END}")
        print(f"     docker compose -f docker-compose.fastapi.yml up -d --build\n")

    sys.exit(0)


if __name__ == "__main__":
    main()
