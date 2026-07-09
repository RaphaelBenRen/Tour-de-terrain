export interface Checklist {
  title: string;
  listCheck: {
    title: string;
    description?: string;
    checked: boolean | null;
  }[];
}
