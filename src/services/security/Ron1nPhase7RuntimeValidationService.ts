import { Ron1nRuntimeTestService, type Ron1nRuntimeTestReport } from './Ron1nRuntimeTestService';

export type Phase7RuntimeValidation = {
  status: 'PASS' | 'FAIL';
  report: Ron1nRuntimeTestReport;
  checkedAt: string;
};

export class Ron1nPhase7RuntimeValidationService {
  static async run(): Promise<Phase7RuntimeValidation> {
    const report = await Ron1nRuntimeTestService.run();
    return { status: report.failed === 0 ? 'PASS' : 'FAIL', report, checkedAt: new Date().toISOString() };
  }
}
