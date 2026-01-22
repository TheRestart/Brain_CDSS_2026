export default function ComingSoon() {
  return (
    <div className="coming-soon">
      <h1>🚧 Coming Soon</h1>
      <p>현재 페이지는 준비 중입니다.</p>
    </div>
  );
}

export function ComingSoonPage({title} : {title : string}){
  return (
    <div className="coming-soon">
      <h1>🚧 Coming Soon</h1>
      <h2>{title} 준비중</h2>
      <p>현재 페이지는 준비 중입니다.</p>
    </div>
  )
}