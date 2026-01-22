import { useSearchParams, useParams } from 'react-router-dom';
import SummaryTab from './tabs/SummaryTab';
import ImagingTab from './tabs/ImagingTab';
import LabResultTab from './tabs/LabResultTab';
import ExaminationTab from './tabs/ExaminationTab';
import TreatmentTab from './tabs/TreatmentTab';
import FollowUpTab from './tabs/FollowUpTab';

type Props = {
  role: string;
  patientName?: string;
  patientNumber?: string;
};

export default function PatientDetailContent({ role, patientName, patientNumber }: Props) {
  const isDoctor = role === 'DOCTOR';
  const isNurse = role === 'NURSE';
  const isSystemManager = role === 'SYSTEMMANAGER';
  const canViewTreatment = isDoctor || isNurse || isSystemManager;
  const canViewExamination = isDoctor || isNurse || isSystemManager;

  const { patientId } = useParams();
  const [params] = useSearchParams();
  const tab = params.get('tab') ?? 'summary';

  if (tab === 'summary') return <SummaryTab role={role} patientId={patientId ? Number(patientId) : undefined} patientName={patientName} patientNumber={patientNumber} />;
  if (tab === 'imaging') return <ImagingTab role={role} patientId={patientId ? Number(patientId) : undefined} />;
  if (tab === 'lab') return <LabResultTab role={role} />;
  if (tab === 'examination')
    return canViewExamination ? <ExaminationTab role={role} patientId={patientId ? Number(patientId) : undefined} /> : null;
  if (tab === 'treatment')
    return canViewTreatment ? <TreatmentTab role={role} /> : null;
  if (tab === 'followup')
    return canViewTreatment ? <FollowUpTab role={role} /> : null;

  return <div>잘못된 접근</div>;
}
