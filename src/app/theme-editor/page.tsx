import { Suspense } from 'react';
import ThemeEditorClient from './ThemeEditorClient';

export default function ThemeEditorPage() {
  return (
    <Suspense>
      <ThemeEditorClient />
    </Suspense>
  );
}
