export function ErrorMessage({ title = 'Something went wrong', children }) {
  return <div className="error-message" role="alert"><strong>{title}</strong>{children && <p>{children}</p>}</div>;
}
