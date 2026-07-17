export interface Checklist {
  title: string;
  listCheck: {
    title: string;
    description?: string;
    checked: boolean | null;
    /**
     * Réponse attendue (le "corrigé") : true = la bonne réponse est "Conforme",
     * false = la bonne réponse est "Non conforme". Par défaut true.
     */
    expected?: boolean;
    /** Noms de fichiers des photos enregistrées pour une non-conformité. */
    photos?: string[];
  }[];
}

/** Vrai si la réponse de l'opérateur correspond à la réponse attendue. */
export function isAnswerCorrect(item: { checked: boolean | null; expected?: boolean }): boolean {
  const expected = item.expected !== false; // défaut : Conforme attendu
  return item.checked === expected;
}

/** Enregistrement d'un TDT complété (pour l'historique / le calendrier). */
export interface TdtRecord {
  /** Identifiant/fichier déterministe (type + date + opérateur). */
  id: string;
  /** Date-heure d'enregistrement (ISO). */
  savedAt: string;
  /** Date du TDT au format YYYY-MM-DD (regroupement calendrier). */
  date: string;
  /** Nom du jour (Lundi, Mardi, …). */
  dayName: string;
  /** Créneau : 'matin' (00h–13h) ou 'aprem' (13h–00h). */
  slot?: 'matin' | 'aprem';
  username: string;
  uap: number;
  type: string;
  /** Vrai si toutes les réponses correspondent au corrigé. */
  allCorrect: boolean;
  /** Copie des checklists répondues (thème -> questions + réponse + attendu + photos). */
  checklists: Checklist[];
}
