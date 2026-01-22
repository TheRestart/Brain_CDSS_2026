# Volume3DViewer 광원 설정 문서

## 개요

Volume3DViewer는 Three.js 기반의 3D 뇌종양 시각화 컴포넌트입니다.
본 문서는 3D 씬에 적용된 광원(Lighting) 설정을 설명합니다.

---

## 광원 구성

### 1. Ambient Light (주변광)

```typescript
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
scene.add(ambientLight)
```

| 속성 | 값 | 설명 |
|------|-----|------|
| 색상 | `0xffffff` (흰색) | 자연스러운 조명 색상 |
| 강도 | `0.6` | 전체 밝기의 60% |

**역할**: 씬 전체를 균일하게 비추는 기본 조명. 방향이 없어 모든 오브젝트를 동일한 밝기로 비춥니다. 그림자가 너무 어두워지는 것을 방지합니다.

---

### 2. Directional Light 1 (주 방향광)

```typescript
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
directionalLight.position.set(1, 1, 1)
scene.add(directionalLight)
```

| 속성 | 값 | 설명 |
|------|-----|------|
| 색상 | `0xffffff` (흰색) | 자연스러운 조명 색상 |
| 강도 | `0.8` | 주 광원으로 가장 강한 밝기 |
| 위치 | `(1, 1, 1)` | 우상단 전면 방향 |

**역할**: 메인 조명으로 오브젝트에 입체감을 부여합니다. 우상단 전면에서 비추어 자연스러운 하이라이트를 생성합니다.

---

### 3. Directional Light 2 (보조 방향광)

```typescript
const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4)
directionalLight2.position.set(-1, -1, -1)
scene.add(directionalLight2)
```

| 속성 | 값 | 설명 |
|------|-----|------|
| 색상 | `0xffffff` (흰색) | 자연스러운 조명 색상 |
| 강도 | `0.4` | 보조 광원으로 낮은 밝기 |
| 위치 | `(-1, -1, -1)` | 좌하단 후면 방향 |

**역할**: Fill Light(보조광)로 주 조명의 반대편에서 비추어 그림자 영역을 부드럽게 밝힙니다. 콘트라스트가 너무 강해지는 것을 방지합니다.

---

## 조명 다이어그램

```
                    (+Y) 상단
                      |
                      |
        주 조명 ------+-----> (+X) 우측
       (1,1,1)       /|
                    / |
                   /  |
               (+Z) 전면


        보조 조명: (-1,-1,-1) - 좌하단 후면
```

---

## 3-Point Lighting 기법

본 설정은 영화/사진 촬영에서 사용되는 **3-Point Lighting** 기법을 응용한 것입니다:

| 역할 | 구현 | 목적 |
|------|------|------|
| **Key Light** | DirectionalLight 1 (0.8) | 주 광원, 형태와 입체감 정의 |
| **Fill Light** | DirectionalLight 2 (0.4) | 그림자 영역 보완 |
| **Ambient** | AmbientLight (0.6) | 전체적인 기본 밝기 |

---

## 광원 강도 비율

```
총 조명 = Ambient(0.6) + Key(0.8) + Fill(0.4) = 1.8

비율:
- Ambient : 33% (0.6/1.8)
- Key     : 44% (0.8/1.8)
- Fill    : 22% (0.4/1.8)
```

이 비율은 의료 영상 시각화에 적합하도록 설계되었습니다:
- 충분한 Ambient로 세부 구조가 어둡게 묻히지 않음
- Key-Fill 비율 2:1로 적절한 입체감 유지

---

## 파일 위치

```
brain_tumor_front/
└── src/
    └── components/
        └── ai/
            └── SegMRIViewer/
                └── Volume3DViewer.tsx  (Line 205-215)
```

---

## 수정 시 고려사항

1. **Ambient 강도 증가**: 전체적으로 밝아지지만 입체감이 감소합니다
2. **Ambient 강도 감소**: 그림자가 진해지고 콘트라스트가 강해집니다
3. **Directional 위치 변경**: 하이라이트 방향이 바뀌어 다른 느낌의 렌더링 결과
4. **색상 변경**: 의료 영상에서는 흰색(0xffffff) 유지를 권장합니다

---

## 최종 업데이트

- **날짜**: 2026-01-22
- **작성자**: Claude Code
