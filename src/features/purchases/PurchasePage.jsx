import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/common/Button.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { ErrorMessage } from '../../components/common/ErrorMessage.jsx';
import { Input } from '../../components/common/Input.jsx';
import { LoadingState } from '../../components/common/LoadingState.jsx';
import { PageContainer } from '../../components/common/PageContainer.jsx';
import { loadPurchaseVendors, loadPurchases } from '../../services/purchaseService.js';
import { ExistingTyreForm } from './ExistingTyreForm.jsx';
import { PurchaseDetails } from './PurchaseDetails.jsx';
import { PurchaseForm } from './PurchaseForm.jsx';

export function PurchasePage() {
  const [purchases, setPurchases] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('list');
  const [selectedPurchaseId, setSelectedPurchaseId] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  async function refreshRegister() {
    setError('');
    setIsLoading(true);
    try {
      const [purchaseRecords, vendorRecords] = await Promise.all([loadPurchases(), loadPurchaseVendors()]);
      setPurchases(purchaseRecords);
      setVendors(vendorRecords);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load the purchase register.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refreshRegister();
  }, []);

  const filteredPurchases = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return purchases;
    return purchases.filter((purchase) => [
      purchase.invoiceNumber,
      purchase.vendor?.name,
      purchase.brand,
      purchase.model,
      ...purchase.tyres.map((tyre) => tyre.serialNumber),
    ].some((value) => String(value ?? '').toLocaleLowerCase().includes(query)));
  }, [purchases, search]);

  async function handlePurchaseSaved() {
    setView('list');
    setSelectedPurchaseId('');
    setNotice('Purchase and associated tyres were saved.');
    await refreshRegister();
  }

  function handleTyreSaved(tyre) {
    setView('list');
    setNotice(`Tyre ${tyre.serialNumber} was registered without a purchase.`);
  }

  if (view === 'details' && selectedPurchaseId) {
    return <PurchaseDetails purchaseId={selectedPurchaseId} onBack={() => setView('list')} />;
  }

  return (
    <>
      <PageContainer
        eyebrow="Business module"
        title="Purchase Register"
        description="Record completed purchases and register each associated tyre."
      >
        {view === 'list' && (
          <div className="page-actions">
            <Button variant="secondary" onClick={() => { setNotice(''); setView('existing-tyre'); }}>
              Register existing tyre
            </Button>
            <Button onClick={() => { setNotice(''); setView('create'); }}>Add purchase</Button>
          </div>
        )}
        {view !== 'list' && <Button variant="secondary" onClick={() => setView('list')}>Back to register</Button>}
      </PageContainer>

      {notice && <div className="success-message" role="status">{notice}</div>}
      {error && <ErrorMessage title="Purchase register unavailable">{error}</ErrorMessage>}

      {view === 'create' && (
        <PurchaseForm
          vendors={vendors}
          onCancel={() => setView('list')}
          onSaved={handlePurchaseSaved}
        />
      )}

      {view === 'existing-tyre' && (
        <ExistingTyreForm
          onCancel={() => setView('list')}
          onSaved={handleTyreSaved}
        />
      )}

      {view === 'list' && (
        <>
          <section className="register-toolbar" aria-label="Purchase search">
            <Input
              id="purchase-search"
              label="Search purchases"
              type="search"
              placeholder="Invoice, vendor, brand, model, or tyre serial"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <span className="result-count">{filteredPurchases.length} {filteredPurchases.length === 1 ? 'purchase' : 'purchases'}</span>
          </section>

          {isLoading ? <LoadingState label="Loading purchase register" /> : filteredPurchases.length === 0 ? (
            <EmptyState
              title={search ? 'No matching purchases' : 'No purchases recorded yet'}
              description={search
                ? 'Try another invoice, vendor, product, or tyre serial search.'
                : 'Add a purchase to register its tyres, or register an existing tyre independently.'}
            />
          ) : (
            <div className="table-wrap responsive-table-wrap">
              <table className="data-table responsive-table">
                <thead>
                  <tr><th>Invoice</th><th>Vendor</th><th>Purchase date</th><th>Brand / model</th><th>Price</th><th>Tyres</th><th><span className="sr-only">Actions</span></th></tr>
                </thead>
                <tbody>
                  {filteredPurchases.map((purchase) => (
                    <tr key={purchase.id}>
                      <td data-label="Invoice"><button className="table-link" type="button" onClick={() => { setSelectedPurchaseId(purchase.id); setView('details'); }}>{purchase.invoiceNumber}</button></td>
                      <td data-label="Vendor">{purchase.vendor?.name ?? 'Vendor unavailable'}</td>
                      <td data-label="Purchase date">{purchase.purchaseDate}</td>
                      <td data-label="Brand / model">{purchase.brand} · {purchase.model}</td>
                      <td data-label="Price">{purchase.price}</td>
                      <td data-label="Tyres">{purchase.tyreCount}</td>
                      <td data-label="Details"><Button variant="secondary" onClick={() => { setSelectedPurchaseId(purchase.id); setView('details'); }}>View</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
