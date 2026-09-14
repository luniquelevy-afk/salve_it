import { Link } from 'react-router-dom';
import { usePublicSite } from '../../lib/public-site';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export function FaqPage() {
  const { site, failed } = usePublicSite();
  useDocumentTitle('Questions fréquentes', site?.settings.centreName);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-12">
      <h1 className="text-3xl font-extrabold">Questions fréquentes</h1>
      {failed && <p className="text-rosso">Impossible de charger la FAQ.</p>}
      <div className="space-y-2">
        {site?.faq.map((item) => (
          <details key={item.id} className="card group">
            <summary className="cursor-pointer list-none font-semibold marker:hidden">
              <span className="flex items-center justify-between gap-3">
                {item.question}
                <span aria-hidden className="text-verde transition group-open:rotate-45">+</span>
              </span>
            </summary>
            <p className="mt-3 whitespace-pre-line text-stone-700">{item.answer}</p>
          </details>
        ))}
      </div>
      <p className="text-stone-600">
        Vous ne trouvez pas votre réponse ?{' '}
        <Link to="/contact" className="text-verde-dark hover:underline">
          Contactez-nous
        </Link>
        .
      </p>
    </div>
  );
}

export function GalleryPage() {
  const { site } = usePublicSite();
  useDocumentTitle('Galerie', site?.settings.centreName);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-12">
      <h1 className="text-3xl font-extrabold">Galerie</h1>
      {site && site.gallery.length === 0 && <p className="text-stone-500">Aucune photo pour le moment.</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {site?.gallery.map((image) => (
          <figure key={image.id} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
            <img src={image.imageUrl} alt={image.altText} loading="lazy" className="aspect-[4/3] w-full object-cover" />
            {image.caption && <figcaption className="px-3 py-2 text-sm text-stone-600">{image.caption}</figcaption>}
          </figure>
        ))}
      </div>
    </div>
  );
}
