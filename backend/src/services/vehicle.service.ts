import { VehicleNotFoundError } from '../domain/errors.js';
import type { PageRequest, Paginated } from '../domain/pagination.js';
import type { BodyStyle, Category, Vehicle } from '../domain/vehicle.js';
import type {
  VehicleFilter,
  VehiclePatch,
  VehicleRepository,
} from '../repositories/vehicle.repository.js';

export type CreateVehicleInput = {
  make: string;
  model: string;
  category: Category;
  price: number;
  quantity: number;
  year?: number | undefined;
  bodyStyle?: BodyStyle | undefined;
  colorOptions: string[];
  description?: string | undefined;
};

export type VehicleSearch = Omit<VehicleFilter, 'terms'> & { q?: string | undefined };

export class VehicleService {
  constructor(private readonly vehicles: VehicleRepository) {}

  /** The body style falls back to the category, so the API never requires illustration details. */
  create(input: CreateVehicleInput, actorId: string): Promise<Vehicle> {
    return this.vehicles.create(
      {
        ...input,
        year: input.year ?? null,
        description: input.description ?? null,
        bodyStyle: input.bodyStyle ?? input.category,
      },
      actorId,
    );
  }

  async update(id: string, patch: VehiclePatch, actorId: string): Promise<Vehicle> {
    const vehicle = await this.vehicles.update(id, patch, actorId);
    if (!vehicle) throw new VehicleNotFoundError();
    return vehicle;
  }

  /** Soft delete: the row stays so orders and the ledger keep pointing at it. */
  async delete(id: string, actorId: string): Promise<void> {
    if (!(await this.vehicles.softDelete(id, actorId))) throw new VehicleNotFoundError();
  }

  async get(id: string): Promise<Vehicle> {
    const vehicle = await this.vehicles.findById(id);
    if (!vehicle) throw new VehicleNotFoundError();
    return vehicle;
  }

  list(request: PageRequest): Promise<Paginated<Vehicle>> {
    return this.page(request);
  }

  /** `q` is split into words; every word must appear in the make or the model, in any order. */
  search(query: VehicleSearch, request: PageRequest): Promise<Paginated<Vehicle>> {
    const { q, ...rest } = query;
    return this.page(request, { ...rest, terms: q?.split(/\s+/).filter(Boolean) ?? [] });
  }

  private async page(request: PageRequest, filter?: VehicleFilter): Promise<Paginated<Vehicle>> {
    const { items, total } = await this.vehicles.findMany(request, filter);
    return {
      data: items,
      meta: {
        page: request.page,
        pageSize: request.pageSize,
        total,
        totalPages: Math.ceil(total / request.pageSize),
      },
    };
  }
}
