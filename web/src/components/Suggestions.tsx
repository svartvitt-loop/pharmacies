import type { ReactNode } from "react";

interface Props<T> {
  items: T[];
  itemKey: (item: T) => string;
  onPick: (item: T) => void;
  children: (item: T) => ReactNode;
}

/** The drop-down under a search box; the first item is highlighted, as Enter picks it. */
export function Suggestions<T>({ items, itemKey, onPick, children }: Props<T>) {
  return (
    <ul className="suggestions" role="listbox" hidden={!items.length}>
      {items.map((item) => (
        <li
          key={itemKey(item)}
          role="option"
          aria-selected={false}
          // mousedown fires before the input's blur hides the list.
          onMouseDown={(event) => {
            event.preventDefault();
            onPick(item);
          }}
        >
          {children(item)}
        </li>
      ))}
    </ul>
  );
}
