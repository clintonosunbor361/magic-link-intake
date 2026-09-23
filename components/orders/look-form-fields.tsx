import { Input } from "@/components/ui/input";

const textareaClass =
  "min-h-[5rem] w-full rounded-[0.8rem] border border-kuartz-control bg-white/70 px-3.5 py-3 text-sm text-kuartz-ink outline-none focus:border-[#88925f] focus:bg-white focus:ring-4 focus:ring-kuartz-lime/20";

export function LookFormFields({
  name = "",
  lookDate = "",
  notes = "",
}: {
  name?: string;
  lookDate?: string;
  notes?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="form-group">
          <span>
            Name <span className="font-normal text-kuartz-secondary">(required)</span>
          </span>
          <Input name="name" defaultValue={name} required maxLength={120} data-modal-autofocus />
        </label>
        <label className="form-group">
          <span>
            Look date <span className="font-normal text-kuartz-secondary">(optional)</span>
          </span>
          <Input type="date" name="lookDate" defaultValue={lookDate} />
        </label>
      </div>
      <label className="form-group">
        <span>
          Notes <span className="font-normal text-kuartz-secondary">(optional)</span>
        </span>
        <textarea name="notes" defaultValue={notes} maxLength={1000} className={textareaClass} />
      </label>
    </div>
  );
}
