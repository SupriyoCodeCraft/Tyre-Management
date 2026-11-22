import { Link } from 'react-router-dom';
import { PageContainer } from '../../components/common/PageContainer.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { routePaths } from '../../app/routePaths.js';

const moduleShortcuts = [
  {
    to: routePaths.inspection,
    icon: '◉',
    title: 'Vehicle Live Inspection',
    description: 'Record tyre readings during a vehicle inspection.',
    action: 'Open inspections',
  },
  {
    to: routePaths.purchases,
    icon: '＋',
    title: 'Purchase Register',
    description: 'Review purchases and their associated tyres.',
    action: 'Open purchases',
  },
  {
    to: routePaths.tyreHistory,
    icon: '↻',
    title: 'Tyre History',
    description: 'Follow the recorded events for a tyre.',
    action: 'Search tyre history',
  },
  {
    to: routePaths.scrapAnalysis,
    icon: '▤',
    title: 'Scrap Analysis',
    description: 'Review tyre scrap records and evidence.',
    action: 'Open scrap analysis',
  },
];

export function DashboardPage() {
  return (
    <>
      <PageContainer
        eyebrow="Operator dashboard"
        title="Welcome to Tyre Management"
        description="Manage tyre inspections, purchases, history, and scrap records across your business clients and sites. Choose a workspace to get started."
      />
      <section className="dashboard-section" aria-labelledby="modules-heading">
        <div className="section-heading">
          <div>
            <h2 id="modules-heading">Your workspaces</h2>
            <p>Open one of the four operational modules.</p>
          </div>
        </div>
        <div className="module-grid">
          {moduleShortcuts.map((module) => (
            <Link className="module-card" key={module.to} to={module.to}>
              <span className="module-icon" aria-hidden="true">{module.icon}</span>
              <span className="module-card-content">
                <span className="module-card-title">{module.title}</span>
                <span className="module-card-description">{module.description}</span>
                <span className="module-card-action">{module.action} <span aria-hidden="true">→</span></span>
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="dashboard-section overview-section" aria-labelledby="overview-heading">
        <div className="section-heading">
          <div>
            <h2 id="overview-heading">Overview</h2>
            <p>Operational summaries will be available when record workflows are added.</p>
          </div>
        </div>
        <EmptyState
          title="No overview data yet"
          description="This prototype does not contain business records or activity data."
        />
      </section>
    </>
  );
}
