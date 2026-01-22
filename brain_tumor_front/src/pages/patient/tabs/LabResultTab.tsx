
interface Props {
  role: string;
}

export default function LabTab({ role }: Props) {
  const isLIS = role === 'LIS';

  return (
    <div className="lab-tab">

      <div className="lab-header">
        <h3>검사 결과</h3>
        {isLIS && (
          <button className="primary">
            검사 결과 업로드
          </button>
        )}
      </div>

      <table className="lab-table">
        <thead>
          <tr>
            <th>검사일</th>
            <th>검사명</th>
            <th>결과</th>
            <th>정상범위</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          <tr className="abnormal">
            <td>2024-01-12</td>
            <td>CBC</td>
            <td>12.1</td>
            <td>4.0 ~ 10.0</td>
            <td>▲ 높음</td>
          </tr>

          <tr>
            <td>2024-01-12</td>
            <td>CRP</td>
            <td>0.3</td>
            <td>&lt; 0.5</td>
            <td>정상</td>
          </tr>

          <tr className="abnormal">
            <td>2024-02-01</td>
            <td>Na</td>
            <td>132</td>
            <td>135 ~ 145</td>
            <td>▼ 낮음</td>
          </tr>
        </tbody>
      </table>

    </div>
  );
}
