export interface Subject {
  id: string;
  code: string;
  name: string;
  academicYear: string;
  semester: number;
  department?: string;
  firstExaminerId?: string;
  firstExaminerName?: string;
  lecturerId?: string;
  lecturerName?: string;
  lecturerIds?: string[];
  lecturers?: Array<{ id: string; name: string; email?: string }>;
  moderatorId?: string;
  moderatorName?: string;
}

export interface Paper {
  id: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  department?: string;
  firstExaminerId?: string;
  firstExaminerName?: string;
  lecturerId: string;
  lecturerName: string;
  lecturerIds?: string[];
  lecturers?: Array<{ id: string; name: string; email?: string }>;
  moderatorId?: string;
  moderatorName?: string;
  academicYear: string;
  semester: number;
  status: 'draft' | 'submitted' | 'under_moderation' | 'revision_required' | 'finalized';
  paperUrl?: string;
  paperWordUrl?: string;
  markingSchemeUrl?: string;
  markingSchemeWordUrl?: string;
  draftPaperUrl?: string;
  draftPaperWordUrl?: string;
  draftMarkingSchemeUrl?: string;
  draftMarkingSchemeWordUrl?: string;
  hasPasswordProtection?: boolean;
  sentToHod?: boolean;
  sentToHodAt?: string;
  hasReport?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ModerationReport {
  id: string;
  paperId: string;
  moderatorId: string;
  moderatorName: string;
  remarks: {
    standardAppropriate: boolean;
    coversMainContents: boolean;
    assessesLearningOutcomes: boolean;
    clearAndUnambiguous: boolean;
    appropriateTimeAllocation: boolean;
    appropriateMarkAllocation: boolean;
    appropriateNumberingAndFormatting: boolean;
    clearFigures: boolean;
    accurateModelAnswers: boolean;
    structuredModelAnswers: boolean;
  };
  additionalComments: string;
  followUpActions: string[];
  moderatorSignatureUrl?: string;
  lecturerSignatureUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AcademicSettings {
  currentYear: string;
  currentSemester: number;
}
