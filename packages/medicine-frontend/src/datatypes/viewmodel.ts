export interface HistoryEntry {
  timestamp: number;

  patientId: string;
  patientFullName: string;

  text: string;
}

export interface LabTest {
  displayableName: string;
  name: string;
}

export interface ViewModel {
  patientHistory: HistoryEntry[];

  availableTests: LabTest[];
}
