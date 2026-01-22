// JSX 모듈 타입 선언 (TypeScript가 .jsx 파일을 인식하도록)
declare module '@/components/UploadSection' {
  const UploadSection: React.FC<any>;
  export default UploadSection;
}

declare module '@/components/PacsSelector' {
  const PacsSelector: React.FC<any>;
  export default PacsSelector;
}

declare module '@/components/ViewerSection' {
  const ViewerSection: React.FC<any>;
  export default ViewerSection;
}

// 상대 경로 import 지원
declare module '*/UploadSection' {
  const UploadSection: React.FC<any>;
  export default UploadSection;
}

declare module '*/PacsSelector' {
  const PacsSelector: React.FC<any>;
  export default PacsSelector;
}

declare module '*/ViewerSection' {
  const ViewerSection: React.FC<any>;
  export default ViewerSection;
}
