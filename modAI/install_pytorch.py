"""
PyTorch 자동 설치 스크립트 (GPU / CPU 자동 감지)

- CUDA 있음  → GPU 버전 설치 (CUDA 인덱스 전용)
- CUDA 없음  → CPU 버전 설치
- 기존 PyTorch 제거 후 환경에 맞는 버전 설치

사용법:
    python install_pytorch.py
"""

import subprocess
import sys
import re


# CUDA 버전별 PyTorch 인덱스 URL
CUDA_INDEX_MAP = {
    "12.6": "https://download.pytorch.org/whl/cu126",
    "12.4": "https://download.pytorch.org/whl/cu124",
    "12.1": "https://download.pytorch.org/whl/cu121",
    "11.8": "https://download.pytorch.org/whl/cu118",
}


def get_cuda_version():
    """시스템 CUDA 버전 감지"""
    try:
        result = subprocess.run(
            ["nvidia-smi"],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            match = re.search(r"CUDA Version:\s*(\d+\.\d+)", result.stdout)
            if match:
                return match.group(1)
    except Exception:
        pass

    try:
        result = subprocess.run(
            ["nvcc", "--version"],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            match = re.search(r"release (\d+\.\d+)", result.stdout)
            if match:
                return match.group(1)
    except Exception:
        pass

    return None


def get_best_cuda_index(cuda_version):
    """
    시스템 CUDA 버전에 맞는 최적의 PyTorch 인덱스 선택

    - 정확히 일치하는 버전 우선
    - 없으면 하위 호환 버전 선택 (예: 12.6 → cu126, cu124, cu121 순)
    """
    if cuda_version is None:
        return None

    cuda_major = int(cuda_version.split(".")[0])
    cuda_minor = int(cuda_version.split(".")[1])

    # 정확히 일치하는 버전 확인
    if cuda_version in CUDA_INDEX_MAP:
        return CUDA_INDEX_MAP[cuda_version]

    # CUDA 12.x → 하위 호환 버전 선택 (cu126 > cu124 > cu121)
    if cuda_major >= 12:
        if cuda_minor >= 6:
            return CUDA_INDEX_MAP.get("12.6", CUDA_INDEX_MAP.get("12.4", CUDA_INDEX_MAP["12.1"]))
        elif cuda_minor >= 4:
            return CUDA_INDEX_MAP.get("12.4", CUDA_INDEX_MAP["12.1"])
        else:
            return CUDA_INDEX_MAP["12.1"]

    # CUDA 11.8+
    if cuda_major == 11 and cuda_minor >= 8:
        return CUDA_INDEX_MAP["11.8"]

    # 너무 오래된 CUDA
    print(f"[WARNING] CUDA {cuda_version} is too old, no compatible PyTorch available")
    return None


def get_installed_torch_cuda():
    """현재 설치된 PyTorch의 CUDA 버전 확인"""
    try:
        result = subprocess.run(
            [sys.executable, "-c", "import torch; print(torch.version.cuda or 'cpu')"],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        pass
    return None


def verify_cuda_available():
    """설치 후 CUDA 사용 가능 여부 확인"""
    try:
        result = subprocess.run(
            [sys.executable, "-c", "import torch; print(torch.cuda.is_available())"],
            capture_output=True,
            text=True,
            timeout=30
        )
        return result.returncode == 0 and "True" in result.stdout
    except Exception:
        return False


def uninstall_pytorch():
    """기존 PyTorch 완전 제거"""
    packages = ["torch", "torchvision", "torchaudio"]
    for pkg in packages:
        subprocess.run(
            [sys.executable, "-m", "pip", "uninstall", "-y", pkg],
            capture_output=True
        )


def install_pytorch(index_url=None):
    """
    PyTorch 설치

    - index_url이 있으면 해당 인덱스만 사용 (--index-url)
    - 없으면 기본 PyPI에서 CPU 버전 설치
    """
    cmd = [
        sys.executable, "-m", "pip", "install",
        "torch", "torchvision", "torchaudio",
        "--no-cache-dir"
    ]

    if index_url:
        # CUDA 버전: 해당 인덱스만 사용 (--index-url)
        cmd.extend(["--index-url", index_url])

    print(f"  → 명령: {' '.join(cmd)}")
    result = subprocess.run(cmd)
    return result.returncode == 0


def main():
    print("=" * 60)
    print("PyTorch 자동 설치 스크립트 (GPU/CPU 자동 감지)")
    print("=" * 60)

    # 1. 시스템 CUDA 감지
    print("\n[1/4] 시스템 CUDA 감지 중...")
    system_cuda = get_cuda_version()

    if system_cuda:
        print(f"  → 시스템 CUDA: {system_cuda}")
    else:
        print("  → CUDA 없음 (CPU 버전 설치 예정)")

    # 2. 현재 설치된 PyTorch 확인
    print("\n[2/4] 현재 PyTorch 확인 중...")
    installed_cuda = get_installed_torch_cuda()

    if installed_cuda:
        print(f"  → 설치된 PyTorch CUDA: {installed_cuda}")
    else:
        print("  → PyTorch 미설치")

    # 3. 재설치 필요 여부 판단
    target_index = get_best_cuda_index(system_cuda)
    need_reinstall = True

    if installed_cuda and system_cuda:
        # 이미 GPU 버전이 설치되어 있고, CUDA 버전이 호환되면 스킵
        if installed_cuda != "cpu" and installed_cuda.startswith(system_cuda.split(".")[0]):
            print(f"  → 호환되는 CUDA PyTorch 이미 설치됨")
            if verify_cuda_available():
                print("  → CUDA 정상 작동 확인됨, 재설치 불필요")
                need_reinstall = False

    if not need_reinstall:
        print("\n[SKIP] 재설치가 필요하지 않습니다.")
        show_status()
        return

    # 4. 기존 PyTorch 제거
    print("\n[3/4] 기존 PyTorch 제거 중...")
    uninstall_pytorch()
    print("  → 완료")

    # 5. 새로운 PyTorch 설치
    print("\n[4/4] PyTorch 설치 중...")
    if target_index:
        print(f"  → CUDA 인덱스: {target_index}")
    else:
        print("  → CPU 버전 설치")

    success = install_pytorch(target_index)

    if not success:
        print("\n[ERROR] PyTorch 설치 실패")
        sys.exit(1)

    # 6. 설치 검증
    print("\n[검증] CUDA 사용 가능 여부 확인...")
    if system_cuda and target_index:
        if verify_cuda_available():
            print("  → SUCCESS: CUDA 정상 작동!")
        else:
            print("  → WARNING: CUDA 설치했으나 사용 불가")
            print("  → 드라이버 또는 호환성 문제일 수 있습니다")

    show_status()


def show_status():
    """최종 상태 출력"""
    print("\n" + "=" * 60)
    print("설치 결과")
    print("=" * 60)
    subprocess.run([
        sys.executable, "-c",
        """
import torch
print(f"PyTorch: {torch.__version__}")
print(f"CUDA available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"CUDA version: {torch.version.cuda}")
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"GPU Memory: {torch.cuda.get_device_properties(0).total_memory // (1024**3)} GB")
else:
    print("Device: CPU")
"""
    ])


if __name__ == "__main__":
    main()
