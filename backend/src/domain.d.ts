export function minutes(time: string): number;
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean;
export function schedulesConflict(candidate: { weekday: number; startTime: string; endTime: string; teacherId?: string | null; classroomId?: string | null; groupId?: string | null }, existing: Array<{ weekday: number; startTime: string; endTime: string; teacherId?: string | null; classroomId?: string | null; groupId?: string | null }>): boolean;
export function maintenanceTransitionError(input: { from: string; to: string; role: string; evidenceCount: number; destination?: string; scheduledAt?: string; reopeningReason?: string }): string | null;
export function csvCell(value: unknown): string;
export function toCsv(rows: Array<Record<string, unknown>>, headers: Array<[string, string]>): string;
