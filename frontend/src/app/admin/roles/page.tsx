import { PublicShell } from '@/modules/navigation/components/PublicShell';
import { AdminRoleManager } from '@/modules/auth/components/AdminRoleManager';
export default function RolesPage() { return <PublicShell><div className="staffPage"><p className="staffKicker">Администрирование</p><h1>Управление ролями</h1><p className="staffLead">Назначение ролей пользователям. Только для администратора.</p><AdminRoleManager /></div></PublicShell>; }
