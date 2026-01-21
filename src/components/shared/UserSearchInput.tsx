'use client';

import { useEffect, useMemo, useState } from 'react';
import type { DirectoryUser } from '@/types/userDirectory';

type Props = {
  value: string;
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSelect: (user: DirectoryUser) => void;
};

export function UserSearchInput({
  value,
  placeholder = 'Search users by name or email',
  disabled,
  onChange,
  onSelect,
}: Props) {
  const [results, setResults] = useState<DirectoryUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const trimmedValue = useMemo(() => value.trim(), [value]);

  useEffect(() => {
    if (disabled) {
      setResults([]);
      return;
    }
    if (trimmedValue.length < 2) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(trimmedValue)}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          setResults([]);
          return;
        }
        const data = await res.json();
        setResults(Array.isArray(data.users) ? data.users : []);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [disabled, trimmedValue]);

  const showResults = isFocused && (results.length > 0 || isLoading || trimmedValue.length >= 2);

  return (
    <div className="relative w-56">
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setTimeout(() => setIsFocused(false), 120);
        }}
        className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
        disabled={disabled}
        autoComplete="off"
      />
      {showResults ? (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-md dark:border-slate-700 dark:bg-slate-900">
          {isLoading ? (
            <div className="px-2 py-2 text-xs text-slate-500 dark:text-slate-400">
              Searching...
            </div>
          ) : null}
          {!isLoading && results.length === 0 ? (
            <div className="px-2 py-2 text-xs text-slate-500 dark:text-slate-400">
              No matches
            </div>
          ) : null}
          {!isLoading
            ? results.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className="flex w-full flex-col gap-0.5 px-2 py-1 text-left text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onSelect(user);
                    setIsFocused(false);
                  }}
                >
                  <span className="font-semibold">{user.displayName}</span>
                  <span className="text-[0.65rem] text-slate-500 dark:text-slate-400">
                    {user.email ?? user.id}
                  </span>
                </button>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}
