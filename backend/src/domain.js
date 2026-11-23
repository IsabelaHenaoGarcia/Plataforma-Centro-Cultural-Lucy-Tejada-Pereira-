const maintenanceTransitions = {
  REGISTRADA: ['EN_REVISION'],
  EN_REVISION: ['ASIGNADA', 'ESCALADA'],
  ASIGNADA: ['EN_EJECUCION', 'ESCALADA'],
  ESCALADA: ['EN_REVISION', 'ASIGNADA'],
  EN_EJECUCION: ['CERRADA', 'EN_REVISION'],
  CERRADA: []
};

function minutes(time) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Hora inválida; usa HH:mm.');
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return minutes(aStart) < minutes(bEnd) && minutes(bStart) < minutes(aEnd);
}

function schedulesConflict(candidate, existing) {
  return existing.some(item => item.weekday === candidate.weekday &&
    overlaps(candidate.startTime, candidate.endTime, item.startTime, item.endTime) &&
    ((candidate.teacherId && candidate.teacherId === item.teacherId) ||
      (candidate.classroomId && candidate.classroomId === item.classroomId) ||
      (candidate.groupId && candidate.groupId === item.groupId)));
}

function maintenanceTransitionError({ from, to, role, evidenceCount, destination, scheduledAt, reopeningReason }) {
  if (from === 'CERRADA') return role === 'JEFE_MANTENIMIENTO' && reopeningReason?.trim() ? null : 'Una solicitud cerrada requiere reapertura justificada por jefatura.';
  if (!(maintenanceTransitions[from] || []).includes(to)) return `No se permite el cambio de ${from} a ${to}.`;
  if (['ASIGNADA', 'ESCALADA'].includes(to) && !['SUPER_ADMIN', 'JEFE_MANTENIMIENTO'].includes(role)) return 'Solo jefatura puede asignar o escalar.';
  if (to === 'ESCALADA' && (!destination?.trim() || !scheduledAt)) return 'La escalación requiere dependencia destino y fecha programada.';
  if (to === 'CERRADA' && evidenceCount < 1) return 'Agrega evidencia fotográfica antes del cierre.';
  return null;
}

function csvCell(value) {
  let text = value == null ? '' : String(value);
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(rows, headers) {
  return [headers.map(([, label]) => csvCell(label)).join(','), ...rows.map(row => headers.map(([key]) => csvCell(row[key])).join(','))].join('\r\n');
}

module.exports = { minutes, overlaps, schedulesConflict, maintenanceTransitionError, csvCell, toCsv };
