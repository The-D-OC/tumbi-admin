import { useFieldArray, type Control, type UseFormRegister, type FieldErrors } from 'react-hook-form';
import type { FormShape } from '../lib/schema';
import { DAYS } from '../lib/schema';
import { Field } from './Field';

/** Repeating day + start/end time rows. Optional — a class can have no schedule. */
export function ScheduleEditor({
  control,
  register,
  errors,
}: {
  control: Control<FormShape>;
  register: UseFormRegister<FormShape>;
  errors: FieldErrors<FormShape>;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: 'schedule' });

  return (
    <div>
      {fields.length === 0 && (
        <p className="subtle" style={{ marginBottom: 12 }}>
          No sessions added yet. Add one for each weekly time slot (optional).
        </p>
      )}

      {fields.map((f, i) => {
        const slotErr = errors.schedule?.[i];
        return (
          <div className="slot-row" key={f.id}>
            <Field label="Day" error={slotErr?.day?.message}>
              <select {...register(`schedule.${i}.day` as const)}>
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Start" error={slotErr?.start_time?.message}>
              <input type="text" placeholder="09:30" {...register(`schedule.${i}.start_time` as const)} />
            </Field>
            <Field label="End" error={slotErr?.end_time?.message}>
              <input type="text" placeholder="10:30" {...register(`schedule.${i}.end_time` as const)} />
            </Field>
            <button type="button" className="icon-btn" title="Remove session" onClick={() => remove(i)}>
              ×
            </button>
          </div>
        );
      })}

      <button
        type="button"
        className="pill-btn ghost"
        onClick={() => append({ day: 'monday', start_time: '', end_time: '' })}
      >
        + Add session
      </button>
    </div>
  );
}
