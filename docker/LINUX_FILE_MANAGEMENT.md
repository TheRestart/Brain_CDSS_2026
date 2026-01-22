# Linux 파일 관리 가이드

## 개요

Linux 시스템의 파일/폴더 권한, 소유자, 그룹 개념을 설명합니다.

---

## 1. ls -la 출력 해석

```bash
$ ls -la
drwxr-xr-x  2  acorn  acorn  4096  Jan 22 10:00  folder1
-rw-r--r--  1  root   root    123  Jan 22 10:00  file.txt
```

### 각 필드 설명

```
drwxr-xr-x  2  acorn  acorn  4096  Jan 22 10:00  folder1
│└──┬───┘  │    │      │      │        │           │
│   │      │    │      │      │        │           └─ 파일/폴더 이름
│   │      │    │      │      │        └─ 수정 날짜
│   │      │    │      │      └─ 파일 크기 (bytes)
│   │      │    │      └─ 그룹 (Group)
│   │      │    └─ 소유자 (Owner)
│   │      └─ 하드 링크 수
│   └─ 권한 (Permissions)
└─ 파일 타입
```

---

## 2. 파일 타입

| 문자 | 의미 | 설명 |
|------|------|------|
| `-` | 일반 파일 | 텍스트, 바이너리, 이미지 등 |
| `d` | 디렉토리 | 폴더 |
| `l` | 심볼릭 링크 | 바로가기 (Windows의 단축 아이콘과 유사) |
| `b` | 블록 장치 | 하드디스크, USB 등 |
| `c` | 문자 장치 | 키보드, 마우스 등 |

### 예시

```bash
drwxr-xr-x  ...  folder1      # d = 디렉토리
-rw-r--r--  ...  file.txt     # - = 일반 파일
lrwxrwxrwx  ...  link -> file # l = 심볼릭 링크
```

---

## 3. 권한 (Permissions)

### 3.1 권한 구조

```
rwxr-xr-x
└┬┘└┬┘└┬┘
 │  │  └─ Others (기타 사용자) 권한
 │  └─ Group (그룹) 권한
 └─ Owner (소유자) 권한
```

### 3.2 권한 문자 의미

| 문자 | 의미 | 파일에서 | 디렉토리에서 |
|------|------|----------|--------------|
| `r` | Read (읽기) | 파일 내용 읽기 | 폴더 내 파일 목록 보기 |
| `w` | Write (쓰기) | 파일 내용 수정 | 폴더 내 파일 생성/삭제 |
| `x` | Execute (실행) | 파일 실행 | 폴더 진입 (cd) |
| `-` | 권한 없음 | 해당 권한 없음 | 해당 권한 없음 |

### 3.3 권한 예시

```
rwxr-xr-x (755)
│││││││││
│││││││││
│││││││└┴─ Others: r-x (읽기O, 쓰기X, 실행O)
│││││└┴─── Group:  r-x (읽기O, 쓰기X, 실행O)
│││└┴───── Owner:  rwx (읽기O, 쓰기O, 실행O)
```

### 3.4 숫자로 표현 (8진수)

| 권한 | 숫자 | 계산 |
|------|------|------|
| `---` | 0 | 0+0+0 |
| `--x` | 1 | 0+0+1 |
| `-w-` | 2 | 0+2+0 |
| `-wx` | 3 | 0+2+1 |
| `r--` | 4 | 4+0+0 |
| `r-x` | 5 | 4+0+1 |
| `rw-` | 6 | 4+2+0 |
| `rwx` | 7 | 4+2+1 |

### 3.5 자주 사용하는 권한

| 숫자 | 권한 | 설명 | 용도 |
|------|------|------|------|
| `755` | rwxr-xr-x | 소유자 전체, 나머지 읽기+실행 | 실행파일, 디렉토리 |
| `644` | rw-r--r-- | 소유자 읽기+쓰기, 나머지 읽기 | 일반 파일 |
| `700` | rwx------ | 소유자만 전체 권한 | 개인 디렉토리 |
| `600` | rw------- | 소유자만 읽기+쓰기 | 비밀 파일 (.ssh/id_rsa) |
| `777` | rwxrwxrwx | 모두에게 전체 권한 | ⚠️ 보안상 비권장 |

---

## 4. 소유자 (Owner)와 그룹 (Group)

### 4.1 개념

```
-rw-r--r--  1  acorn  developers  123  file.txt
               │       │
               │       └─ 그룹: 이 파일이 속한 그룹
               └─ 소유자: 이 파일을 만든/소유한 사용자
```

### 4.2 권한 적용 순서

```
사용자가 파일에 접근할 때:

1. 사용자가 소유자인가? → Owner 권한 적용
2. 사용자가 그룹에 속하는가? → Group 권한 적용
3. 그 외 → Others 권한 적용
```

### 4.3 예시

```bash
-rw-r-----  1  acorn  developers  123  secret.txt
```

| 사용자 | 소유자? | 그룹? | 적용 권한 | 읽기 가능? |
|--------|---------|-------|-----------|------------|
| acorn | O | - | rw- | O |
| bob (developers 그룹) | X | O | r-- | O |
| guest | X | X | --- | X |

---

## 5. 자주 사용하는 명령어

### 5.1 권한 변경 (chmod)

```bash
# 숫자 방식
chmod 755 file.txt          # rwxr-xr-x
chmod 644 file.txt          # rw-r--r--

# 문자 방식
chmod +x script.sh          # 실행 권한 추가
chmod -w file.txt           # 쓰기 권한 제거
chmod u+x file.txt          # 소유자에게 실행 권한 추가
chmod g+w file.txt          # 그룹에게 쓰기 권한 추가
chmod o-r file.txt          # 기타 사용자 읽기 권한 제거

# 재귀적 적용 (하위 폴더 포함)
chmod -R 755 folder/
```

### 5.2 소유자/그룹 변경 (chown)

```bash
# 소유자 변경
chown acorn file.txt

# 소유자와 그룹 변경
chown acorn:developers file.txt

# 그룹만 변경
chown :developers file.txt
chgrp developers file.txt   # 또는 chgrp 사용

# 재귀적 적용
chown -R acorn:developers folder/
```

### 5.3 현재 사용자/그룹 확인

```bash
# 현재 사용자
whoami

# 현재 사용자가 속한 그룹
groups

# 특정 사용자의 그룹
groups acorn

# 사용자 상세 정보
id
# uid=1000(acorn) gid=1000(acorn) groups=1000(acorn),27(sudo),999(docker)
```

---

## 6. sudo와 root

### 6.1 root 사용자

- Linux 시스템의 **최고 관리자** (Windows의 Administrator)
- 모든 파일에 대한 권한 보유
- 시스템 설정 변경 가능

### 6.2 sudo 명령어

```bash
# 일반 사용자로 실행 (권한 부족 시 실패)
rm -rf /protected/folder
# rm: cannot remove '/protected/folder': Permission denied

# sudo로 관리자 권한 실행
sudo rm -rf /protected/folder
# [sudo] password for acorn: ********
# (성공)
```

### 6.3 sudo 사용 시 주의사항

```bash
# ⚠️ 위험: 시스템 전체 삭제
sudo rm -rf /

# ⚠️ 위험: 부팅 파일 삭제
sudo rm -rf /boot

# 항상 경로 확인 후 실행
pwd                              # 현재 위치 확인
ls -la                           # 파일 목록 확인
sudo rm -rf ./specific_folder    # 특정 폴더만 삭제
```

---

## 7. 특수 권한

### 7.1 SUID (Set User ID)

```bash
-rwsr-xr-x  1  root  root  passwd
   │
   └─ 's' = SUID 설정됨
```

- 실행 시 파일 **소유자의 권한**으로 실행
- 예: `/usr/bin/passwd`는 일반 사용자도 비밀번호 변경 가능

### 7.2 SGID (Set Group ID)

```bash
drwxr-sr-x  2  acorn  developers  folder
      │
      └─ 's' = SGID 설정됨
```

- 디렉토리: 새 파일이 **디렉토리의 그룹**을 상속

### 7.3 Sticky Bit

```bash
drwxrwxrwt  10  root  root  /tmp
         │
         └─ 't' = Sticky Bit 설정됨
```

- 디렉토리 내 파일을 **소유자만 삭제 가능**
- 예: `/tmp` 폴더 - 모두 쓸 수 있지만 남의 파일은 삭제 불가

---

## 8. Docker와 파일 권한

### 8.1 Docker 컨테이너 권한 문제

```bash
# Docker 컨테이너는 기본적으로 root로 실행
# 호스트에서 생성된 파일이 root 소유가 될 수 있음

ls -la /app/data/
-rw-r--r--  1  root  root  1234  file_from_container.txt
```

### 8.2 해결 방법

```bash
# 1. sudo로 삭제
sudo rm -rf ./data/*

# 2. 소유자 변경 후 삭제
sudo chown -R $USER:$USER ./data/
rm -rf ./data/*

# 3. Docker에서 사용자 지정
docker run --user $(id -u):$(id -g) ...
```

---

## 9. 실전 예시

### 9.1 "Permission denied" 해결

```bash
# 상황: 파일 삭제 불가
rm file.txt
# rm: cannot remove 'file.txt': Permission denied

# 1. 권한 확인
ls -la file.txt
# -rw-r--r--  1  root  root  123  file.txt
# → root 소유, 일반 사용자는 쓰기 권한 없음

# 2. sudo로 삭제
sudo rm file.txt
```

### 9.2 스크립트 실행 권한 부여

```bash
# 상황: 스크립트 실행 불가
./script.sh
# bash: ./script.sh: Permission denied

# 1. 권한 확인
ls -la script.sh
# -rw-r--r--  1  acorn  acorn  456  script.sh
# → 실행(x) 권한 없음

# 2. 실행 권한 추가
chmod +x script.sh

# 3. 다시 실행
./script.sh
# (정상 실행)
```

### 9.3 웹 서버 파일 권한 설정

```bash
# 웹 루트 디렉토리 권한 설정
sudo chown -R www-data:www-data /var/www/html
sudo chmod -R 755 /var/www/html
sudo chmod -R 644 /var/www/html/*.html
```

---

## 10. 빠른 참조표

### 권한 숫자 변환

| Owner | Group | Others | 숫자 | 설명 |
|-------|-------|--------|------|------|
| rwx | r-x | r-x | 755 | 일반 디렉토리/실행파일 |
| rw- | r-- | r-- | 644 | 일반 파일 |
| rwx | --- | --- | 700 | 비공개 디렉토리 |
| rw- | --- | --- | 600 | 비공개 파일 |
| rwx | rwx | rwx | 777 | 전체 공개 (비권장) |

### 자주 쓰는 명령어

| 명령어 | 설명 |
|--------|------|
| `ls -la` | 상세 파일 목록 |
| `chmod 755 file` | 권한 변경 |
| `chown user:group file` | 소유자 변경 |
| `sudo command` | 관리자 권한 실행 |
| `whoami` | 현재 사용자 확인 |
| `groups` | 소속 그룹 확인 |

---

## 최종 업데이트

- **날짜**: 2026-01-22
- **작성자**: Claude Code
