// import React, { useEffect, useMemo, useRef, useState } from "react";
// import * as cornerstone from "cornerstone-core";
// import { initCornerstone } from "../cornerstoneConfig";
// import { getInstances, getInstanceFileUrl } from "../api/orthancApi";
// import "./ViewerSection.css";

// function safeNum(v, fallback = 0) {
//   const n = Number(v);
//   return Number.isFinite(n) ? n : fallback;
// }

// function getBestInstanceNumber(inst) {
//   return (
//     safeNum(inst?.instanceNumber, NaN) ||
//     safeNum(inst?.InstanceNumber, NaN) ||
//     safeNum(inst?.tags?.InstanceNumber, NaN) ||
//     safeNum(inst?.MainDicomTags?.InstanceNumber, NaN) ||
//     safeNum(inst?.index, NaN) ||
//     0
//   );
// }

// function getDicomTag(inst, key) {
//   return (
//     inst?.tags?.[key] ||
//     inst?.MainDicomTags?.[key] ||
//     inst?.dicomTags?.[key] ||
//     inst?.[key] ||
//     ""
//   );
// }

// function firstOfMulti(v) {
//   return String(v || "").split("\\")[0];
// }

// function hexToRgb(hex) {
//   const h = String(hex || "").replace("#", "").trim();
//   if (h.length !== 6) return { r: 0, g: 255, b: 0 };
//   const n = parseInt(h, 16);
//   return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
// }

// // 보기 좋은 기본 팔레트(레이블별 자동 색상)
// const DEFAULT_COLORS = [
//   "#42f58d",
//   "#ff4d4d",
//   "#4da6ff",
//   "#ffd24d",
//   "#c44dff",
//   "#4dffd2",
//   "#ff7a4d",
//   "#4dff4d",
//   "#ff4dd2",
//   "#a6ff4d",
// ];

// export default function ViewerSection({
//   baseSeriesId,
//   baseSeriesName,
//   overlaySeriesId,
//   overlaySeriesName,
// }) {
//   const elementRef = useRef(null);
//   const enabledRef = useRef(false);

//   const [baseInstances, setBaseInstances] = useState([]);
//   const [overlayInstances, setOverlayInstances] = useState([]);
//   const [sliceIndex, setSliceIndex] = useState(0);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");

//   // ✅ 레이블 목록(숫자) + 설정(체크/색/투명도)
//   const [labels, setLabels] = useState([]); // [1,2,3...]
//   const [labelCfg, setLabelCfg] = useState({}); // {1:{enabled,color,opacity,name}, ...}
//   const [labelScanning, setLabelScanning] = useState(false);

//   // overlayInstances instanceNumber -> inst
//   const overlayMap = useMemo(() => {
//     const m = new Map();
//     overlayInstances.forEach((inst) =>
//       m.set(getBestInstanceNumber(inst), inst)
//     );
//     return m;
//   }, [overlayInstances]);

//   const currentBase = baseInstances[sliceIndex] || null;

//   // ✅ meta overlay: Instance만
//   const metaModel = useMemo(() => {
//     if (!currentBase) return null;
//     return { instNo: getBestInstanceNumber(currentBase) };
//   }, [currentBase]);

//   // cornerstone init + enable
//   useEffect(() => {
//     initCornerstone();
//     const el = elementRef.current;
//     if (!el) return;

//     if (!enabledRef.current) {
//       cornerstone.enable(el);
//       enabledRef.current = true;
//     }

//     return () => {
//       try {
//         if (enabledRef.current) {
//           cornerstone.disable(el);
//           enabledRef.current = false;
//         }
//       } catch {}
//     };
//   }, []);

//   // ResizeObserver: 항상 block에 맞게 fit + center
//   useEffect(() => {
//     const el = elementRef.current;
//     if (!el) return;

//     const ro = new ResizeObserver(() => {
//       try {
//         cornerstone.resize(el, true);
//         cornerstone.fitToWindow(el);

//         const vp = cornerstone.getViewport(el);
//         if (vp) {
//           vp.translation = { x: 0, y: 0 };
//           cornerstone.setViewport(el, vp);
//         }
//       } catch {}
//     });

//     ro.observe(el);
//     return () => ro.disconnect();
//   }, []);

//   // load instances
//   useEffect(() => {
//     let alive = true;

//     async function load() {
//       setError("");
//       setLoading(true);

//       setBaseInstances([]);
//       setOverlayInstances([]);
//       setSliceIndex(0);

//       // overlay 관련 reset
//       setLabels([]);
//       setLabelCfg({});
//       setLabelScanning(false);

//       try {
//         if (!baseSeriesId) {
//           setLoading(false);
//           return;
//         }

//         const base = await getInstances(baseSeriesId);
//         const sortedBase = [...(base || [])].sort(
//           (a, b) => getBestInstanceNumber(a) - getBestInstanceNumber(b)
//         );

//         let overlay = [];
//         if (overlaySeriesId) {
//           overlay = await getInstances(overlaySeriesId);
//           overlay = [...(overlay || [])].sort(
//             (a, b) => getBestInstanceNumber(a) - getBestInstanceNumber(b)
//           );
//         }

//         if (!alive) return;
//         setBaseInstances(sortedBase);
//         setOverlayInstances(overlay);
//         setSliceIndex(0);
//       } catch (e) {
//         if (!alive) return;
//         setError(e?.message || String(e));
//       } finally {
//         if (alive) setLoading(false);
//       }
//     }

//     load();
//     return () => {
//       alive = false;
//     };
//   }, [baseSeriesId, overlaySeriesId]);

//   // ✅ overlay 레이블 스캔: 전체 overlayInstances에서 픽셀값(>0) 수집
//   useEffect(() => {
//     let alive = true;

//     async function scanLabels() {
//       if (!overlaySeriesId || !overlayInstances.length) return;

//       setLabelScanning(true);
//       try {
//         const found = new Set();

//         for (let i = 0; i < overlayInstances.length; i++) {
//           if (!alive) return;

//           const inst = overlayInstances[i];
//           const ovOrthancId =
//             inst?.orthancId || inst?.id || inst?.OrthancId || inst?.ID;
//           if (!ovOrthancId) continue;

//           const ovUrl = getInstanceFileUrl(ovOrthancId);
//           const ovImageId = `wadouri:${ovUrl}`;
//           const ovImage = await cornerstone.loadAndCacheImage(ovImageId);
//           const px = ovImage.getPixelData();

//           // 샘플링(성능): 최대 5만개 정도만 체크
//           const stride = Math.max(1, Math.floor(px.length / 50000));
//           for (let p = 0; p < px.length; p += stride) {
//             const v = px[p];
//             if (v > 0) found.add(v);
//           }

//           if (found.size >= 20) break;
//         }

//         const arr = Array.from(found)
//           .filter((n) => Number.isFinite(n) && n > 0)
//           .sort((a, b) => a - b);

//         if (!alive) return;

//         setLabels(arr);

//         setLabelCfg((prev) => {
//           const next = { ...prev };
//           arr.forEach((lab, idx) => {
//             if (!next[lab]) {
//               next[lab] = {
//                 enabled: true,
//                 color: DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
//                 opacity: 0.35,
//                 name: `Label${lab}`,
//               };
//             } else {
//               if (!next[lab].name) next[lab].name = `Label${lab}`;
//               if (next[lab].opacity == null) next[lab].opacity = 0.35;
//               if (!next[lab].color)
//                 next[lab].color = DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
//               if (next[lab].enabled == null) next[lab].enabled = true;
//             }
//           });
//           return next;
//         });
//       } catch (e) {
//         if (!alive) return;
//         console.warn("label scan failed:", e);
//       } finally {
//         if (alive) setLabelScanning(false);
//       }
//     }

//     scanLabels();
//     return () => {
//       alive = false;
//     };
//   }, [overlaySeriesId, overlayInstances]);

//   // ✅ overlay 그리기: 현재 slice에 맞는 overlay instance를 labelCfg 기준으로 컬러링
//   const drawOverlay = async (baseInst) => {
//     const el = elementRef.current;
//     if (!el) return;

//     const overlayCanvas = el.parentElement?.querySelector(".overlayCanvas");
//     if (!overlayCanvas) return;

//     overlayCanvas.width = el.clientWidth;
//     overlayCanvas.height = el.clientHeight;

//     const ctx = overlayCanvas.getContext("2d");
//     ctx.setTransform(1, 0, 0, 1, 0, 0);
//     ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

//     if (!overlaySeriesId) return;

//     const baseNo = getBestInstanceNumber(baseInst);
//     const ovInst = overlayMap.get(baseNo);
//     const ovOrthancId =
//       ovInst?.orthancId || ovInst?.id || ovInst?.OrthancId || ovInst?.ID;
//     if (!ovOrthancId) return;

//     const ovUrl = getInstanceFileUrl(ovOrthancId);
//     const ovImageId = `wadouri:${ovUrl}`;
//     const ovImage = await cornerstone.loadAndCacheImage(ovImageId);

//     const px = ovImage.getPixelData();
//     const imageW = ovImage.columns;
//     const imageH = ovImage.rows;

//     // label -> rgba LUT
//     const lut = new Map();
//     Object.keys(labelCfg || {}).forEach((k) => {
//       const lab = Number(k);
//       const cfg = labelCfg[lab];
//       if (!cfg || !cfg.enabled) {
//         lut.set(lab, { r: 0, g: 0, b: 0, a: 0 });
//         return;
//       }
//       const { r, g, b } = hexToRgb(cfg.color);
//       const a = Math.max(0, Math.min(1, Number(cfg.opacity ?? 0.35)));
//       lut.set(lab, { r, g, b, a });
//     });

//     // offscreen mask canvas (image space)
//     const maskCanvas = document.createElement("canvas");
//     maskCanvas.width = imageW;
//     maskCanvas.height = imageH;

//     const mctx = maskCanvas.getContext("2d", { willReadFrequently: true });
//     const imgData = mctx.createImageData(imageW, imageH);
//     const out = imgData.data;

//     for (let i = 0; i < px.length; i++) {
//       const lab = px[i];
//       if (!lab) continue;

//       const cfg = lut.get(lab);
//       if (!cfg || cfg.a <= 0) continue;

//       const o = i * 4;
//       out[o] = cfg.r;
//       out[o + 1] = cfg.g;
//       out[o + 2] = cfg.b;
//       out[o + 3] = Math.round(cfg.a * 255);
//     }
//     mctx.putImageData(imgData, 0, 0);

//     // viewport transform로 동일하게 얹기
//     const vp = cornerstone.getViewport(el);
//     const cw = overlayCanvas.width;
//     const ch = overlayCanvas.height;

//     ctx.setTransform(1, 0, 0, 1, 0, 0);
//     ctx.translate(cw / 2 + (vp?.translation?.x || 0), ch / 2 + (vp?.translation?.y || 0));
//     const rot = ((vp?.rotation || 0) * Math.PI) / 180;
//     ctx.rotate(rot);

//     const sx = (vp?.hflip ? -1 : 1) * (vp?.scale || 1);
//     const sy = (vp?.vflip ? -1 : 1) * (vp?.scale || 1);
//     ctx.scale(sx, sy);

//     ctx.translate(-imageW / 2, -imageH / 2);
//     ctx.drawImage(maskCanvas, 0, 0);
//     ctx.setTransform(1, 0, 0, 1, 0, 0);
//   };

//   // show base image + overlay draw
//   useEffect(() => {
//     const el = elementRef.current;
//     if (!el || !enabledRef.current) return;

//     let alive = true;

//     async function show() {
//       if (!baseInstances.length) return;

//       const idx = Math.min(Math.max(sliceIndex, 0), baseInstances.length - 1);
//       const baseInst = baseInstances[idx];
//       if (!baseInst) return;

//       const baseOrthancId =
//         baseInst?.orthancId || baseInst?.id || baseInst?.OrthancId || baseInst?.ID;
//       if (!baseOrthancId) return;

//       const baseUrl = getInstanceFileUrl(baseOrthancId);
//       const baseImageId = `wadouri:${baseUrl}`;
//       const image = await cornerstone.loadAndCacheImage(baseImageId);

//       if (!alive) return;

//       cornerstone.displayImage(el, image);

//       const vp = cornerstone.getDefaultViewportForImage(el, image);
//       vp.pixelReplication = false;

//       const wc = Number(firstOfMulti(getDicomTag(baseInst, "WindowCenter")));
//       const ww = Number(firstOfMulti(getDicomTag(baseInst, "WindowWidth")));
//       if (Number.isFinite(wc) && Number.isFinite(ww) && ww > 1) {
//         vp.voi = { windowCenter: wc, windowWidth: ww };
//       }

//       vp.translation = { x: 0, y: 0 };
//       cornerstone.setViewport(el, vp);

//       const doFit = async () => {
//         try {
//           cornerstone.resize(el, true);
//           cornerstone.fitToWindow(el);
//           const vp2 = cornerstone.getViewport(el);
//           if (vp2) {
//             vp2.translation = { x: 0, y: 0 };
//             cornerstone.setViewport(el, vp2);
//           }
//         } catch {}
//         try {
//           await drawOverlay(baseInst);
//         } catch {}
//       };

//       requestAnimationFrame(() => {
//         doFit();
//         requestAnimationFrame(() => doFit());
//       });

//       await drawOverlay(baseInst);
//     }

//     show().catch((e) => setError(e?.message || String(e)));

//     return () => {
//       alive = false;
//     };
//   }, [baseInstances, sliceIndex, overlaySeriesId, overlayMap, labelCfg]);

//   // 🔄 zoom/scroll 등 렌더링 이벤트마다 overlay follow
//   useEffect(() => {
//     const el = elementRef.current;
//     if (!el) return;

//     const handler = async () => {
//       try {
//         const idx = Math.min(Math.max(sliceIndex, 0), baseInstances.length - 1);
//         const baseInst = baseInstances[idx];
//         if (!baseInst) return;
//         await drawOverlay(baseInst);
//       } catch {}
//     };

//     el.addEventListener("cornerstoneimagerendered", handler);
//     return () => el.removeEventListener("cornerstoneimagerendered", handler);
//   }, [baseInstances, sliceIndex, overlaySeriesId, overlayMap, labelCfg]);

//   const maxIndex = Math.max(baseInstances.length - 1, 0);

//   // UI handlers
//   const setCfg = (lab, patch) => {
//     setLabelCfg((prev) => ({
//       ...prev,
//       [lab]: { ...(prev[lab] || {}), ...patch },
//     }));
//   };

//   return (
//     <div className="viewerShell">
//       <div className="viewerToolbar">
//         <div className="toolLeft">
//           <div className="toolBadge">
//             {loading
//               ? "Loading..."
//               : baseSeriesId
//               ? `Series: ${baseSeriesName || baseSeriesId}`
//               : "No Series"}
//           </div>

//           {overlaySeriesId ? (
//             <div className="toolBadge subtleBadge">
//               Overlay: {overlaySeriesName || overlaySeriesId}
//             </div>
//           ) : null}

//           {error ? <div className="toolError">{error}</div> : null}
//         </div>

//         {/* ✅ toolRight 끝에 Seg Labels를 가로로 3개 "칩"처럼 붙임 */}
//         <div className="toolRight">
//           <div className="sliceInfo">
//             Slice: {baseInstances.length ? sliceIndex + 1 : 0} /{" "}
//             {baseInstances.length || 0}
//           </div>

//           <button
//             className="btn"
//             onClick={() => setSliceIndex((v) => Math.max(0, v - 1))}
//             disabled={!baseInstances.length}
//           >
//             Prev
//           </button>

//           <button
//             className="btn"
//             onClick={() => setSliceIndex((v) => Math.min(maxIndex, v + 1))}
//             disabled={!baseInstances.length}
//           >
//             Next
//           </button>

//           {/* ✅ Seg Labels Toolbar */}
//           {overlaySeriesId ? (
//             <div className="segToolbar">
//               <div className="segTitle">
//                 Seg
//                 {labelScanning ? (
//                   <span className="segScanHint"> (scanning)</span>
//                 ) : null}
//               </div>

//               {/* 요구: "3개를 옆으로" -> 우선 최대 3개만 표시(나머지는 later 확장 가능) */}
//               {(labels || []).slice(0, 3).map((lab, idx) => {
//                 const cfg = labelCfg[lab] || {
//                   enabled: true,
//                   color: DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
//                   opacity: 0.35,
//                   name: `Label${lab}`,
//                 };

//                 return (
//                   <div className="segChip" key={lab} title={`Label ${lab}`}>
//                     <label className="segChk">
//                       <input
//                         type="checkbox"
//                         checked={!!cfg.enabled}
//                         onChange={(e) => setCfg(lab, { enabled: e.target.checked })}
//                       />
//                       <span className="segName">{cfg.name || `Label${lab}`}</span>
//                     </label>

//                     <input
//                       className="segColor"
//                       type="color"
//                       value={cfg.color || "#42f58d"}
//                       onChange={(e) => setCfg(lab, { color: e.target.value })}
//                       title="Color"
//                     />

//                     <div className="segOpacity">
//                       <input
//                         type="range"
//                         min={0}
//                         max={1}
//                         step={0.01}
//                         value={Number(cfg.opacity ?? 0.35)}
//                         onChange={(e) => setCfg(lab, { opacity: Number(e.target.value) })}
//                         title="Opacity"
//                       />
//                       <span className="segOpVal">
//                         {Math.round((cfg.opacity ?? 0.35) * 100)}%
//                       </span>
//                     </div>
//                   </div>
//                 );
//               })}
//             </div>
//           ) : null}
//         </div>
//       </div>

//       <div className="viewerStage">
//         <div className="cornerstoneHost" ref={elementRef} />
//         <canvas className="overlayCanvas" />

//         {metaModel ? (
//           <div className="metaOverlay">
//             <span className="metaKey metaGreen">Instance</span>
//             <span className="metaVal metaGreen">#{metaModel.instNo}</span>
//           </div>
//         ) : null}
//       </div>

//       <div className="sliceBar">
//         <input
//           type="range"
//           min={0}
//           max={maxIndex}
//           value={Math.min(sliceIndex, maxIndex)}
//           onChange={(e) => setSliceIndex(Number(e.target.value))}
//           disabled={!baseInstances.length}
//         />
//       </div>
//     </div>
//   );
// }







// import React, { useEffect, useMemo, useRef, useState } from "react";
// import * as cornerstone from "cornerstone-core";
// import { initCornerstone } from "../cornerstoneConfig";
// import { getInstances, getInstanceFileUrl } from "../api/orthancApi";
// import "./ViewerSection.css";

// function safeNum(v, fallback = 0) {
//   const n = Number(v);
//   return Number.isFinite(n) ? n : fallback;
// }

// function getBestInstanceNumber(inst) {
//   return (
//     safeNum(inst?.instanceNumber, NaN) ||
//     safeNum(inst?.InstanceNumber, NaN) ||
//     safeNum(inst?.tags?.InstanceNumber, NaN) ||
//     safeNum(inst?.MainDicomTags?.InstanceNumber, NaN) ||
//     safeNum(inst?.index, NaN) ||
//     0
//   );
// }

// function getDicomTag(inst, key) {
//   return (
//     inst?.tags?.[key] ||
//     inst?.MainDicomTags?.[key] ||
//     inst?.dicomTags?.[key] ||
//     inst?.[key] ||
//     ""
//   );
// }

// function firstOfMulti(v) {
//   return String(v || "").split("\\")[0];
// }

// function hexToRgb(hex) {
//   const h = String(hex || "").replace("#", "").trim();
//   if (h.length !== 6) return { r: 0, g: 255, b: 0 };
//   const n = parseInt(h, 16);
//   return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
// }

// // 보기 좋은 기본 팔레트(레이블별 자동 색상)
// const DEFAULT_COLORS = [
//   "#42f58d",
//   "#ff4d4d",
//   "#4da6ff",
//   "#ffd24d",
//   "#c44dff",
//   "#4dffd2",
//   "#ff7a4d",
//   "#4dff4d",
//   "#ff4dd2",
//   "#a6ff4d",
// ];

// export default function ViewerSection({
//   baseSeriesId,
//   baseSeriesName,
//   overlaySeriesId,
//   overlaySeriesName,
// }) {
//   const elementRef = useRef(null);
//   const enabledRef = useRef(false);

//   const [baseInstances, setBaseInstances] = useState([]);
//   const [overlayInstances, setOverlayInstances] = useState([]);
//   const [sliceIndex, setSliceIndex] = useState(0);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");

//   // ✅ 레이블 목록(숫자) + 설정(체크/색/투명도)
//   const [labels, setLabels] = useState([]); // [1,2,3...]
//   const [labelCfg, setLabelCfg] = useState({}); // {1:{enabled,color,opacity,name}, ...}
//   const [labelScanning, setLabelScanning] = useState(false);

//   // overlayInstances instanceNumber -> inst
//   const overlayMap = useMemo(() => {
//     const m = new Map();
//     overlayInstances.forEach((inst) => m.set(getBestInstanceNumber(inst), inst));
//     return m;
//   }, [overlayInstances]);

//   const currentBase = baseInstances[sliceIndex] || null;

//   // ✅ meta overlay: Instance만
//   const metaModel = useMemo(() => {
//     if (!currentBase) return null;
//     return { instNo: getBestInstanceNumber(currentBase) };
//   }, [currentBase]);

//   // cornerstone init + enable
//   useEffect(() => {
//     initCornerstone();
//     const el = elementRef.current;
//     if (!el) return;

//     if (!enabledRef.current) {
//       cornerstone.enable(el);
//       enabledRef.current = true;
//     }

//     return () => {
//       try {
//         if (enabledRef.current) {
//           cornerstone.disable(el);
//           enabledRef.current = false;
//         }
//       } catch {}
//     };
//   }, []);

//   // ResizeObserver: 항상 block에 맞게 fit + center
//   useEffect(() => {
//     const el = elementRef.current;
//     if (!el) return;

//     const ro = new ResizeObserver(() => {
//       try {
//         cornerstone.resize(el, true);
//         cornerstone.fitToWindow(el);

//         const vp = cornerstone.getViewport(el);
//         if (vp) {
//           vp.translation = { x: 0, y: 0 };
//           cornerstone.setViewport(el, vp);
//         }
//       } catch {}
//     });

//     ro.observe(el);
//     return () => ro.disconnect();
//   }, []);

//   // load instances
//   useEffect(() => {
//     let alive = true;

//     async function load() {
//       setError("");
//       setLoading(true);

//       setBaseInstances([]);
//       setOverlayInstances([]);
//       setSliceIndex(0);

//       // overlay 관련 reset
//       setLabels([]);
//       setLabelCfg({});
//       setLabelScanning(false);

//       try {
//         if (!baseSeriesId) {
//           setLoading(false);
//           return;
//         }

//         const base = await getInstances(baseSeriesId);
//         const sortedBase = [...(base || [])].sort(
//           (a, b) => getBestInstanceNumber(a) - getBestInstanceNumber(b)
//         );

//         let overlay = [];
//         if (overlaySeriesId) {
//           overlay = await getInstances(overlaySeriesId);
//           overlay = [...(overlay || [])].sort(
//             (a, b) => getBestInstanceNumber(a) - getBestInstanceNumber(b)
//           );
//         }

//         if (!alive) return;
//         setBaseInstances(sortedBase);
//         setOverlayInstances(overlay);
//         setSliceIndex(0);
//       } catch (e) {
//         if (!alive) return;
//         setError(e?.message || String(e));
//       } finally {
//         if (alive) setLoading(false);
//       }
//     }

//     load();
//     return () => {
//       alive = false;
//     };
//   }, [baseSeriesId, overlaySeriesId]);

//   // ✅ overlay 레이블 스캔: 전체 overlayInstances에서 픽셀값(>0) 수집
//   useEffect(() => {
//     let alive = true;

//     async function scanLabels() {
//       if (!overlaySeriesId || !overlayInstances.length) return;

//       setLabelScanning(true);
//       try {
//         const found = new Set();

//         for (let i = 0; i < overlayInstances.length; i++) {
//           if (!alive) return;

//           const inst = overlayInstances[i];
//           const ovOrthancId =
//             inst?.orthancId || inst?.id || inst?.OrthancId || inst?.ID;
//           if (!ovOrthancId) continue;

//           const ovUrl = getInstanceFileUrl(ovOrthancId);
//           const ovImageId = `wadouri:${ovUrl}`;
//           const ovImage = await cornerstone.loadAndCacheImage(ovImageId);
//           const px = ovImage.getPixelData();

//           // 샘플링(성능): 최대 5만개 정도만 체크
//           const stride = Math.max(1, Math.floor(px.length / 50000));
//           for (let p = 0; p < px.length; p += stride) {
//             const v = px[p];
//             if (v > 0) found.add(v);
//           }

//           if (found.size >= 20) break;
//         }

//         const arr = Array.from(found)
//           .filter((n) => Number.isFinite(n) && n > 0)
//           .sort((a, b) => a - b);

//         if (!alive) return;

//         setLabels(arr);

//         setLabelCfg((prev) => {
//           const next = { ...prev };
//           arr.forEach((lab, idx) => {
//             if (!next[lab]) {
//               next[lab] = {
//                 enabled: true,
//                 color: DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
//                 opacity: 0.35,
//                 name: `L${lab}`, // ✅ Label1 -> L1
//               };
//             } else {
//               if (!next[lab].name) next[lab].name = `L${lab}`; // ✅
//               if (next[lab].opacity == null) next[lab].opacity = 0.35;
//               if (!next[lab].color)
//                 next[lab].color = DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
//               if (next[lab].enabled == null) next[lab].enabled = true;
//             }
//           });
//           return next;
//         });
//       } catch (e) {
//         if (!alive) return;
//         console.warn("label scan failed:", e);
//       } finally {
//         if (alive) setLabelScanning(false);
//       }
//     }

//     scanLabels();
//     return () => {
//       alive = false;
//     };
//   }, [overlaySeriesId, overlayInstances]);

//   // ✅ overlay 그리기: 현재 slice에 맞는 overlay instance를 labelCfg 기준으로 컬러링
//   const drawOverlay = async (baseInst) => {
//     const el = elementRef.current;
//     if (!el) return;

//     const overlayCanvas = el.parentElement?.querySelector(".overlayCanvas");
//     if (!overlayCanvas) return;

//     overlayCanvas.width = el.clientWidth;
//     overlayCanvas.height = el.clientHeight;

//     const ctx = overlayCanvas.getContext("2d");
//     ctx.setTransform(1, 0, 0, 1, 0, 0);
//     ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

//     if (!overlaySeriesId) return;

//     const baseNo = getBestInstanceNumber(baseInst);
//     const ovInst = overlayMap.get(baseNo);
//     const ovOrthancId =
//       ovInst?.orthancId || ovInst?.id || ovInst?.OrthancId || ovInst?.ID;
//     if (!ovOrthancId) return;

//     const ovUrl = getInstanceFileUrl(ovOrthancId);
//     const ovImageId = `wadouri:${ovUrl}`;
//     const ovImage = await cornerstone.loadAndCacheImage(ovImageId);

//     const px = ovImage.getPixelData();
//     const imageW = ovImage.columns;
//     const imageH = ovImage.rows;

//     // label -> rgba LUT
//     const lut = new Map();
//     Object.keys(labelCfg || {}).forEach((k) => {
//       const lab = Number(k);
//       const cfg = labelCfg[lab];
//       if (!cfg || !cfg.enabled) {
//         lut.set(lab, { r: 0, g: 0, b: 0, a: 0 });
//         return;
//       }
//       const { r, g, b } = hexToRgb(cfg.color);
//       const a = Math.max(0, Math.min(1, Number(cfg.opacity ?? 0.35)));
//       lut.set(lab, { r, g, b, a });
//     });

//     // offscreen mask canvas (image space)
//     const maskCanvas = document.createElement("canvas");
//     maskCanvas.width = imageW;
//     maskCanvas.height = imageH;

//     const mctx = maskCanvas.getContext("2d", { willReadFrequently: true });
//     const imgData = mctx.createImageData(imageW, imageH);
//     const out = imgData.data;

//     for (let i = 0; i < px.length; i++) {
//       const lab = px[i];
//       if (!lab) continue;

//       const cfg = lut.get(lab);
//       if (!cfg || cfg.a <= 0) continue;

//       const o = i * 4;
//       out[o] = cfg.r;
//       out[o + 1] = cfg.g;
//       out[o + 2] = cfg.b;
//       out[o + 3] = Math.round(cfg.a * 255);
//     }
//     mctx.putImageData(imgData, 0, 0);

//     // viewport transform로 동일하게 얹기
//     const vp = cornerstone.getViewport(el);
//     const cw = overlayCanvas.width;
//     const ch = overlayCanvas.height;

//     ctx.setTransform(1, 0, 0, 1, 0, 0);
//     ctx.translate(
//       cw / 2 + (vp?.translation?.x || 0),
//       ch / 2 + (vp?.translation?.y || 0)
//     );
//     const rot = ((vp?.rotation || 0) * Math.PI) / 180;
//     ctx.rotate(rot);

//     const sx = (vp?.hflip ? -1 : 1) * (vp?.scale || 1);
//     const sy = (vp?.vflip ? -1 : 1) * (vp?.scale || 1);
//     ctx.scale(sx, sy);

//     ctx.translate(-imageW / 2, -imageH / 2);
//     ctx.drawImage(maskCanvas, 0, 0);
//     ctx.setTransform(1, 0, 0, 1, 0, 0);
//   };

//   // show base image + overlay draw
//   useEffect(() => {
//     const el = elementRef.current;
//     if (!el || !enabledRef.current) return;

//     let alive = true;

//     async function show() {
//       if (!baseInstances.length) return;

//       const idx = Math.min(Math.max(sliceIndex, 0), baseInstances.length - 1);
//       const baseInst = baseInstances[idx];
//       if (!baseInst) return;

//       const baseOrthancId =
//         baseInst?.orthancId || baseInst?.id || baseInst?.OrthancId || baseInst?.ID;
//       if (!baseOrthancId) return;

//       const baseUrl = getInstanceFileUrl(baseOrthancId);
//       const baseImageId = `wadouri:${baseUrl}`;
//       const image = await cornerstone.loadAndCacheImage(baseImageId);

//       if (!alive) return;

//       cornerstone.displayImage(el, image);

//       const vp = cornerstone.getDefaultViewportForImage(el, image);
//       vp.pixelReplication = false;

//       const wc = Number(firstOfMulti(getDicomTag(baseInst, "WindowCenter")));
//       const ww = Number(firstOfMulti(getDicomTag(baseInst, "WindowWidth")));
//       if (Number.isFinite(wc) && Number.isFinite(ww) && ww > 1) {
//         vp.voi = { windowCenter: wc, windowWidth: ww };
//       }

//       vp.translation = { x: 0, y: 0 };
//       cornerstone.setViewport(el, vp);

//       const doFit = async () => {
//         try {
//           cornerstone.resize(el, true);
//           cornerstone.fitToWindow(el);
//           const vp2 = cornerstone.getViewport(el);
//           if (vp2) {
//             vp2.translation = { x: 0, y: 0 };
//             cornerstone.setViewport(el, vp2);
//           }
//         } catch {}
//         try {
//           await drawOverlay(baseInst);
//         } catch {}
//       };

//       requestAnimationFrame(() => {
//         doFit();
//         requestAnimationFrame(() => doFit());
//       });

//       await drawOverlay(baseInst);
//     }

//     show().catch((e) => setError(e?.message || String(e)));

//     return () => {
//       alive = false;
//     };
//   }, [baseInstances, sliceIndex, overlaySeriesId, overlayMap, labelCfg]);

//   // 🔄 zoom/scroll 등 렌더링 이벤트마다 overlay follow
//   useEffect(() => {
//     const el = elementRef.current;
//     if (!el) return;

//     const handler = async () => {
//       try {
//         const idx = Math.min(Math.max(sliceIndex, 0), baseInstances.length - 1);
//         const baseInst = baseInstances[idx];
//         if (!baseInst) return;
//         await drawOverlay(baseInst);
//       } catch {}
//     };

//     el.addEventListener("cornerstoneimagerendered", handler);
//     return () => el.removeEventListener("cornerstoneimagerendered", handler);
//   }, [baseInstances, sliceIndex, overlaySeriesId, overlayMap, labelCfg]);

//   const maxIndex = Math.max(baseInstances.length - 1, 0);

//   // UI handlers
//   const setCfg = (lab, patch) => {
//     setLabelCfg((prev) => ({
//       ...prev,
//       [lab]: { ...(prev[lab] || {}), ...patch },
//     }));
//   };

//   return (
//     <div className="viewerShell">
//       <div className="viewerToolbar">
//         <div className="toolLeft">
//           <div className="toolBadge">
//             {loading
//               ? "Loading..."
//               : baseSeriesId
//               ? `Series: ${baseSeriesName || baseSeriesId}`
//               : "No Series"}
//           </div>

//           {overlaySeriesId ? (
//             <div className="toolBadge subtleBadge">
//               Overlay: {overlaySeriesName || overlaySeriesId}
//             </div>
//           ) : null}

//           {error ? <div className="toolError">{error}</div> : null}
//         </div>

//         <div className="toolRight">
//           <div className="sliceInfo">
//             Slice: {baseInstances.length ? sliceIndex + 1 : 0} /{" "}
//             {baseInstances.length || 0}
//           </div>

//           <button
//             className="btn"
//             onClick={() => setSliceIndex((v) => Math.max(0, v - 1))}
//             disabled={!baseInstances.length}
//           >
//             Prev
//           </button>

//           <button
//             className="btn"
//             onClick={() => setSliceIndex((v) => Math.min(maxIndex, v + 1))}
//             disabled={!baseInstances.length}
//           >
//             Next
//           </button>

//           {/* ✅ Seg Labels Toolbar */}
//           {overlaySeriesId ? (
//             <div className="segToolbar">
//               <div className="segTitle">
//                 Seg
//                 {labelScanning ? (
//                   <span className="segScanHint"> (scanning)</span>
//                 ) : null}
//               </div>

//               {(labels || []).slice(0, 3).map((lab, idx) => {
//                 const cfg = labelCfg[lab] || {
//                   enabled: true,
//                   color: DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
//                   opacity: 0.35,
//                   name: `L${lab}`, // ✅ Label1 -> L1
//                 };

//                 return (
//                   <div className="segChip" key={lab} title={`Label ${lab}`}>
//                     <label className="segChk">
//                       <input
//                         type="checkbox"
//                         checked={!!cfg.enabled}
//                         onChange={(e) =>
//                           setCfg(lab, { enabled: e.target.checked })
//                         }
//                       />
//                       <span className="segName">{cfg.name || `L${lab}`}</span>
//                     </label>

//                     <input
//                       className="segColor"
//                       type="color"
//                       value={cfg.color || "#42f58d"}
//                       onChange={(e) => setCfg(lab, { color: e.target.value })}
//                       title="Color"
//                     />

//                     <div className="segOpacity">
//                       <input
//                         type="range"
//                         min={0}
//                         max={1}
//                         step={0.01}
//                         value={Number(cfg.opacity ?? 0.35)}
//                         onChange={(e) =>
//                           setCfg(lab, { opacity: Number(e.target.value) })
//                         }
//                         title="Opacity"
//                       />
//                       <span className="segOpVal">
//                         {Math.round((cfg.opacity ?? 0.35) * 100)}%
//                       </span>
//                     </div>
//                   </div>
//                 );
//               })}
//             </div>
//           ) : null}
//         </div>
//       </div>

//       <div className="viewerStage">
//         <div className="cornerstoneHost" ref={elementRef} />
//         <canvas className="overlayCanvas" />

//         {metaModel ? (
//           <div className="metaOverlay">
//             <span className="metaKey metaGreen">Instance</span>
//             <span className="metaVal metaGreen">#{metaModel.instNo}</span>
//           </div>
//         ) : null}
//       </div>

//       <div className="sliceBar">
//         <input
//           type="range"
//           min={0}
//           max={maxIndex}
//           value={Math.min(sliceIndex, maxIndex)}
//           onChange={(e) => setSliceIndex(Number(e.target.value))}
//           disabled={!baseInstances.length}
//         />
//       </div>
//     </div>
//   );
// }








// import React, { useEffect, useMemo, useRef, useState } from "react";
// import * as cornerstone from "cornerstone-core";
// import { initCornerstone } from "../cornerstoneConfig";
// import { getInstances, getInstanceFileUrl } from "../api/orthancApi";
// import "./ViewerSection.css";

// function safeNum(v, fallback = 0) {
//   const n = Number(v);
//   return Number.isFinite(n) ? n : fallback;
// }

// function getBestInstanceNumber(inst) {
//   return (
//     safeNum(inst?.instanceNumber, NaN) ||
//     safeNum(inst?.InstanceNumber, NaN) ||
//     safeNum(inst?.tags?.InstanceNumber, NaN) ||
//     safeNum(inst?.MainDicomTags?.InstanceNumber, NaN) ||
//     safeNum(inst?.index, NaN) ||
//     0
//   );
// }

// function getDicomTag(inst, key) {
//   return (
//     inst?.tags?.[key] ||
//     inst?.MainDicomTags?.[key] ||
//     inst?.dicomTags?.[key] ||
//     inst?.[key] ||
//     ""
//   );
// }

// function firstOfMulti(v) {
//   return String(v || "").split("\\")[0];
// }

// function hexToRgb(hex) {
//   const h = String(hex || "").replace("#", "").trim();
//   if (h.length !== 6) return { r: 0, g: 255, b: 0 };
//   const n = parseInt(h, 16);
//   return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
// }

// const DEFAULT_COLORS = [
//   "#42f58d",
//   "#ff4d4d",
//   "#4da6ff",
//   "#ffd24d",
//   "#c44dff",
//   "#4dffd2",
//   "#ff7a4d",
//   "#4dff4d",
//   "#ff4dd2",
//   "#a6ff4d",
// ];

// export default function ViewerSection({
//   baseSeriesId,
//   baseSeriesName,
//   overlaySeriesId,
//   overlaySeriesName,
// }) {
//   const elementRef = useRef(null);
//   const enabledRef = useRef(false);

//   const [baseInstances, setBaseInstances] = useState([]);
//   const [overlayInstances, setOverlayInstances] = useState([]);
//   const [sliceIndex, setSliceIndex] = useState(0);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");

//   const [labels, setLabels] = useState([]); // 실제 픽셀값 배열
//   const [labelCfg, setLabelCfg] = useState({});
//   const [labelScanning, setLabelScanning] = useState(false);

//   const overlayMap = useMemo(() => {
//     const m = new Map();
//     overlayInstances.forEach((inst) =>
//       m.set(getBestInstanceNumber(inst), inst)
//     );
//     return m;
//   }, [overlayInstances]);

//   const currentBase = baseInstances[sliceIndex] || null;

//   const metaModel = useMemo(() => {
//     if (!currentBase) return null;
//     return { instNo: getBestInstanceNumber(currentBase) };
//   }, [currentBase]);

//   useEffect(() => {
//     initCornerstone();
//     const el = elementRef.current;
//     if (!el) return;

//     if (!enabledRef.current) {
//       cornerstone.enable(el);
//       enabledRef.current = true;
//     }

//     return () => {
//       try {
//         cornerstone.disable(el);
//         enabledRef.current = false;
//       } catch {}
//     };
//   }, []);

//   useEffect(() => {
//     const el = elementRef.current;
//     if (!el) return;

//     const ro = new ResizeObserver(() => {
//       try {
//         cornerstone.resize(el, true);
//         cornerstone.fitToWindow(el);
//         const vp = cornerstone.getViewport(el);
//         if (vp) {
//           vp.translation = { x: 0, y: 0 };
//           cornerstone.setViewport(el, vp);
//         }
//       } catch {}
//     });

//     ro.observe(el);
//     return () => ro.disconnect();
//   }, []);

//   useEffect(() => {
//     let alive = true;

//     async function load() {
//       setLoading(true);
//       setError("");

//       setBaseInstances([]);
//       setOverlayInstances([]);
//       setSliceIndex(0);
//       setLabels([]);
//       setLabelCfg({});
//       setLabelScanning(false);

//       try {
//         if (!baseSeriesId) return;

//         const base = await getInstances(baseSeriesId);
//         const sortedBase = [...(base || [])].sort(
//           (a, b) => getBestInstanceNumber(a) - getBestInstanceNumber(b)
//         );

//         let overlay = [];
//         if (overlaySeriesId) {
//           overlay = await getInstances(overlaySeriesId);
//           overlay = [...overlay].sort(
//             (a, b) => getBestInstanceNumber(a) - getBestInstanceNumber(b)
//           );
//         }

//         if (!alive) return;
//         setBaseInstances(sortedBase);
//         setOverlayInstances(overlay);
//       } catch (e) {
//         if (alive) setError(String(e));
//       } finally {
//         if (alive) setLoading(false);
//       }
//     }

//     load();
//     return () => {
//       alive = false;
//     };
//   }, [baseSeriesId, overlaySeriesId]);

//   /* ===============================
//      ✅ LABEL SCAN + L1/L2/L3 매핑
//      =============================== */
//   useEffect(() => {
//     let alive = true;

//     async function scanLabels() {
//       if (!overlaySeriesId || !overlayInstances.length) return;

//       setLabelScanning(true);

//       try {
//         const found = new Set();

//         for (const inst of overlayInstances) {
//           if (!alive) return;

//           const id =
//             inst?.orthancId || inst?.id || inst?.OrthancId || inst?.ID;
//           if (!id) continue;

//           const image = await cornerstone.loadAndCacheImage(
//             `wadouri:${getInstanceFileUrl(id)}`
//           );
//           const px = image.getPixelData();

//           const stride = Math.max(1, Math.floor(px.length / 50000));
//           for (let i = 0; i < px.length; i += stride) {
//             if (px[i] > 0) found.add(px[i]);
//           }
//         }

//         const arr = Array.from(found).sort((a, b) => a - b);
//         if (!alive) return;

//         setLabels(arr);

//         setLabelCfg((prev) => {
//           const next = { ...prev };

//           arr.forEach((lab, idx) => {
//             const displayNo = idx + 1;
//             const color = DEFAULT_COLORS[idx % DEFAULT_COLORS.length];

//             next[lab] = {
//               enabled: prev[lab]?.enabled ?? true,
//               opacity: prev[lab]?.opacity ?? 0.35,
//               color: prev[lab]?.color || color,
//               name: `L${displayNo}`, // ✅ 핵심
//             };
//           });

//           return next;
//         });
//       } catch (e) {
//         console.warn("label scan failed:", e);
//       } finally {
//         if (alive) setLabelScanning(false);
//       }
//     }

//     scanLabels();
//     return () => {
//       alive = false;
//     };
//   }, [overlaySeriesId, overlayInstances]);

//   const drawOverlay = async (baseInst) => {
//     const el = elementRef.current;
//     if (!el) return;

//     const canvas = el.parentElement.querySelector(".overlayCanvas");
//     if (!canvas) return;

//     canvas.width = el.clientWidth;
//     canvas.height = el.clientHeight;

//     const ctx = canvas.getContext("2d");
//     ctx.clearRect(0, 0, canvas.width, canvas.height);

//     if (!overlaySeriesId) return;

//     const ovInst = overlayMap.get(getBestInstanceNumber(baseInst));
//     const id =
//       ovInst?.orthancId || ovInst?.id || ovInst?.OrthancId || ovInst?.ID;
//     if (!id) return;

//     const image = await cornerstone.loadAndCacheImage(
//       `wadouri:${getInstanceFileUrl(id)}`
//     );

//     const px = image.getPixelData();
//     const w = image.columns;
//     const h = image.rows;

//     const mask = document.createElement("canvas");
//     mask.width = w;
//     mask.height = h;

//     const mctx = mask.getContext("2d", { willReadFrequently: true });
//     const imgData = mctx.createImageData(w, h);
//     const out = imgData.data;

//     for (let i = 0; i < px.length; i++) {
//       const lab = px[i];
//       const cfg = labelCfg[lab];
//       if (!cfg || !cfg.enabled) continue;

//       const { r, g, b } = hexToRgb(cfg.color);
//       const a = Math.round((cfg.opacity ?? 0.35) * 255);

//       const o = i * 4;
//       out[o] = r;
//       out[o + 1] = g;
//       out[o + 2] = b;
//       out[o + 3] = a;
//     }

//     mctx.putImageData(imgData, 0, 0);

//     const vp = cornerstone.getViewport(el);
//     ctx.translate(
//       canvas.width / 2 + (vp?.translation?.x || 0),
//       canvas.height / 2 + (vp?.translation?.y || 0)
//     );
//     ctx.scale(vp?.scale || 1, vp?.scale || 1);
//     ctx.translate(-w / 2, -h / 2);
//     ctx.drawImage(mask, 0, 0);
//     ctx.setTransform(1, 0, 0, 1, 0, 0);
//   };

//   useEffect(() => {
//     const el = elementRef.current;
//     if (!el || !baseInstances.length) return;

//     const inst = baseInstances[sliceIndex];
//     if (!inst) return;

//     const id = inst?.orthancId || inst?.id || inst?.OrthancId || inst?.ID;
//     if (!id) return;

//     cornerstone
//       .loadAndCacheImage(`wadouri:${getInstanceFileUrl(id)}`)
//       .then((image) => {
//         cornerstone.displayImage(el, image);
//         cornerstone.fitToWindow(el);
//         drawOverlay(inst);
//       });
//   }, [baseInstances, sliceIndex, labelCfg]);

//   const maxIndex = Math.max(0, baseInstances.length - 1);

//   const setCfg = (lab, patch) =>
//     setLabelCfg((p) => ({ ...p, [lab]: { ...p[lab], ...patch } }));

//   return (
//     <div className="viewerShell">
//       <div className="viewerToolbar">
//         <div className="toolLeft">
//           <div className="toolBadge">
//             {loading ? "Loading..." : baseSeriesName || baseSeriesId}
//           </div>
//         </div>

//         <div className="toolRight">
//           <div className="sliceInfo">
//             {sliceIndex + 1} / {baseInstances.length}
//           </div>

//           <button
//             className="btn"
//             onClick={() => setSliceIndex((v) => Math.max(0, v - 1))}
//           >
//             Prev
//           </button>
//           <button
//             className="btn"
//             onClick={() => setSliceIndex((v) => Math.min(maxIndex, v + 1))}
//           >
//             Next
//           </button>

//           {overlaySeriesId && (
//             <div className="segToolbar">
//               <div className="segTitle">
//                 Seg{labelScanning && " (scan)"}
//               </div>

//               {labels.slice(0, 3).map((lab) => {
//                 const cfg = labelCfg[lab];
//                 return (
//                   <div className="segChip" key={lab}>
//                     <label className="segChk">
//                       <input
//                         type="checkbox"
//                         checked={cfg.enabled}
//                         onChange={(e) =>
//                           setCfg(lab, { enabled: e.target.checked })
//                         }
//                       />
//                       <span className="segName">{cfg.name}</span>
//                     </label>

//                     <input
//                       type="color"
//                       className="segColor"
//                       value={cfg.color}
//                       onChange={(e) =>
//                         setCfg(lab, { color: e.target.value })
//                       }
//                     />

//                     <div className="segOpacity">
//                       <input
//                         type="range"
//                         min={0}
//                         max={1}
//                         step={0.01}
//                         value={cfg.opacity}
//                         onChange={(e) =>
//                           setCfg(lab, { opacity: Number(e.target.value) })
//                         }
//                       />
//                       <span className="segOpVal">
//                         {Math.round(cfg.opacity * 100)}%
//                       </span>
//                     </div>
//                   </div>
//                 );
//               })}
//             </div>
//           )}
//         </div>
//       </div>

//       <div className="viewerStage">
//         <div className="cornerstoneHost" ref={elementRef} />
//         <canvas className="overlayCanvas" />
//         {metaModel && (
//           <div className="metaOverlay">
//             <span className="metaGreen">Instance #{metaModel.instNo}</span>
//           </div>
//         )}
//       </div>

//       <div className="sliceBar">
//         <input
//           type="range"
//           min={0}
//           max={maxIndex}
//           value={sliceIndex}
//           onChange={(e) => setSliceIndex(Number(e.target.value))}
//         />
//       </div>
//     </div>
//   );
// }







import React, { useEffect, useMemo, useRef, useState } from "react";
import * as cornerstone from "cornerstone-core";
import { initCornerstone } from "../cornerstoneConfig";
import { getInstances, getInstanceFileUrl } from "../api/orthancApi";
import "./ViewerSection.css";

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function getBestInstanceNumber(inst) {
  return (
    safeNum(inst?.instanceNumber, NaN) ||
    safeNum(inst?.InstanceNumber, NaN) ||
    safeNum(inst?.tags?.InstanceNumber, NaN) ||
    safeNum(inst?.MainDicomTags?.InstanceNumber, NaN) ||
    safeNum(inst?.index, NaN) ||
    0
  );
}

function getDicomTag(inst, key) {
  return (
    inst?.tags?.[key] ||
    inst?.MainDicomTags?.[key] ||
    inst?.dicomTags?.[key] ||
    inst?.[key] ||
    ""
  );
}

function firstOfMulti(v) {
  return String(v || "").split("\\")[0];
}

function hexToRgb(hex) {
  const h = String(hex || "").replace("#", "").trim();
  if (h.length !== 6) return { r: 0, g: 255, b: 0 };
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

const DEFAULT_COLORS = [
  "#42f58d",
  "#ff4d4d",
  "#4da6ff",
  "#ffd24d",
  "#c44dff",
  "#4dffd2",
  "#ff7a4d",
  "#4dff4d",
  "#ff4dd2",
  "#a6ff4d",
];

export default function ViewerSection({
  studyInstanceUID,
  baseSeriesId,
  baseSeriesName,
  overlaySeriesId,
  overlaySeriesName,
  externalPlaying = false, // 외부에서 제어하는 Play 상태 (All Play)
  externalResetKey = 0, // 외부에서 제어하는 리셋 키 (Set 버튼)
}) {
  const elementRef = useRef(null);
  const enabledRef = useRef(false);

  const [baseInstances, setBaseInstances] = useState([]);
  const [overlayInstances, setOverlayInstances] = useState([]);
  const [sliceIndex, setSliceIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // labels: 실제 픽셀값 배열(예: 16383 등)
  const [labels, setLabels] = useState([]);
  // labelCfg: key는 실제 픽셀값, name은 표시용 L1/L2... (순번)
  const [labelCfg, setLabelCfg] = useState({});
  const [labelScanning, setLabelScanning] = useState(false);

  // Play 기능
  const [isPlaying, setIsPlaying] = useState(false);
  const playIntervalRef = useRef(null);

  const overlayMap = useMemo(() => {
    const m = new Map();
    overlayInstances.forEach((inst) => m.set(getBestInstanceNumber(inst), inst));
    return m;
  }, [overlayInstances]);

  const currentBase = baseInstances[sliceIndex] || null;

  const metaModel = useMemo(() => {
    if (!currentBase) return null;
    return { instNo: getBestInstanceNumber(currentBase) };
  }, [currentBase]);

  // cornerstone init + enable
  useEffect(() => {
    initCornerstone();
    const el = elementRef.current;
    if (!el) return;

    if (!enabledRef.current) {
      cornerstone.enable(el);
      enabledRef.current = true;
    }

    return () => {
      try {
        if (enabledRef.current) {
          cornerstone.disable(el);
          enabledRef.current = false;
        }
      } catch {}
    };
  }, []);

  // ResizeObserver: 항상 block에 맞게 fit + center
  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      try {
        cornerstone.resize(el, true);
        cornerstone.fitToWindow(el);

        const vp = cornerstone.getViewport(el);
        if (vp) {
          vp.translation = { x: 0, y: 0 };
          cornerstone.setViewport(el, vp);
        }
      } catch {}
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 백그라운드 프리로드 진행률 상태
  const [preloadProgress, setPreloadProgress] = useState({ loaded: 0, total: 0 });
  const preloadAbortRef = useRef(null);

  // Base Series 로딩 (overlaySeriesId 변경 시 영향 없음)
  useEffect(() => {
    let alive = true;

    // 이전 프리로드 작업 취소
    if (preloadAbortRef.current) {
      preloadAbortRef.current.abort = true;
    }
    const abortController = { abort: false };
    preloadAbortRef.current = abortController;

    async function loadBase() {
      setError("");
      setLoading(true);
      setPreloadProgress({ loaded: 0, total: 0 });

      setBaseInstances([]);
      setSliceIndex(0);

      // Base 변경 시에만 overlay 리셋
      setOverlayInstances([]);
      setLabels([]);
      setLabelCfg({});
      setLabelScanning(false);

      try {
        if (!baseSeriesId) {
          setLoading(false);
          return;
        }

        // 1. 인스턴스 목록 가져오기 (메타데이터만, 실제 이미지 아님)
        const base = await getInstances(baseSeriesId);
        const sortedBase = [...(base || [])].sort(
          (a, b) => getBestInstanceNumber(a) - getBestInstanceNumber(b)
        );

        if (!alive || abortController.abort) return;

        // 2. 첫 번째 인스턴스 즉시 표시를 위해 상태 설정
        setBaseInstances(sortedBase);
        setSliceIndex(0);
        setLoading(false); // 로딩 완료 (첫 슬라이스 표시 가능)

        // 3. 백그라운드 프리로드: 첫 번째 인스턴스 먼저, 그 다음 나머지 순차적으로
        if (sortedBase.length > 0) {
          setPreloadProgress({ loaded: 0, total: sortedBase.length });

          // 첫 번째 인스턴스 우선 프리로드 (현재 보는 슬라이스)
          const firstInst = sortedBase[0];
          const firstId = firstInst?.orthancId || firstInst?.id || firstInst?.OrthancId || firstInst?.ID;
          if (firstId) {
            try {
              const firstUrl = getInstanceFileUrl(firstId);
              await cornerstone.loadAndCacheImage(`wadouri:${firstUrl}`);
              if (!alive || abortController.abort) return;
              setPreloadProgress({ loaded: 1, total: sortedBase.length });
            } catch (e) {
              console.warn("First instance preload failed:", e);
            }
          }

          // 나머지 인스턴스 백그라운드 프리로드 (배치 처리)
          const BATCH_SIZE = 5; // 동시에 5개씩 로드
          for (let i = 1; i < sortedBase.length; i += BATCH_SIZE) {
            if (!alive || abortController.abort) return;

            const batch = sortedBase.slice(i, i + BATCH_SIZE);
            const promises = batch.map(async (inst) => {
              const id = inst?.orthancId || inst?.id || inst?.OrthancId || inst?.ID;
              if (!id) return;
              try {
                const url = getInstanceFileUrl(id);
                await cornerstone.loadAndCacheImage(`wadouri:${url}`);
              } catch (e) {
                // 개별 인스턴스 실패는 무시 (이미 캐시됐거나 네트워크 오류)
              }
            });

            await Promise.all(promises);

            if (!alive || abortController.abort) return;
            setPreloadProgress((prev) => ({
              ...prev,
              loaded: Math.min(i + BATCH_SIZE, sortedBase.length),
            }));
          }
        }
      } catch (e) {
        if (!alive || abortController.abort) return;
        setError(e?.message || String(e));
        setLoading(false);
      }
    }

    loadBase();
    return () => {
      alive = false;
      abortController.abort = true;
    };
  }, [baseSeriesId]); // ✅ baseSeriesId만 의존

  // Overlay Series 로딩 (별도 useEffect - Base 영향 없음)
  useEffect(() => {
    let alive = true;

    async function loadOverlay() {
      if (!overlaySeriesId) {
        setOverlayInstances([]);
        setLabels([]);
        setLabelCfg({});
        return;
      }

      try {
        const overlay = await getInstances(overlaySeriesId);
        const sortedOverlay = [...(overlay || [])].sort(
          (a, b) => getBestInstanceNumber(a) - getBestInstanceNumber(b)
        );

        if (!alive) return;
        setOverlayInstances(sortedOverlay);
      } catch (e) {
        if (!alive) return;
        console.warn("Overlay load failed:", e);
        setOverlayInstances([]);
      }
    }

    loadOverlay();
    return () => {
      alive = false;
    };
  }, [overlaySeriesId]); // ✅ overlaySeriesId만 의존

  // ✅ overlay 레이블 스캔: 전체 overlayInstances에서 픽셀값(>0) 수집
  // ✅ 표시명은 L1/L2/L3... (실제 값 16383 등은 내부키로만 사용)
  useEffect(() => {
    let alive = true;

    async function scanLabels() {
      if (!overlaySeriesId || !overlayInstances.length) return;

      setLabelScanning(true);
      try {
        const found = new Set();

        for (let i = 0; i < overlayInstances.length; i++) {
          if (!alive) return;

          const inst = overlayInstances[i];
          const ovOrthancId =
            inst?.orthancId || inst?.id || inst?.OrthancId || inst?.ID;
          if (!ovOrthancId) continue;

          const ovUrl = getInstanceFileUrl(ovOrthancId);
          const ovImageId = `wadouri:${ovUrl}`;
          const ovImage = await cornerstone.loadAndCacheImage(ovImageId);
          const px = ovImage.getPixelData();

          const stride = Math.max(1, Math.floor(px.length / 50000));
          for (let p = 0; p < px.length; p += stride) {
            const v = px[p];
            if (v > 0) found.add(v);
          }

          if (found.size >= 40) break;
        }

        const arr = Array.from(found)
          .filter((n) => Number.isFinite(n) && n > 0)
          .sort((a, b) => a - b);

        if (!alive) return;

        setLabels(arr);

        setLabelCfg((prev) => {
          const next = { ...prev };
          arr.forEach((lab, idx) => {
            const displayNo = idx + 1; // ✅ 표시용 순번
            const defaultColor = DEFAULT_COLORS[idx % DEFAULT_COLORS.length];

            if (!next[lab]) {
              next[lab] = {
                enabled: true,
                color: defaultColor,
                opacity: 0.35,
                name: `L${displayNo}`, // ✅ L1/L2...
              };
            } else {
              next[lab] = {
                ...next[lab],
                // ✅ name은 항상 순번 기반으로 덮어쓰기(라벨값 16383 방지)
                name: `L${displayNo}`,
                opacity: next[lab].opacity ?? 0.35,
                color: next[lab].color || defaultColor,
                enabled: next[lab].enabled ?? true,
              };
            }
          });
          return next;
        });
      } catch (e) {
        if (!alive) return;
        console.warn("label scan failed:", e);
      } finally {
        if (alive) setLabelScanning(false);
      }
    }

    scanLabels();
    return () => {
      alive = false;
    };
  }, [overlaySeriesId, overlayInstances]);

  // ✅ overlay 그리기 (원본 유지: viewport transform 반영)
  const drawOverlay = async (baseInst) => {
    const el = elementRef.current;
    if (!el) return;

    const overlayCanvas = el.parentElement?.querySelector(".overlayCanvas");
    if (!overlayCanvas) return;

    overlayCanvas.width = el.clientWidth;
    overlayCanvas.height = el.clientHeight;

    const ctx = overlayCanvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    if (!overlaySeriesId) return;

    const baseNo = getBestInstanceNumber(baseInst);
    const ovInst = overlayMap.get(baseNo);
    const ovOrthancId =
      ovInst?.orthancId || ovInst?.id || ovInst?.OrthancId || ovInst?.ID;
    if (!ovOrthancId) return;

    const ovUrl = getInstanceFileUrl(ovOrthancId);
    const ovImageId = `wadouri:${ovUrl}`;
    const ovImage = await cornerstone.loadAndCacheImage(ovImageId);

    const px = ovImage.getPixelData();
    const imageW = ovImage.columns;
    const imageH = ovImage.rows;

    const lut = new Map();
    Object.keys(labelCfg || {}).forEach((k) => {
      const lab = Number(k);
      const cfg = labelCfg[lab];
      if (!cfg || !cfg.enabled) {
        lut.set(lab, { r: 0, g: 0, b: 0, a: 0 });
        return;
      }
      const { r, g, b } = hexToRgb(cfg.color);
      const a = Math.max(0, Math.min(1, Number(cfg.opacity ?? 0.35)));
      lut.set(lab, { r, g, b, a });
    });

    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = imageW;
    maskCanvas.height = imageH;

    const mctx = maskCanvas.getContext("2d", { willReadFrequently: true });
    const imgData = mctx.createImageData(imageW, imageH);
    const out = imgData.data;

    for (let i = 0; i < px.length; i++) {
      const lab = px[i];
      if (!lab) continue;

      const cfg = lut.get(lab);
      if (!cfg || cfg.a <= 0) continue;

      const o = i * 4;
      out[o] = cfg.r;
      out[o + 1] = cfg.g;
      out[o + 2] = cfg.b;
      out[o + 3] = Math.round(cfg.a * 255);
    }
    mctx.putImageData(imgData, 0, 0);

    const vp = cornerstone.getViewport(el);
    const cw = overlayCanvas.width;
    const ch = overlayCanvas.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(
      cw / 2 + (vp?.translation?.x || 0),
      ch / 2 + (vp?.translation?.y || 0)
    );

    const rot = ((vp?.rotation || 0) * Math.PI) / 180;
    ctx.rotate(rot);

    const sx = (vp?.hflip ? -1 : 1) * (vp?.scale || 1);
    const sy = (vp?.vflip ? -1 : 1) * (vp?.scale || 1);
    ctx.scale(sx, sy);

    ctx.translate(-imageW / 2, -imageH / 2);
    ctx.drawImage(maskCanvas, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };

  // ✅ show base image + (VOI 적용) + overlay draw (원본 유지)
  useEffect(() => {
    const el = elementRef.current;
    if (!el || !enabledRef.current) return;

    let alive = true;

    async function show() {
      if (!baseInstances.length) return;

      const idx = Math.min(Math.max(sliceIndex, 0), baseInstances.length - 1);
      const baseInst = baseInstances[idx];
      if (!baseInst) return;

      const baseOrthancId =
        baseInst?.orthancId ||
        baseInst?.id ||
        baseInst?.OrthancId ||
        baseInst?.ID;
      if (!baseOrthancId) return;

      const baseUrl = getInstanceFileUrl(baseOrthancId);
      const baseImageId = `wadouri:${baseUrl}`;
      const image = await cornerstone.loadAndCacheImage(baseImageId);

      if (!alive) return;

      cornerstone.displayImage(el, image);

      const vp = cornerstone.getDefaultViewportForImage(el, image);
      vp.pixelReplication = false;

      // ✅ 이게 빠지면 흰색 과포화가 자주 발생함
      const wc = Number(firstOfMulti(getDicomTag(baseInst, "WindowCenter")));
      const ww = Number(firstOfMulti(getDicomTag(baseInst, "WindowWidth")));
      if (Number.isFinite(wc) && Number.isFinite(ww) && ww > 1) {
        vp.voi = { windowCenter: wc, windowWidth: ww };
      }

      vp.translation = { x: 0, y: 0 };
      cornerstone.setViewport(el, vp);

      const doFit = async () => {
        try {
          cornerstone.resize(el, true);

          // 컨테이너와 이미지 크기 기반으로 scale 계산 (contain 방식)
          const containerW = el.clientWidth;
          const containerH = el.clientHeight;
          const imageW = image.columns;
          const imageH = image.rows;

          // contain: 이미지 전체가 보이도록 scale 계산
          const scaleX = containerW / imageW;
          const scaleY = containerH / imageH;
          const fitScale = Math.min(scaleX, scaleY);

          const vp2 = cornerstone.getViewport(el);
          if (vp2) {
            vp2.scale = fitScale;
            vp2.translation = { x: 0, y: 0 };
            cornerstone.setViewport(el, vp2);
          }
        } catch {}
        try {
          await drawOverlay(baseInst);
        } catch {}
      };

      // ✅ 원본처럼 두 번 fit(초기 레이아웃 타이밍 대응)
      requestAnimationFrame(() => {
        doFit();
        requestAnimationFrame(() => doFit());
      });

      await drawOverlay(baseInst);
    }

    show().catch((e) => setError(e?.message || String(e)));

    return () => {
      alive = false;
    };
  }, [baseInstances, sliceIndex, overlaySeriesId, overlayMap, labelCfg]);

  // ✅ zoom/scroll 등 렌더링 이벤트마다 overlay follow
  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    const handler = async () => {
      try {
        const idx = Math.min(Math.max(sliceIndex, 0), baseInstances.length - 1);
        const baseInst = baseInstances[idx];
        if (!baseInst) return;
        await drawOverlay(baseInst);
      } catch {}
    };

    el.addEventListener("cornerstoneimagerendered", handler);
    return () => el.removeEventListener("cornerstoneimagerendered", handler);
  }, [baseInstances, sliceIndex, overlaySeriesId, overlayMap, labelCfg]);

  const maxIndex = Math.max(baseInstances.length - 1, 0);

  // Play/Stop 토글
  const togglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  // Play 기능: 200ms 간격으로 슬라이스 자동 이동
  useEffect(() => {
    if (isPlaying && baseInstances.length > 1) {
      playIntervalRef.current = setInterval(() => {
        setSliceIndex((prev) => {
          // 끝에 도달하면 처음으로 돌아감 (loop)
          if (prev >= maxIndex) {
            return 0;
          }
          return prev + 1;
        });
      }, 200);
    } else {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    };
  }, [isPlaying, baseInstances.length, maxIndex]);

  // Series 변경 시 Play 중지
  useEffect(() => {
    setIsPlaying(false);
  }, [baseSeriesId]);

  // 외부 Play 상태 동기화 (All Play 기능)
  useEffect(() => {
    setIsPlaying(externalPlaying);
  }, [externalPlaying]);

  // 외부 리셋 키 동기화 (Set 버튼: 인스턴스=0)
  const prevResetKeyRef = useRef(externalResetKey);
  useEffect(() => {
    // 초기 렌더링이 아닌 경우에만 리셋
    if (prevResetKeyRef.current !== externalResetKey) {
      prevResetKeyRef.current = externalResetKey;
      setSliceIndex(0);
    }
  }, [externalResetKey]);

  const setCfg = (lab, patch) => {
    setLabelCfg((prev) => ({
      ...prev,
      [lab]: { ...(prev[lab] || {}), ...patch },
    }));
  };

  return (
    <div className="viewerShell">
      <div className="viewerToolbar">
        <div className="toolLeft">
          <div className="toolBadge">
            {loading
              ? "Loading..."
              : baseSeriesId
              ? `Series: ${baseSeriesName || baseSeriesId}`
              : "No Series"}
          </div>

          {/* ✅ Overlay 정보 복구 */}
          {overlaySeriesId ? (
            <div className="toolBadge subtleBadge">
              Overlay: {overlaySeriesName || overlaySeriesId}
            </div>
          ) : null}

          {error ? <div className="toolError">{error}</div> : null}
        </div>

        <div className="toolRight">
          <div className="sliceInfo">
            Slice: {baseInstances.length ? sliceIndex + 1 : 0} /{" "}
            {baseInstances.length || 0}
            {/* 백그라운드 프리로드 진행률 */}
            {preloadProgress.total > 0 && preloadProgress.loaded < preloadProgress.total && (
              <span className="preloadProgress">
                ({Math.round((preloadProgress.loaded / preloadProgress.total) * 100)}% cached)
              </span>
            )}
          </div>

          <button
            className="btn"
            onClick={() => setSliceIndex((v) => Math.max(0, v - 1))}
            disabled={!baseInstances.length}
          >
            Prev
          </button>

          <button
            className="btn"
            onClick={() => setSliceIndex((v) => Math.min(maxIndex, v + 1))}
            disabled={!baseInstances.length}
          >
            Next
          </button>

          <button
            className={`btn btnPlay ${isPlaying ? "playing" : ""}`}
            onClick={togglePlay}
            disabled={!baseInstances.length || baseInstances.length <= 1}
            title={isPlaying ? "Stop (200ms)" : "Play (200ms)"}
          >
            {isPlaying ? "Stop" : "Play"}
          </button>

          {overlaySeriesId ? (
            <div className="segToolbar">
              <div className="segTitle">
                Seg
                {labelScanning ? (
                  <span className="segScanHint"> (scanning)</span>
                ) : null}
              </div>

              {(labels || []).slice(0, 3).map((lab, idx) => {
                const cfg = labelCfg[lab] || {
                  enabled: true,
                  color: DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
                  opacity: 0.35,
                  name: `L${idx + 1}`,
                };

                return (
                  <div className="segChip" key={lab} title={`Label ${cfg.name}`}>
                    <label className="segChk">
                      <input
                        type="checkbox"
                        checked={!!cfg.enabled}
                        onChange={(e) =>
                          setCfg(lab, { enabled: e.target.checked })
                        }
                      />
                      <span className="segName">{cfg.name}</span>
                    </label>

                    <input
                      className="segColor"
                      type="color"
                      value={cfg.color || "#42f58d"}
                      onChange={(e) => setCfg(lab, { color: e.target.value })}
                      title="Color"
                    />

                    <div className="segOpacity">
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={Number(cfg.opacity ?? 0.35)}
                        onChange={(e) =>
                          setCfg(lab, { opacity: Number(e.target.value) })
                        }
                        title="Opacity"
                      />
                      <span className="segOpVal">
                        {Math.round((cfg.opacity ?? 0.35) * 100)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <div className="viewerStage">
        <div className="cornerstoneHost" ref={elementRef} />
        <canvas className="overlayCanvas" />

        {metaModel ? (
          <div className="metaOverlay">
            {studyInstanceUID && (
              <div className="metaRow">
                <span className="metaKey metaGreen">Study</span>
                <span className="metaVal metaGreen">{studyInstanceUID}</span>
              </div>
            )}
            {baseSeriesName && (
              <div className="metaRow">
                <span className="metaKey metaGreen">Series</span>
                <span className="metaVal metaGreen">{baseSeriesName}</span>
              </div>
            )}
            <div className="metaRow">
              <span className="metaKey metaGreen">Instance</span>
              <span className="metaVal metaGreen">#{metaModel.instNo}</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="sliceBar">
        <input
          type="range"
          min={0}
          max={maxIndex}
          value={Math.min(sliceIndex, maxIndex)}
          onChange={(e) => setSliceIndex(Number(e.target.value))}
          disabled={!baseInstances.length}
        />
      </div>
    </div>
  );
}

