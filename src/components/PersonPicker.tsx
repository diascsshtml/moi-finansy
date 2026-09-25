import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '../db/db';

interface PersonPickerProps {
  value: string;
  onChange: (name: string) => void;
  id?: string;
}

/** Текстовое поле с автоподсказками по уже существующим людям. Если введённого
 *  имени ещё нет — при сохранении долга будет создан новый человек. */
export function PersonPicker({ value, onChange, id }: PersonPickerProps) {
  const { t } = useTranslation();
  const people = useLiveQuery(() => db.people.orderBy('name').toArray(), []);

  return (
    <>
      <input
        id={id}
        type="text"
        className="text-input"
        list="people-datalist"
        placeholder={t('debtForm.personPlaceholder')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
      <datalist id="people-datalist">
        {people?.map((p) => (
          <option key={p.id} value={p.name} />
        ))}
      </datalist>
    </>
  );
}
