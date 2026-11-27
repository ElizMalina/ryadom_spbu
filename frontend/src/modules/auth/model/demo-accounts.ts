import type { CurrentUser } from './types';

export const DEMO_USERS: readonly Omit<CurrentUser, 'roles'>[] = [
  { id: 'demo-001', username: 'student.demo', displayName: 'Алексей Студент' },
  { id: 'demo-002', username: 'consultant.demo', displayName: 'Мария Соколова' },
  { id: 'demo-006', username: 'psychologist.demo', displayName: 'Ольга Психолог' },
  { id: 'demo-007', username: 'student2.demo', displayName: 'Софья Иванова' },
  { id: 'demo-008', username: 'student3.demo', displayName: 'Пётр Смирнов' },
  { id: 'demo-003', username: 'moderator.demo', displayName: 'Даниил Модератор' },
  { id: 'demo-004', username: 'reviewer.demo', displayName: 'Анна Рецензент' },
  { id: 'demo-005', username: 'admin.demo', displayName: 'Ирина Администратор' },
];
