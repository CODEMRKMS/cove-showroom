import { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  useAllVehicles,
  useCreateVehicle,
  useDeleteVehicle,
  useInventoryEvents,
  useRestockVehicle,
  useUpdateVehicle,
} from '../api/inventory';
import type { InventoryEvent, Vehicle } from '../api/types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { RestockDialog } from '../components/RestockDialog';
import { StockText } from '../components/VehicleCard';
import { btnPrimary, btnQuiet, field, label } from '../components/styles';
import { useToast } from '../components/Toast';
import { VehicleFormDialog } from '../components/VehicleFormDialog';
import { CATEGORY_LABELS } from '../lib/labels';
import { apiErrorMessage } from '../lib/messages';
import { formatINR } from '../lib/money';
import { stockState } from '../lib/stock';
import { useDocumentTitle } from '../lib/useDocumentTitle';

type Dialog = { kind: 'add' } | { kind: 'edit' | 'restock' | 'delete'; vehicle: Vehicle } | null;

type SortKey = 'price' | 'stock';
type Sort = { key: SortKey; direction: 'ascending' | 'descending' } | null;

export function AdminPage() {
  useDocumentTitle('Inventory');
  const vehicles = useAllVehicles();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>(null);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const matching = (vehicles.data ?? []).filter(
      (v) => !needle || `${v.make} ${v.model}`.toLowerCase().includes(needle),
    );
    if (!sort) return matching;
    const sign = sort.direction === 'ascending' ? 1 : -1;
    const value = (v: Vehicle) => (sort.key === 'price' ? v.price : v.quantity);
    return [...matching].sort((a, b) => sign * (value(a) - value(b)));
  }, [vehicles.data, search, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((current) =>
      current?.key === key && current.direction === 'ascending'
        ? { key, direction: 'descending' }
        : { key, direction: 'ascending' },
    );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Inventory</h1>
          <p className="mt-1 text-graphite">
            Add cars, change their details, restock or remove them.
          </p>
        </div>
        <button type="button" className={btnPrimary} onClick={() => setDialog({ kind: 'add' })}>
          Add to inventory
        </button>
      </div>

      {vehicles.isError ? (
        <div role="alert" className="rounded-card border border-sold bg-white/70 p-5">
          <p className="font-semibold text-sold">{apiErrorMessage(vehicles.error)}</p>
          <button type="button" className={`${btnPrimary} mt-3`} onClick={() => vehicles.refetch()}>
            Try again
          </button>
        </div>
      ) : vehicles.isPending ? (
        <div role="status" aria-label="Loading inventory">
          <div aria-hidden="true" className="h-48 animate-pulse rounded-card bg-floor/70" />
        </div>
      ) : (
        <>
          <SummaryTiles vehicles={vehicles.data} />
          <div className="max-w-md">
            <label htmlFor="inventory-search" className={label}>
              Search inventory
            </label>
            <input
              id="inventory-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={field}
              placeholder="Make or model"
            />
          </div>
          <InventoryTable
            rows={rows}
            sort={sort}
            onSort={toggleSort}
            onAction={(kind, vehicle) => setDialog({ kind, vehicle })}
          />
        </>
      )}

      <ActivityFeed />

      {dialog?.kind === 'add' && <AddDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === 'edit' && (
        <EditDialog vehicle={dialog.vehicle} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'restock' && (
        <RestockVehicleDialog vehicle={dialog.vehicle} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'delete' && (
        <DeleteDialog vehicle={dialog.vehicle} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

function SummaryTiles({ vehicles }: { vehicles: Vehicle[] }) {
  const tiles = [
    { name: 'Vehicles', value: vehicles.length },
    { name: 'Units in stock', value: vehicles.reduce((sum, v) => sum + v.quantity, 0) },
    { name: 'Low stock', value: vehicles.filter((v) => stockState(v.quantity) === 'low').length },
    {
      name: 'Sold out',
      value: vehicles.filter((v) => stockState(v.quantity) === 'sold-out').length,
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {tiles.map((tile) => (
        <Tile key={tile.name} name={tile.name} value={tile.value} />
      ))}
    </div>
  );
}

function Tile({ name, value }: { name: string; value: number }) {
  const id = `tile-${name.replaceAll(' ', '-').toLowerCase()}`;
  return (
    <div role="group" aria-labelledby={id} className="rounded-card bg-floor/60 p-4 shadow-cove">
      <p id={id} className="text-graphite">
        {name}
      </p>
      <p className="font-display text-3xl tabular-nums">{value}</p>
    </div>
  );
}

function InventoryTable({
  rows,
  sort,
  onSort,
  onAction,
}: {
  rows: Vehicle[];
  sort: Sort;
  onSort: (key: SortKey) => void;
  onAction: (kind: 'edit' | 'restock' | 'delete', vehicle: Vehicle) => void;
}) {
  if (rows.length === 0) {
    return <p className="rounded-card bg-floor/60 p-6 text-graphite">No cars match this search.</p>;
  }
  const sortHeader = (key: SortKey, text: string) => (
    <th
      scope="col"
      aria-sort={sort?.key === key ? sort.direction : undefined}
      className="px-3 py-2 text-left"
    >
      <button
        type="button"
        aria-label={`Sort by ${text}`}
        onClick={() => onSort(key)}
        className="inline-flex min-h-11 items-center gap-1 font-semibold underline decoration-dotted"
      >
        {text}
        <span aria-hidden="true">
          {sort?.key === key ? (sort.direction === 'ascending' ? '▲' : '▼') : ''}
        </span>
      </button>
    </th>
  );
  const cell =
    'px-3 py-2 max-md:flex max-md:items-center max-md:justify-between max-md:gap-4 max-md:before:font-semibold max-md:before:content-[attr(data-label)]';
  return (
    <table className="w-full border-collapse">
      <caption className="sr-only">Cars in the inventory</caption>
      <thead className="max-md:sr-only">
        <tr className="border-b border-graphite/40">
          <th scope="col" className="px-3 py-2 text-left">
            Car
          </th>
          <th scope="col" className="px-3 py-2 text-left">
            Category
          </th>
          {sortHeader('price', 'Price')}
          {sortHeader('stock', 'Stock')}
          <th scope="col" className="px-3 py-2 text-left">
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((vehicle) => {
          const name = `${vehicle.make} ${vehicle.model}`;
          return (
            <tr
              key={vehicle.id}
              className="border-b border-graphite/20 max-md:mb-3 max-md:block max-md:rounded-card max-md:bg-floor/60 max-md:p-3"
            >
              <th scope="row" className={`${cell} text-left font-semibold`} data-label="Car">
                {name}
              </th>
              <td className={cell} data-label="Category">
                {CATEGORY_LABELS[vehicle.category]}
              </td>
              <td className={`${cell} tabular-nums`} data-label="Price">
                {formatINR(vehicle.price)}
              </td>
              <td className={cell} data-label="Stock">
                <StockText quantity={vehicle.quantity} />
              </td>
              <td className={`${cell} max-md:flex-wrap`} data-label="Actions">
                <span className="flex flex-wrap gap-2">
                  {(['edit', 'restock', 'delete'] as const).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      className={btnQuiet}
                      onClick={() => onAction(kind, vehicle)}
                    >
                      {kind.charAt(0).toUpperCase() + kind.slice(1)}{' '}
                      <span className="sr-only">{name}</span>
                    </button>
                  ))}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function AddDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateVehicle();
  const toast = useToast();
  return (
    <VehicleFormDialog
      onCancel={onClose}
      onSubmit={async (input) => {
        const vehicle = await create.mutateAsync(input);
        onClose();
        toast.success(`Added ${vehicle.make} ${vehicle.model} to the inventory.`);
      }}
    />
  );
}

function EditDialog({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const update = useUpdateVehicle(vehicle.id);
  const toast = useToast();
  return (
    <VehicleFormDialog
      vehicle={vehicle}
      onCancel={onClose}
      onSubmit={async (input) => {
        const saved = await update.mutateAsync(input);
        onClose();
        toast.success(`Saved changes to ${saved.make} ${saved.model}.`);
      }}
    />
  );
}

function RestockVehicleDialog({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const restock = useRestockVehicle(vehicle.id);
  const toast = useToast();
  return (
    <RestockDialog
      vehicle={vehicle}
      onCancel={onClose}
      onRestock={async (quantity) => {
        const saved = await restock.mutateAsync(quantity);
        onClose();
        toast.success(`Restocked ${saved.make} ${saved.model}: ${saved.quantity} in stock.`);
      }}
    />
  );
}

function DeleteDialog({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const remove = useDeleteVehicle(vehicle.id);
  const toast = useToast();
  const name = `${vehicle.make} ${vehicle.model}`;
  return (
    <ConfirmDialog
      title={`Delete ${name}?`}
      confirmLabel={`Delete ${name}`}
      danger
      busy={remove.isPending}
      onCancel={onClose}
      onConfirm={() =>
        remove.mutate(undefined, {
          onSuccess: () => {
            onClose();
            toast.success(`Deleted ${name}.`);
          },
          onError: (error) => {
            onClose();
            toast.error(apiErrorMessage(error));
          },
        })
      }
    >
      <p>{name} will disappear from the showroom. Orders already placed keep their record of it.</p>
    </ConfirmDialog>
  );
}

const EVENT_VERB: Record<InventoryEvent['type'], string> = {
  CREATED: 'added',
  UPDATED: 'edited',
  PURCHASED: 'bought',
  RESTOCKED: 'restocked',
  DELETED: 'deleted',
};

function describeEvent(event: InventoryEvent): string {
  const car = `${event.vehicle.make} ${event.vehicle.model}`;
  const start = `${event.actor.name} ${EVENT_VERB[event.type]} ${car}`;
  if (event.type === 'UPDATED' || event.type === 'DELETED') return start;
  const delta = `${event.delta > 0 ? '+' : ''}${event.delta}`;
  return `${start}: ${delta}, ${event.quantityAfter} in stock`;
}

const timeFormat = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

function ActivityFeed() {
  const events = useInventoryEvents();
  const { state } = useAuth();
  return (
    <section aria-labelledby="activity-heading">
      <h2 id="activity-heading" className="font-display text-xl">
        Recent activity
      </h2>
      {state.status !== 'authenticated' || events.isPending ? (
        <p role="status" className="mt-3 text-graphite">
          Loading activity…
        </p>
      ) : events.isError ? (
        <p role="alert" className="mt-3 font-semibold text-sold">
          {apiErrorMessage(events.error)}
        </p>
      ) : events.data.length === 0 ? (
        <p className="mt-3 text-graphite">No activity yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-graphite/20">
          {events.data.map((event) => (
            <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
              <p>{describeEvent(event)}</p>
              <time dateTime={event.createdAt} className="text-sm text-graphite">
                {timeFormat.format(new Date(event.createdAt))}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
