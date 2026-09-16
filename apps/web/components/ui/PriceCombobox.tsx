import { Check, ChevronsUpDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from './command';

const PRICE_OPTIONS = Array.from({ length: 9 }, (_, i) => (i + 1) * 10_000);

type Props = { value: number | null; onChange: (value: number | null) => void };

export function PriceCombobox({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const options = useMemo(() => PRICE_OPTIONS.map(price => ({ price, label: `≤ ${price.toLocaleString('vi-VN')}` })), []);
  const label = value == null ? 'All prices' : `≤ ${value.toLocaleString('vi-VN')}`;

  return <div className="relative w-full">
    <button type="button" className="flex h-8 w-full items-center justify-between gap-2 border-0 bg-transparent p-0 text-left text-[14px] font-bold leading-tight text-[var(--tce-text)] outline-none" aria-expanded={open} aria-haspopup="listbox" onClick={() => setOpen(v => !v)}>
      <span className="truncate">{label}</span><ChevronsUpDown className="size-4 shrink-0 text-[var(--tce-muted)]" />
    </button>
    {open && <>
      <button type="button" className="fixed inset-0 z-40 cursor-default bg-transparent" aria-label="Close price selector" onClick={() => setOpen(false)} />
      <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[220px] overflow-hidden rounded-xl border border-white/10 bg-[#0b171e] shadow-2xl">
        <Command>
          <CommandInput placeholder="Search price…" />
          <CommandList>
            <CommandEmpty>No matching price.</CommandEmpty>
            <CommandItem value="all prices" onSelect={() => { onChange(null); setOpen(false); }}>
              <Check className={`mr-2 size-4 ${value == null ? 'opacity-100' : 'opacity-0'}`} /> All prices
            </CommandItem>
            {options.map(({ price, label: optionLabel }) => <CommandItem key={price} value={optionLabel} onSelect={() => { onChange(price); setOpen(false); }}>
              <Check className={`mr-2 size-4 ${value === price ? 'opacity-100' : 'opacity-0'}`} /> {optionLabel}
            </CommandItem>)}
          </CommandList>
        </Command>
      </div>
    </>}
  </div>;
}
