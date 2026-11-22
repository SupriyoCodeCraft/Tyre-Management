export function PageContainer({ eyebrow, title, description, children }) {
  return (
    <section className="page-container" aria-labelledby="page-title">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <div className="page-heading">
        <div>
          <h1 id="page-title">{title}</h1>
          {description && <p className="page-description">{description}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}
