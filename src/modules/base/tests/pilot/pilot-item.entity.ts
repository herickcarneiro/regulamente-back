import { Entity } from '../../core/entities/entity';

export type PilotItemProps = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export class PilotItem extends Entity {
  readonly id: string;
  readonly name: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;

  private constructor(props: PilotItemProps) {
    super();
    this.id = props.id;
    this.name = props.name;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.deletedAt = props.deletedAt;
  }

  static create(name: string, id = crypto.randomUUID()): PilotItem {
    const now = new Date();
    return new PilotItem({
      id,
      name,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  static restore(props: PilotItemProps): PilotItem {
    return new PilotItem(props);
  }

  rename(name: string): PilotItem {
    return new PilotItem({
      ...this,
      name,
      updatedAt: new Date(),
    });
  }
}
