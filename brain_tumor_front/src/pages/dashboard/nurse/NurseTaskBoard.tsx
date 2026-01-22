// 오늘 해야할 간호 업무(Task 중심)
export default function NurseTaskBoard() {
  return (
    <section className="card task-board">
      <header className="card-header">
        <h3>오늘 간호 업무</h3>
      </header>

      <ul className="task-list">
        <TaskItem
          patient="김영희"
          task="수액 교체"
          time="10:30"
          status="대기"
        />
        <TaskItem
          patient="박민수"
          task="투약"
          time="11:00"
          status="진행중"
        />
        <TaskItem
          patient="이수진"
          task="활력징후 측정"
          time="11:30"
          status="완료"
        />
      </ul>
    </section>
  );
}

function TaskItem({
  patient,
  task,
  time,
  status,
}: {
  patient: string;
  task: string;
  time: string;
  status: '대기' | '진행중' | '완료';
}) {
  return (
    <li className={`task-item ${status}`}>
      <div className="task-main">
        <strong>{task}</strong>
        <span>{patient}</span>
      </div>
      <div className="task-meta">
        <span className="time">{time}</span>
        <span className={`badge ${status}`}>{status}</span>
      </div>
    </li>
  );
}
