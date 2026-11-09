// Salvar em: src/lib/date.ts
 
/** Retorna "YYYY-MM-DD" no horário LOCAL (sem passar por UTC). */
export const toLocalDateStr = (d: Date = new Date()): string =>
  d.toLocaleDateString('sv-SE');
 
/** Converte "YYYY-MM-DD" (ou ISO com hora) em Date à meia-noite LOCAL. */
export const parseLocalDate = (s: string): Date =>
  new Date(s.slice(0, 10) + 'T00:00:00');