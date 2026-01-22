export const ROLE_THEME = {
  SYSTEMMANAGER:{
    bg: 'linear-gradient(90deg, #eca115ff, #ecb44bff)',
    border: '#eca115ff',
    color: '#ffffff',
    icon: 'fa-user-gear',
  },
  ADMIN:
  {
    bg: 'linear-gradient(90deg, #1e3a8a, #1e40af)',
    border: '#1e3a8a',
    color: '#ffffff',
    icon: 'fa-user-shield',
  },

  DOCTOR: {
    bg: 'linear-gradient(90deg, #065f46, #047857)',
    border: '#065f46',
    color: '#ffffff',
    icon: 'fa-user-doctor',
  },
  NURSE: {
    bg: 'linear-gradient(90deg, #0369a1, #0284c7)',
    border: '#0369a1',
    color: '#ffffff',
    icon: 'fa-user-nurse',
  },
  RIS: {
    bg: 'linear-gradient(90deg, #7c3aed, #a275f0ff)',
    border: '#7c3aed',
    color: '#ffffff',
    icon: 'fa-x-ray',
  },
  LIS: {
    bg: 'linear-gradient(90deg, #ea580c, #e7793eff)',
    border: '#ea580c',
    color: '#ffffff',
    icon: 'fa-flask',
  },
  PATIENT :{
    bg: 'linear-gradient(90deg, #374151, #556279ff)',
    border: '#374151',
    color: '#ffffff',
    icon: 'fa-flask',
  },
  EXTERNAL: {
    bg: 'linear-gradient(90deg, #6b7280, #9ca3af)',
    border: '#6b7280',
    color: '#ffffff',
    icon: 'fa-hospital',
  }
} as const;