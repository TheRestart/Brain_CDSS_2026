import EncounterListWidget from './EncounterListWidget';
import '@/assets/style/encounterListView.css';

export default function EncounterListPage() {
  return (
    <div className="page">
      <div className="content">
        <EncounterListWidget
          title=""
          size="full"
          showPagination={true}
          showFilters={true}
          showCreateButton={true}
          sortable={true}
        />
      </div>
    </div>
  );
}
