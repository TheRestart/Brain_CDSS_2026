// src/api/endpoints.js
export const EP = {
  orthanc: {
    uploadPatient: "/orthanc/upload-patient/",
    patients: "/orthanc/patients/",
    studies: "/orthanc/studies/",
    series: "/orthanc/series/",
    instances: "/orthanc/instances/",
    instanceFile: (orthancId) => `/orthanc/instances/${orthancId}/file/`,
    instancePreview: (orthancId) => `/orthanc/instances/${orthancId}/preview/`,
    seriesThumbnail: (seriesId) => `/orthanc/series/${seriesId}/thumbnail/`,
    studyThumbnails: (studyId) => `/orthanc/studies/${studyId}/thumbnails/`,
    deletePatient: (patientId) => `/orthanc/patients/${patientId}/`,
    deleteStudy: (studyId) => `/orthanc/studies/${studyId}/`,
    deleteSeries: (seriesId) => `/orthanc/series/${seriesId}/`,
  },
};
