// Icônes de la landing page : les SVG (Solar + twemoji) sont bundlés depuis
// src/assets/landing/icons et inlinés, pour que `currentColor` suive la couleur
// de texte (comme dans le design) sans dépendance au CDN Iconify (ENF-03).
const modules = import.meta.glob('../../assets/landing/icons/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

// Clé = nom de fichier sans extension, ex. « solar-check-circle-bold ».
const ICONS: Record<string, string> = {};
for (const [path, svg] of Object.entries(modules)) {
  const key = path.split('/').pop()!.replace('.svg', '');
  ICONS[key] = svg;
}

// « solar:check-circle-bold » → « solar-check-circle-bold ».
function fileKey(name: string): string {
  return name.replace(':', '-');
}

export function Icon({ name, size = 16, className = '' }: { name: string; size?: number; className?: string }) {
  const svg = ICONS[fileKey(name)];
  if (!svg) return null;
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ fontSize: `${size}px`, width: `${size}px`, height: `${size}px`, lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
