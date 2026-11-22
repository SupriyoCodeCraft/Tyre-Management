import { useEffect, useState } from 'react';
import { Button } from '../../components/common/Button.jsx';
import { ErrorMessage } from '../../components/common/ErrorMessage.jsx';
import { LoadingState } from '../../components/common/LoadingState.jsx';
import { PageContainer } from '../../components/common/PageContainer.jsx';
import { loadPurchaseDetails } from '../../services/purchaseService.js';

export function PurchaseDetails({ purchaseId, onBack }) {
  const [purchase, setPurchase] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPurchaseDetails(purchaseId)
      .then((record) => setPurchase(record))
      .catch((loadFailure) => setError(loadFailure instanceof Error ? loadFailure.message : 'Could not load purchase details.'))
      .finally(() => setIsLoading(false));
  }, [purchaseId]);

  if (isLoading) return <LoadingState label="Loading purchase details" />;
  if (error) return <ErrorMessage title="Purchase details unavailable">{error}</ErrorMessage>;
  if (!purchase) return <ErrorMessage title="Purchase not found">This purchase may have been removed from local storage.</ErrorMessage>;

  return (
    <>
      <PageContainer
        eyebrow="Purchase details"
        title={purchase.invoiceNumber}
        description="Completed purchase records are not editable in this prototype."
      >
        <Button variant="secondary" onClick={onBack}>Back to register</Button>
      </PageContainer>
      <section className="details-panel" aria-label="Purchase information">
        <dl className="details-grid">
          <div><dt>Vendor</dt><dd>{purchase.vendor?.name ?? 'Vendor unavailable'}</dd></div>
          <div><dt>Purchase date</dt><dd>{purchase.purchaseDate}</dd></div>
          <div><dt>Brand</dt><dd>{purchase.brand}</dd></div>
          <div><dt>Model</dt><dd>{purchase.model}</dd></div>
          <div><dt>Price</dt><dd>{purchase.price}</dd></div>
          <div><dt>Registered tyres</dt><dd>{purchase.tyres.length}</dd></div>
        </dl>
      </section>
      <section className="dashboard-section" aria-labelledby="purchase-tyres-heading">
        <div className="section-heading"><div><h2 id="purchase-tyres-heading">Associated tyres</h2><p>Serial numbers and initial tread readings.</p></div></div>
        <div className="table-wrap responsive-table-wrap">
          <table className="data-table responsive-table">
            <thead><tr><th>Serial number</th><th>Brand</th><th>Model</th><th>Initial NSD</th></tr></thead>
            <tbody>
              {purchase.tyres.map((tyre) => (
                <tr key={tyre.id}><td className="serial-cell" data-label="Serial number">{tyre.serialNumber}</td><td data-label="Brand">{tyre.brand}</td><td data-label="Model">{tyre.model}</td><td data-label="Initial NSD">{tyre.initialNsd}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
