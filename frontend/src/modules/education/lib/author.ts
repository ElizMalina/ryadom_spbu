/** Public author byline: Фамилия Имя, never a role label. */
export function surnameFirst(displayName: string): string | undefined {
  const words = displayName.trim().split(/\s+/u).filter(Boolean);
  if (words.length < 2) return undefined;
  // Account display names use «Имя Фамилия [Отчество]».
  return `${words[1]} ${words[0]}`;
}
