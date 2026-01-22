import MySummary from './MySummary';
import MyVisitList from  './MyVisitList';
import MyExamList from './MyExamList';

/* 환자 전용 - 진료 확인 페이지 */
export default function MyCarePage() {
  return (
    <div className="page my-care">
      <MySummary /> 
      <MyVisitList />
      <MyExamList />
    </div>
  );
}
