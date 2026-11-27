import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';

export interface SlashCommandMenuProps {
  items: Array<{ id: string; title: string }>;
  onSelect: (id: string) => void;
}

export interface SlashCommandMenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

export const SlashCommandMenu = forwardRef<
  SlashCommandMenuHandle,
  SlashCommandMenuProps
>(function SlashCommandMenu({ items, onSelect }, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  useImperativeHandle(
    ref,
    () => ({
      onKeyDown(event: KeyboardEvent) {
        if (items.length === 0) {
          return false;
        }

        if (event.key === 'ArrowDown') {
          setSelectedIndex((index) => (index + 1) % items.length);
          return true;
        }

        if (event.key === 'ArrowUp') {
          setSelectedIndex(
            (index) => (index - 1 + items.length) % items.length,
          );
          return true;
        }

        if (event.key === 'Enter') {
          const item = items[selectedIndex];
          if (item) {
            onSelect(item.id);
          }
          return true;
        }

        return false;
      },
    }),
    [items, selectedIndex, onSelect],
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className="z-50 min-w-[180px] rounded-md border border-border bg-popover p-1 shadow-md"
      role="listbox"
    >
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          role="option"
          aria-selected={index === selectedIndex}
          className={`flex w-full cursor-pointer items-center rounded-sm px-2.5 py-1.5 text-left text-[13px] text-foreground hover:bg-muted ${
            index === selectedIndex ? 'bg-muted' : ''
          }`}
          onClick={() => onSelect(item.id)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          {item.title}
        </button>
      ))}
    </div>
  );
});