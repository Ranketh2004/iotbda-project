/** Age band keys match signup / API `babyAge`. */
export const BABY_AGE_LABELS = {
  '0-3': '0–3 months',
  '4-6': '4–6 months',
  '7-9': '7–9 months',
  '10-12': '10–12 months',
  '12+': '12+ months',
};

export const BABY_AGE_OPTIONS = [
  { value: '0-3', label: '0-3 Months' },
  { value: '4-6', label: '4-6 Months' },
  { value: '7-9', label: '7-9 Months' },
  { value: '10-12', label: '10-12 Months' },
  { value: '12+', label: '12+ Months' },
];

function emptyProfileForm() {
  return {
    accountEmail: '',
    accountPhone: '',
    motherName: '',
    motherPhone: '',
    motherEmail: '',
    fatherName: '',
    fatherPhone: '',
    fatherEmail: '',
    babyName: '',
    babyAge: '0-3',
    babyGender: 'other',
    parentPhotoUrl: '',
    babyPhotoUrl: '',
  };
}

export function mapApiUserToProfileForm(u) {
  if (!u || typeof u !== 'object') {
    return emptyProfileForm();
  }

  const mother = u.mother && typeof u.mother === 'object' ? u.mother : {};
  const father = u.father && typeof u.father === 'object' ? u.father : {};

  let motherName = mother.name || '';
  let motherPhone = mother.phone || '';
  let motherEmail = mother.email || '';
  let fatherName = father.name || '';
  let fatherPhone = father.phone || '';
  let fatherEmail = father.email || '';

  if (!motherName && !fatherName && (u.fullName || u.email)) {
    motherName = u.fullName || '';
    motherPhone = u.phone || '';
    motherEmail = u.email || '';
  }

  return {
    accountEmail: u.email || '',
    accountPhone: u.phone || '',
    motherName,
    motherPhone,
    motherEmail,
    fatherName,
    fatherPhone,
    fatherEmail,
    babyName: u.babyName || '',
    babyAge: u.babyAge || '0-3',
    babyGender: u.babyGender || 'other',
    parentPhotoUrl: u.parentPhotoUrl || '',
    babyPhotoUrl: u.babyPhotoUrl || '',
  };
}

function formatGuardianPhoneDisplay(stored) {
  if (stored == null || stored === '') return '';
  const d = String(stored).replace(/\D/g, '');
  if (d.length === 10) {
    return `+1 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  }
  if (d.length === 11 && d.startsWith('1')) {
    return `+1 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  }
  if (d.length > 0) return `+${d}`;
  return String(stored).trim();
}

/**
 * Map API `guardians` (signup: priority, name, relationship, phone) → Settings UI cards.
 */
export function mapApiGuardiansToSettingsForm(apiGuardians) {
  if (!Array.isArray(apiGuardians) || apiGuardians.length === 0) return [];

  const sorted = [...apiGuardians].sort(
    (a, b) => Number(a.priority || 0) - Number(b.priority || 0),
  );

  return sorted
    .map((g, idx) => {
      const p = Number(g.priority);
      const pri = Number.isFinite(p) && p > 0 ? p : idx + 1;
      const name = (g.name || '').trim();
      const relationship = (g.relationship || '').trim();
      const phoneRaw = g.phone != null ? String(g.phone).trim() : '';
      return {
        id: `g-${pri}-${idx}`,
        name,
        role: relationship,
        phone: phoneRaw ? formatGuardianPhoneDisplay(phoneRaw) : '',
        rank: pri === 1 ? 'primary' : 'secondary',
        online: false,
        icon: pri === 1 ? 'accessibility' : 'home',
      };
    })
    .filter((row) => row.name || (row.phone && String(row.phone).replace(/\D/g, '')));
}

/** Settings UI cards → API PATCH /api/auth/guardians (primary first, then stable order). */
export function mapSettingsGuardiansToApiPayload(guardians) {
  if (!Array.isArray(guardians)) return [];
  const sorted = [...guardians].sort((a, b) => {
    if (a.rank === 'primary' && b.rank !== 'primary') return -1;
    if (a.rank !== 'primary' && b.rank === 'primary') return 1;
    return 0;
  });
  return sorted.map((g, idx) => ({
    priority: idx + 1,
    name: (g.name || '').trim(),
    relationship: (g.role || '').trim(),
    phone: g.phone || '',
  }));
}
