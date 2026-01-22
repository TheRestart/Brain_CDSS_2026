import { NavLink } from 'react-router-dom';

type Props = {
  role: string;
};

export default function PatientDetailTabs( {role} : Props ) {
  
  const isSystemManager = role === 'SYSTEMMANAGER';
  const tabs = [
    { key: 'summary', label: '요약', roles: ['DOCTOR', 'NURSE', 'PATIENT'] },
    { key: 'imaging', label: '영상', roles: ['DOCTOR', 'NURSE', 'RIS'] },
    { key: 'lab', label: '검사 결과', roles: ['DOCTOR', 'NURSE', 'LIS'] },
    { key: 'examination', label: '진찰', roles: ['DOCTOR', 'NURSE'] },
    { key: 'treatment', label: '치료 계획', roles: ['DOCTOR', 'NURSE'] },
    { key: 'followup', label: '경과 추적', roles: ['DOCTOR', 'NURSE'] },
  ];

  return (
    <div className="tabs">
      {tabs
        .filter(tab => isSystemManager ||tab.roles.includes(role))
        .map(tab => (
          <NavLink
            key={tab.key}
            to={`?tab=${tab.key}`}
            className={({ isActive }) =>
              isActive ? 'tab active' : 'tab'
            }
          >
            {tab.label}
          </NavLink>
        ))}
    </div>
  );
}
