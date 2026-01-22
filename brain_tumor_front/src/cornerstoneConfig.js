import * as cornerstone from "cornerstone-core";
import * as cornerstoneWADOImageLoader from "cornerstone-wado-image-loader";
import dicomParser from "dicom-parser";

// (선택) webWorker 사용하면 로딩이 부드러워짐
// import * as cornerstoneWebImageLoader from "cornerstone-web-image-loader"; // 필요시

export function initCornerstone() {
  // WADO Loader 외부 의존성 연결
  cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
  cornerstoneWADOImageLoader.external.dicomParser = dicomParser;

  // (권장) WebWorker 설정 - 브라우저 환경에서 DICOM 파싱/디코딩 부담 분산
  // 경로는 vite 번들링 방식에 따라 달라질 수 있음. 일단 최소 구성만 제공.
  cornerstoneWADOImageLoader.webWorkerManager.initialize({
    maxWebWorkers: Math.min(navigator.hardwareConcurrency || 4, 8),
    startWebWorkersOnDemand: true,
    webWorkerPath: "/cornerstoneWADOImageLoaderWebWorker.js", // 번들/정적경로에 맞춰 조정
    taskConfiguration: {
      decodeTask: {
        // 코덱 경로도 환경에 맞춰 조정 필요
        codecsPath: "/cornerstoneWADOImageLoaderCodecs.js",
      },
    },
  });

  return cornerstone;
}
