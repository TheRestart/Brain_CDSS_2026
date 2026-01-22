// src/components/PacsSelector.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import "./PacsSelector.css";
import { getPatients, getStudies, getSeries } from "../api/orthancApi";

const asText = (v) => (v == null ? "" : String(v));

// 간단한 메모리 캐시 (5분 TTL)
const cache = {
  studies: new Map(),  // patientId -> { data, timestamp }
  series: new Map(),   // studyId -> { data, timestamp }
  TTL: 5 * 60 * 1000,  // 5분
};

const getCachedStudies = async (patientId) => {
  const cached = cache.studies.get(patientId);
  if (cached && Date.now() - cached.timestamp < cache.TTL) {
    return cached.data;
  }
  const data = await getStudies(patientId);
  cache.studies.set(patientId, { data, timestamp: Date.now() });
  return data;
};

const getCachedSeries = async (studyId) => {
  const cached = cache.series.get(studyId);
  if (cached && Date.now() - cached.timestamp < cache.TTL) {
    return cached.data;
  }
  const data = await getSeries(studyId);
  cache.series.set(studyId, { data, timestamp: Date.now() });
  return data;
};

// 긴 텍스트 말줄임 처리
const truncate = (text, maxLen = 40) => {
  if (!text || text.length <= maxLen) return text;
  return text.substring(0, maxLen) + '...';
};

export default function PacsSelector({ onChange, ocsInfo, initialSelection }) {
  const [patients, setPatients] = useState([]);
  const [studies, setStudies] = useState([]);
  const [seriesList, setSeriesList] = useState([]);

  const [patientId, setPatientId] = useState(initialSelection?.patientId || "");
  const [studyId, setStudyId] = useState(initialSelection?.studyId || "");

  const [baseSeriesId, setBaseSeriesId] = useState(initialSelection?.baseSeriesId || "");
  const [baseSeriesName, setBaseSeriesName] = useState(initialSelection?.baseSeriesName || "");

  const [overlaySeriesId, setOverlaySeriesId] = useState(initialSelection?.overlaySeriesId || "");
  const [overlaySeriesName, setOverlaySeriesName] = useState(initialSelection?.overlaySeriesName || "");

  const [busy, setBusy] = useState(false);
  const initializedRef = useRef(false);
  const ocsAutoSelectRef = useRef(false);  // OCS 자동 선택 완료 여부
  const mountedRef = useRef(true);  // 컴포넌트 마운트 상태

  // OCS 연동 모드인지 확인
  const isOcsMode = Boolean(ocsInfo?.patientNumber);

  // ✅ initialSelection이 있으면 OCS 자동 선택 건너뛰기 (V1→V2→V1 복원 시)
  const hasInitialData = Boolean(initialSelection?.patientId && initialSelection?.baseSeriesId);

  // 컴포넌트 언마운트 추적
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // initialSelection 복원 useEffect (복수 화면 전환 시 데이터 유지)
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      // patientId, studyId 복원
      if (initialSelection?.patientId) {
        setPatientId(initialSelection.patientId);
      }
      if (initialSelection?.studyId) {
        setStudyId(initialSelection.studyId);
      }
      if (initialSelection?.baseSeriesId) {
        setBaseSeriesId(initialSelection.baseSeriesId);
        setBaseSeriesName(initialSelection.baseSeriesName || "");
      }
      if (initialSelection?.overlaySeriesId) {
        setOverlaySeriesId(initialSelection.overlaySeriesId);
        setOverlaySeriesName(initialSelection.overlaySeriesName || "");
      }

      // studies, seriesList 다시 로드 (patientId가 있으면 항상, 캐시 사용)
      if (initialSelection?.patientId) {
        try {
          const st = await getCachedStudies(initialSelection.patientId);
          if (cancelled || !mountedRef.current) return;
          setStudies(st);

          if (initialSelection?.studyId) {
            const se = await getCachedSeries(initialSelection.studyId);
            if (cancelled || !mountedRef.current) return;
            setSeriesList(se);
          }
        } catch (err) {
          console.error("Failed to restore selection data:", err);
        }
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, [initialSelection?.patientId, initialSelection?.studyId, initialSelection?.baseSeriesId, initialSelection?.overlaySeriesId]);

  // 환자 목록 로드 + initialSelection/OCS 자동 선택
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const p = await getPatients();
        if (cancelled || !mountedRef.current) return;
        setPatients(p);

        // ✅ initialSelection에 데이터가 있으면 OCS 자동 선택 건너뛰기
        if (hasInitialData) {
          return;
        }

        // OCS 모드: patientNumber로 자동 매칭
        if (isOcsMode && !ocsAutoSelectRef.current) {
          ocsAutoSelectRef.current = true;

          // Orthanc에서 patientNumber(=PatientID)로 환자 찾기
          const matchedPatient = p.find(
            (pt) => pt.patientId === ocsInfo.patientNumber
          );

          if (matchedPatient) {
            setPatientId(matchedPatient.orthancId);

            // Study 자동 로드 (캐시 사용)
            setBusy(true);
            try {
              const st = await getCachedStudies(matchedPatient.orthancId);
              if (cancelled || !mountedRef.current) return;
              setStudies(st);

              // Study가 1개면 자동 선택
              if (st.length === 1) {
                const autoStudy = st[0];
                setStudyId(autoStudy.orthancId);

                // Series 로드 (캐시 사용)
                const se = await getCachedSeries(autoStudy.orthancId);
                if (cancelled || !mountedRef.current) return;
                setSeriesList(se);

                onChange?.({
                  patientId: matchedPatient.orthancId,
                  studyId: autoStudy.orthancId,
                  studyInstanceUID: autoStudy.studyInstanceUID || "",
                  baseSeriesId: "",
                  baseSeriesName: "",
                  overlaySeriesId: "",
                  overlaySeriesName: "",
                });
              } else {
                onChange?.({
                  patientId: matchedPatient.orthancId,
                  studyId: "",
                  studyInstanceUID: "",
                  baseSeriesId: "",
                  baseSeriesName: "",
                  overlaySeriesId: "",
                  overlaySeriesName: "",
                });
              }
            } finally {
              setBusy(false);
            }
          }
        }
        // 일반 모드: initialSelection 복원 (캐시 사용)
        else if (initialSelection?.patientId && !initializedRef.current) {
          initializedRef.current = true;

          // Study 로드
          if (initialSelection.patientId) {
            const st = await getCachedStudies(initialSelection.patientId);
            if (cancelled || !mountedRef.current) return;
            setStudies(st);

            // Series 로드
            if (initialSelection.studyId) {
              const se = await getCachedSeries(initialSelection.studyId);
              if (cancelled || !mountedRef.current) return;
              setSeriesList(se);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load patients:", err);
        if (!cancelled && mountedRef.current) {
          setPatients([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOcsMode, ocsInfo?.patientNumber, hasInitialData]);

  const overlayCandidates = useMemo(() => {
    return (seriesList || []).filter((s) => {
      const d = (s.description || "").toLowerCase();
      const uid = (s.seriesInstanceUID || "").toLowerCase();
      return d.includes("seg") || uid.includes("seg");
    });
  }, [seriesList]);

  const findSeriesName = (serId) => {
    if (!serId) return "";
    const s = (seriesList || []).find((x) => x.orthancId === serId);
    return asText(s?.description || s?.seriesInstanceUID || "");
  };

  // 현재 선택된 studyInstanceUID 가져오기
  const currentStudyInstanceUID = useMemo(() => {
    if (!studyId) return "";
    const study = studies.find((s) => s.orthancId === studyId);
    return study?.studyInstanceUID || "";
  }, [studyId, studies]);

  const emit = (patch = {}) => {
    const next = {
      patientId,
      studyId,
      studyInstanceUID: currentStudyInstanceUID,
      baseSeriesId,
      baseSeriesName,
      overlaySeriesId,
      overlaySeriesName,
      ...patch,
    };
    onChange?.(next);
  };

  const selectPatient = async (pid) => {
    setPatientId(pid);

    // reset
    setStudyId("");
    setStudies([]);
    setSeriesList([]);

    setBaseSeriesId("");
    setBaseSeriesName("");

    setOverlaySeriesId("");
    setOverlaySeriesName("");

    onChange?.({
      patientId: pid,
      studyId: "",
      baseSeriesId: "",
      baseSeriesName: "",
      overlaySeriesId: "",
      overlaySeriesName: "",
    });

    if (!pid) return;

    setBusy(true);
    try {
      const st = await getCachedStudies(pid);
      setStudies(st);
    } finally {
      setBusy(false);
    }
  };

  const selectStudy = async (sid) => {
    setStudyId(sid);

    // reset series selections
    setBaseSeriesId("");
    setBaseSeriesName("");
    setOverlaySeriesId("");
    setOverlaySeriesName("");
    setSeriesList([]);

    // 선택된 study의 studyInstanceUID 가져오기
    const selectedStudy = studies.find((s) => s.orthancId === sid);
    const studyUid = selectedStudy?.studyInstanceUID || "";

    onChange?.({
      patientId,
      studyId: sid,
      studyInstanceUID: studyUid,
      baseSeriesId: "",
      baseSeriesName: "",
      overlaySeriesId: "",
      overlaySeriesName: "",
    });

    if (!sid) return;

    setBusy(true);
    try {
      const se = await getCachedSeries(sid);
      setSeriesList(se);
    } finally {
      setBusy(false);
    }
  };

  const selectBaseSeries = (serId) => {
    const name = findSeriesName(serId);

    setBaseSeriesId(serId);
    setBaseSeriesName(name);

    emit({
      baseSeriesId: serId,
      baseSeriesName: name,
    });
  };

  const selectOverlaySeries = (serId) => {
    const name = findSeriesName(serId);

    setOverlaySeriesId(serId);
    setOverlaySeriesName(name);

    emit({
      overlaySeriesId: serId,
      overlaySeriesName: name,
    });
  };

  // 현재 선택된 환자 정보 가져오기
  const selectedPatient = useMemo(() => {
    if (!patientId) return null;
    return patients.find((p) => p.orthancId === patientId);
  }, [patientId, patients]);

  return (
    <section className="selCard">
      <div className="selHeader">
        <h2 className="selTitle">Selection</h2>
        <div className="selHint">
          {busy ? "Loading..." : isOcsMode ? "Study → Series" : "Patient → Study → Series"}
        </div>
      </div>

      {/* OCS 연동 모드: 환자 정보 읽기 전용 표시 */}
      {isOcsMode ? (
        <div className="ocsPatientBox">
          <div className="ocsPatientHeader">
            <span className="ocsPatientIcon">👤</span>
            <span className="ocsPatientTitle">환자 정보 (OCS 연동)</span>
          </div>
          <div className="ocsPatientContent">
            <div className="ocsPatientRow">
              <span className="ocsPatientLabel">환자명</span>
              <span className="ocsPatientValue">{ocsInfo.patientName}</span>
            </div>
            <div className="ocsPatientRow">
              <span className="ocsPatientLabel">환자번호</span>
              <span className="ocsPatientValue mono">{ocsInfo.patientNumber}</span>
            </div>
            {selectedPatient ? (
              <div className="ocsPatientRow">
                <span className="ocsPatientLabel">Orthanc</span>
                <span className="ocsPatientValue matched">
                  ✓ 매칭됨 ({selectedPatient.studiesCount}개 Study)
                </span>
              </div>
            ) : (
              <div className="ocsPatientRow">
                <span className="ocsPatientLabel">Orthanc</span>
                <span className="ocsPatientValue not-matched">
                  ✗ 영상 없음 (업로드 필요)
                </span>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* 일반 모드: 환자 선택 드롭다운 */
        <div className="selGrid">
          <div className="row">
            <label className="label">Patient</label>
            <select
              className="select"
              value={patientId}
              onChange={(e) => selectPatient(e.target.value)}
              disabled={busy}
            >
              <option value="">-- 선택 --</option>
              {patients.map((p) => (
                <option key={p.orthancId} value={p.orthancId}>
                  {truncate(asText(p.patientName || p.patientId), 30)} ({p.studiesCount})
                </option>
              ))}
            </select>
            {patientId && (
              <div className="idDisplay">
                <span className="idLabel">Orthanc ID:</span>
                <span className="idValue">{patientId}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="selGrid">

        <div className="row">
          <label className="label">Study</label>
          <select
            className="select"
            value={studyId}
            onChange={(e) => selectStudy(e.target.value)}
            disabled={!patientId || busy}
          >
            <option value="">-- 선택 --</option>
            {studies.map((s) => (
              <option key={s.orthancId} value={s.orthancId}>
                {truncate(asText(s.studyInstanceUID || s.orthancId), 40)}
              </option>
            ))}
          </select>
          {studyId && (
            <>
              <div className="studyInfoBox">
                <div className="studyInfoRow">
                  <span className="studyInfoLabel">Study UID</span>
                  <span className="studyInfoValue mono">
                    {studies.find((s) => s.orthancId === studyId)?.studyInstanceUID || "-"}
                  </span>
                </div>
                <div className="studyInfoRow">
                  <span className="studyInfoLabel">Description</span>
                  <span className="studyInfoValue">
                    {studies.find((s) => s.orthancId === studyId)?.description || "(없음)"}
                  </span>
                </div>
                <div className="studyInfoRow">
                  <span className="studyInfoLabel">Orthanc ID</span>
                  <span className="studyInfoValue mono">{studyId}</span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="row">
          <label className="label">Base Series</label>
          <select
            className="select"
            value={baseSeriesId}
            onChange={(e) => selectBaseSeries(e.target.value)}
            disabled={!studyId || busy}
          >
            <option value="">-- 선택 --</option>
            {seriesList.map((s) => (
              <option key={s.orthancId} value={s.orthancId}>
                {truncate(asText(s.description || s.seriesInstanceUID), 40)}
              </option>
            ))}
          </select>
        </div>

        <div className="row">
          <label className="label">Overlay Series (seg)</label>
          <select
            className="select"
            value={overlaySeriesId}
            onChange={(e) => selectOverlaySeries(e.target.value)}
            disabled={!studyId || busy}
          >
            <option value="">-- 없음 --</option>
            {overlayCandidates.map((s) => (
              <option key={s.orthancId} value={s.orthancId}>
                {truncate(asText(s.description || s.seriesInstanceUID), 40)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
