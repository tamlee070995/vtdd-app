import type { AdminSection } from "@/lib/admin-navigation";

export default function AdminSectionIcon({ section }: { section: AdminSection }) {
  const paths = {
    content: <><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 12h7M9 16h7" /></>,
    prices: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M8 9h8M8 13h8M8 16h4" /></>,
    accounts: <><circle cx="9" cy="7" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-4-5.7" /></>,
    system: <><path d="m10 3-1 3-3 1-3-1-1 4 2 2-1 3 3 3 3-1 3 1 1 3 4-1 1-3 3-1 1-4-2-2 1-3-3-3-3 1-3-1z" /><circle cx="12" cy="12" r="3" /></>,
  };
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[section]}</svg>;
}
