// Type declarations for orthancApi.js

export interface UploadPatientParams {
  patientId: string;
  patientName?: string;
  studyDescription?: string;
  studyInstanceUID?: string;
  ocsId?: number;
  files: File[];
  seriesPaths: string[];
}

export interface UploadResult {
  success: boolean;
  patient_id?: string;
  study_id?: string;
  study_uid?: string;
  orthanc_study_id?: string;
  series_count?: number;
  instance_count?: number;
  message?: string;
}

export interface OrthancPatient {
  orthancId: string;
  patientId: string;
  patientName?: string;
  studiesCount?: number;
}

export interface OrthancStudy {
  orthancId: string;
  studyInstanceUID?: string;
  studyDescription?: string;
  studyDate?: string;
  seriesCount?: number;
  instancesCount?: number;
}

export interface OrthancSeries {
  orthancId: string;
  seriesInstanceUID?: string;
  seriesType?: string;
  modality?: string;
  description?: string;
  instancesCount?: number;
}

export interface OrthancInstance {
  orthancId: string;
  sopInstanceUID?: string;
  instanceNumber?: number;
}

export function uploadPatientFolder(params: UploadPatientParams): Promise<UploadResult>;
export function getPatients(): Promise<OrthancPatient[]>;
export function getStudies(patientOrthancId: string): Promise<OrthancStudy[]>;
export function getSeries(studyOrthancId: string): Promise<OrthancSeries[]>;
export function getInstances(seriesOrthancId: string): Promise<OrthancInstance[]>;
export function getInstanceFileUrl(orthancId: string): string;
export function getSeriesThumbnailUrl(seriesOrthancId: string): string;
export function getSeriesPreviewBase64(seriesOrthancId: string): Promise<string | null>;
export function deleteStudy(studyOrthancId: string): Promise<{ success: boolean; message?: string }>;
