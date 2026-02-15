import type { Course, University } from '../types/index';

export const UNIVERSITIES: University[] = [
  { id: 'unsw', name: 'University of New South Wales', shortName: 'UNSW' },
  { id: 'usyd', name: 'University of Sydney', shortName: 'USYD' },
  { id: 'mq', name: 'Macquarie University', shortName: 'MQ' },
  { id: 'uow', name: 'University of Wollongong', shortName: 'UOW' },
  // { id: 'unimelb', name: 'University of Melbourne', shortName: 'UniMelb' },
  // { id: 'mit', name: 'Massachusetts Institute of Technology', shortName: 'MIT' },
];

export const COURSES: Course[] = [
  { id: '1', universityId: 'unsw', code: 'COMP9417', name: 'Machine Learning' },
  { id: '2', universityId: 'unsw', code: 'COMP9444', name: 'Deep Learning' },
  //   { id: '3', universityId: 'unsw', code: 'MATH1131', name: 'Mathematics 1A' },
  //   { id: '4', universityId: 'usyd', code: 'INFO1110', name: 'Introduction to Programming' },
  //   { id: '5', universityId: 'unimelb', code: 'MAST10006', name: 'Calculus 2' },
  //   { id: '6', universityId: 'mit', code: '6.036', name: 'Introduction to Machine Learning' },
];
