// Type declarations for endpoints.js
export interface OrthancEndpoints {
  uploadPatient: string;
  patients: string;
  studies: string;
  series: string;
  instances: string;
  instanceFile: (orthancId: string) => string;
  deletePatient: (patientId: string) => string;
  deleteStudy: (studyId: string) => string;
  deleteSeries: (seriesId: string) => string;
}

export interface Endpoints {
  orthanc: OrthancEndpoints;
}

export const EP: Endpoints;
