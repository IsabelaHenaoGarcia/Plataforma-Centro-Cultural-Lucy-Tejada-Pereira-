import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const password = process.env.SEED_PASSWORD || 'Demo-PGC-LT-2026!';
const roles = Object.values(Role);

async function main() {
  const passwordHash = await bcrypt.hash(password, 12);
  for (const role of roles) {
    const email = `${role.toLowerCase()}@demo.pgclt.local`;
    await prisma.user.upsert({ where: { email }, update: { passwordHash }, create: { name: role.replaceAll('_', ' '), email, role, passwordHash } });
  }
  const programs = [
    { name: 'Danza y movimiento', category: 'Danza', description: 'Exploración del cuerpo, el ritmo y la expresión colectiva.' },
    { name: 'Laboratorio de música', category: 'Música', description: 'Práctica y escucha para descubrir lenguajes musicales.' },
    { name: 'Teatro en comunidad', category: 'Teatro', description: 'Juego escénico, voz y creación compartida.' },
    { name: 'Taller de artes plásticas', category: 'Artes plásticas', description: 'Experimentación con materiales, imagen y forma.' }
  ];
  for (const p of programs) await prisma.program.upsert({ where: { name: p.name }, update: {}, create: p });
  const venue = await prisma.venue.upsert({ where: { name: 'Sede cultural — espacio de demostración' }, update: {}, create: { name: 'Sede cultural — espacio de demostración', address: 'Pereira, Risaralda' } });
  const classroom = await prisma.classroom.findFirst({ where: { name: 'Salón de creación', venueId: venue.id } }) ?? await prisma.classroom.create({ data: { name: 'Salón de creación', capacity: 18, venueId: venue.id } });
  const educator = await prisma.user.findUniqueOrThrow({ where: { email: 'educador@demo.pgclt.local' } });
  const program = await prisma.program.findUniqueOrThrow({ where: { name: programs[0].name } });
  const oldTeacher = await prisma.teacher.findFirst({ where: { email: 'educador@demo.pgclt.local' } });
  const teacher = oldTeacher ? await prisma.teacher.update({ where: { id: oldTeacher.id }, data: { userId: educator.id } }) : await prisma.teacher.create({ data: { name: educator.name, email: educator.email, specialty: 'Danza y movimiento', userId: educator.id } });
  const group = await prisma.group.findFirst({ where: { name: 'Danza — grupo de demostración', programId: program.id } }) ?? await prisma.group.create({ data: { name: 'Danza — grupo de demostración', programId: program.id, teacherId: teacher.id, classroomId: classroom.id, capacity: 18 } });
  const studentAccount = await prisma.user.findUniqueOrThrow({ where: { email: 'estudiante@demo.pgclt.local' } });
  const student = await prisma.student.upsert({ where: { documentNumber: 'DEMO-1001' }, update: { userId: studentAccount.id }, create: { firstName: 'Valentina', lastName: 'Ríos', documentType: 'TI', documentNumber: 'DEMO-1001', neighborhood: 'Centro', userId: studentAccount.id } });
  const guardianAccount = await prisma.user.findUniqueOrThrow({ where: { email: 'acudiente@demo.pgclt.local' } });
  const guardian = await prisma.guardian.upsert({ where: { documentNumber: 'DEMO-2001' }, update: { userId: guardianAccount.id }, create: { name: 'Camila Ríos', documentNumber: 'DEMO-2001', email: guardianAccount.email, userId: guardianAccount.id } });
  await prisma.studentGuardian.upsert({ where: { studentId_guardianId: { studentId: student.id, guardianId: guardian.id } }, update: { relationship: 'Acudiente de demostración' }, create: { studentId: student.id, guardianId: guardian.id, relationship: 'Acudiente de demostración' } });
  await prisma.enrollment.upsert({ where: { studentId_programId: { studentId: student.id, programId: program.id } }, update: {}, create: { studentId: student.id, programId: program.id, groupId: group.id, status: 'ACTIVE' } });
  const day = new Date(); day.setHours(0, 0, 0, 0);
  const session = await prisma.attendanceSession.upsert({ where: { groupId_date: { groupId: group.id, date: day } }, update: {}, create: { groupId: group.id, date: day, teacherId: educator.id } });
  await prisma.attendance.upsert({ where: { sessionId_studentId: { sessionId: session.id, studentId: student.id } }, update: {}, create: { sessionId: session.id, studentId: student.id, status: 'PRESENTE' } });
  const evaluation = await prisma.evaluation.findFirst({ where: { studentId: student.id, groupId: group.id, period: '2026 — muestra' } });
  if (!evaluation) await prisma.evaluation.create({ data: { studentId: student.id, groupId: group.id, educatorId: educator.id, period: '2026 — muestra', observations: 'Participa con curiosidad y explora nuevas posibilidades de movimiento.' } });
  await prisma.evaluationIndicator.upsert({ where: { name: 'Exploración creativa' }, update: {}, create: { name: 'Exploración creativa', description: 'Disposición a experimentar y proponer desde la práctica artística.' } });
  const maintenanceUser = await prisma.user.findUniqueOrThrow({ where: { email: 'jefe_mantenimiento@demo.pgclt.local' } });
  if (!(await prisma.maintenanceRequest.findFirst({ where: { location: 'Baños — muestra de demostración', venueId: venue.id } }))) {
    await prisma.maintenanceRequest.create({ data: { venueId: venue.id, location: 'Baños — muestra de demostración', type: 'PREVENTIVO', description: 'Revisión periódica de grifería y luminarias.', urgency: 'BAJA', requesterId: maintenanceUser.id, history: { create: { status: 'REGISTRADA', userId: maintenanceUser.id, note: 'Registro ficticio para demostración.' } } } });
  }
  console.log(`Seed listo. Contraseña de demostración: ${password}`);
}
main().finally(() => prisma.$disconnect());
