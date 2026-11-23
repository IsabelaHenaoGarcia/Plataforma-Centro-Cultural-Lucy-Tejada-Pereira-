import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '../.env') });
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import nodemailer from 'nodemailer';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { PrismaClient, Role, EnrollmentStatus, AttendanceStatus, MaintenanceStatus, Prisma } from '@prisma/client';
import { maintenanceTransitionError, schedulesConflict, toCsv } from './domain.js';

const prisma = new PrismaClient();
const app = express();
const port = Number(process.env.API_PORT || 4000);
const secret = process.env.JWT_SECRET || '';
if (secret.length < 32) throw new Error('JWT_SECRET debe tener al menos 32 caracteres.');

app.use(helmet());
const allowedOrigins = new Set((process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map(origin => origin.trim()));
app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)), credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth/recovery', rateLimit({ windowMs: 60 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false }));

type AuthRequest = express.Request & { user?: { id: string; role: Role; email: string } };
const authenticate: express.RequestHandler = (req, res, next) => {
  const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) { res.status(401).json({ error: 'Inicia sesión para continuar.' }); return; }
  try { (req as AuthRequest).user = jwt.verify(token, secret) as AuthRequest['user']; next(); }
  catch { res.status(401).json({ error: 'La sesión venció. Vuelve a iniciar sesión.' }); }
};
const allow = (...roles: Role[]): express.RequestHandler => (req, res, next) => {
  if (!roles.includes((req as AuthRequest).user!.role)) { res.status(403).json({ error: 'No tienes permiso para esta acción.' }); return; }
  next();
};
const asyncRoute = (fn: (req: AuthRequest, res: express.Response) => Promise<unknown>): express.RequestHandler => (req, res, next) => {
  Promise.resolve(fn(req as AuthRequest, res)).catch(next);
};
const staff: Role[] = [Role.SUPER_ADMIN, Role.ADMINISTRATIVO, Role.COORDINADOR];
const management: Role[] = [Role.SUPER_ADMIN, Role.ADMINISTRATIVO];
const maintenanceLeads: Role[] = [Role.SUPER_ADMIN, Role.JEFE_MANTENIMIENTO];
const encryptionKey = createHash('sha256').update(process.env.MFA_ENCRYPTION_KEY || secret).digest();
const uploadDirectory = path.resolve(__dirname, '../uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({ destination: uploadDirectory, filename: (_req, file, cb) => cb(null, `${randomBytes(20).toString('hex')}${path.extname(file.originalname).toLowerCase()}`) }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
});

function hashToken(value: string) { return createHash('sha256').update(value).digest('hex'); }
function detectImageMime(filePath: string) {
  const data = Buffer.alloc(12); const fd = fs.openSync(filePath, 'r');
  try { fs.readSync(fd, data, 0, 12, 0); } finally { fs.closeSync(fd); }
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  if (data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}
function encryptSecret(value: string) {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}
function decryptSecret(value: string) {
  const [iv, tag, payload] = value.split('.'); const decipher = createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(payload, 'base64url')), decipher.final()]).toString('utf8');
}
function base32Decode(value: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = ''; const clean = value.toUpperCase().replace(/=+$/, '');
  for (const char of clean) { const index = alphabet.indexOf(char); if (index < 0) throw new Error('Invalid MFA secret'); bits += index.toString(2).padStart(5, '0'); }
  const bytes: number[] = []; for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
function base32Encode(value: Buffer) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = ''; let out = '';
  for (const byte of value) bits += byte.toString(2).padStart(8, '0');
  for (let i = 0; i < bits.length; i += 5) out += alphabet[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)];
  return out;
}
function totp(secretValue: string, at = Date.now()) {
  const counter = Math.floor(at / 30_000); const message = Buffer.alloc(8); message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', base32Decode(secretValue)).update(message).digest(); const offset = digest[digest.length - 1] & 0x0f;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}
function verifyTotp(secretValue: string | null, code: string | undefined) {
  if (!secretValue || !code || !/^\d{6}$/.test(code)) return false;
  const key = decryptSecret(secretValue); const actual = Buffer.from(code); const now = Date.now();
  return [-1, 0, 1].some(delta => { const expected = Buffer.from(totp(key, now + delta * 30_000)); return actual.length === expected.length && timingSafeEqual(actual, expected); });
}
function cookieValue(req: express.Request, name: string) {
  const pair = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : undefined;
}
function csrfValid(req: express.Request) {
  const cookie = cookieValue(req, 'pgclt_csrf'); const header = req.header('x-csrf-token');
  return Boolean(cookie && header && cookie.length === header.length && timingSafeEqual(Buffer.from(cookie), Buffer.from(header)));
}
function setAuthCookies(res: express.Response, refresh: string, csrf: string) {
  const secure = process.env.NODE_ENV === 'production';
  res.cookie('pgclt_refresh', refresh, { httpOnly: true, secure, sameSite: 'strict', path: '/api/auth', maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.cookie('pgclt_csrf', csrf, { httpOnly: false, secure, sameSite: 'strict', path: '/', maxAge: 30 * 24 * 60 * 60 * 1000 });
}
async function rotateRefreshToken(userId: string, res: express.Response) {
  const raw = randomBytes(48).toString('base64url'); const csrf = randomBytes(24).toString('base64url');
  await prisma.refreshToken.create({ data: { userId, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } });
  setAuthCookies(res, raw, csrf);
}
function accessToken(user: { id: string; role: Role; email: string }) {
  return jwt.sign({ id: user.id, role: user.role, email: user.email }, secret, { expiresIn: '15m' });
}
const mailer = process.env.SMTP_HOST && process.env.SMTP_FROM ? nodemailer.createTransport({
  host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: Number(process.env.SMTP_PORT) === 465,
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined
}) : null;
async function sendMail(to: string, subject: string, text: string) {
  if (mailer) { await mailer.sendMail({ from: process.env.SMTP_FROM, to, subject, text }); return 'sent'; }
  if (process.env.NODE_ENV !== 'production') console.info(JSON.stringify({ kind: 'mail-preview', to, subject, text }));
  return 'preview';
}
async function notifyUser(userId: string | null | undefined, title: string, body: string) {
  if (!userId) return;
  await prisma.notification.create({ data: { userId, title, body } });
}
async function notifyUserOnce(userId: string, eventKey: string, title: string, body: string) {
  try {
    await prisma.notification.create({ data: { userId, eventKey, title, body } });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (user?.email) await sendMail(user.email, title, body).catch(error => console.error('No se pudo enviar el recordatorio:', error));
  } catch (error) {
    if (!(typeof error === 'object' && error && 'code' in error && error.code === 'P2002')) throw error;
  }
}
// Avisa una sola vez, a las 18:00 (hora de Pereira), sobre clases del día siguiente.
async function sendNextDayClassReminders() {
  const nowInPereira = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  if (nowInPereira.getHours() !== 18) return;
  const tomorrowWeekday = (nowInPereira.getDay() + 1) % 7;
  const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const enrollments = await prisma.enrollment.findMany({
    where: { status: EnrollmentStatus.ACTIVE, group: { active: true, schedules: { some: { weekday: tomorrowWeekday } } } },
    include: {
      student: { include: { user: true, guardians: { include: { guardian: { include: { user: true } } } } } },
      group: { include: { schedules: { where: { weekday: tomorrowWeekday } }, classroom: true, program: true } }
    }
  });
  for (const enrollment of enrollments) {
    if (!enrollment.group) continue;
    if (!enrollment.group.schedules.length) continue;
    const location = enrollment.group.classroom?.name ? `, salón ${enrollment.group.classroom.name}` : '';
    const times = enrollment.group.schedules.map(schedule => `${schedule.startTime}–${schedule.endTime}`).join(' y ');
    const message = `Mañana ${dateKey} tienes ${enrollment.group.program.name} de ${times}${location}.`;
    const recipients = [enrollment.student.user?.id, ...enrollment.student.guardians.map(link => link.guardian.user?.id)].filter((id): id is string => Boolean(id));
    for (const recipientId of new Set(recipients)) await notifyUserOnce(recipientId, `class-${dateKey}-${enrollment.studentId}-${enrollment.groupId}`, 'Recordatorio de clase para mañana', message);
  }
}
async function notifyEnrollmentParties(studentId: string, title: string, body: string) {
  const student = await prisma.student.findUnique({ where: { id: studentId }, include: { user: true, guardians: { include: { guardian: true } } } });
  if (!student) return;
  const recipients = [...new Set([student.userId, ...student.guardians.map(link => link.guardian.userId)].filter((id): id is string => Boolean(id)))];
  await Promise.all(recipients.map(id => notifyUser(id, title, body)));
  const emails = [...new Set([student.email, ...student.guardians.map(link => link.guardian.email)].filter((email): email is string => Boolean(email)))];
  await Promise.all(emails.map(email => sendMail(email, title, body).catch(error => { console.error('No se pudo enviar el aviso por correo:', error); })));
}
async function notifyRoleUsers(roles: Role[], title: string, body: string) {
  const users = await prisma.user.findMany({ where: { role: { in: roles }, active: true }, select: { id: true } });
  await Promise.all(users.map(user => notifyUser(user.id, title, body)));
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'PGC-LT API' }));
app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const input = z.object({ email: z.string().email(), password: z.string().min(1), mfaCode: z.string().optional() }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Revisa el correo y la contraseña.' }); return; }
  const user = await prisma.user.findUnique({ where: { email: input.data.email.toLowerCase() } });
  if (!user || !user.active || !(await bcrypt.compare(input.data.password, user.passwordHash))) {
    await prisma.loginAttempt.create({ data: { email: input.data.email.toLowerCase(), success: false, ipAddress: req.ip } });
    res.status(401).json({ error: 'Correo o contraseña incorrectos.' }); return;
  }
  if (user.mfaEnabled) {
    let validMfaCode = false;
    try { validMfaCode = verifyTotp(user.mfaSecret, input.data.mfaCode); }
    catch (error) {
      console.error('No se pudo descifrar el secreto de autenticación de dos pasos.', error);
      res.status(503).json({ error: 'No se pudo verificar la autenticación de dos pasos. La clave MFA del servidor pudo cambiar; solicita al administrador que restablezca ese método de acceso.' });
      return;
    }
    if (!validMfaCode) {
      await prisma.loginAttempt.create({ data: { userId: user.id, email: user.email, success: false, ipAddress: req.ip } });
      res.status(401).json({ error: 'El código de autenticación no es válido.' }); return;
    }
  }
  await prisma.loginAttempt.create({ data: { userId: user.id, email: user.email, success: true, ipAddress: req.ip } });
  await prisma.auditLog.create({ data: { userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id } });
  await rotateRefreshToken(user.id, res);
  res.json({ token: accessToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role, mustChangePassword: user.mustChangePassword } });
}));
app.get('/api/auth/me', authenticate, asyncRoute(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { id: true, name: true, email: true, role: true, mustChangePassword: true, mfaEnabled: true } });
  res.json({ user });
}));
app.post('/api/auth/refresh', asyncRoute(async (req, res) => {
  if (!csrfValid(req)) { res.status(403).json({ error: 'La validación de seguridad expiró. Inicia sesión de nuevo.' }); return; }
  const raw = cookieValue(req, 'pgclt_refresh');
  if (!raw) { res.status(401).json({ error: 'La sesión venció.' }); return; }
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(raw) }, include: { user: true } });
  if (!stored || stored.revokedAt || stored.expiresAt <= new Date() || !stored.user.active) { res.status(401).json({ error: 'La sesión venció.' }); return; }
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
  await rotateRefreshToken(stored.userId, res);
  res.json({ token: accessToken(stored.user), user: { id: stored.user.id, name: stored.user.name, email: stored.user.email, role: stored.user.role, mustChangePassword: stored.user.mustChangePassword } });
}));
app.post('/api/auth/logout', authenticate, asyncRoute(async (req, res) => {
  if (!csrfValid(req)) { res.status(403).json({ error: 'Validación CSRF inválida.' }); return; }
  const raw = cookieValue(req, 'pgclt_refresh');
  if (raw) await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(raw), revokedAt: null }, data: { revokedAt: new Date() } });
  res.clearCookie('pgclt_refresh', { path: '/api/auth', sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
  res.clearCookie('pgclt_csrf', { path: '/', sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
  res.status(204).end();
}));
app.post('/api/auth/change-password', authenticate, asyncRoute(async (req, res) => {
  const input = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(12).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/) }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'La nueva contraseña debe tener 12 caracteres e incluir mayúscula, minúscula y número.' }); return; }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  if (!(await bcrypt.compare(input.data.currentPassword, user.passwordHash))) { res.status(400).json({ error: 'La contraseña actual no coincide.' }); return; }
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(input.data.newPassword, 12), mustChangePassword: false } });
  await prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  await prisma.auditLog.create({ data: { userId: user.id, action: 'PASSWORD_CHANGE', entity: 'User', entityId: user.id } });
  res.status(204).end();
}));
app.post('/api/auth/recovery/request', asyncRoute(async (req, res) => {
  const input = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Ingresa un correo válido.' }); return; }
  const user = await prisma.user.findUnique({ where: { email: input.data.email.toLowerCase() } });
  if (user?.active) {
    const raw = randomBytes(32).toString('base64url');
    await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + 30 * 60 * 1000) } });
    const link = `${process.env.FRONTEND_URL?.split(',')[0] || 'http://localhost:5173'}/recuperar?token=${encodeURIComponent(raw)}`;
    const delivery = await sendMail(user.email, 'Recuperación de acceso PGC-LT', `Solicitaste cambiar tu contraseña. Usa este enlace antes de 30 minutos: ${link}`);
    await prisma.auditLog.create({ data: { userId: user.id, action: `PASSWORD_RECOVERY_${delivery.toUpperCase()}`, entity: 'User', entityId: user.id } });
  }
  res.json({ message: 'Si la cuenta existe, enviaremos las instrucciones de recuperación.' });
}));
app.post('/api/auth/recovery/complete', asyncRoute(async (req, res) => {
  const input = z.object({ token: z.string().min(20), newPassword: z.string().min(12).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/) }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Token o contraseña no válidos.' }); return; }
  const token = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(input.data.token) } });
  if (!token || token.usedAt || token.expiresAt <= new Date()) { res.status(400).json({ error: 'El enlace expiró o ya fue utilizado.' }); return; }
  await prisma.$transaction([
    prisma.user.update({ where: { id: token.userId }, data: { passwordHash: await bcrypt.hash(input.data.newPassword, 12), mustChangePassword: false } }),
    prisma.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
    prisma.refreshToken.updateMany({ where: { userId: token.userId, revokedAt: null }, data: { revokedAt: new Date() } })
  ]);
  await prisma.auditLog.create({ data: { userId: token.userId, action: 'PASSWORD_RECOVERED', entity: 'User', entityId: token.userId } });
  res.status(204).end();
}));
app.post('/api/auth/mfa/setup', authenticate, asyncRoute(async (req, res) => {
  const secretValue = base32Encode(randomBytes(20));
  await prisma.user.update({ where: { id: req.user!.id }, data: { mfaSecret: encryptSecret(secretValue), mfaEnabled: false } });
  const label = encodeURIComponent(req.user!.email); const issuer = encodeURIComponent('PGC-LT');
  res.json({ secret: secretValue, otpauthUrl: `otpauth://totp/${issuer}:${label}?secret=${secretValue}&issuer=${issuer}&digits=6&period=30` });
}));
app.post('/api/auth/mfa/enable', authenticate, asyncRoute(async (req, res) => {
  const code = z.object({ code: z.string().regex(/^\d{6}$/) }).safeParse(req.body);
  if (!code.success) { res.status(400).json({ error: 'Ingresa un código de seis dígitos.' }); return; }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  if (!verifyTotp(user.mfaSecret, code.data.code)) { res.status(400).json({ error: 'Código no válido.' }); return; }
  await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: true } });
  await prisma.auditLog.create({ data: { userId: user.id, action: 'MFA_ENABLED', entity: 'User', entityId: user.id } });
  res.json({ enabled: true });
}));
app.post('/api/auth/mfa/disable', authenticate, asyncRoute(async (req, res) => {
  const code = z.object({ code: z.string().regex(/^\d{6}$/) }).safeParse(req.body);
  if (!code.success) { res.status(400).json({ error: 'Ingresa un código de seis dígitos.' }); return; }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  if (!verifyTotp(user.mfaSecret, code.data.code)) { res.status(400).json({ error: 'Código no válido.' }); return; }
  await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: false, mfaSecret: null } });
  await prisma.auditLog.create({ data: { userId: user.id, action: 'MFA_DISABLED', entity: 'User', entityId: user.id } });
  res.json({ enabled: false });
}));

app.get('/api/dashboard', authenticate, allow(...staff), asyncRoute(async (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : undefined;
  const to = req.query.to ? new Date(String(req.query.to)) : undefined;
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) { res.status(400).json({ error: 'Rango de fechas inválido.' }); return; }
  const programId = req.query.programId ? String(req.query.programId) : undefined;
  const groupId = req.query.groupId ? String(req.query.groupId) : undefined;
  const enrollmentWhere: Prisma.EnrollmentWhereInput = { status: EnrollmentStatus.ACTIVE, ...(programId ? { programId } : {}), ...(groupId ? { groupId } : {}), ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) };
  const studentWhere: Prisma.StudentWhereInput = { active: true, ...(programId || groupId ? { enrollments: { some: { status: EnrollmentStatus.ACTIVE, ...(programId ? { programId } : {}), ...(groupId ? { groupId } : {}) } } } : {}) };
  const attendanceWhere: Prisma.AttendanceWhereInput = { session: { ...(groupId ? { groupId } : {}), ...(programId ? { group: { programId } } : {}), ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) } };
  const [students, enrollments, withdrawn, evaluations, programs, teachers, groups, maintenance, attendanceCount, presentCount, attendanceByStatus, neighborhoods, programCounts, enrollmentDates] = await Promise.all([
    prisma.student.count({ where: studentWhere }),
    prisma.enrollment.count({ where: enrollmentWhere }),
    prisma.enrollment.count({ where: { ...enrollmentWhere, status: EnrollmentStatus.WITHDRAWN } }),
    prisma.evaluation.count({ where: { ...(programId ? { group: { programId } } : {}), ...(groupId ? { groupId } : {}), ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) } }),
    prisma.program.count({ where: { active: true } }),
    prisma.teacher.count({ where: { active: true } }),
    prisma.group.count({ where: { active: true, ...(programId ? { programId } : {}), ...(groupId ? { id: groupId } : {}) } }),
    prisma.maintenanceRequest.count({ where: { status: { not: MaintenanceStatus.CERRADA } } }),
    prisma.attendance.count({ where: attendanceWhere }),
    prisma.attendance.count({ where: { ...attendanceWhere, status: AttendanceStatus.PRESENTE } }),
    prisma.attendance.groupBy({ by: ['status'], where: attendanceWhere, _count: { _all: true } }),
    prisma.student.groupBy({ by: ['neighborhood'], where: studentWhere, _count: { _all: true }, orderBy: { _count: { neighborhood: 'desc' } }, take: 8 }),
    prisma.program.findMany({ where: { active: true, ...(programId ? { id: programId } : {}) }, select: { id: true, name: true, _count: { select: { groups: { where: groupId ? { id: groupId } : undefined }, enrollments: { where: enrollmentWhere } } } }, take: 8 }),
    prisma.enrollment.findMany({ where: enrollmentWhere, select: { createdAt: true }, orderBy: { createdAt: 'asc' }, take: 10000 })
  ]);
  const trend = enrollmentDates.reduce<Record<string, number>>((acc, item) => { const month = item.createdAt.toISOString().slice(0, 7); acc[month] = (acc[month] || 0) + 1; return acc; }, {});
  res.json({ metrics: { students, enrollments, withdrawn, evaluations, programs, teachers, groups, maintenance, attendanceRate: attendanceCount ? Math.round((presentCount / attendanceCount) * 100) : null }, byProgram: programCounts, byNeighborhood: neighborhoods.map(item => ({ name: item.neighborhood || 'Sin dato', total: item._count._all })), attendanceByStatus: attendanceByStatus.map(item => ({ status: item.status, total: item._count._all })), enrollmentTrend: Object.entries(trend).map(([month, total]) => ({ month, total })) });
}));

app.get('/api/programs', asyncRoute(async (_req, res) => {
  const programs = await prisma.program.findMany({ where: { active: true }, include: { _count: { select: { groups: true, enrollments: true } } }, orderBy: { name: 'asc' } });
  res.json(programs);
}));
// Los programas archivados solo son visibles para personal autorizado.
app.get('/api/programs/archived', authenticate, allow(...staff), asyncRoute(async (_req, res) => {
  const programs = await prisma.program.findMany({ where: { active: false }, include: { _count: { select: { groups: true, enrollments: true } } }, orderBy: { name: 'asc' } });
  res.json(programs);
}));
app.get('/api/venues', authenticate, asyncRoute(async (_req, res) => {
  res.json(await prisma.venue.findMany({ include: { classrooms: true }, orderBy: { name: 'asc' } }));
}));
app.post('/api/programs', authenticate, allow(...staff), asyncRoute(async (req, res) => {
  const input = z.object({ name: z.string().min(2), category: z.string().min(2), description: z.string().max(1000).optional(), capacity: z.number().int().positive().optional() }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Completa nombre y categoría. El cupo debe ser mayor que cero.' }); return; }
  const program = await prisma.program.create({ data: input.data });
  await prisma.auditLog.create({ data: { userId: req.user!.id, action: 'CREATE', entity: 'Program', entityId: program.id } });
  res.status(201).json(program);
}));
app.patch('/api/programs/:id', authenticate, allow(Role.SUPER_ADMIN, Role.ADMINISTRATIVO, Role.COORDINADOR), asyncRoute(async (req, res) => {
  const input = z.object({ name: z.string().min(2).optional(), category: z.string().min(2).optional(), description: z.string().max(1000).optional(), capacity: z.number().int().positive().optional(), active: z.boolean().optional() }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Datos de programa inválidos.' }); return; }
  const program = await prisma.program.update({ where: { id: req.params.id }, data: input.data });
  await prisma.auditLog.create({ data: { userId: req.user!.id, action: 'UPDATE', entity: 'Program', entityId: program.id } });
  res.json(program);
}));
app.get('/api/programs/:id', asyncRoute(async (req, res) => {
  const program = await prisma.program.findUniqueOrThrow({ where: { id: req.params.id }, include: { requirements: true, groups: { where: { active: true }, include: { schedules: true, classroom: { include: { venue: true } }, teacher: true, _count: { select: { students: true } } } }, _count: { select: { enrollments: true } } } });
  if (!program.active) { res.status(404).json({ error: 'Programa no disponible.' }); return; }
  res.json(program);
}));
app.post('/api/programs/:id/requirements', authenticate, allow(...staff), asyncRoute(async (req, res) => {
  const input = z.object({ description: z.string().min(4).max(500) }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Describe el requisito.' }); return; }
  res.status(201).json(await prisma.programRequirement.create({ data: { ...input.data, programId: req.params.id } }));
}));

app.get('/api/students', authenticate, allow(...staff), asyncRoute(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1); const take = 20;
  const q = String(req.query.q || '');
  const where = q ? { active: true, OR: [{ firstName: { contains: q, mode: 'insensitive' as const } }, { lastName: { contains: q, mode: 'insensitive' as const } }, { documentNumber: { contains: q } }] } : { active: true };
  const [items, total] = await Promise.all([prisma.student.findMany({ where, skip: (page - 1) * take, take, orderBy: { lastName: 'asc' } }), prisma.student.count({ where })]);
  res.json({ items, page, total, pages: Math.ceil(total / take) });
}));
app.post('/api/students', authenticate, allow(Role.SUPER_ADMIN, Role.ADMINISTRATIVO), asyncRoute(async (req, res) => {
  const input = z.object({ firstName: z.string().min(2), lastName: z.string().min(2), documentType: z.string().min(2), documentNumber: z.string().min(4), gender: z.string().max(40).optional(), email: z.string().email().optional().or(z.literal('')), phone: z.string().optional(), birthDate: z.string().optional(), userId: z.string().uuid().optional() }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Completa los datos requeridos del estudiante.' }); return; }
  const d = input.data;
  if (d.userId && !(await prisma.user.findFirst({ where: { id: d.userId, role: Role.ESTUDIANTE, active: true } }))) { res.status(400).json({ error: 'La cuenta vinculada debe ser un estudiante activo.' }); return; }
  const student = await prisma.student.create({ data: { ...d, email: d.email || null, birthDate: d.birthDate ? new Date(d.birthDate) : null } });
  await prisma.auditLog.create({ data: { userId: req.user!.id, action: 'CREATE', entity: 'Student', entityId: student.id } });
  res.status(201).json(student);
}));
app.get('/api/students/:id', authenticate, allow(...staff), asyncRoute(async (req, res) => {
  const student = await prisma.student.findUniqueOrThrow({ where: { id: req.params.id }, include: { guardians: { include: { guardian: true } }, enrollments: { include: { program: true, group: true } } } });
  res.json(student);
}));
app.patch('/api/students/:id', authenticate, allow(...management), asyncRoute(async (req, res) => {
  const input = z.object({ firstName: z.string().min(2).optional(), lastName: z.string().min(2).optional(), documentType: z.string().min(2).optional(), documentNumber: z.string().min(4).optional(), gender: z.string().max(40).nullable().optional(), email: z.string().email().nullable().optional(), phone: z.string().max(40).nullable().optional(), address: z.string().max(240).nullable().optional(), neighborhood: z.string().max(120).nullable().optional(), originCity: z.string().max(120).nullable().optional(), birthDate: z.string().nullable().optional(), userId: z.string().uuid().nullable().optional(), active: z.boolean().optional() }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Datos de estudiante inválidos.' }); return; }
  const { birthDate, ...rest } = input.data;
  const student = await prisma.student.update({ where: { id: req.params.id }, data: { ...rest, ...(birthDate !== undefined ? { birthDate: birthDate ? new Date(birthDate) : null } : {}) } });
  await prisma.auditLog.create({ data: { userId: req.user!.id, action: 'UPDATE', entity: 'Student', entityId: student.id } });
  res.json(student);
}));
app.delete('/api/students/:id', authenticate, allow(...management), asyncRoute(async (req, res) => {
  const student = await prisma.student.update({ where: { id: req.params.id }, data: { active: false } });
  await prisma.auditLog.create({ data: { userId: req.user!.id, action: 'DEACTIVATE', entity: 'Student', entityId: student.id } });
  res.status(204).end();
}));

app.get('/api/users', authenticate, allow(Role.SUPER_ADMIN), asyncRoute(async (req, res) => {
  const q = String(req.query.q || ''); const role = req.query.role && Object.values(Role).includes(String(req.query.role) as Role) ? String(req.query.role) as Role : undefined;
  const users = await prisma.user.findMany({ where: { ...(role ? { role } : {}), ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] } : {}) }, select: { id: true, name: true, email: true, role: true, active: true, mfaEnabled: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 100 });
  res.json(users);
}));
app.post('/api/users', authenticate, allow(Role.SUPER_ADMIN), asyncRoute(async (req, res) => {
  const input = z.object({ name: z.string().min(2).max(100), email: z.string().email(), role: z.nativeEnum(Role), password: z.string().min(12).optional() }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Nombre, correo, rol y una contraseña válida son obligatorios.' }); return; }
  const temporaryPassword = input.data.password || randomBytes(12).toString('base64url');
  const user = await prisma.user.create({ data: { name: input.data.name, email: input.data.email.toLowerCase(), role: input.data.role, passwordHash: await bcrypt.hash(temporaryPassword, 12), mustChangePassword: true }, select: { id: true, name: true, email: true, role: true, active: true } });
  await prisma.auditLog.create({ data: { userId: req.user!.id, action: 'CREATE', entity: 'User', entityId: user.id } });
  res.status(201).json({ ...user, temporaryPassword });
}));
app.get('/api/users/candidates', authenticate, allow(...management), asyncRoute(async (req, res) => {
  const parsed = z.enum(['EDUCADOR','ESTUDIANTE','ACUDIENTE','TECNICO_MANTENIMIENTO']).safeParse(String(req.query.role || ''));
  if (!parsed.success) { res.status(400).json({ error: 'Rol de cuenta inválido.' }); return; }
  const noProfile = parsed.data === 'EDUCADOR' ? { teacherProfile: null } : parsed.data === 'ESTUDIANTE' ? { studentProfile: null } : parsed.data === 'ACUDIENTE' ? { guardianProfile: null } : {};
  res.json(await prisma.user.findMany({ where: { role: parsed.data, active: true, ...noProfile }, select: { id: true, name: true, email: true }, orderBy: { name: 'asc' }, take: 200 }));
}));
app.patch('/api/users/:id', authenticate, allow(Role.SUPER_ADMIN), asyncRoute(async (req, res) => {
  const input = z.object({ name: z.string().min(2).max(100).optional(), email: z.string().email().optional(), role: z.nativeEnum(Role).optional(), active: z.boolean().optional() }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Datos de usuario inválidos.' }); return; }
  if (req.params.id === req.user!.id && input.data.active === false) { res.status(400).json({ error: 'No puedes desactivar tu propia cuenta.' }); return; }
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { ...input.data, ...(input.data.email ? { email: input.data.email.toLowerCase() } : {}) }, select: { id: true, name: true, email: true, role: true, active: true } });
  await prisma.auditLog.create({ data: { userId: req.user!.id, action: 'UPDATE', entity: 'User', entityId: user.id } });
  res.json(user);
}));

app.get('/api/teachers', authenticate, allow(...staff, Role.EDUCADOR), asyncRoute(async (_req, res) => res.json(await prisma.teacher.findMany({ where: { active: true }, include: { groups: { include: { program: true } } }, orderBy: { name: 'asc' } }))));
app.post('/api/teachers', authenticate, allow(...management), asyncRoute(async (req, res) => {
  const input = z.object({ name: z.string().min(2), email: z.string().email().optional(), phone: z.string().optional(), specialty: z.string().min(2), userId: z.string().uuid().optional() }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Completa nombre y especialidad del educador.' }); return; }
  if (input.data.userId && !(await prisma.user.findFirst({ where: { id: input.data.userId, role: Role.EDUCADOR, active: true } }))) { res.status(400).json({ error: 'La cuenta vinculada debe ser un educador activo.' }); return; }
  const teacher = await prisma.teacher.create({ data: input.data });
  await prisma.auditLog.create({ data: { userId: req.user!.id, action: 'CREATE', entity: 'Teacher', entityId: teacher.id } });
  res.status(201).json(teacher);
}));
app.patch('/api/teachers/:id', authenticate, allow(...management), asyncRoute(async (req, res) => {
  const input = z.object({ name: z.string().min(2).optional(), email: z.string().email().nullable().optional(), phone: z.string().nullable().optional(), specialty: z.string().min(2).optional(), userId: z.string().uuid().nullable().optional(), active: z.boolean().optional() }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Datos de educador inválidos.' }); return; }
  const teacher = await prisma.teacher.update({ where: { id: req.params.id }, data: input.data }); res.json(teacher);
}));

async function ensureScheduleAvailability(client: PrismaClient | Prisma.TransactionClient, groupId: string | undefined, teacherId: string | null, classroomId: string | null, schedules: Array<{ weekday: number; startTime: string; endTime: string }>) {
  const proposed: Array<{ weekday: number; startTime: string; endTime: string; teacherId: string | null; classroomId: string | null; groupId: string }> = [];
  for (const item of schedules) {
    if (item.weekday < 0 || item.weekday > 6 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.endTime) || item.startTime >= item.endTime) throw new Error('HORARIO_INVALIDO');
    const candidate = { ...item, teacherId, classroomId, groupId: groupId || '__new_group__' };
    if (schedulesConflict(candidate, proposed)) throw new Error('CONFLICTO_HORARIO');
    const existing = await client.schedule.findMany({ where: { weekday: item.weekday, ...(groupId ? { groupId: { not: groupId } } : {}), group: { active: true } }, include: { group: { select: { id: true, teacherId: true, classroomId: true } } } });
    const comparable = existing.map(row => ({ weekday: row.weekday, startTime: row.startTime, endTime: row.endTime, teacherId: row.group.teacherId, classroomId: row.group.classroomId, groupId: row.group.id }));
    if (schedulesConflict(candidate, comparable)) throw new Error('CONFLICTO_HORARIO');
    proposed.push(candidate);
  }
}
const scheduleSchema = z.array(z.object({ weekday: z.number().int().min(0).max(6), startTime: z.string(), endTime: z.string() })).max(14);
app.post('/api/groups', authenticate, allow(...staff), asyncRoute(async (req, res) => {
  const input = z.object({ name: z.string().min(2), programId: z.string().uuid(), teacherId: z.string().uuid().nullable().optional(), classroomId: z.string().uuid().nullable().optional(), capacity: z.number().int().positive().optional(), schedules: scheduleSchema.default([]) }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Revisa los datos y horarios del grupo.' }); return; }
  const group = await prisma.$transaction(async tx => {
    await ensureScheduleAvailability(tx, undefined, input.data.teacherId || null, input.data.classroomId || null, input.data.schedules);
    return tx.group.create({ data: { name: input.data.name, programId: input.data.programId, teacherId: input.data.teacherId, classroomId: input.data.classroomId, capacity: input.data.capacity, schedules: { create: input.data.schedules } }, include: { schedules: true, program: true, teacher: true, classroom: true } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await prisma.auditLog.create({ data: { userId: req.user!.id, action: 'CREATE', entity: 'Group', entityId: group.id } });
  res.status(201).json(group);
}));
app.patch('/api/groups/:id', authenticate, allow(...staff), asyncRoute(async (req, res) => {
  const input = z.object({ name: z.string().min(2).optional(), programId: z.string().uuid().optional(), teacherId: z.string().uuid().nullable().optional(), classroomId: z.string().uuid().nullable().optional(), capacity: z.number().int().positive().nullable().optional(), active: z.boolean().optional(), schedules: scheduleSchema.optional() }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Datos de grupo inválidos.' }); return; }
  const current = await prisma.group.findUniqueOrThrow({ where: { id: req.params.id } });
  const teacherId = input.data.teacherId === undefined ? current.teacherId : input.data.teacherId;
  const classroomId = input.data.classroomId === undefined ? current.classroomId : input.data.classroomId;
  const { schedules, ...data } = input.data;
  const group = await prisma.$transaction(async tx => {
    if (schedules) await ensureScheduleAvailability(tx, current.id, teacherId, classroomId, schedules);
    if (schedules) await tx.schedule.deleteMany({ where: { groupId: current.id } });
    return tx.group.update({ where: { id: current.id }, data: { ...data, ...(schedules ? { schedules: { create: schedules } } : {}) }, include: { schedules: true, program: true, teacher: true, classroom: true } });
  });
  await prisma.auditLog.create({ data: { userId: req.user!.id, action: 'UPDATE', entity: 'Group', entityId: group.id } });
  if (schedules) {
    const members = await prisma.enrollment.findMany({ where: { groupId: group.id, status: EnrollmentStatus.ACTIVE }, select: { studentId: true } });
    await Promise.all(members.map(member => notifyEnrollmentParties(member.studentId, 'Horario actualizado', `El horario del grupo ${group.name} cambió. Consulta tu espacio para ver el nuevo horario.`)));
  }
  res.json(group);
}));
app.get('/api/groups/:id/roster', authenticate, allow(...staff, Role.EDUCADOR), asyncRoute(async (req, res) => {
  const group = await prisma.group.findUniqueOrThrow({ where: { id: req.params.id }, include: { teacher: true } });
  if (req.user!.role === Role.EDUCADOR && group.teacher?.userId !== req.user!.id) { res.status(403).json({ error: 'Este grupo no está asignado a tu perfil.' }); return; }
  res.json(await prisma.enrollment.findMany({ where: { groupId: group.id, status: EnrollmentStatus.ACTIVE }, include: { student: true }, orderBy: { student: { lastName: 'asc' } } }));
}));
app.post('/api/venues', authenticate, allow(...management), asyncRoute(async (req, res) => {
  const input = z.object({ name: z.string().min(2), address: z.string().max(200).optional() }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Nombre de escenario requerido.' }); return; }
  res.status(201).json(await prisma.venue.create({ data: input.data }));
}));
app.post('/api/classrooms', authenticate, allow(...management), asyncRoute(async (req, res) => {
  const input = z.object({ name: z.string().min(2), venueId: z.string().uuid(), capacity: z.number().int().positive().optional() }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Completa salón, escenario y capacidad válida.' }); return; }
  res.status(201).json(await prisma.classroom.create({ data: input.data, include: { venue: true } }));
}));
app.get('/api/classrooms', authenticate, asyncRoute(async (_req, res) => res.json(await prisma.classroom.findMany({ include: { venue: true }, orderBy: { name: 'asc' } }))));
app.patch('/api/venues/:id', authenticate, allow(...management), asyncRoute(async (req, res) => {
  const input = z.object({ name: z.string().min(2).optional(), address: z.string().max(200).nullable().optional() }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Datos de escenario inválidos.' }); return; }
  res.json(await prisma.venue.update({ where: { id: req.params.id }, data: input.data }));
}));
app.patch('/api/classrooms/:id', authenticate, allow(...management), asyncRoute(async (req, res) => {
  const input = z.object({ name: z.string().min(2).optional(), venueId: z.string().uuid().optional(), capacity: z.number().int().positive().nullable().optional() }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Datos de salón inválidos.' }); return; }
  res.json(await prisma.classroom.update({ where: { id: req.params.id }, data: input.data, include: { venue: true } }));
}));
app.patch('/api/groups/:id/active', authenticate, allow(...management), asyncRoute(async (req, res) => {
  const input = z.object({ active: z.boolean() }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Estado inválido.' }); return; }
  res.json(await prisma.group.update({ where: { id: req.params.id }, data: { active: input.data.active } }));
}));
app.get('/api/maintenance/technicians', authenticate, allow(...maintenanceLeads), asyncRoute(async (_req, res) => {
  res.json(await prisma.user.findMany({ where: { role: Role.TECNICO_MANTENIMIENTO, active: true }, select: { id: true, name: true, email: true }, orderBy: { name: 'asc' } }));
}));

app.post('/api/enrollments', authenticate, allow(Role.SUPER_ADMIN, Role.ADMINISTRATIVO, Role.COORDINADOR), asyncRoute(async (req, res) => {
  const input = z.object({ studentId: z.string().uuid(), programId: z.string().uuid(), groupId: z.string().uuid().optional() }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Selecciona estudiante y programa.' }); return; }
  const result = await prisma.$transaction(async tx => {
    const program = await tx.program.findUniqueOrThrow({ where: { id: input.data.programId } });
    if (program.capacity) {
      const active = await tx.enrollment.count({ where: { programId: program.id, status: EnrollmentStatus.ACTIVE } });
      if (active >= program.capacity) throw new Error('CUPOS_COMPLETOS');
    }
    if (input.data.groupId) {
      const group = await tx.group.findUniqueOrThrow({ where: { id: input.data.groupId } });
      if (group.programId !== program.id) throw new Error('GRUPO_NO_COINCIDE');
      if (group.capacity && await tx.enrollment.count({ where: { groupId: group.id, status: EnrollmentStatus.ACTIVE } }) >= group.capacity) throw new Error('GRUPO_LLENO');
    }
    return tx.enrollment.create({ data: { studentId: input.data.studentId, programId: input.data.programId, groupId: input.data.groupId, status: EnrollmentStatus.PENDING } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await prisma.auditLog.create({ data: { userId: req.user!.id, action: 'CREATE', entity: 'Enrollment', entityId: result.id } });
  await notifyEnrollmentParties(result.studentId, 'Inscripción recibida', 'Tu solicitud está pendiente de revisión administrativa.');
  res.status(201).json(result);
}));
app.get('/api/enrollments', authenticate, allow(...staff), asyncRoute(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1); const take = 25;
  const status = req.query.status && Object.values(EnrollmentStatus).includes(String(req.query.status) as EnrollmentStatus) ? String(req.query.status) as EnrollmentStatus : undefined;
  const where = { ...(status ? { status } : {}), ...(req.query.programId ? { programId: String(req.query.programId) } : {}), ...(req.query.groupId ? { groupId: String(req.query.groupId) } : {}) };
  const [items, total] = await Promise.all([prisma.enrollment.findMany({ where, include: { student: true, program: true, group: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * take, take }), prisma.enrollment.count({ where })]);
  res.json({ items, page, total, pages: Math.ceil(total / take) });
}));
app.patch('/api/enrollments/:id/status', authenticate, allow(...staff), asyncRoute(async (req, res) => {
  const input = z.object({ status: z.nativeEnum(EnrollmentStatus), groupId: z.string().uuid().nullable().optional(), reason: z.string().max(500).optional() }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Estado o grupo inválidos.' }); return; }
  const enrollment = await prisma.enrollment.findUniqueOrThrow({ where: { id: req.params.id } });
  const updated = await prisma.$transaction(async tx => {
    const program = await tx.program.findUniqueOrThrow({ where: { id: enrollment.programId } });
    const groupId = input.data.groupId === undefined ? enrollment.groupId : input.data.groupId;
    if (input.data.status === EnrollmentStatus.ACTIVE) {
      const programCount = await tx.enrollment.count({ where: { programId: program.id, status: EnrollmentStatus.ACTIVE, id: { not: enrollment.id } } });
      if (program.capacity && programCount >= program.capacity) throw new Error('CUPOS_COMPLETOS');
      if (groupId) {
        const group = await tx.group.findUniqueOrThrow({ where: { id: groupId } });
        if (group.programId !== program.id) throw new Error('GRUPO_NO_COINCIDE');
        const groupCount = await tx.enrollment.count({ where: { groupId: group.id, status: EnrollmentStatus.ACTIVE, id: { not: enrollment.id } } });
        if (group.capacity && groupCount >= group.capacity) throw new Error('GRUPO_LLENO');
      }
    }
    return tx.enrollment.update({ where: { id: enrollment.id }, data: { status: input.data.status, groupId }, include: { student: true, program: true, group: true } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await prisma.auditLog.create({ data: { userId: req.user!.id, action: `ENROLLMENT_${updated.status}`, entity: 'Enrollment', entityId: updated.id } });
  const message = input.data.status === EnrollmentStatus.ACTIVE ? `Tu matrícula en ${updated.program.name} fue aprobada.` : input.data.status === EnrollmentStatus.REJECTED ? `Tu solicitud para ${updated.program.name} fue rechazada.${input.data.reason ? ` Motivo: ${input.data.reason}` : ''}` : `El estado de tu matrícula cambió a ${updated.status}.`;
  await notifyEnrollmentParties(updated.studentId, 'Actualización de matrícula', message);
  res.json(updated);
}));
app.get('/api/me/profile', authenticate, asyncRoute(async (req, res) => {
  if (req.user!.role === Role.ESTUDIANTE) {
    const student = await prisma.student.findUnique({ where: { userId: req.user!.id }, include: { enrollments: { include: { program: true, group: { include: { schedules: true, teacher: true, classroom: true } } } }, attendance: { include: { session: { include: { group: true } } }, orderBy: { session: { date: 'desc' } }, take: 50 }, evaluations: { include: { group: true }, orderBy: { createdAt: 'desc' } }, consents: { orderBy: { createdAt: 'desc' }, take: 20 } } });
    res.json({ type: 'student', profile: student }); return;
  }
  if (req.user!.role === Role.ACUDIENTE) {
    const guardian = await prisma.guardian.findUnique({
      where: { userId: req.user!.id },
      include: {
        students: {
          include: {
            student: {
              include: {
                enrollments: { include: { program: true, group: { include: { schedules: true, teacher: true, classroom: true } } } },
                attendance: { include: { session: true }, orderBy: { session: { date: 'desc' } }, take: 30 },
                evaluations: { include: { group: true }, orderBy: { createdAt: 'desc' }, take: 10 },
                consents: { orderBy: { createdAt: 'desc' }, take: 20 },
              },
            },
          },
        },
      },
    });
    res.json({ type: 'guardian', profile: guardian }); return;
  }
  res.json({ type: 'staff', profile: await prisma.user.findUnique({ where: { id: req.user!.id }, select: { id: true, name: true, email: true, role: true, mustChangePassword: true, mfaEnabled: true } }) });
}));
app.patch('/api/me/profile', authenticate, asyncRoute(async (req, res) => {
  if (req.user!.role === Role.ESTUDIANTE) {
    const input = z.object({ email: z.string().email().nullable().optional(), phone: z.string().max(40).nullable().optional(), address: z.string().max(240).nullable().optional(), neighborhood: z.string().max(120).nullable().optional() }).safeParse(req.body);
    if (!input.success) { res.status(400).json({ error: 'Revisa tus datos de contacto.' }); return; }
    const profile = await prisma.student.update({ where: { userId: req.user!.id }, data: input.data }); res.json(profile); return;
  }
  if (req.user!.role === Role.ACUDIENTE) {
    const input = z.object({ email: z.string().email().nullable().optional(), phone: z.string().max(40).nullable().optional() }).safeParse(req.body);
    if (!input.success) { res.status(400).json({ error: 'Revisa tus datos de contacto.' }); return; }
    const profile = await prisma.guardian.update({ where: { userId: req.user!.id }, data: input.data }); res.json(profile); return;
  }
  res.status(403).json({ error: 'El perfil institucional lo administra el equipo autorizado.' });
}));
app.post('/api/my/enrollments', authenticate, allow(Role.ESTUDIANTE), asyncRoute(async (req, res) => {
  const input = z.object({ programId: z.string().uuid(), groupId: z.string().uuid().optional(), consent: z.literal(true) }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Selecciona un programa y acepta el aviso de privacidad.' }); return; }
  const student = await prisma.student.findUniqueOrThrow({ where: { userId: req.user!.id } });
  const created = await prisma.$transaction(async tx => {
    const program = await tx.program.findUniqueOrThrow({ where: { id: input.data.programId } });
    if (!program.active) throw new Error('PROGRAMA_INACTIVO');
    if (program.capacity && await tx.enrollment.count({ where: { programId: program.id, status: EnrollmentStatus.ACTIVE } }) >= program.capacity) throw new Error('CUPOS_COMPLETOS');
    if (input.data.groupId) {
      const group = await tx.group.findUniqueOrThrow({ where: { id: input.data.groupId } });
      if (group.programId !== program.id || !group.active) throw new Error('GRUPO_NO_COINCIDE');
      if (group.capacity && await tx.enrollment.count({ where: { groupId: group.id, status: EnrollmentStatus.ACTIVE } }) >= group.capacity) throw new Error('GRUPO_LLENO');
    }
    const enrollment = await tx.enrollment.create({ data: { studentId: student.id, programId: program.id, groupId: input.data.groupId, status: EnrollmentStatus.PENDING } });
    const consent = await tx.consentRecord.create({ data: { studentId: student.id, subjectName: student.firstName + ' ' + student.lastName, purpose: 'Autorización del titular para inscripción y gestión académica; aviso de privacidad vigente consultado antes de enviar la solicitud.', consentedAt: new Date() } });
    await tx.auditLog.create({ data: { userId: req.user!.id, action: 'CONSENT_RECORD', entity: 'ConsentRecord', entityId: consent.id } });
    return enrollment;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await notifyEnrollmentParties(student.id, 'Inscripción recibida', 'Tu solicitud está pendiente de revisión administrativa.');
  res.status(201).json(created);
}));
app.post('/api/my/guardian-enrollments', authenticate, allow(Role.ACUDIENTE), asyncRoute(async (req, res) => {
  const input = z.object({ studentId: z.string().uuid(), programId: z.string().uuid(), groupId: z.string().uuid().optional(), consent: z.literal(true) }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Selecciona estudiante y programa, y acepta el aviso de privacidad.' }); return; }
  const link = await prisma.studentGuardian.findFirst({ where: { guardian: { userId: req.user!.id }, studentId: input.data.studentId } });
  if (!link) { res.status(403).json({ error: 'No representas a ese estudiante.' }); return; }
  const created = await prisma.$transaction(async tx => {
    const program = await tx.program.findUniqueOrThrow({ where: { id: input.data.programId } });
    if (!program.active) throw new Error('PROGRAMA_INACTIVO');
    if (program.capacity && await tx.enrollment.count({ where: { programId: program.id, status: EnrollmentStatus.ACTIVE } }) >= program.capacity) throw new Error('CUPOS_COMPLETOS');
    if (input.data.groupId) {
      const group = await tx.group.findUniqueOrThrow({ where: { id: input.data.groupId } });
      if (!group.active || group.programId !== program.id) throw new Error('GRUPO_NO_COINCIDE');
      if (group.capacity && await tx.enrollment.count({ where: { groupId: group.id, status: EnrollmentStatus.ACTIVE } }) >= group.capacity) throw new Error('GRUPO_LLENO');
    }
    return tx.enrollment.create({ data: { studentId: input.data.studentId, programId: input.data.programId, groupId: input.data.groupId, status: EnrollmentStatus.PENDING } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  const consentStudent = await prisma.student.findUniqueOrThrow({ where: { id: created.studentId }, select: { firstName: true, lastName: true } });
  const consentGuardian = await prisma.guardian.findUniqueOrThrow({ where: { id: link.guardianId }, select: { name: true } });
  const consentRecord = await prisma.consentRecord.create({ data: { studentId: created.studentId, subjectName: consentGuardian.name, purpose: `Autorización del acudiente para tratar los datos de ${consentStudent.firstName} ${consentStudent.lastName} con fines de inscripción y gestión académica; aviso de privacidad consultado antes del envío.`, consentedAt: new Date() } });
  await prisma.auditLog.create({ data: { userId: req.user!.id, action: 'CONSENT_RECORD', entity: 'ConsentRecord', entityId: consentRecord.id } });
  await notifyEnrollmentParties(created.studentId, 'Inscripción recibida', 'La solicitud enviada por tu acudiente está pendiente de revisión.');
  res.status(201).json(created);
}));
app.post('/api/student-guardians', authenticate, allow(...management), asyncRoute(async (req, res) => {
  const input = z.object({ studentId: z.string().uuid(), name: z.string().min(2), documentNumber: z.string().min(4).optional(), email: z.string().email().optional(), phone: z.string().optional(), relationship: z.string().min(2), userId: z.string().uuid().optional() }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Completa los datos del acudiente y la relación.' }); return; }
  if (input.data.userId && !(await prisma.user.findFirst({ where: { id: input.data.userId, role: Role.ACUDIENTE, active: true } }))) { res.status(400).json({ error: 'La cuenta vinculada debe ser un acudiente activo.' }); return; }
  const guardian = await prisma.guardian.create({ data: { name: input.data.name, documentNumber: input.data.documentNumber, email: input.data.email, phone: input.data.phone, userId: input.data.userId } });
  const link = await prisma.studentGuardian.create({ data: { studentId: input.data.studentId, guardianId: guardian.id, relationship: input.data.relationship }, include: { guardian: true, student: true } });
  await prisma.auditLog.create({ data: { userId: req.user!.id, action: 'GUARDIAN_LINK', entity: 'Student', entityId: input.data.studentId } });
  res.status(201).json(link);
}));
app.get('/api/groups', authenticate, asyncRoute(async (req, res) => res.json(await prisma.group.findMany({ where: { active: true, ...(req.user!.role === Role.EDUCADOR ? { teacher: { userId: req.user!.id } } : {}) }, include: { program: true, teacher: true, classroom: true, schedules: true, _count: { select: { students: true } } }, orderBy: { name: 'asc' } }))));

app.post('/api/attendance', authenticate, allow(Role.SUPER_ADMIN, Role.EDUCADOR), asyncRoute(async (req, res) => {
  const input = z.object({ groupId: z.string().uuid(), date: z.string(), records: z.array(z.object({ studentId: z.string().uuid(), status: z.nativeEnum(AttendanceStatus), note: z.string().optional() })).min(1) }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Revisa el grupo, fecha y lista de asistencia.' }); return; }
  const group = await prisma.group.findUniqueOrThrow({ where: { id: input.data.groupId }, include: { teacher: true } });
  if (req.user!.role === Role.EDUCADOR && group.teacher?.userId !== req.user!.id) { res.status(403).json({ error: 'Este grupo no está asignado a tu perfil.' }); return; }
  const activeStudents = await prisma.enrollment.findMany({ where: { groupId: group.id, status: EnrollmentStatus.ACTIVE }, select: { studentId: true } });
  const allowedStudents = new Set(activeStudents.map(item => item.studentId));
  if (input.data.records.some(record => !allowedStudents.has(record.studentId))) { res.status(400).json({ error: 'La lista contiene estudiantes que no están matriculados en este grupo.' }); return; }
  const session = await prisma.attendanceSession.upsert({ where: { groupId_date: { groupId: input.data.groupId, date: new Date(input.data.date) } }, create: { groupId: input.data.groupId, date: new Date(input.data.date), teacherId: req.user!.id }, update: {} });
  const saved = await prisma.$transaction(input.data.records.map(r => prisma.attendance.upsert({ where: { sessionId_studentId: { sessionId: session.id, studentId: r.studentId } }, create: { sessionId: session.id, studentId: r.studentId, status: r.status, note: r.note }, update: { status: r.status, note: r.note } })));
  await prisma.auditLog.create({ data: { userId: req.user!.id, action: 'ATTENDANCE_SAVE', entity: 'AttendanceSession', entityId: session.id } });
  res.json({ session, saved: saved.length });
}));
app.get('/api/groups/:id/attendance', authenticate, allow(...staff, Role.EDUCADOR), asyncRoute(async (req, res) => {
  const group = await prisma.group.findUniqueOrThrow({ where: { id: req.params.id }, include: { teacher: true } });
  if (req.user!.role === Role.EDUCADOR && group.teacher?.userId !== req.user!.id) { res.status(403).json({ error: 'Este grupo no está asignado a tu perfil.' }); return; }
  const sessions = await prisma.attendanceSession.findMany({ where: { groupId: group.id }, include: { records: { include: { student: true } } }, orderBy: { date: 'desc' }, take: 60 });
  res.json(sessions);
}));
app.get('/api/students/:id/attendance', authenticate, asyncRoute(async (req, res) => {
  const student = await prisma.student.findUniqueOrThrow({ where: { id: req.params.id } });
  if (![...staff, Role.EDUCADOR].includes(req.user!.role) && student.userId !== req.user!.id) { res.status(403).json({ error: 'No tienes acceso a este historial.' }); return; }
  const records = await prisma.attendance.findMany({ where: { studentId: student.id }, include: { session: { include: { group: { include: { program: true } } } } }, orderBy: { session: { date: 'desc' } }, take: 200 });
  res.json(records);
}));

app.post('/api/evaluations', authenticate, allow(Role.SUPER_ADMIN, Role.EDUCADOR), asyncRoute(async (req, res) => {
  const input = z.object({ studentId: z.string().uuid(), groupId: z.string().uuid(), period: z.string().min(2), observations: z.string().min(2), indicators: z.array(z.object({ indicatorId: z.string().uuid(), observation: z.string().max(1000).optional() })).optional() }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Completa el periodo y las observaciones cualitativas.' }); return; }
  const group = await prisma.group.findUniqueOrThrow({ where: { id: input.data.groupId }, include: { teacher: true } });
  if (req.user!.role === Role.EDUCADOR && group.teacher?.userId !== req.user!.id) { res.status(403).json({ error: 'Este grupo no está asignado a tu perfil.' }); return; }
  const enrollment = await prisma.enrollment.findFirst({ where: { studentId: input.data.studentId, groupId: group.id, status: EnrollmentStatus.ACTIVE } });
  if (!enrollment) { res.status(400).json({ error: 'El estudiante no está matriculado en este grupo.' }); return; }
  const { indicators, ...evaluationData } = input.data;
  const evaluation = await prisma.evaluation.create({ data: { ...evaluationData, educatorId: req.user!.id, ...(indicators?.length ? { records: { create: indicators } } : {}) }, include: { records: { include: { indicator: true } }, student: true, group: true } });
  await prisma.auditLog.create({ data: { userId: req.user!.id, action: 'CREATE', entity: 'Evaluation', entityId: evaluation.id } });
  await notifyEnrollmentParties(evaluation.studentId, 'Nueva evaluación cualitativa', `Hay una actualización de progreso en ${evaluation.group.name}. Consulta tu espacio para ver los comentarios del educador.`);
  res.status(201).json(evaluation);
}));
app.get('/api/evaluations', authenticate, asyncRoute(async (req, res) => {
  const where: Prisma.EvaluationWhereInput = {};
  if ([Role.ESTUDIANTE, Role.ACUDIENTE].some(role => role === req.user!.role)) {
    const ids = req.user!.role === Role.ESTUDIANTE ? [await prisma.student.findUnique({ where: { userId: req.user!.id }, select: { id: true } })].filter(Boolean).map(item => item!.id) : (await prisma.guardian.findUnique({ where: { userId: req.user!.id }, include: { students: { select: { studentId: true } } } }))?.students.map(item => item.studentId) || [];
    where.studentId = { in: ids };
  } else if (req.user!.role === Role.EDUCADOR) where.educatorId = req.user!.id;
  else if (!staff.includes(req.user!.role)) { res.status(403).json({ error: 'No tienes acceso a evaluaciones.' }); return; }
  if (req.query.studentId && staff.includes(req.user!.role)) where.studentId = String(req.query.studentId);
  res.json(await prisma.evaluation.findMany({ where, include: { student: true, group: { include: { program: true } }, records: { include: { indicator: true } } }, orderBy: { createdAt: 'desc' }, take: 200 }));
}));
app.get('/api/evaluation-indicators', authenticate, asyncRoute(async (_req, res) => res.json(await prisma.evaluationIndicator.findMany({ orderBy: { name: 'asc' } }))));
app.post('/api/evaluation-indicators', authenticate, allow(...management), asyncRoute(async (req, res) => {
  const input = z.object({ name: z.string().min(3).max(100), description: z.string().max(500).optional() }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Nombre de indicador inválido.' }); return; }
  res.status(201).json(await prisma.evaluationIndicator.create({ data: input.data }));
}));
app.delete('/api/evaluation-indicators/:id', authenticate, allow(Role.SUPER_ADMIN), asyncRoute(async (req, res) => {
  await prisma.evaluationIndicator.delete({ where: { id: req.params.id } }); res.status(204).end();
}));

app.get('/api/maintenance', authenticate, asyncRoute(async (req, res) => {
  const isManager = [Role.SUPER_ADMIN, Role.JEFE_MANTENIMIENTO].some(role => role === req.user!.role);
  const where = isManager ? {} : req.user!.role === Role.TECNICO_MANTENIMIENTO ? { assignments: { some: { userId: req.user!.id } } } : { requesterId: req.user!.id };
  res.json(await prisma.maintenanceRequest.findMany({ where, include: { venue: true, assignments: true, evidence: true, history: true }, orderBy: { createdAt: 'desc' } }));
}));
app.post('/api/maintenance', authenticate, asyncRoute(async (req, res) => {
  const input = z.object({ venueId: z.string().uuid(), location: z.string().min(2), type: z.enum(['PREVENTIVO','CORRECTIVO']), description: z.string().min(8), urgency: z.enum(['BAJA','MEDIA','ALTA','CRITICA']), origin: z.enum(['SAIA','CORREO','TELEFONO','INTERNO']).default('INTERNO') }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Revisa escenario, ubicación, tipo, descripción y urgencia.' }); return; }
  const request = await prisma.maintenanceRequest.create({ data: { ...input.data, requesterId: req.user!.id, history: { create: { status: MaintenanceStatus.REGISTRADA, userId: req.user!.id, note: 'Solicitud registrada.' } } } });
  await notifyRoleUsers(maintenanceLeads, 'Nueva solicitud de mantenimiento', `Se registró la solicitud #${request.number}.`);
  await prisma.auditLog.create({ data: { userId: req.user!.id, action: 'MAINTENANCE_CREATE', entity: 'MaintenanceRequest', entityId: request.id } });
  res.status(201).json(request);
}));
app.patch('/api/maintenance/:id/status', authenticate, allow(Role.SUPER_ADMIN, Role.JEFE_MANTENIMIENTO, Role.TECNICO_MANTENIMIENTO), asyncRoute(async (req, res) => {
  const input = z.object({ status: z.nativeEnum(MaintenanceStatus), note: z.string().optional(), destination: z.string().optional(), scheduledAt: z.string().optional() }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Estado inválido.' }); return; }
  const existing = await prisma.maintenanceRequest.findUniqueOrThrow({ where: { id: req.params.id }, include: { evidence: true } });
  const issue = maintenanceTransitionError({ from: existing.status, to: input.data.status, role: req.user!.role, evidenceCount: existing.evidence.length, destination: input.data.destination, scheduledAt: input.data.scheduledAt });
  if (issue) { res.status(issue.includes('Solo jefatura') ? 403 : 400).json({ error: issue }); return; }
  const updated = await prisma.maintenanceRequest.update({ where: { id: req.params.id }, data: { status: input.data.status, destination: input.data.destination, scheduledAt: input.data.scheduledAt ? new Date(input.data.scheduledAt) : undefined, history: { create: { status: input.data.status, userId: req.user!.id, note: input.data.note } } } });
  await prisma.auditLog.create({ data: { userId: req.user!.id, action: `MAINTENANCE_${input.data.status}`, entity: 'MaintenanceRequest', entityId: updated.id } });
  const requester = await prisma.maintenanceRequest.findUnique({ where: { id: updated.id }, select: { requesterId: true, number: true } });
  if (requester) await notifyUser(requester.requesterId, 'Actualización de mantenimiento', `La solicitud #${requester.number} cambió a ${input.data.status}.`);
  res.json(updated);
}));
app.post('/api/maintenance/:id/assign', authenticate, allow(...maintenanceLeads), asyncRoute(async (req, res) => {
  const input = z.object({ userId: z.string().uuid() }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Selecciona un técnico válido.' }); return; }
  const technician = await prisma.user.findFirst({ where: { id: input.data.userId, role: Role.TECNICO_MANTENIMIENTO, active: true } });
  if (!technician) { res.status(400).json({ error: 'El usuario seleccionado no es un técnico activo.' }); return; }
  const request = await prisma.maintenanceRequest.findUniqueOrThrow({ where: { id: req.params.id } });
  if (![MaintenanceStatus.EN_REVISION, MaintenanceStatus.ASIGNADA].some(status => status === request.status)) { res.status(409).json({ error: 'La solicitud debe estar en revisión o asignada.' }); return; }
  const updated = await prisma.$transaction(async tx => {
    await tx.maintenanceAssignment.create({ data: { requestId: request.id, userId: technician.id } });
    return tx.maintenanceRequest.update({ where: { id: request.id }, data: { status: MaintenanceStatus.ASIGNADA, history: { create: { status: MaintenanceStatus.ASIGNADA, userId: req.user!.id, note: `Asignada a ${technician.name}.` } } }, include: { assignments: { include: { user: { select: { id: true, name: true } } } } } });
  });
  await prisma.auditLog.create({ data: { userId: req.user!.id, action: 'MAINTENANCE_ASSIGN', entity: 'MaintenanceRequest', entityId: request.id } });
  await notifyUser(technician.id, 'Solicitud de mantenimiento asignada', `Te asignaron la solicitud #${request.number}.`);
  res.json(updated);
}));
app.post('/api/maintenance/:id/reopen', authenticate, allow(...maintenanceLeads), asyncRoute(async (req, res) => {
  const input = z.object({ reason: z.string().min(8).max(1000) }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Explica el motivo de la reapertura.' }); return; }
  const request = await prisma.maintenanceRequest.findUniqueOrThrow({ where: { id: req.params.id } });
  if (request.status !== MaintenanceStatus.CERRADA) { res.status(409).json({ error: 'Solo puedes reabrir una solicitud cerrada.' }); return; }
  const updated = await prisma.maintenanceRequest.update({ where: { id: request.id }, data: { status: MaintenanceStatus.EN_REVISION, history: { create: { status: MaintenanceStatus.EN_REVISION, userId: req.user!.id, note: `Reapertura: ${input.data.reason}` } } } });
  await prisma.auditLog.create({ data: { userId: req.user!.id, action: 'MAINTENANCE_REOPEN', entity: 'MaintenanceRequest', entityId: request.id } });
  res.json(updated);
}));
app.post('/api/maintenance/:id/evidence', authenticate, allow(Role.SUPER_ADMIN, Role.JEFE_MANTENIMIENTO, Role.TECNICO_MANTENIMIENTO), upload.single('file'), asyncRoute(async (req, res) => {
  if (!req.file) { res.status(400).json({ error: 'Adjunta una imagen JPG, PNG o WebP de hasta 5 MB.' }); return; }
  const request = await prisma.maintenanceRequest.findUniqueOrThrow({ where: { id: req.params.id } });
  if (request.status === MaintenanceStatus.CERRADA) { fs.unlinkSync(req.file.path); res.status(409).json({ error: 'No se puede agregar evidencia a una solicitud cerrada.' }); return; }
  if (req.user!.role === Role.TECNICO_MANTENIMIENTO && !(await prisma.maintenanceAssignment.findFirst({ where: { requestId: request.id, userId: req.user!.id } }))) { fs.unlinkSync(req.file.path); res.status(403).json({ error: 'La solicitud no está asignada a tu perfil.' }); return; }
  const detectedMime = detectImageMime(req.file.path);
  if (!detectedMime) { fs.unlinkSync(req.file.path); res.status(400).json({ error: 'El archivo no contiene una imagen JPG, PNG o WebP válida.' }); return; }
  try {
    const evidence = await prisma.maintenanceEvidence.create({ data: { requestId: request.id, uploadedById: req.user!.id, url: req.file.filename, originalName: path.basename(req.file.originalname).slice(0, 180), mimeType: detectedMime, byteSize: req.file.size, caption: String(req.body.caption || '').slice(0, 300) || null } });
    await prisma.auditLog.create({ data: { userId: req.user!.id, action: 'MAINTENANCE_EVIDENCE_UPLOAD', entity: 'MaintenanceEvidence', entityId: evidence.id } });
    res.status(201).json({ ...evidence, contentUrl: `/api/evidence/${evidence.id}` });
  } catch (error) { fs.unlinkSync(req.file.path); throw error; }
}));
app.get('/api/evidence/:id', authenticate, asyncRoute(async (req, res) => {
  const evidence = await prisma.maintenanceEvidence.findUniqueOrThrow({ where: { id: req.params.id }, include: { request: { include: { assignments: true } } } });
  const role = req.user!.role;
  const canView = [Role.SUPER_ADMIN, Role.JEFE_MANTENIMIENTO].some(allowedRole => allowedRole === role) || evidence.request.requesterId === req.user!.id || evidence.request.assignments.some(item => item.userId === req.user!.id);
  if (!canView) { res.status(403).json({ error: 'No tienes acceso a esta evidencia.' }); return; }
  const filePath = path.resolve(uploadDirectory, path.basename(evidence.url));
  if (!filePath.startsWith(`${uploadDirectory}${path.sep}`) || !fs.existsSync(filePath)) { res.status(404).json({ error: 'No se encontró la evidencia.' }); return; }
  res.type(evidence.mimeType || 'application/octet-stream').sendFile(filePath);
}));

app.get('/api/notifications', authenticate, asyncRoute(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1); const take = 30;
  const [items, unread] = await Promise.all([prisma.notification.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * take, take }), prisma.notification.count({ where: { userId: req.user!.id, readAt: null } })]);
  res.json({ items, page, unread });
}));
app.patch('/api/notifications/:id/read', authenticate, asyncRoute(async (req, res) => {
  const updated = await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.user!.id }, data: { readAt: new Date() } });
  if (!updated.count) { res.status(404).json({ error: 'No encontramos esa notificación.' }); return; }
  res.status(204).end();
}));
app.post('/api/notifications/read-all', authenticate, asyncRoute(async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user!.id, readAt: null }, data: { readAt: new Date() } });
  res.status(204).end();
}));
app.get('/api/audit-logs', authenticate, allow(Role.SUPER_ADMIN), asyncRoute(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1); const take = 50;
  const [items, total] = await Promise.all([prisma.auditLog.findMany({ include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * take, take }), prisma.auditLog.count()]);
  res.json({ items, page, total, pages: Math.ceil(total / take) });
}));
app.get('/api/settings', authenticate, allow(Role.SUPER_ADMIN, Role.ADMINISTRATIVO), asyncRoute(async (_req, res) => res.json(await prisma.institutionSetting.findMany({ orderBy: { key: 'asc' } }))));
app.put('/api/settings/:key', authenticate, allow(Role.SUPER_ADMIN), asyncRoute(async (req, res) => {
  const input = z.object({ value: z.string().max(2000) }).safeParse(req.body);
  const key = z.string().regex(/^[A-Z][A-Z0-9_]{1,79}$/).safeParse(req.params.key);
  if (!input.success || !key.success) { res.status(400).json({ error: 'Clave o valor inválidos.' }); return; }
  const setting = await prisma.institutionSetting.upsert({ where: { key: key.data }, create: { key: key.data, value: input.data.value, updatedById: req.user!.id }, update: { value: input.data.value, updatedById: req.user!.id } });
  await prisma.auditLog.create({ data: { userId: req.user!.id, action: 'SETTING_UPDATE', entity: 'InstitutionSetting', entityId: setting.key } });
  res.json(setting);
}));
app.get('/api/students/:id/consents', authenticate, asyncRoute(async (req, res) => {
  const student = await prisma.student.findUniqueOrThrow({ where: { id: req.params.id } });
  if (!staff.includes(req.user!.role) && student.userId !== req.user!.id) { res.status(403).json({ error: 'No tienes acceso a este registro.' }); return; }
  res.json(await prisma.consentRecord.findMany({ where: { studentId: student.id }, orderBy: { createdAt: 'desc' } }));
}));
app.post('/api/consents', authenticate, allow(...management), asyncRoute(async (req, res) => {
  const input = z.object({ studentId: z.string().uuid(), subjectName: z.string().min(2), purpose: z.string().min(4).max(500), consented: z.boolean() }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Completa la persona, el propósito y el estado de autorización.' }); return; }
  const consent = await prisma.consentRecord.create({ data: { studentId: input.data.studentId, subjectName: input.data.subjectName, purpose: input.data.purpose, consentedAt: input.data.consented ? new Date() : null } });
  await prisma.auditLog.create({ data: { userId: req.user!.id, action: 'CONSENT_RECORD', entity: 'ConsentRecord', entityId: consent.id } });
  res.status(201).json(consent);
}));
app.post('/api/consents/:id/revoke', authenticate, allow(...management), asyncRoute(async (req, res) => {
  const consent = await prisma.consentRecord.update({ where: { id: req.params.id }, data: { revokedAt: new Date() } });
  await prisma.auditLog.create({ data: { userId: req.user!.id, action: 'CONSENT_REVOKE', entity: 'ConsentRecord', entityId: consent.id } });
  res.json(consent);
}));
app.post('/api/my/consents/:id/revoke', authenticate, allow(Role.ESTUDIANTE, Role.ACUDIENTE), asyncRoute(async (req, res) => {
  const consent = await prisma.consentRecord.findUniqueOrThrow({ where: { id: req.params.id } });
  const authorized = req.user!.role === Role.ESTUDIANTE
    ? await prisma.student.findFirst({ where: { id: consent.studentId || '', userId: req.user!.id }, select: { id: true } })
    : await prisma.studentGuardian.findFirst({ where: { studentId: consent.studentId || '', guardian: { userId: req.user!.id } }, select: { studentId: true } });
  if (!authorized) { res.status(403).json({ error: 'No tienes permiso para cambiar esta autorización.' }); return; }
  const updated = await prisma.consentRecord.update({ where: { id: consent.id }, data: { revokedAt: consent.revokedAt || new Date() } });
  await prisma.auditLog.create({ data: { userId: req.user!.id, action: 'CONSENT_REVOKE', entity: 'ConsentRecord', entityId: updated.id } });
  res.json(updated);
}));
app.get('/api/maintenance/preventive', authenticate, allow(Role.SUPER_ADMIN, Role.JEFE_MANTENIMIENTO, Role.TECNICO_MANTENIMIENTO), asyncRoute(async (_req, res) => {
  res.json(await prisma.preventiveMaintenance.findMany({ include: { venue: true }, orderBy: { dueAt: 'asc' } }));
}));
app.post('/api/maintenance/preventive', authenticate, allow(...maintenanceLeads), asyncRoute(async (req, res) => {
  const input = z.object({ asset: z.enum(['ASCENSOR','PLANTA_ELECTRICA','MOTOBOMBA','ALARMA_INCENDIOS','SILLETERIA','BANOS','LUMINARIAS']), venueId: z.string().uuid(), description: z.string().min(5), dueAt: z.string().datetime() }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Revisa el activo, escenario, descripción y fecha del mantenimiento.' }); return; }
  const record = await prisma.preventiveMaintenance.create({ data: { ...input.data, createdById: req.user!.id }, include: { venue: true } });
  await prisma.auditLog.create({ data: { userId: req.user!.id, action: 'PREVENTIVE_MAINTENANCE_CREATE', entity: 'PreventiveMaintenance', entityId: record.id } });
  res.status(201).json(record);
}));
app.patch('/api/maintenance/preventive/:id/complete', authenticate, allow(Role.SUPER_ADMIN, Role.JEFE_MANTENIMIENTO, Role.TECNICO_MANTENIMIENTO), asyncRoute(async (req, res) => {
  const record = await prisma.preventiveMaintenance.update({ where: { id: req.params.id }, data: { completedAt: new Date() }, include: { venue: true } });
  await prisma.auditLog.create({ data: { userId: req.user!.id, action: 'PREVENTIVE_MAINTENANCE_COMPLETE', entity: 'PreventiveMaintenance', entityId: record.id } });
  res.json(record);
}));

app.get('/api/reports/:kind', authenticate, asyncRoute(async (req, res) => {
  const kind = String(req.params.kind); const format = String(req.query.format || 'csv').toLowerCase();
  if (!['students', 'enrollments', 'attendance', 'maintenance'].includes(kind) || !['csv', 'xlsx', 'pdf'].includes(format)) { res.status(400).json({ error: 'Tipo de reporte o formato no válido.' }); return; }
  const administrative = staff.includes(req.user!.role);
  const maintenanceAccess = [Role.SUPER_ADMIN, Role.JEFE_MANTENIMIENTO, Role.TECNICO_MANTENIMIENTO].some(role => role === req.user!.role);
  if (kind === 'maintenance' ? !maintenanceAccess : !administrative && req.user!.role !== Role.EDUCADOR) { res.status(403).json({ error: 'No tienes permiso para exportar este reporte.' }); return; }
  const programId = req.query.programId ? String(req.query.programId) : undefined;
  const groupId = req.query.groupId ? String(req.query.groupId) : undefined;
  const from = req.query.from ? new Date(String(req.query.from)) : undefined;
  const to = req.query.to ? new Date(String(req.query.to)) : undefined;
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) { res.status(400).json({ error: 'Rango de fechas inválido.' }); return; }
  const educatorGroupIds = req.user!.role === Role.EDUCADOR ? (await prisma.group.findMany({ where: { teacher: { userId: req.user!.id } }, select: { id: true } })).map(group => group.id) : undefined;
  let rows: Array<Record<string, unknown>> = []; let headers: Array<[string, string]> = [];
  if (kind === 'students') {
    const and: Prisma.StudentWhereInput[] = [{ active: true }];
    if (programId) and.push({ enrollments: { some: { programId } } });
    if (groupId) and.push({ enrollments: { some: { groupId } } });
    if (req.query.neighborhood) and.push({ neighborhood: { contains: String(req.query.neighborhood), mode: 'insensitive' } });
    if (req.query.originCity) and.push({ originCity: { contains: String(req.query.originCity), mode: 'insensitive' } });
    if (req.query.gender) and.push({ gender: { equals: String(req.query.gender), mode: 'insensitive' } });
    if (educatorGroupIds) and.push({ enrollments: { some: { groupId: { in: educatorGroupIds } } } });
    const students = await prisma.student.findMany({ where: { AND: and }, include: { enrollments: { where: { status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.PENDING] } }, include: { program: true, group: true } } }, take: 5000, orderBy: { lastName: 'asc' } });
    rows = students.flatMap(student => student.enrollments.length ? student.enrollments.map(enrollment => ({ nombre: `${student.firstName} ${student.lastName}`, tipoDocumento: student.documentType, documento: student.documentNumber, genero: student.gender || '', barrio: student.neighborhood || '', ciudadOrigen: student.originCity || '', programa: enrollment.program.name, grupo: enrollment.group?.name || '', estado: enrollment.status })) : [{ nombre: `${student.firstName} ${student.lastName}`, tipoDocumento: student.documentType, documento: student.documentNumber, genero: student.gender || '', barrio: student.neighborhood || '', ciudadOrigen: student.originCity || '', programa: '', grupo: '', estado: 'SIN_MATRICULA' }]);
    headers = [['nombre','Nombre'],['tipoDocumento','Tipo documento'],['documento','Documento'],['genero','Género'],['barrio','Barrio'],['ciudadOrigen','Ciudad de origen'],['programa','Programa'],['grupo','Grupo'],['estado','Estado de matrícula']];
  } else if (kind === 'enrollments') {
    const enrollmentAnd: Prisma.EnrollmentWhereInput[] = [];
    if (programId) enrollmentAnd.push({ programId });
    if (groupId) enrollmentAnd.push({ groupId });
    if (educatorGroupIds) enrollmentAnd.push({ groupId: { in: educatorGroupIds } });
    if (from || to) enrollmentAnd.push({ createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } });
    const enrollments = await prisma.enrollment.findMany({ where: { AND: enrollmentAnd }, include: { student: true, program: true, group: true }, take: 5000, orderBy: { createdAt: 'desc' } });
    rows = enrollments.map(row => ({ fecha: row.createdAt.toISOString().slice(0, 10), estudiante: `${row.student.firstName} ${row.student.lastName}`, documento: row.student.documentNumber, programa: row.program.name, grupo: row.group?.name || '', estado: row.status }));
    headers = [['fecha','Fecha'],['estudiante','Estudiante'],['documento','Documento'],['programa','Programa'],['grupo','Grupo'],['estado','Estado']];
  } else if (kind === 'attendance') {
    const attendanceAnd: Prisma.AttendanceWhereInput[] = [];
    if (groupId) attendanceAnd.push({ session: { groupId } });
    if (programId) attendanceAnd.push({ session: { group: { programId } } });
    if (educatorGroupIds) attendanceAnd.push({ session: { groupId: { in: educatorGroupIds } } });
    if (from || to) attendanceAnd.push({ session: { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } });
    const records = await prisma.attendance.findMany({ where: { AND: attendanceAnd }, include: { student: true, session: { include: { group: { include: { program: true } } } } }, take: 10000, orderBy: { session: { date: 'desc' } } });
    rows = records.map(record => ({ fecha: record.session.date.toISOString().slice(0, 10), estudiante: `${record.student.firstName} ${record.student.lastName}`, programa: record.session.group.program.name, grupo: record.session.group.name, estado: record.status, observacion: record.note || '' }));
    headers = [['fecha','Fecha'],['estudiante','Estudiante'],['programa','Programa'],['grupo','Grupo'],['estado','Asistencia'],['observacion','Observación']];
  } else {
    const requests = await prisma.maintenanceRequest.findMany({ where: { ...(req.query.venueId ? { venueId: String(req.query.venueId) } : {}), ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}), ...(req.user!.role === Role.TECNICO_MANTENIMIENTO ? { assignments: { some: { userId: req.user!.id } } } : {}) }, include: { venue: true }, take: 5000, orderBy: { createdAt: 'desc' } });
    rows = requests.map(row => ({ numero: row.number, registro: row.createdAt.toISOString().slice(0, 10), escenario: row.venue.name, ubicacion: row.location, tipo: row.type, urgencia: row.urgency, estado: row.status, escaladaA: row.destination || '' }));
    headers = [['numero','Número'],['registro','Fecha'],['escenario','Escenario'],['ubicacion','Ubicación'],['tipo','Tipo'],['urgencia','Urgencia'],['estado','Estado'],['escaladaA','Dependencia destino']];
  }
  const safeKind = kind; const filename = `pgclt-${safeKind}-${new Date().toISOString().slice(0,10)}`;
  await prisma.auditLog.create({ data: { userId: req.user!.id, action: `REPORT_${kind.toUpperCase()}_${format.toUpperCase()}`, entity: 'Report', entityId: filename } });
  if (format === 'csv') { res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`); res.send(`\uFEFF${toCsv(rows, headers)}`); return; }
  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('Reporte');
    sheet.columns = headers.map(([key, header]) => ({ key, header, width: Math.min(35, Math.max(14, header.length + 3)) }));
    sheet.addRows(rows); sheet.views = [{ state: 'frozen', ySplit: 1 }]; sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + headers.length)}1` };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF153C45' } };
    const buffer = await workbook.xlsx.writeBuffer(); res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`); res.send(Buffer.from(buffer)); return;
  }
  const doc = new PDFDocument({ size: 'A4', margin: 36, layout: 'landscape' }); const chunks: Buffer[] = [];
  doc.on('data', chunk => chunks.push(Buffer.from(chunk)));
  doc.on('end', () => { res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`); res.send(Buffer.concat(chunks)); });
  doc.fontSize(15).fillColor('#153c45').text(`PGC-LT · Reporte de ${kind}`); doc.moveDown(.5).fontSize(8).fillColor('#555').text(`Generado ${new Date().toLocaleString('es-CO')} · ${rows.length} registros`); doc.moveDown();
  doc.fontSize(7).fillColor('#153c45').text(headers.map(([, label]) => label).join('  |  ')); doc.moveDown(.3).fontSize(6).fillColor('#242725');
  rows.forEach((row, index) => { const line = headers.map(([key]) => String(row[key] ?? '').replace(/[\r\n]+/g, ' ').slice(0, 80)).join('  |  '); doc.text(line); if (index % 2 === 1) doc.fillColor('#242725'); });
  doc.end();
}));

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const message = err instanceof Error ? err.message : 'Error interno.';
  const errorName = err instanceof Error ? err.name : '';
  const prismaCode = typeof err === 'object' && err
    ? String('code' in err ? err.code : 'errorCode' in err ? err.errorCode : '')
    : '';
  if (err instanceof multer.MulterError) { res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'La imagen supera el máximo de 5 MB.' : 'No se pudo procesar el archivo.' }); return; }
  if (['P1001', 'P1002', 'P1017'].includes(prismaCode) || errorName === 'PrismaClientInitializationError' || /Can't reach database server/i.test(message)) {
    res.status(503).json({ error: 'No se pudo conectar con PostgreSQL. Inicia Docker Desktop y ejecuta «docker compose up -d database» desde la carpeta del proyecto.' }); return;
  }
  if (prismaCode === 'P1000' || prismaCode === 'P1010') { res.status(503).json({ error: 'PostgreSQL rechazó la conexión. Verifica el usuario y la contraseña de DATABASE_URL en .env.' }); return; }
  if (prismaCode === 'P2021' || prismaCode === 'P2022') { res.status(503).json({ error: 'La base de datos no tiene el esquema actualizado. Desde la carpeta del proyecto ejecuta npm --workspace backend run db:deploy y vuelve a intentar.' }); return; }
  if (message === 'CUPOS_COMPLETOS') { res.status(409).json({ error: 'El programa completó sus cupos.' }); return; }
  if (message === 'GRUPO_LLENO') { res.status(409).json({ error: 'El grupo completó sus cupos.' }); return; }
  if (message === 'GRUPO_NO_COINCIDE') { res.status(400).json({ error: 'El grupo no pertenece al programa seleccionado.' }); return; }
  if (message === 'PROGRAMA_INACTIVO') { res.status(409).json({ error: 'El programa ya no recibe solicitudes.' }); return; }
  if (message === 'CONFLICTO_HORARIO') { res.status(409).json({ error: 'El educador, grupo o salón ya tiene una actividad en ese horario.' }); return; }
  if (message === 'HORARIO_INVALIDO') { res.status(400).json({ error: 'Revisa días y horas; el horario debe estar en formato 24 horas.' }); return; }
  if (prismaCode === 'P2002') { res.status(409).json({ error: 'Ya existe un registro con esos datos.' }); return; }
  if (prismaCode === 'P2025') { res.status(404).json({ error: 'No encontramos ese registro.' }); return; }
  if (prismaCode === 'P2034') { res.status(409).json({ error: 'La operación coincidió con otra actualización. Vuelve a intentarlo.' }); return; }
  res.status(500).json({ error: 'Ocurrió un error al procesar la solicitud.' });
});

app.listen(port, () => console.log(`PGC-LT API escuchando en http://localhost:${port}`));
setInterval(() => { sendNextDayClassReminders().catch(error => console.error('No se pudieron generar recordatorios de clase:', error)); }, 15 * 60 * 1000);
sendNextDayClassReminders().catch(error => console.error('No se pudieron generar recordatorios de clase:', error));
process.on('SIGINT', async () => { await prisma.$disconnect(); process.exit(0); });
