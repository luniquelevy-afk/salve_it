// Matchers DOM (toBeInTheDocument, etc.) et nettoyage du DOM entre les tests.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());
