const test = require('node:test');
const assert = require('node:assert/strict');
const { overlaps, schedulesConflict, maintenanceTransitionError, csvCell, toCsv } = require('../src/domain.js');

test('schedule conflict uses half-open intervals and ignores other weekdays', () => {
  assert.equal(overlaps('09:00', '10:00', '10:00', '11:00'), false);
  assert.equal(schedulesConflict({ weekday: 2, startTime: '09:30', endTime: '10:30', classroomId: 'room-a' }, [
    { weekday: 2, startTime: '09:00', endTime: '10:00', classroomId: 'room-a' }
  ]), true);
  assert.equal(schedulesConflict({ weekday: 3, startTime: '09:30', endTime: '10:30', classroomId: 'room-a' }, [
    { weekday: 2, startTime: '09:00', endTime: '10:00', classroomId: 'room-a' }
  ]), false);
});

test('maintenance close requires evidence and follows allowed transitions', () => {
  assert.match(maintenanceTransitionError({ from: 'EN_EJECUCION', to: 'CERRADA', role: 'TECNICO_MANTENIMIENTO', evidenceCount: 0 }), /evidencia/i);
  assert.equal(maintenanceTransitionError({ from: 'EN_EJECUCION', to: 'CERRADA', role: 'TECNICO_MANTENIMIENTO', evidenceCount: 1 }), null);
  assert.match(maintenanceTransitionError({ from: 'REGISTRADA', to: 'CERRADA', role: 'JEFE_MANTENIMIENTO', evidenceCount: 1 }), /No se permite/);
  assert.equal(maintenanceTransitionError({ from: 'CERRADA', to: 'EN_REVISION', role: 'JEFE_MANTENIMIENTO', evidenceCount: 1, reopeningReason: 'Revisión posterior' }), null);
});

test('CSV cells quote formula-like and comma-containing values', () => {
  assert.equal(csvCell('=SUM(A1,A2)'), '"\'=SUM(A1,A2)"');
  assert.equal(toCsv([{ name: 'Arte, música' }], [['name', 'Nombre']]), '"Nombre"\r\n"Arte, música"');
});
