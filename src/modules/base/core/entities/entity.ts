export abstract class Entity {
  abstract readonly id: string;
  abstract readonly createdAt: Date;
  abstract readonly updatedAt: Date;
  abstract readonly deletedAt: Date | null;
}
